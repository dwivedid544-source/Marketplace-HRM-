/**
 * Kiaan License Engine — License API Controller
 * Module: backend-hrm/kiaan-license/controllers/licenseController.js
 *
 * Implements the API handlers for license status, activation, synchronization,
 * conflict recovery, and administrative diagnostics.
 *
 * Security Requirements:
 * 1. Minimal Public Exposure: GET /status never reveals customer names, domains,
 *    features, employee limits, signatures, file paths, or internal exceptions.
 * 2. Strict Input Validation: POST /activate rejects malformed shapes, invalid Base64,
 *    and oversized request payloads (>64KB).
 * 3. Cryptographic Enforceability: All activations and conflict recoveries must pass
 *    RFC 8785 canonicalization and PureEd25519 signature verification against the trusted Keystore.
 * 4. Safe Conflict Recovery: Rejects unrestricted vault selection (SELECT_VAULT);
 *    requires a newly verified Kiaan-signed entitlement envelope.
 * 5. Non-Mutating Diagnostics: GET /diagnostics executes in read-only mode (autoHeal: false)
 *    and redacts all internal paths and credentials.
 */

'use strict';

const { verifyEnvelope, VerificationCodes } = require('../core/cryptoEngine');
const { reconcileVaults, persistEntitlement, VaultStatus, WriteStatus } = require('../core/vaultEngine');
const { CacheStatus } = require('../core/licenseCache');
const { resolveHost } = require('../core/hostResolver');
const { licenseConfig: defaultLicenseConfig } = require('../config/licenseConfig');

/**
 * Maximum permitted size for an activation payload (64 KB).
 */
const MAX_ACTIVATION_PAYLOAD_BYTES = 65536;

/**
 * Helper to extract and normalize the incoming host context from Express request.
 *
 * @param {object} req Express request
 * @param {object} config License configuration
 * @returns {object} Host resolution object
 */
function getHostContext(req, config) {
    if (req.licenseHost && typeof req.licenseHost === 'object') {
        return req.licenseHost;
    }

    const rawHost = req.headers ? (req.headers.host || req.headers[':authority']) : undefined;
    const forwardedHost = req.headers ? req.headers['x-forwarded-host'] : undefined;
    const remoteIp = (req.socket && req.socket.remoteAddress) || req.ip;

    const res = resolveHost({
        rawHost,
        forwardedHost,
        remoteIp,
        trustedProxies: config.trustedProxies,
        nodeEnv: process.env.NODE_ENV
    });

    return {
        valid: res.success,
        success: res.success,
        hostname: res.hostname,
        normalizedHost: res.hostname,
        port: res.port,
        source: res.source,
        isDevBypass: res.isDevBypass,
        code: res.code,
        reason: res.reason
    };
}

/**
 * Factory creating the License Controller handlers with injected dependencies.
 *
 * @param {object} options
 * @param {object} options.licenseCache An instance of licenseCache
 * @param {object} options.primaryAdapter Primary database storage adapter
 * @param {object} options.mirrorAdapter Mirror filesystem storage adapter
 * @param {object} [options.config] License configuration overrides
 * @param {object} [options.keystore] Keystore overrides
 * @returns {object} Controller instance with handler methods
 */
