/**
 * Kiaan Central License Authority — AppSumo Sales Channel Adapter
 * Module: backend-hrm/kiaan-authority/adapters/appSumoAdapter.js
 *
 * Implements the sales channel adapter for AppSumo / deal platform redemption payloads.
 * Converts AppSumo tier redemption and activation webhooks into CanonicalOrderDTO.
 *
 * Security & Architectural Guarantees:
 * 1. Zero Network / No Live API: Operates strictly offline on provider-neutral redemption payloads.
 * 2. Deterministic Tier-to-Edition Mapping:
 *    - 'tier1' / 'tier_1' / 'single'   -> 'ui_dist'     (KHRM-DIST-LIFETIME)
 *    - 'tier2' / 'tier_2' / 'double'   -> 'full_source' (KHRM-SRC-LIFETIME)
 *    - 'tier3' / 'tier_3' / 'multiple' -> 'extended'    (KHRM-EXT-LIFETIME)
 *    Unrecognized plan IDs or tiers are REJECTED with UNSUPPORTED_EDITION.
 * 3. Fail-Closed Action/Event Translation:
 *    - 'activate' / 'purchase' -> 'PAID'
 *    - 'refund'                -> 'REFUNDED'
 *    Unknown actions fail closed with INVALID_PAYMENT_STATUS.
 * 4. Stable External Identity: Normalizes AppSumo `uuid` / `invoice_item_uuid` without mutation.
 */

'use strict';

const { BaseSalesChannelAdapter, createAdapterError } = require('./baseAdapter');

const CHANNEL_ID = 'appsumo';
const CHANNEL_NAME = 'AppSumo / Deal Platforms';

/**
 * Known AppSumo tier / plan identifier mapping to canonical edition codes.
 */
const APPSUMO_TIER_MAP = Object.freeze({
    'tier1': 'ui_dist',
    'tier_1': 'ui_dist',
    'tier-1': 'ui_dist',
    'single': 'ui_dist',
    'tier2': 'full_source',
    'tier_2': 'full_source',
    'tier-2': 'full_source',
    'double': 'full_source',
    'tier3': 'extended',
    'tier_3': 'extended',
    'tier-3': 'extended',
    'multiple': 'extended'
});

/**
 * AppSumo Sales Channel Adapter.
 */
class AppSumoAdapter extends BaseSalesChannelAdapter {
    /**
     * Returns the channel ID registered in `marketplace_sales_channels`.
     *
     * @returns {string} 'appsumo'
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
     * Extracts external order identifier.
     * Prefers `invoice_item_uuid`, falling back to `uuid`, `order_id`, or `code`.
     *
     * @param {object} rawPayload Raw AppSumo payload
     * @returns {string}
     */
    mapOrderIdentifier(rawPayload) {
        const id = rawPayload.invoice_item_uuid ||
            rawPayload.invoiceItemUuid ||
            rawPayload.uuid ||
            rawPayload.order_id ||
            rawPayload.orderId ||
            rawPayload.code;

        if (!id || typeof id !== 'string' || !id.trim()) {
            throw createAdapterError(
                'MISSING_REQUIRED_FIELD',
                'invoice_item_uuid or uuid is required for AppSumo redemptions.'
            );
        }
        return id.trim();
    }

    /**
     * Maps AppSumo plan / tier to canonical commercial edition.
     *
     * CRITICAL INTEGRITY RULE:
     * Never guess! If the tier cannot be identified, REJECT.
     *
     * @param {object} rawPayload Raw AppSumo payload
     * @returns {{ productId: string, editionCode: string, sku: string, editionName: string }}
     */
    mapEdition(rawPayload) {
        const plan = rawPayload.plan_id || rawPayload.planId || rawPayload.tier || rawPayload.plan;
        if (!plan || typeof plan !== 'string' || !plan.trim()) {
            throw createAdapterError(
                'UNSUPPORTED_EDITION',
                'AppSumo plan_id or tier is missing. Cannot determine commercial edition.'
            );
        }

        const normalizedPlan = plan.trim().toLowerCase();
        const mappedEditionCode = APPSUMO_TIER_MAP[normalizedPlan];

        if (!mappedEditionCode) {
            throw createAdapterError(
                'UNSUPPORTED_EDITION',
                `AppSumo plan '${plan}' is not recognized. Must be tier1, tier2, or tier3.`
            );
        }

        return this.resolveEditionAndSku({
            productId: this.skuResolver.productId,
            editionCode: mappedEditionCode
        });
    }

    /**
     * Maps buyer information.
     *
     * @param {object} rawPayload Raw AppSumo payload
     * @returns {{ buyerName: string, buyerEmail: string, buyerPhone: null }}
     */
    mapBuyer(rawPayload) {
        const buyerEmail = rawPayload.email || rawPayload.buyer_email || rawPayload.buyerEmail;
        if (!buyerEmail || typeof buyerEmail !== 'string' || !buyerEmail.trim()) {
            throw createAdapterError(
                'MISSING_REQUIRED_FIELD',
                'email is required for AppSumo redemptions.'
            );
        }

        const buyerName = rawPayload.buyer_name || rawPayload.buyerName || rawPayload.name || buyerEmail.trim().split('@')[0];

        return {
            buyerName: String(buyerName).trim(),
            buyerEmail: String(buyerEmail).trim().toLowerCase(),
            buyerPhone: null
        };
    }

    /**
     * Normalizes AppSumo action / event into canonical payment status.
     *
     * Actions:
     * - 'activate', 'purchase', 'completed' -> 'PAID'
     * - 'pending'                           -> 'PENDING'
     * - 'refund', 'refunded'                -> 'REFUNDED'
     * - 'chargeback', 'dispute'             -> 'DISPUTED'
     *
     * @param {object} rawPayload Raw AppSumo payload
     * @returns {'PAID'|'PENDING'|'REFUNDED'|'DISPUTED'}
     */
    mapPaymentStatus(rawPayload) {
        const action = rawPayload.action || rawPayload.event || rawPayload.payment_status || rawPayload.status;
        if (!action || typeof action !== 'string' || !action.trim()) {
            throw createAdapterError(
                'INVALID_PAYMENT_STATUS',
                'action or payment status is required for AppSumo redemptions.'
            );
        }

        const normalizedAction = action.trim().toLowerCase();

        // Custom AppSumo action translations
        if (normalizedAction === 'activate' || normalizedAction === 'purchase' || normalizedAction === 'active') {
            return 'PAID';
        }

        return this.normalizePaymentStatus(normalizedAction);
    }

    /**
     * Maps payment reference identifier.
     * Prefers `uuid` or `invoice_item_uuid`.
     *
     * @param {object} rawPayload Raw AppSumo payload
     * @returns {string}
     */
    mapPaymentReference(rawPayload) {
        const ref = rawPayload.uuid ||
            rawPayload.invoice_item_uuid ||
            rawPayload.invoiceItemUuid ||
            rawPayload.code ||
            rawPayload.order_id;

        if (!ref || typeof ref !== 'string' || !ref.trim()) {
            throw createAdapterError(
                'MISSING_REQUIRED_FIELD',
                'uuid or payment reference is required for AppSumo redemptions.'
            );
        }
        return ref.trim();
    }
}

module.exports = {
    AppSumoAdapter,
    CHANNEL_ID,
    CHANNEL_NAME,
    APPSUMO_TIER_MAP
};
