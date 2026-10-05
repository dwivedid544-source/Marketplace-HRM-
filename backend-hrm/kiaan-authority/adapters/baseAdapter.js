/**
 * Kiaan Central License Authority — Base Sales Channel Adapter
 * Module: backend-hrm/kiaan-authority/adapters/baseAdapter.js
 *
 * Defines the foundational SalesChannelAdapter contract and shared normalization,
 * security sanitization, and fail-closed payment status translation utilities.
 *
 * Security & Architectural Guarantees:
 * 1. Interface Uniformity: Guarantees every sales channel normalizes disparate provider
 *    payloads into the canonical schema required by `CanonicalOrderDTO`.
 * 2. Fail-Closed Payment Normalization: Strictly translates provider states into
 *    PAID, PENDING, REFUNDED, or DISPUTED. Never fails open or assumes unknown states are PAID.
 * 3. Prototype Pollution Defense: Detects and rejects malicious prototype poisoning vectors.
 * 4. Input Sanitization & Boundary Validation: Guards against oversized payloads, excessive
 *    nesting depth, and malformed structures before invoking the canonical DTO.
 * 5. Deterministic Catalog Resolution: Integrates with SkuResolver to guarantee zero
 *    guessing on product IDs, commercial editions, or SKUs.
 * 6. Multi-SKU Protection: Prevents unverified cart splitting and preserves source order identity.
 */

'use strict';

const { CanonicalOrderDTO, createCanonicalOrderDTO } = require('../core/orderDto');
const { defaultSkuResolver } = require('./skuResolver');

/**
 * Maximum permitted JSON payload length (256 KB) to prevent memory exhaustion attacks.
 */
const MAX_PAYLOAD_SERIALIZED_BYTES = 256 * 1024;

/**
 * Maximum recursion depth allowed during nested object inspection.
 */
const MAX_OBJECT_DEPTH = 10;

/**
 * Strict provider-to-canonical payment status translation map.
 * All strings are lowercased and trimmed before lookup.
 */
const PAYMENT_STATUS_MAP = Object.freeze({
    // Paid states
    'paid': 'PAID',
    'captured': 'PAID',
    'complete': 'PAID',
    'completed': 'PAID',
    'success': 'PAID',
    'succeeded': 'PAID',
    'active': 'PAID',
    'activate': 'PAID',
    'settled': 'PAID',

    // Pending states
    'pending': 'PENDING',
    'awaiting': 'PENDING',
    'awaiting_payment': 'PENDING',
    'created': 'PENDING',
    'authorized': 'PENDING',
    'in_process': 'PENDING',
    'processing': 'PENDING',

    // Refunded states
    'refunded': 'REFUNDED',
    'reversed': 'REFUNDED',
    'refund': 'REFUNDED',
    'cancelled': 'REFUNDED',
    'canceled': 'REFUNDED',

    // Disputed states
    'dispute': 'DISPUTED',
    'disputed': 'DISPUTED',
    'chargeback': 'DISPUTED',
    'claim': 'DISPUTED'
});

/**
 * Creates an error instance with an explicit adapter error code.
 *
 * @param {string} code Error identifier
 * @param {string} message Descriptive failure message
 * @param {*} [details] Optional error details
 * @returns {Error}
 */
function createAdapterError(code, message, details) {
    const err = new Error(`${code}: ${message}`);
    err.code = code;
    if (details !== undefined) {
        err.details = details;
    }
    return err;
}

/**
 * Strictly normalizes provider payment statuses into the canonical set:
 * PAID, PENDING, REFUNDED, DISPUTED.
 *
 * SECURITY REQUIREMENT (Fail-Closed):
 * If the status is missing, unknown, or ambiguous, this function THROWS.
 * It will NEVER fail open by defaulting to PAID.
 *
 * @param {*} rawStatus Raw status string from provider
 * @returns {'PAID'|'PENDING'|'REFUNDED'|'DISPUTED'} Canonical payment status
 * @throws {Error} If status is missing, invalid, or unrecognized
 */
function normalizePaymentStatus(rawStatus) {
    if (rawStatus === null || rawStatus === undefined || typeof rawStatus !== 'string' || !rawStatus.trim()) {
        throw createAdapterError(
            'INVALID_PAYMENT_STATUS',
            'Payment status is required and cannot be empty.'
        );
    }

    const normalized = rawStatus.trim().toLowerCase();
    const mapped = PAYMENT_STATUS_MAP[normalized];

    if (!mapped) {
        throw createAdapterError(
            'INVALID_PAYMENT_STATUS',
            `Unrecognized payment status '${rawStatus}'. Unknown provider states must not be treated as PAID.`
        );
    }

    return mapped;
}

