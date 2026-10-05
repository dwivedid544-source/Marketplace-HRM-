/**
 * Kiaan Central License Authority — Kiaan Direct Sales Channel Adapter
 * Module: backend-hrm/kiaan-authority/adapters/kiaanDirectAdapter.js
 *
 * Implements the sales channel adapter for Kiaan Direct storefront purchases
 * (including direct Razorpay/Stripe checkout sessions and internal webhooks).
 *
 * Security & Architectural Guarantees:
 * 1. Channel Identity: Binds to authoritative channel ID `kiaan_direct`.
 * 2. Fail-Closed Payment Normalization: Translates gateway states (`captured`, `paid`, `success`)
 *    strictly to `PAID`. Rejects ambiguous or unknown statuses.
 * 3. Deterministic Edition Resolution: Uses SkuResolver to guarantee valid SKU and edition code.
 * 4. Zero Network/External Calls: Pure data normalization; performs no HTTP or payment gateway calls.
 */

'use strict';

const { BaseSalesChannelAdapter, createAdapterError } = require('./baseAdapter');

const CHANNEL_ID = 'kiaan_direct';
const CHANNEL_NAME = 'Kiaan Direct Storefront (Razorpay/Stripe)';

/**
 * Kiaan Direct Sales Channel Adapter.
 */
class KiaanDirectAdapter extends BaseSalesChannelAdapter {
    /**
     * Returns the channel ID registered in `marketplace_sales_channels`.
     *
     * @returns {string} 'kiaan_direct'
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
     * Extracts the external channel order identifier.
     * Supports both direct DTO field names and gateway structures (Razorpay/Stripe).
     *
     * @param {object} rawPayload Raw payload
     * @returns {string}
     */
    mapOrderIdentifier(rawPayload) {
        const id = rawPayload.orderId || rawPayload.channelOrderId || rawPayload.id || (rawPayload.order && rawPayload.order.id);
        if (!id || typeof id !== 'string' || !id.trim()) {
            throw createAdapterError('MISSING_REQUIRED_FIELD', 'orderId is required for Kiaan Direct purchases.');
        }
        return id.trim();
    }

    /**
     * Resolves product, edition, and SKU deterministically.
     *
     * @param {object} rawPayload Raw payload
     * @returns {{ productId: string, editionCode: string, sku: string, editionName: string }}
     */
    mapEdition(rawPayload) {
        // Extract SKU or editionCode from top level or metadata/notes
        const sku = rawPayload.sku || (rawPayload.notes && rawPayload.notes.sku) || (rawPayload.metadata && rawPayload.metadata.sku);
        const editionCode = rawPayload.editionCode || (rawPayload.notes && rawPayload.notes.editionCode) || (rawPayload.metadata && rawPayload.metadata.editionCode);
        const productId = rawPayload.productId || (rawPayload.notes && rawPayload.notes.productId) || (rawPayload.metadata && rawPayload.metadata.productId);

        return this.resolveEditionAndSku({ productId, editionCode, sku });
    }

    /**
     * Extracts and normalizes buyer contact details.
     *
     * @param {object} rawPayload Raw payload
     * @returns {{ buyerName: string, buyerEmail: string, buyerPhone: string|null }}
     */
    mapBuyer(rawPayload) {
        const customer = rawPayload.customer_details || rawPayload.customer || {};

        const buyerEmail = rawPayload.buyerEmail || rawPayload.email || customer.email;
        if (!buyerEmail || typeof buyerEmail !== 'string' || !buyerEmail.trim()) {
            throw createAdapterError('MISSING_REQUIRED_FIELD', 'buyerEmail is required for Kiaan Direct purchases.');
        }

        const buyerName = rawPayload.buyerName || rawPayload.name || customer.name || buyerEmail.trim().split('@')[0];
        const buyerPhone = rawPayload.buyerPhone || rawPayload.phone || customer.phone || null;

        return {
            buyerName: String(buyerName).trim(),
            buyerEmail: String(buyerEmail).trim().toLowerCase(),
            buyerPhone: buyerPhone ? String(buyerPhone).trim() : null
        };
    }

    /**
     * Normalizes payment status using fail-closed translation.
     *
     * @param {object} rawPayload Raw payload
     * @returns {'PAID'|'PENDING'|'REFUNDED'|'DISPUTED'}
     */
    mapPaymentStatus(rawPayload) {
        const status = rawPayload.paymentStatus || rawPayload.status || (rawPayload.payment && rawPayload.payment.status);
        return this.normalizePaymentStatus(status);
    }

    /**
     * Extracts payment reference identifier.
     *
     * @param {object} rawPayload Raw payload
     * @returns {string}
     */
    mapPaymentReference(rawPayload) {
        const ref = rawPayload.paymentReference ||
            rawPayload.payment_id ||
            rawPayload.paymentId ||
            rawPayload.transactionId ||
            rawPayload.razorpay_payment_id ||
            rawPayload.stripe_payment_intent ||
            (rawPayload.payment && rawPayload.payment.id);

        if (!ref || typeof ref !== 'string' || !ref.trim()) {
            throw createAdapterError('MISSING_REQUIRED_FIELD', 'paymentReference is required for Kiaan Direct purchases.');
        }
        return ref.trim();
    }
}

module.exports = {
    KiaanDirectAdapter,
    CHANNEL_ID,
    CHANNEL_NAME
};
