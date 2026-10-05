/**
 * Kiaan Central License Authority — Sales Channel Adapter Registry & Entry Point
 * Module: backend-hrm/kiaan-authority/adapters/index.js
 *
 * Implements the centralized sales channel adapter factory and registry.
 * Dispatches raw provider payloads to channel-specific adapters and produces
 * validated CanonicalOrderDTO instances for the license issuance pipeline.
 *
 * Architecture & Security Guarantees:
 * 1. Pluggable Adapter Registry: Maps registered channels to concrete adapter classes.
 * 2. Channel Isolation: Dispatches strictly by authoritative `channel_id`.
 * 3. Fail-Closed Unknown Channels: Rejects unregistered channels with UNKNOWN_SALES_CHANNEL.
 * 4. Zero Issuance Engine Mutation: Adapters produce pure CanonicalOrderDTOs without
 *    invoking or modifying the core OrderIngestionService or database.
 */

'use strict';

const {
    BaseSalesChannelAdapter,
    createAdapterError,
    normalizePaymentStatus,
    validatePayloadSecurity,
    PAYMENT_STATUS_MAP,
    MAX_PAYLOAD_SERIALIZED_BYTES
} = require('./baseAdapter');

const {
    SkuResolver,
    defaultSkuResolver,
    CANONICAL_PRODUCT_ID,
    CANONICAL_EDITIONS,
    SKU_TO_EDITION
} = require('./skuResolver');

const { KiaanDirectAdapter } = require('./kiaanDirectAdapter');
const { CodeCanyonAdapter } = require('./codeCanyonAdapter');
const { AppSumoAdapter } = require('./appSumoAdapter');
const { ManualB2bAdapter } = require('./manualB2bAdapter');

/**
 * Registry of standard sales channel adapter constructors.
 */
const ADAPTER_REGISTRY = new Map([
    ['kiaan_direct', KiaanDirectAdapter],
    ['codecanyon', CodeCanyonAdapter],
    ['appsumo', AppSumoAdapter],
    ['manual_b2b', ManualB2bAdapter]
]);

/**
 * Retrieves a sales channel adapter instance for a given channel ID.
 *
 * @param {string} channelId Sales channel identifier (e.g. 'kiaan_direct', 'codecanyon')
 * @param {object} [options] Injected adapter options (e.g. skuResolver, logger)
 * @returns {BaseSalesChannelAdapter}
 * @throws {Error} If channelId is unknown or unregistered
 */
function getAdapter(channelId, options = {}) {
    if (!channelId || typeof channelId !== 'string' || !channelId.trim()) {
        throw createAdapterError('INVALID_SALES_CHANNEL', 'salesChannelId is required and cannot be empty.');
    }

    const normalized = channelId.trim().toLowerCase();
    const AdapterClass = ADAPTER_REGISTRY.get(normalized);

    if (!AdapterClass) {
        throw createAdapterError(
            'UNKNOWN_SALES_CHANNEL',
            `Sales channel '${channelId}' is not registered in adapter registry.`
        );
    }

    return new AdapterClass(options);
}

/**
 * Registers or overrides a sales channel adapter constructor.
 *
 * @param {string} channelId Sales channel identifier
 * @param {typeof BaseSalesChannelAdapter} adapterClass Adapter constructor extending BaseSalesChannelAdapter
 */
function registerAdapter(channelId, adapterClass) {
    if (!channelId || typeof channelId !== 'string') {
        throw createAdapterError('INVALID_SALES_CHANNEL', 'channelId must be a non-empty string.');
    }
    if (!adapterClass || typeof adapterClass !== 'function') {
        throw createAdapterError('INVALID_ADAPTER', 'adapterClass must be a constructor function.');
    }
    ADAPTER_REGISTRY.set(channelId.trim().toLowerCase(), adapterClass);
}

/**
 * High-level helper: Normalizes a provider payload into a CanonicalOrderDTO.
 *
 * @param {string} channelId Sales channel identifier
 * @param {object} rawPayload Provider-specific raw order payload
 * @param {object} [options] Optional adapter configuration
 * @returns {import('../core/orderDto').CanonicalOrderDTO}
 */
function normalizeChannelOrder(channelId, rawPayload, options = {}) {
    const adapter = getAdapter(channelId, options);
    return adapter.normalizeOrder(rawPayload);
}

/**
 * High-level helper: Normalizes a multi-line provider payload into an array of CanonicalOrderDTOs.
 *
 * @param {string} channelId Sales channel identifier
 * @param {object} rawPayload Provider-specific raw cart payload
 * @param {object} [options] Optional adapter configuration
 * @returns {import('../core/orderDto').CanonicalOrderDTO[]}
 */
function normalizeChannelOrderUnits(channelId, rawPayload, options = {}) {
    const adapter = getAdapter(channelId, options);
    return adapter.normalizeOrderUnits(rawPayload);
}

module.exports = {
    // Adapter Classes
    BaseSalesChannelAdapter,
    KiaanDirectAdapter,
    CodeCanyonAdapter,
    AppSumoAdapter,
    ManualB2bAdapter,

    // Factory & Registry
    getAdapter,
    registerAdapter,
    normalizeChannelOrder,
    normalizeChannelOrderUnits,

    // SkuResolver
    SkuResolver,
    defaultSkuResolver,
    CANONICAL_PRODUCT_ID,
    CANONICAL_EDITIONS,
    SKU_TO_EDITION,

    // Errors & Utilities
    createAdapterError,
    normalizePaymentStatus,
    validatePayloadSecurity,
    PAYMENT_STATUS_MAP,
    MAX_PAYLOAD_SERIALIZED_BYTES
};