/**
 * Validates payload security properties against prototype pollution and oversized data.
 *
 * @param {*} payload Arbitrary provider payload
 * @param {number} [depth=0] Current recursion depth
 * @throws {Error} If prototype pollution, excessive nesting, or oversized payload is detected
 */
function validatePayloadSecurity(payload, depth = 0) {
    if (depth > MAX_OBJECT_DEPTH) {
        throw createAdapterError(
            'PAYLOAD_NESTING_EXCEEDED',
            `Payload exceeds maximum allowable object depth of ${MAX_OBJECT_DEPTH}.`
        );
    }

    if (payload === null || payload === undefined) {
        return;
    }

    if (typeof payload === 'object') {
        // Reject unsafe prototype properties
        for (const key of Object.getOwnPropertyNames(payload)) {
            if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
                throw createAdapterError(
                    'PROTOTYPE_POLLUTION_DETECTED',
                    `Malicious prototype property '${key}' detected in payload.`
                );
            }
        }

        if (Array.isArray(payload)) {
            for (const item of payload) {
                validatePayloadSecurity(item, depth + 1);
            }
        } else {
            for (const val of Object.values(payload)) {
                validatePayloadSecurity(val, depth + 1);
            }
        }
    }
}

/**
 * Base Abstract Sales Channel Adapter.
 * Provides the core orchestration pipeline for normalizing marketplace orders.
 */
class BaseSalesChannelAdapter {
    /**
     * Instantiates a BaseSalesChannelAdapter.
     *
     * @param {object} [options] Adapter options
     * @param {object} [options.skuResolver] Injected SKU resolver
     * @param {object} [options.logger] Injected logger
     */
    constructor(options = {}) {
        this.skuResolver = options.skuResolver || defaultSkuResolver;
        this.logger = options.logger || console;
    }

    /**
     * Returns the unique sales channel identifier registered in `marketplace_sales_channels`.
     * Must be implemented by concrete subclasses.
     *
     * @returns {string} Channel identifier (e.g. 'kiaan_direct', 'codecanyon', 'appsumo', 'manual_b2b')
     * @abstract
     */
    getChannelId() {
        throw new Error('getChannelId() must be implemented by subclass.');
    }

    /**
     * Returns the human-readable display name of this sales channel.
     *
     * @returns {string} Channel display name
     */
    getChannelName() {
        return this.getChannelId();
    }

    /**
     * Validates raw payload structure and security properties.
     *
     * @param {*} rawPayload Incoming provider payload
     * @throws {Error} If payload is malformed, oversized, or insecure
     */
    validatePayload(rawPayload) {
        if (!rawPayload || typeof rawPayload !== 'object' || Array.isArray(rawPayload)) {
            throw createAdapterError('MALFORMED_PAYLOAD', 'Payload must be a non-null plain object.');
        }

        // Verify serialized length
        try {
            const serialized = JSON.stringify(rawPayload);
            if (serialized && serialized.length > MAX_PAYLOAD_SERIALIZED_BYTES) {
                throw createAdapterError(
                    'PAYLOAD_TOO_LARGE',
                    `Payload size (${serialized.length} bytes) exceeds maximum allowable limit of ${MAX_PAYLOAD_SERIALIZED_BYTES} bytes.`
                );
            }
        } catch (e) {
            if (e.code === 'PAYLOAD_TOO_LARGE') throw e;
            throw createAdapterError('MALFORMED_PAYLOAD', 'Payload could not be safely serialized to JSON.');
        }

        // Deep security validation against prototype pollution
        validatePayloadSecurity(rawPayload);
    }

    /**
     * Normalizes a provider payment status string using fail-closed translation.
     *
     * @param {*} rawStatus Provider payment status
     * @returns {'PAID'|'PENDING'|'REFUNDED'|'DISPUTED'}
     */
    normalizePaymentStatus(rawStatus) {
        return normalizePaymentStatus(rawStatus);
    }

    /**
     * Resolves product and edition mapping via the injected SkuResolver.
     *
     * @param {object} params Lookup parameters
     * @returns {{ productId: string, editionCode: string, sku: string, editionName: string }}
     */
    resolveEditionAndSku(params) {
        return this.skuResolver.resolveEditionAndSku(params);
    }

