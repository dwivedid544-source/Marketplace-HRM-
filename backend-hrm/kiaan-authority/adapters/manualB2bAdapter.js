/**
 * Kiaan Central License Authority — Manual B2B Sales Channel Adapter
 * Module: backend-hrm/kiaan-authority/adapters/manualB2bAdapter.js
 *
 * Implements the sales channel adapter for controlled manual / corporate B2B order entry.
 * Validates enterprise purchase orders, bank wire transfers, and direct contracts.
 *
 * Security & Architectural Guarantees:
 * 1. Zero Admin Bypass: Strict paymentStatus validation is preserved. An order entered with
 *    status 'PENDING' will not bypass issuance rules. Downstream issuance strictly requires 'PAID'.
 * 2. Explicit Audit Trail: Requires an explicit external paymentReference (e.g. Bank Wire UTR,
 *    purchase order number, or verified enterprise contract reference).
 * 3. Exact Canonical Contract: Emits the standard CanonicalOrderDTO schema without privileged flags.
 * 4. Deterministic Catalog Resolution: Validates product, edition, and SKU via SkuResolver.
 */

'use strict';

const { BaseSalesChannelAdapter, createAdapterError } = require('./baseAdapter');

const CHANNEL_ID = 'manual_b2b';
const CHANNEL_NAME = 'Direct B2B & Verified Corporate Orders';

/**
 * Manual B2B Sales Channel Adapter.
 */
class ManualB2bAdapter extends BaseSalesChannelAdapter {
    /**
     * Returns the channel ID registered in `marketplace_sales_channels`.
     *
     * @returns {string} 'manual_b2b'
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
     * Extracts and validates the external corporate order / invoice identifier.
     *
     * @param {object} rawPayload Raw B2B payload
     * @returns {string} B2B order/invoice number
     */
    mapOrderIdentifier(rawPayload) {
        const id = rawPayload.orderId ||
            rawPayload.channelOrderId ||
            rawPayload.invoiceNumber ||
            rawPayload.invoice_number ||
            rawPayload.id;

        if (!id || typeof id !== 'string' || !id.trim()) {
            throw createAdapterError(
                'MISSING_REQUIRED_FIELD',
                'orderId or invoiceNumber is required for Manual B2B order entry.'
            );
        }
        return id.trim();
    }

    /**
     * Maps product, edition, and SKU deterministically using SkuResolver.
     *
     * @param {object} rawPayload Raw B2B payload
     * @returns {{ productId: string, editionCode: string, sku: string, editionName: string }}
     */
    mapEdition(rawPayload) {
        const sku = rawPayload.sku;
        const editionCode = rawPayload.editionCode || rawPayload.edition_code || rawPayload.edition;
        const productId = rawPayload.productId || rawPayload.product_id || this.skuResolver.productId;

        return this.resolveEditionAndSku({ productId, editionCode, sku });
    }

    /**
     * Maps buyer contact details with strict non-empty email requirement.
     *
     * @param {object} rawPayload Raw B2B payload
     * @returns {{ buyerName: string, buyerEmail: string, buyerPhone: string|null }}
     */
    mapBuyer(rawPayload) {
        const buyerEmail = rawPayload.buyerEmail || rawPayload.buyer_email || rawPayload.email;
        if (!buyerEmail || typeof buyerEmail !== 'string' || !buyerEmail.trim()) {
            throw createAdapterError(
                'MISSING_REQUIRED_FIELD',
                'buyerEmail is required for Manual B2B order entry.'
            );
        }

        const buyerName = rawPayload.buyerName || rawPayload.buyer_name || rawPayload.companyName || rawPayload.company_name;
        if (!buyerName || typeof buyerName !== 'string' || !buyerName.trim()) {
            throw createAdapterError(
                'MISSING_REQUIRED_FIELD',
                'buyerName or companyName is required for Manual B2B order entry.'
            );
        }

        const buyerPhone = rawPayload.buyerPhone || rawPayload.buyer_phone || rawPayload.phone || null;

        return {
            buyerName: String(buyerName).trim(),
            buyerEmail: String(buyerEmail).trim().toLowerCase(),
            buyerPhone: buyerPhone ? String(buyerPhone).trim() : null
        };
    }

    /**
     * Normalizes payment status with strict fail-closed validation.
     *
     * CRITICAL SECURITY:
     * Does NOT default to PAID. The admin must explicitly specify the payment state.
     * If the payment is PENDING, it will be ingested as PENDING, and downstream license
     * issuance will correctly reject until paid.
     *
     * @param {object} rawPayload Raw B2B payload
     * @returns {'PAID'|'PENDING'|'REFUNDED'|'DISPUTED'}
     */
    mapPaymentStatus(rawPayload) {
        const status = rawPayload.paymentStatus || rawPayload.payment_status || rawPayload.status;
        if (!status || typeof status !== 'string' || !status.trim()) {
            throw createAdapterError(
                'INVALID_PAYMENT_STATUS',
                'Explicit paymentStatus is required for Manual B2B orders. Admin bypass is prohibited.'
            );
        }

        return this.normalizePaymentStatus(status);
    }

    /**
     * Extracts and validates the external payment reference (e.g. Bank Wire UTR, PO number).
     *
     * @param {object} rawPayload Raw B2B payload
     * @returns {string} Payment reference
     */
    mapPaymentReference(rawPayload) {
        const ref = rawPayload.paymentReference ||
            rawPayload.payment_reference ||
            rawPayload.utr ||
            rawPayload.wireReference ||
            rawPayload.poNumber ||
            rawPayload.po_number;

        if (!ref || typeof ref !== 'string' || !ref.trim()) {
            throw createAdapterError(
                'MISSING_REQUIRED_FIELD',
                'paymentReference (e.g. Bank Wire UTR or PO Number) is required for Manual B2B orders.'
            );
        }
        return ref.trim();
    }
}

module.exports = {
    ManualB2bAdapter,
    CHANNEL_ID,
    CHANNEL_NAME
};
