/**
 * Kiaan License Engine — Fast-Path License Verification Cache
 * Module: backend-hrm/kiaan-license/core/licenseCache.js
 *
 * Implements high-performance, in-memory caching of the reconciled license vault
 * state to prevent redundant database queries, disk I/O, and Ed25519 signature checks
 * on every incoming HTTP request.
 *
 * Architectural Guarantees:
 * 1. Bounded TTL: Configurable TTL (30s default for healthy licenses, 5s for degraded/unlicensed).
 * 2. In-Flight Request Coalescing: Prevents "thundering herd" on cold boot; concurrent requests
 *    share a single reconciliation promise instead of duplicating vault queries.
 * 3. Fail-Safe Anti-Poisoning: Transient storage errors (e.g. DB connection timeouts) are NEVER
 *    cached as permanent licensing failures.
 * 4. Deterministic Invalidation: Synchronous cache clearance upon local activation or database restore.
 * 5. Domain & Product Binding: Evaluates canonical host and product ID against the authoritative payload.
 */

'use strict';

const { reconcileVaults, VaultStatus } = require('./vaultEngine');
const { licenseConfig: defaultLicenseConfig } = require('../config/licenseConfig');

/**
 * Cache status identifiers.
 */
const CacheStatus = Object.freeze({
    HEALTHY: 'STATUS_HEALTHY',
    UNLICENSED: 'STATUS_UNLICENSED',
    DEGRADED_CONFLICT: 'STATUS_DEGRADED_CONFLICT',
    CORRUPTED: 'STATUS_CORRUPTED',
    STORAGE_UNAVAILABLE: 'STATUS_STORAGE_UNAVAILABLE',
    DOMAIN_MISMATCH: 'STATUS_DOMAIN_MISMATCH',
    PRODUCT_MISMATCH: 'STATUS_PRODUCT_MISMATCH'
});

/**
 * Creates an isolated License Cache instance with injected dependencies.
 *
 * @param {object} options
 * @param {object} options.primaryAdapter Primary database adapter (MySQL)
 * @param {object} options.mirrorAdapter Mirror storage adapter (Filesystem)
 * @param {object} [options.keystore] Keystore for signature verification
 * @param {object} [options.config] License configuration overrides
 * @param {Function} [options.nowFn] Timestamp generator function (for deterministic testing)
 * @returns {object} Cache instance with { getState, invalidate, clear, getCachedEntry }
 */