    /**
     * Extracts and validates the external channel order identifier.
     * Must be implemented by concrete subclass.
     *
     * @param {object} rawPayload Raw payload
     * @returns {string} External order ID
     * @abstract
     */
    mapOrderIdentifier(rawPayload) {
        throw new Error('mapOrderIdentifier() must be implemented by subclass.');
    }

    /**
     * Maps product and edition from provider payload.
     * Must be implemented by concrete subclass.
     *
     * @param {object} rawPayload Raw payload
     * @returns {{ productId: string, editionCode: string, sku: string }}
     * @abstract
     */
    mapEdition(rawPayload) {
        throw new Error('mapEdition() must be implemented by subclass.');
    }

    /**
     * Maps buyer information (name, email, phone).
     * Must be implemented by concrete subclass.
     *
     * @param {object} rawPayload Raw payload
     * @returns {{ buyerName: string, buyerEmail: string, buyerPhone: string|null }}
     * @abstract
     */
    mapBuyer(rawPayload) {
        throw new Error('mapBuyer() must be implemented by subclass.');
    }

    /**
     * Maps payment status with fail-closed translation.
     *
     * @param {object} rawPayload Raw payload
     * @returns {'PAID'|'PENDING'|'REFUNDED'|'DISPUTED'}
     * @abstract
     */
    mapPaymentStatus(rawPayload) {
        throw new Error('mapPaymentStatus() must be implemented by subclass.');
    }

    /**
     * Maps payment reference identifier (gateway txn, wire UTR, or verification code).
     *
     * @param {object} rawPayload Raw payload
     * @returns {string}
     * @abstract
     */
    mapPaymentReference(rawPayload) {
        throw new Error('mapPaymentReference() must be implemented by subclass.');
    }

    /**
     * Maps pricing details (unitPrice, totalPrice, currency).
     *
     * @param {object} rawPayload Raw payload
     * @param {number} quantity Quantity
     * @returns {{ unitPrice: number, totalPrice: number, currency: string }}
     */
    mapPricing(rawPayload, quantity = 1) {
        const currency = rawPayload.currency ? String(rawPayload.currency).trim().toUpperCase() : 'INR';
        const unitPrice = (rawPayload.unitPrice !== undefined && rawPayload.unitPrice !== null)
            ? Number(rawPayload.unitPrice)
            : ((rawPayload.amount !== undefined && rawPayload.amount !== null) ? Number(rawPayload.amount) : 0.00);

        const totalPrice = (rawPayload.totalPrice !== undefined && rawPayload.totalPrice !== null)
            ? Number(rawPayload.totalPrice)
            : unitPrice * quantity;

        return {
            unitPrice: Number.isFinite(unitPrice) ? Math.round(unitPrice * 100) / 100 : 0.00,
            totalPrice: Number.isFinite(totalPrice) ? Math.round(totalPrice * 100) / 100 : 0.00,
            currency
        };
    }

    /**
     * Maps quantity of software units purchased.
     *
     * @param {object} rawPayload Raw payload
     * @returns {number} Integer >= 1
     */
    mapQuantity(rawPayload) {
        const qty = rawPayload.quantity !== undefined ? rawPayload.quantity : 1;
        const parsed = Number(qty);
        if (!Number.isInteger(parsed) || parsed < 1) {
            throw createAdapterError('INVALID_QUANTITY', 'quantity must be an integer greater than or equal to 1.');
        }
        return parsed;
    }

    /**
     * Maps purchase timestamp.
     *
     * @param {object} rawPayload Raw payload
     * @returns {string} ISO timestamp string
     */
    mapPurchasedAt(rawPayload) {
        const rawTs = rawPayload.purchasedAt || rawPayload.sold_at || rawPayload.timestamp || rawPayload.created_at;
        if (rawTs instanceof Date && !isNaN(rawTs.getTime())) {
            return rawTs.toISOString();
        }
        if (typeof rawTs === 'string' && !isNaN(Date.parse(rawTs))) {
            return new Date(rawTs).toISOString();
        }
        return new Date().toISOString();
    }

    /**
     * Wraps normalized data into an immutable, strictly validated CanonicalOrderDTO.
     *
     * @param {object} normalizedData Complete normalized order data
     * @returns {CanonicalOrderDTO}
     */
    createCanonicalOrder(normalizedData) {
        return createCanonicalOrderDTO(normalizedData);
    }

