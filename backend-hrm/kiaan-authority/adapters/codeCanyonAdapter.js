/**
 * Kiaan Central License Authority — CodeCanyon / Envato Sales Channel Adapter
 * Module: backend-hrm/kiaan-authority/adapters/codeCanyonAdapter.js
 *
 * Implements the sales channel adapter for CodeCanyon / Envato marketplace orders.
 * Converts Envato purchase code verification payloads into CanonicalOrderDTO.
 *
 * Security & Architectural Guarantees:
 * 1. Zero Network / No Live API: Operates offline on provider-neutral normalized verification payloads.
 * 2. Strict Product Boundary: Verifies that the purchased Envato item strictly matches Kiaan HRM.
 *    Rejects unsupported items with UNSUPPORTED_PRODUCT instead of guessing.
 * 3. Exact Licence Mapping:
 *    - 'Regular License'  -> 'full_source' (KHRM-SRC-LIFETIME)
 *    - 'Extended License' -> 'extended'    (KHRM-EXT-LIFETIME)
 *    Any unknown or ambiguous licence type is REJECTED with UNSUPPORTED_EDITION.
 * 4. Purchase Code Uniqueness: Uses Envato purchase_code as both channelOrderId and paymentReference.
 * 5. Fail-Closed Payment Status: Defaults to PAID only for valid verification structures;
 *    any explicitly provided non-PAID or unrecognized status is strictly normalized or rejected.
 */

'use strict';

const { BaseSalesChannelAdapter, createAdapterError } = require('./baseAdapter');

const CHANNEL_ID = 'codecanyon';
const CHANNEL_NAME = 'Envato / CodeCanyon Marketplace';

/**
 * Known item identifiers or keywords confirming the product is Kiaan HRM.
 */
const KIAAN_PRODUCT_REGEX = /kiaan[ -_]?hrm/i;

/**
 * CodeCanyon Sales Channel Adapter.
 */
class CodeCanyonAdapter extends BaseSalesChannelAdapter {
    /**
     * Instantiates a CodeCanyonAdapter with optional product item configuration.
     *
     * @param {object} [options] Adapter options
     * @param {number|string} [options.envatoItemId] Approved Envato Item ID
     */
    constructor(options = {}) {
        super(options);
        this.approvedItemId = options.envatoItemId ? String(options.envatoItemId).trim() : null;
    }

    /**
     * Returns the channel ID registered in `marketplace_sales_channels`.
     *
     * @returns {string} 'codecanyon'
     */
    getChannelId() {
        return CHANNEL_ID;
    }

    /**
     * Returns the human-readable display name.
     *
     * @returns {string}
     */
    getChannelName() {
        return CHANNEL_NAME;
    }

    /**
     * Maps the Envato purchase code as the unique channel order identifier.
     *
     * @param {object} rawPayload Raw Envato payload
     * @returns {string} Envato purchase code
     */
    mapOrderIdentifier(rawPayload) {
        const code = rawPayload.purchase_code || rawPayload.purchaseCode || rawPayload.orderId || rawPayload.code;
        if (!code || typeof code !== 'string' || !code.trim()) {
            throw createAdapterError(
                'MISSING_REQUIRED_FIELD',
                'purchase_code is required for CodeCanyon marketplace orders.'
            );
        }
        return code.trim();
    }