function createLicenseController(options = {}) {
    const licenseCache = options.licenseCache;
    const primaryAdapter = options.primaryAdapter;
    const mirrorAdapter = options.mirrorAdapter;
    const config = options.config || defaultLicenseConfig;
    const keystore = options.keystore || config.keystore;

    /**
     * GET /api/license/status
     * Public minimal status heartbeat. Never exposes sensitive entitlement metadata.
     */
    async function getStatus(req, res) {
        try {
            const hostContext = getHostContext(req, config);
            const state = await licenseCache.getState(hostContext);

            if (state.status === CacheStatus.STORAGE_UNAVAILABLE) {
                return res.status(503).json({
                    success: false,
                    licensed: false,
                    status: 'STATUS_STORAGE_UNAVAILABLE',
                    productId: config.productId,
                    message: 'License storage engine is temporarily unavailable.'
                });
            }

            if (state.valid && state.status === CacheStatus.HEALTHY) {
                return res.status(200).json({
                    success: true,
                    licensed: true,
                    status: 'STATUS_HEALTHY',
                    productId: config.productId,
                    message: 'Installation is licensed and active.'
                });
            }

            let message = 'This Kiaan HRM Pro installation is not licensed.';
            if (state.status === CacheStatus.DEGRADED_CONFLICT) {
                message = 'System locked: Conflicting license records detected.';
            } else if (state.status === CacheStatus.DOMAIN_MISMATCH) {
                message = 'Host domain is not authorized by the installed license.';
            } else if (state.status === CacheStatus.PRODUCT_MISMATCH) {
                message = 'The installed license is not valid for this product.';
            } else if (state.status === CacheStatus.CORRUPTED) {
                message = 'Installed license data is invalid or corrupt.';
            }

            return res.status(200).json({
                success: false,
                licensed: false,
                status: state.status,
                productId: config.productId,
                message: message
            });
        } catch {
            return res.status(500).json({
                success: false,
                code: 'INTERNAL_ERROR',
                message: 'Unable to retrieve license status.'
            });
        }
    }

    /**
     * POST /api/license/activate
     * Installs a newly signed entitlement envelope into local dual vaults.
     */
    async function activate(req, res) {
        try {
            // 1. Request Body & Size Validation
            if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
                return res.status(400).json({
                    success: false,
                    code: 'INVALID_REQUEST',
                    message: 'Request body must be a JSON object containing an entitlement envelope'
                });
            }

            const bodyStr = JSON.stringify(req.body);
            if (Buffer.byteLength(bodyStr, 'utf8') > MAX_ACTIVATION_PAYLOAD_BYTES) {
                return res.status(400).json({
                    success: false,
                    code: 'PAYLOAD_TOO_LARGE',
                    message: 'Activation payload exceeds maximum permitted size (64KB)'
                });
            }

            // 2. Extract Envelope (supports { envelope: {...} } or { licenseKey: "..." })
            let envelope = req.body.envelope;
            if (!envelope && typeof req.body.licenseKey === 'string') {
                const trimmedKey = req.body.licenseKey.trim();

                // Phase 2B.7.1B: Detect raw commercial activation key format (e.g. KHRM-XXXX-XXXX-XXXX)
                if (/^[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}(-[a-z0-9]{4})?$/i.test(trimmedKey)) {
                    return res.status(400).json({
                        success: false,
                        code: 'ONLINE_ACTIVATION_KEY_DETECTED',
                        message: "Online activation key format detected ('KHRM-...'). Central License Authority online activation is not configured in this offline installation. Please upload or paste your signed Kiaan license envelope (.lic file)."
                    });
                }

                try {
                    if (trimmedKey.startsWith('{')) {
                        envelope = JSON.parse(trimmedKey);
                    } else {
                        // Decode Base64 string
                        envelope = JSON.parse(Buffer.from(trimmedKey, 'base64').toString('utf8'));
                    }
                } catch {
                    return res.status(400).json({
                        success: false,
                        code: 'INVALID_LICENSE_KEY_FORMAT',
                        message: 'The provided license key is not a valid JSON or Base64 envelope'
                    });
                }
            }

            if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
                return res.status(400).json({
                    success: false,
                    code: 'MISSING_ENVELOPE',
                    message: "Request must contain a valid 'envelope' object or 'licenseKey' string"
                });
            }

            const { algorithm, key_id, payload, signature } = envelope;
            if (typeof algorithm !== 'string' || typeof key_id !== 'string' || !payload || typeof payload !== 'object' || typeof signature !== 'string') {
                return res.status(400).json({
                    success: false,
                    code: 'INVALID_ENVELOPE_SHAPE',
                    message: 'Envelope missing required fields: algorithm, key_id, payload, signature'
                });
            }

            // 3. Cryptographic Signature Verification
            const verifyRes = verifyEnvelope(envelope, keystore);
            if (!verifyRes.valid) {
                if (verifyRes.code === VerificationCodes.REVOKED_KEY) {
                    return res.status(400).json({
                        success: false,
                        code: 'REVOKED_KEY',
                        message: 'The license signing key has been revoked.'
                    });
                }
                if (verifyRes.code === VerificationCodes.UNKNOWN_KEY_ID) {
                    return res.status(400).json({
                        success: false,
                        code: 'UNKNOWN_KEY_ID',
                        message: 'The license signing key is unknown or untrusted.'
                    });
                }
                return res.status(400).json({
                    success: false,
                    code: 'LICENSE_TAMPERED',
                    message: 'License signature verification failed. The license may be tampered or invalid.'
                });
            }

            // 4. Product ID Validation
            if (payload.product_id !== config.productId) {
                return res.status(403).json({
                    success: false,
                    code: 'LICENSE_PRODUCT_MISMATCH',
                    message: `The license was issued for product '${payload.product_id}', which is incompatible with '${config.productId}'.`
                });
            }

            // 5. Host Domain Binding Validation
            const hostContext = getHostContext(req, config);
            if (!hostContext.isDevBypass) {
                const licensedDomain = (payload.licensed_domain || '').toLowerCase();
                const aliases = Array.isArray(payload.domain_aliases)
                    ? payload.domain_aliases.map(d => String(d).toLowerCase())
                    : [];

                const requestHost = (hostContext.hostname || '').toLowerCase();
                const isDomainMatch = (requestHost === licensedDomain || aliases.includes(requestHost));

                if (!isDomainMatch) {
                    return res.status(403).json({
                        success: false,
                        code: 'LICENSE_DOMAIN_MISMATCH',
                        message: `The license is bound to domain '${licensedDomain}', which does not match active host '${requestHost}'.`
                    });
                }
            }

            // 6. Dual-Vault Persistence
            const persistRes = await persistEntitlement({
                envelope,
                primaryAdapter,
                mirrorAdapter,
                keystore
            });

            if (!persistRes.success) {
                if (persistRes.code === WriteStatus.ROLLBACK_REJECTED) {
                    return res.status(409).json({
                        success: false,
                        code: 'SEQUENCE_ROLLBACK_REJECTED',
                        message: 'Sequence rollback rejected: The installed license is at an equal or higher sequence version.'
                    });
                }

                if (persistRes.code === WriteStatus.CONFLICT_REJECTED) {
                    return res.status(423).json({
                        success: false,
                        code: 'LICENSE_CONFLICT',
                        message: 'Cannot activate: Vault has an unresolved sequence conflict. Conflict recovery required.'
                    });
                }

                if (persistRes.code === WriteStatus.PARTIAL_FAILURE) {
                    return res.status(500).json({
                        success: false,
                        code: 'PARTIAL_PERSISTENCE_FAILURE',
                        message: 'License persistence partially failed across dual vaults. Please inspect storage.'
                    });
                }

                return res.status(500).json({
                    success: false,
                    code: 'PERSISTENCE_FAILURE',
                    message: 'Failed to write license to storage vaults.'
                });
            }

            // 7. Synchronous Cache Invalidation
            licenseCache.invalidate();

            return res.status(200).json({
                success: true,
                message: 'License activated successfully.',
                status: 'STATUS_HEALTHY',
                sequenceNumber: persistRes.sequenceNumber,
                isIdempotent: Boolean(persistRes.isIdempotent)
            });

        } catch (err) {
            console.error('License Activation Internal Error:', err.message);
            return res.status(500).json({
                success: false,
                code: 'INTERNAL_ERROR',
                message: 'An unexpected internal error occurred during license activation.'
            });
        }
    }

    /**
     * POST /api/license/sync
     * Reconciles existing primary and mirror vaults and clears the cache.
     */
    async function sync(req, res) {
        try {
            const reconcRes = await reconcileVaults({
                primaryAdapter,
                mirrorAdapter,
                keystore,
                options: { autoHeal: true }
            });

            if (reconcRes.status === VaultStatus.DEGRADED_CONFLICT) {
                return res.status(423).json({
                    success: false,
                    code: 'LICENSE_CONFLICT',
                    message: 'Vault conflict detected: Primary and secondary vaults contain diverging valid licenses at equal sequence versions. Manual recovery required.'
                });
            }

            if (reconcRes.status === VaultStatus.CORRUPTED) {
                return res.status(403).json({
                    success: false,
                    code: 'LICENSE_CORRUPTED',
                    message: 'Vault synchronization failed: Available license records failed verification.'
                });
            }

            // Synchronous cache invalidation
            licenseCache.invalidate();

            const activeSeq = (reconcRes.authoritative && reconcRes.authoritative.payload)
                ? (reconcRes.authoritative.payload.sequence_number || 1)
                : null;

            return res.status(200).json({
                success: true,
                message: 'License vaults synchronized successfully.',
                status: reconcRes.status,
                activeSequence: activeSeq,
                healTarget: reconcRes.healTarget,
                healResult: reconcRes.healResult ? { target: reconcRes.healResult.target, success: reconcRes.healResult.success } : null
            });

        } catch (err) {
            console.error('License Sync Internal Error:', err.message);
            return res.status(500).json({
                success: false,
                code: 'INTERNAL_ERROR',
                message: 'An unexpected error occurred during license synchronization.'
            });
        }
    }

    /**
     * POST /api/license/recover
     * Resolves an equal-sequence vault conflict using a newly verified Kiaan-signed entitlement.
     * Rejects unrestricted SELECT_VAULT overwrites.
     */
    async function recover(req, res) {
        try {
            const body = req.body || {};
            const strategy = body.resolutionStrategy;

            // Reject unrestricted / unverified vault selection
            if (strategy === 'SELECT_VAULT' || body.selectedVault) {
                return res.status(400).json({
                    success: false,
                    code: 'UNSAFE_RECOVERY_STRATEGY',
                    message: 'Unrestricted vault selection is not permitted. Conflict recovery requires submitting a newly verified Kiaan-signed entitlement envelope.'
                });
            }

            const envelope = body.envelope;
            if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
                return res.status(400).json({
                    success: false,
                    code: 'MISSING_RECOVERY_ENVELOPE',
                    message: 'Conflict recovery requires submitting an authoritative signed envelope in req.body.envelope'
                });
            }

            // Verify envelope
            const verifyRes = verifyEnvelope(envelope, keystore);
            if (!verifyRes.valid) {
                return res.status(400).json({
                    success: false,
                    code: 'INVALID_SIGNATURE',
                    message: 'Recovery envelope signature verification failed.'
                });
            }

            // Verify product ID
            if (envelope.payload?.product_id !== config.productId) {
                return res.status(403).json({
                    success: false,
                    code: 'LICENSE_PRODUCT_MISMATCH',
                    message: 'Recovery envelope product ID does not match this installation.'
                });
            }

            // Execute persistence with explicit conflict resolution authorization
            const persistRes = await persistEntitlement({
                envelope,
                primaryAdapter,
                mirrorAdapter,
                keystore,
                options: { forceConflictResolution: true }
            });

            if (!persistRes.success) {
                if (persistRes.code === WriteStatus.ROLLBACK_REJECTED) {
                    return res.status(409).json({
                        success: false,
                        code: 'SEQUENCE_ROLLBACK_REJECTED',
                        message: 'Recovery envelope sequence must be greater than or equal to active conflicting sequence.'
                    });
                }

                return res.status(500).json({
                    success: false,
                    code: 'RECOVERY_PERSISTENCE_FAILED',
                    message: 'Failed to write recovery envelope across dual storage vaults.'
                });
            }

            licenseCache.invalidate();

            return res.status(200).json({
                success: true,
                message: 'Vault conflict resolved successfully with verified entitlement.',
                status: 'STATUS_HEALTHY',
                sequenceNumber: persistRes.sequenceNumber
            });

        } catch (err) {
            console.error('License Recovery Internal Error:', err.message);
            return res.status(500).json({
                success: false,
                code: 'INTERNAL_ERROR',
                message: 'An unexpected error occurred during conflict recovery.'
            });
        }
    }

    /**
     * GET /api/license/diagnostics
     * Deep technical diagnostics for Superadmin. Never mutates vaults (autoHeal: false).
     */
    async function getDiagnostics(req, res) {
        try {
            const hostContext = getHostContext(req, config);

            // Execute read-only vault inspection (strictly non-mutating)
            const reconcRes = await reconcileVaults({
                primaryAdapter,
                mirrorAdapter,
                keystore,
                options: { autoHeal: false }
            });

            const cachedEntry = licenseCache.getCachedEntry();
            const authoritative = reconcRes.authoritative;
            const payload = authoritative ? authoritative.payload : null;

            // Sanitize storage errors and paths
            const primaryStatus = reconcRes.vaults?.primary?.status || 'UNKNOWN';
            const mirrorStatus = reconcRes.vaults?.mirror?.status || 'UNKNOWN';

            let mirrorPathSanitized = '[VAULT_DIR]/license.lic';
            if (mirrorAdapter && typeof mirrorAdapter.getSanitizedPath === 'function') {
                mirrorPathSanitized = mirrorAdapter.getSanitizedPath();
            }

            const diagnostics = {
                status: reconcRes.status,
                hostResolution: {
                    resolvedHost: hostContext.hostname,
                    resolvedPort: hostContext.port,
                    clientIp: hostContext.clientIp || null,
                    isTrustedProxy: hostContext.isTrustedProxy || false,
                    isDevBypass: hostContext.isDevBypass || false
                },
                vault: {
                    primary: {
                        adapter: 'mysql',
                        status: primaryStatus,
                        sequenceNumber: reconcRes.vaults?.primary?.sequenceNumber || null
                    },
                    mirror: {
                        adapter: 'filesystem',
                        status: mirrorStatus,
                        sequenceNumber: reconcRes.vaults?.mirror?.sequenceNumber || null,
                        sanitizedPath: mirrorPathSanitized
                    },
                    reconciliationStatus: reconcRes.status
                },
                cryptography: {
                    keyId: authoritative ? authoritative.key_id : null,
                    algorithm: authoritative ? authoritative.algorithm : 'Ed25519',
                    signatureValid: Boolean(authoritative)
                },
                entitlement: payload ? {
                    productId: payload.product_id || null,
                    licensedDomain: payload.licensed_domain || null,
                    domainAliases: Array.isArray(payload.domain_aliases) ? payload.domain_aliases : [],
                    sequenceNumber: payload.sequence_number || null,
                    features: Array.isArray(payload.features) ? payload.features : [],
                    planTier: payload.tier || payload.plan_tier || null,
                    issuedAt: payload.issued_at || null,
                    expiresAt: payload.expires_at || null
                } : null,
                cache: {
                    isCached: Boolean(cachedEntry),
                    cachedStatus: cachedEntry ? cachedEntry.status : null
                }
            };

            return res.status(200).json({
                success: true,
                timestamp: new Date().toISOString(),
                diagnostics: diagnostics
            });

        } catch (err) {
            console.error('License Diagnostics Internal Error:', err.message);
            return res.status(500).json({
                success: false,
                code: 'INTERNAL_ERROR',
                message: 'An unexpected error occurred while generating diagnostics.'
            });
        }
    }

    return Object.freeze({
        getStatus,
        activate,
        sync,
        recover,
        getDiagnostics
    });
}

module.exports = {
    createLicenseController,
    MAX_ACTIVATION_PAYLOAD_BYTES
};