    /**
     * Main pipeline method: Validates and normalizes a single-SKU raw order payload
     * into a CanonicalOrderDTO.
     *
     * Multi-SKU Protection:
     * If an external cart contains multiple distinct items/SKUs, this method rejects it with
     * UNSUPPORTED_MULTI_SKU_ORDER. Callers must use `normalizeOrderUnits` if line-item splitting
     * is explicitly supported.
     *
     * @param {object} rawPayload Provider-specific order data
     * @returns {CanonicalOrderDTO} Validated CanonicalOrderDTO
     */
    normalizeOrder(rawPayload) {
        this.validatePayload(rawPayload);

        // Multi-SKU Cart Detection
        if (
            (Array.isArray(rawPayload.items) && rawPayload.items.length > 1) ||
            (Array.isArray(rawPayload.skus) && rawPayload.skus.length > 1) ||
            Array.isArray(rawPayload.sku)
        ) {
            throw createAdapterError(
                'UNSUPPORTED_MULTI_SKU_ORDER',
                'Multi-SKU carts cannot be processed as a single canonical order. Use normalizeOrderUnits if line-item splitting is supported.'
            );
        }

        const channelOrderId = this.mapOrderIdentifier(rawPayload);
        const { productId, editionCode, sku } = this.mapEdition(rawPayload);
        const { buyerName, buyerEmail, buyerPhone } = this.mapBuyer(rawPayload);
        const quantity = this.mapQuantity(rawPayload);
        const { unitPrice, totalPrice, currency } = this.mapPricing(rawPayload, quantity);
        const paymentStatus = this.mapPaymentStatus(rawPayload);
        const paymentReference = this.mapPaymentReference(rawPayload);
        const purchasedAt = this.mapPurchasedAt(rawPayload);

        return this.createCanonicalOrder({
            salesChannelId: this.getChannelId(),
            channelOrderId,
            productId,
            editionCode,
            sku,
            quantity,
            buyerName,
            buyerEmail,
            buyerPhone,
            unitPrice,
            totalPrice,
            currency,
            paymentStatus,
            paymentReference,
            purchasedAt,
            rawPayload: rawPayload.rawPayload ? rawPayload.rawPayload : rawPayload
        });
    }

    /**
     * Normalizes a multi-line provider cart into deterministic individual CanonicalOrderDTO units
     * ONLY when stable line-item identities are available from the source payload.
     *
     * SECURITY & INTEGRITY:
     * Mutating or inventing external order IDs (e.g. ORDER-1001-1, ORDER-1001-2) without
     * provider-supplied line item identity is strictly prohibited.
     *
     * @param {object} rawPayload Multi-line cart payload
     * @returns {CanonicalOrderDTO[]} Array of normalized CanonicalOrderDTOs
     * @throws {Error} If stable line item identity is unavailable or items are ambiguous
     */
    normalizeOrderUnits(rawPayload) {
        this.validatePayload(rawPayload);

        // If not a multi-item cart, return single item array
        if (!Array.isArray(rawPayload.items) || rawPayload.items.length <= 1) {
            const singlePayload = (Array.isArray(rawPayload.items) && rawPayload.items.length === 1)
                ? { ...rawPayload, ...rawPayload.items[0], items: undefined }
                : rawPayload;
            return [this.normalizeOrder(singlePayload)];
        }

        // Multi-line cart: Check that EVERY line item has a stable, explicit source identity
        const baseOrderId = this.mapOrderIdentifier(rawPayload);
        const units = [];

        for (let idx = 0; idx < rawPayload.items.length; idx++) {
            const item = rawPayload.items[idx];
            if (!item || typeof item !== 'object') {
                throw createAdapterError(
                    'MALFORMED_LINE_ITEM',
                    `Line item at index ${idx} is not a valid object.`
                );
            }

            const lineItemId = item.line_item_id || item.lineItemId || item.id;
            if (!lineItemId || typeof lineItemId !== 'string' && typeof lineItemId !== 'number') {
                throw createAdapterError(
                    'UNSUPPORTED_MULTI_SKU_ORDER',
                    `Multi-SKU order '${baseOrderId}' cannot be safely split without stable provider line-item identifiers; mutating external order ID is prohibited.`
                );
            }

            const itemPayload = {
                ...rawPayload,
                ...item,
                orderId: `${baseOrderId}#${lineItemId}`,
                channelOrderId: `${baseOrderId}#${lineItemId}`,
                items: undefined
            };

            units.push(this.normalizeOrder(itemPayload));
        }

        return units;
    }
}

module.exports = {
    BaseSalesChannelAdapter,
    createAdapterError,
    normalizePaymentStatus,
    validatePayloadSecurity,
    PAYMENT_STATUS_MAP,
    MAX_PAYLOAD_SERIALIZED_BYTES
};