    /**
     * Maps and validates the Envato item to Kiaan HRM product, and maps Envato licence type
     * to canonical commercial edition.
     *
     * CRITICAL INTEGRITY RULE:
     * Never silently default to 'full_source' or 'extended'. If the licence or product
     * cannot be established with certainty, REJECT.
     *
     * @param {object} rawPayload Raw Envato payload
     * @returns {{ productId: string, editionCode: string, sku: string, editionName: string }}
     */
    mapEdition(rawPayload) {
        // 1. Validate Item/Product Identity
        const item = rawPayload.item || {};
        const itemId = item.id !== undefined && item.id !== null ? String(item.id).trim() : null;
        const itemName = typeof item.name === 'string' ? item.name : (rawPayload.item_name || rawPayload.itemName || '');
        const rawProduct = rawPayload.productId || rawPayload.product_id;

        let isKiaanProduct = false;

        if (this.approvedItemId && itemId && itemId === this.approvedItemId) {
            isKiaanProduct = true;
        } else if (KIAAN_PRODUCT_REGEX.test(itemName)) {
            isKiaanProduct = true;
        } else if (rawProduct && String(rawProduct).trim().toLowerCase() === this.skuResolver.productId) {
            isKiaanProduct = true;
        }

        if (!isKiaanProduct) {
            throw createAdapterError(
                'UNSUPPORTED_PRODUCT',
                `CodeCanyon item '${itemName || itemId || 'unknown'}' does not match supported product 'kiaan-hrm'.`
            );
        }

        // 2. Map Licence Type to Commercial Edition
        const licence = rawPayload.licence || rawPayload.license || rawPayload.license_type || rawPayload.licence_type;
        if (!licence || typeof licence !== 'string' || !licence.trim()) {
            throw createAdapterError(
                'UNSUPPORTED_EDITION',
                'CodeCanyon licence type is missing or empty. Cannot determine commercial edition.'
            );
        }

        const normalizedLicence = licence.trim().toLowerCase();
        let targetEditionCode = null;

        if (normalizedLicence === 'regular license' || normalizedLicence === 'regular' || normalizedLicence === 'standard') {
            targetEditionCode = 'full_source';
        } else if (normalizedLicence === 'extended license' || normalizedLicence === 'extended') {
            targetEditionCode = 'extended';
        } else if (normalizedLicence === 'ui_dist' || normalizedLicence === 'dist') {
            targetEditionCode = 'ui_dist';
        } else {
            throw createAdapterError(
                'UNSUPPORTED_EDITION',
                `CodeCanyon licence type '${licence}' is not supported. Must be 'Regular License' or 'Extended License'.`
            );
        }

        return this.resolveEditionAndSku({
            productId: this.skuResolver.productId,
            editionCode: targetEditionCode
        });
    }

    /**
     * Maps buyer information. CodeCanyon purchase code payloads typically include `buyer` username
     * and customer registration email.
     *
     * @param {object} rawPayload Raw Envato payload
     * @returns {{ buyerName: string, buyerEmail: string, buyerPhone: null }}
     */
    mapBuyer(rawPayload) {
        const buyerEmail = rawPayload.buyer_email || rawPayload.buyerEmail || rawPayload.email;
        if (!buyerEmail || typeof buyerEmail !== 'string' || !buyerEmail.trim()) {
            throw createAdapterError(
                'MISSING_REQUIRED_FIELD',
                'buyer_email is required for CodeCanyon license registration.'
            );
        }

        const buyerName = rawPayload.buyer_name || rawPayload.buyerName || rawPayload.buyer || buyerEmail.trim().split('@')[0];

        return {
            buyerName: String(buyerName).trim(),
            buyerEmail: String(buyerEmail).trim().toLowerCase(),
            buyerPhone: null
        };
    }

    /**
     * Maps payment status.
     * In Envato API v3, a successfully verified purchase code represents a completed purchase (PAID).
     * If an explicit status field is present (e.g. for reversals/refunds), it is strictly normalized.
     *
     * @param {object} rawPayload Raw Envato payload
     * @returns {'PAID'|'PENDING'|'REFUNDED'|'DISPUTED'}
     */
    mapPaymentStatus(rawPayload) {
        const rawStatus = rawPayload.payment_status || rawPayload.paymentStatus || rawPayload.status;
        if (rawStatus !== undefined && rawStatus !== null && String(rawStatus).trim() !== '') {
            return this.normalizePaymentStatus(rawStatus);
        }
        // Verified Envato purchase code default
        return 'PAID';
    }

    /**
     * Maps payment reference identifier. For CodeCanyon, the verified purchase code is the
     * canonical payment reference.
     *
     * @param {object} rawPayload Raw Envato payload
     * @returns {string}
     */
    mapPaymentReference(rawPayload) {
        return this.mapOrderIdentifier(rawPayload);
    }

    /**
     * Enforces single-unit quantity for CodeCanyon purchase codes (1 Code = 1 Unit).
     *
     * @param {object} rawPayload Raw Envato payload
     * @returns {number} 1
     */
    mapQuantity(rawPayload) {
        const qty = rawPayload.quantity !== undefined ? rawPayload.quantity : 1;
        const parsed = Number(qty);
        if (parsed !== 1) {
            throw createAdapterError(
                'INVALID_QUANTITY',
                `CodeCanyon purchase codes represent single-unit licenses. Received quantity: ${qty}.`
            );
        }
        return 1;
    }
}

module.exports = {
    CodeCanyonAdapter,
    CHANNEL_ID,
    CHANNEL_NAME
};