function createLicenseCache(options = {}) {
    const primaryAdapter = options.primaryAdapter;
    const mirrorAdapter = options.mirrorAdapter;
    const config = options.config || defaultLicenseConfig;
    const keystore = options.keystore || config.keystore;
    const nowFn = options.nowFn || (() => Date.now());

    let cachedVaultState = null;
    let activeReconciliationPromise = null;

    /**
     * Executes vault reconciliation or joins an existing in-flight reconciliation promise.
     *
     * @returns {Promise<object>} Reconciled vault state
     */
    async function getOrFetchVaultState() {
        const now = nowFn();

        // 1. Check if valid, unexpired cached entry exists
        if (cachedVaultState && now < cachedVaultState.expiresAt) {
            return cachedVaultState;
        }

        // 2. Coalesce concurrent requests: if reconciliation is already running, join it
        if (activeReconciliationPromise) {
            return await activeReconciliationPromise;
        }

        // 3. Launch single reconciliation promise
        activeReconciliationPromise = (async () => {
            try {
                let reconcResult;
                try {
                    reconcResult = await reconcileVaults({
                        primaryAdapter,
                        mirrorAdapter,
                        keystore,
                        options: { autoHeal: true }
                    });
                } catch (reconcErr) {
                    // Check for storage unavailability
                    if (reconcErr.code === 'DB_UNAVAILABLE' || reconcErr.code === 'VAULT_PERMISSION_DENIED') {
                        return {
                            status: CacheStatus.STORAGE_UNAVAILABLE,
                            authoritative: null,
                            payload: null,
                            reason: 'Storage engine unavailable',
                            error: reconcErr.message,
                            cachedAt: nowFn(),
                            expiresAt: 0 // Do not cache transient storage failure
                        };
                    }
                    throw reconcErr;
                }

                // Check if errors in vaults indicate transient storage unavailability
                const primaryErr = reconcResult.vaults?.primary?.error || '';
                const mirrorErr = reconcResult.vaults?.mirror?.error || '';

                const isStorageOutage = (
                    primaryErr.includes('DB_UNAVAILABLE') ||
                    primaryErr.includes('Database unavailable') ||
                    primaryErr.includes('ECONNREFUSED') ||
                    primaryErr.includes('ETIMEDOUT') ||
                    primaryErr.includes('PROTOCOL_CONNECTION_LOST') ||
                    mirrorErr.includes('VAULT_PERMISSION_DENIED') ||
                    mirrorErr.includes('Permission denied')
                );

                const currentNow = nowFn();
                const isHealthy = (
                    reconcResult.status === VaultStatus.HEALTHY ||
                    reconcResult.status === VaultStatus.RECONCILED ||
                    reconcResult.status === VaultStatus.SELF_HEALED ||
                    reconcResult.status === VaultStatus.RECOVERED
                );

                if (isStorageOutage && !isHealthy) {
                    return {
                        status: CacheStatus.STORAGE_UNAVAILABLE,
                        vaultStatus: reconcResult.status,
                        authoritative: null,
                        payload: null,
                        reason: 'Storage engine temporarily unavailable',
                        error: primaryErr || mirrorErr,
                        cachedAt: currentNow,
                        expiresAt: 0 // Never cache transient storage failure
                    };
                }

                let status;
                let ttlMs;

                if (isHealthy && reconcResult.authoritative) {
                    status = CacheStatus.HEALTHY;
                    ttlMs = config.cache.healthyTtlMs;
                } else if (reconcResult.status === VaultStatus.DEGRADED_CONFLICT) {
                    status = CacheStatus.DEGRADED_CONFLICT;
                    ttlMs = config.cache.degradedTtlMs;
                } else if (reconcResult.status === VaultStatus.UNLICENSED) {
                    status = CacheStatus.UNLICENSED;
                    ttlMs = config.cache.degradedTtlMs;
                } else {
                    status = CacheStatus.CORRUPTED;
                    ttlMs = config.cache.degradedTtlMs;
                }

                const authoritative = reconcResult.authoritative;
                const payload = authoritative ? authoritative.payload : null;

                const entry = {
                    status: status,
                    vaultStatus: reconcResult.status,
                    authoritative: authoritative,
                    payload: payload,
                    sequenceNumber: payload ? (payload.sequence_number || 1) : null,
                    reason: reconcResult.reason,
                    cachedAt: currentNow,
                    expiresAt: currentNow + ttlMs
                };

                cachedVaultState = entry;
                return entry;
            } finally {
                activeReconciliationPromise = null;
            }
        })();

        return await activeReconciliationPromise;
    }

    /**
     * Retrieves the evaluated license state for a specific resolved host.
     *
     * @param {object} [licenseHost] Resolved host object from hostResolver
     * @returns {Promise<object>} Evaluated license state
     */
    async function getState(licenseHost = null) {
        const vaultState = await getOrFetchVaultState();

        // If storage is unavailable or vault is unlicensed/corrupted/conflict, return immediately
        if (vaultState.status !== CacheStatus.HEALTHY || !vaultState.payload) {
            return {
                valid: false,
                status: vaultState.status,
                reason: vaultState.reason,
                payload: null,
                cachedAt: vaultState.cachedAt,
                sequenceNumber: vaultState.sequenceNumber
            };
        }

        const payload = vaultState.payload;

        // 1. Verify Product ID
        const expectedProductId = config.productId || 'kiaan-hrm';
        if (payload.product_id && payload.product_id !== expectedProductId) {
            return {
                valid: false,
                status: CacheStatus.PRODUCT_MISMATCH,
                reason: `License product mismatch: expected '${expectedProductId}', got '${payload.product_id}'`,
                payload: payload,
                cachedAt: vaultState.cachedAt,
                sequenceNumber: vaultState.sequenceNumber
            };
        }

        // 2. Verify Domain Binding (unless dev bypass is active)
        if (licenseHost) {
            if (licenseHost.isDevBypass) {
                // Local development bypass (e.g. localhost, 127.0.0.1 in NODE_ENV === 'development')
                return {
                    valid: true,
                    status: CacheStatus.HEALTHY,
                    isDevBypass: true,
                    payload: payload,
                    cachedAt: vaultState.cachedAt,
                    sequenceNumber: vaultState.sequenceNumber
                };
            }

            const requestDomain = licenseHost.hostname || licenseHost.normalizedHost;
            if (requestDomain) {
                const licensedDomain = payload.licensed_domain ? payload.licensed_domain.toLowerCase() : '';
                const aliases = Array.isArray(payload.domain_aliases)
                    ? payload.domain_aliases.map(d => d.toLowerCase())
                    : [];

                const isDomainMatch = (requestDomain === licensedDomain || aliases.includes(requestDomain));

                if (!isDomainMatch) {
                    return {
                        valid: false,
                        status: CacheStatus.DOMAIN_MISMATCH,
                        reason: `Host '${requestDomain}' is not authorized by the installed license for '${licensedDomain}'`,
                        payload: payload,
                        cachedAt: vaultState.cachedAt,
                        sequenceNumber: vaultState.sequenceNumber
                    };
                }
            }
        }

        // 3. Fully Validated Healthy License
        return {
            valid: true,
            status: CacheStatus.HEALTHY,
            isDevBypass: Boolean(licenseHost && licenseHost.isDevBypass),
            payload: payload,
            cachedAt: vaultState.cachedAt,
            sequenceNumber: vaultState.sequenceNumber
        };
    }

    /**
     * Explicitly invalidates the cache, forcing cold verification on the next request.
     */
    function invalidate() {
        cachedVaultState = null;
        activeReconciliationPromise = null;
    }

    /**
     * Diagnostic accessor to inspect the current raw cached entry without triggering fetch.
     *
     * @returns {object|null} Current cache entry
     */
    function getCachedEntry() {
        return cachedVaultState;
    }

    return Object.freeze({
        getState,
        invalidate,
        clear: invalidate,
        getCachedEntry
    });
}

module.exports = {
    createLicenseCache,
    CacheStatus
};
