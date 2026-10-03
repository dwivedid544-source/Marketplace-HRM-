/**
 * Kiaan License Engine — Global Configuration & Trusted Public Keystore
 * Module: backend-hrm/kiaan-license/config/licenseConfig.js
 *
 * Provides immutable configuration, trusted public keys for Ed25519 signature
 * verification, storage parameters, and cache policies.
 *
 * Security Requirements:
 * 1. ZERO Private Keys: Private signing keys must NEVER exist in client-side or
 *    on-premise configuration files. Only SPKI public keys are permitted.
 * 2. Immutable Configuration: Exported configurations are deep-frozen to prevent
 *    runtime tampering or prototype pollution.
 * 3. Configuration Validation: Validates types, non-empty identifiers, and absence
 *    of private key markers on initialization.
 */

'use strict';

const path = require('path');

/**
 * Approved official Product Identifier.
 */
const DEFAULT_PRODUCT_ID = 'kiaan-hrm';

/**
 * Canonical Root Ed25519 Public Key for offline entitlement verification.
 * Format: SubjectPublicKeyInfo (SPKI) PEM.
 * Note: Contains strictly the public key. Private keys remain offline in secure air-gapped HSM/signer.
 */
const DEFAULT_ROOT_PUBLIC_KEY = [
    '-----BEGIN PUBLIC KEY-----',
    'MCowBQYDK2VwAyEAG93nLTXSNVcXQWIMP2LGZVOI9zRsiytnfl7nsktIbRE=',
    '-----END PUBLIC KEY-----'
].join('\n');

/**
 * Built-in trusted Keystore dictionary mapping key_id to public key entries.
 */
const DEFAULT_KEYSTORE = Object.freeze({
    'kiaan-root-2026-v1': Object.freeze({
        keyId: 'kiaan-root-2026-v1',
        algorithm: 'Ed25519',
        publicKey: DEFAULT_ROOT_PUBLIC_KEY,
        status: 'VALID'
    })
});

/**
 * Default storage configuration.
 */
const DEFAULT_STORAGE = Object.freeze({
    tableName: 'system_licenses',
    vaultPath: path.resolve(__dirname, '..', '.vault', 'license.lic')
});

/**
 * Default cache TTLs (milliseconds).
 */
const DEFAULT_CACHE = Object.freeze({
    healthyTtlMs: 30000,   // 30 seconds for valid, active licenses
    degradedTtlMs: 5000    // 5 seconds for unlicensed, degraded, or conflict states
});

/**
 * Default trusted reverse proxies (loopback-only default).
 */
const DEFAULT_TRUSTED_PROXIES = Object.freeze([
    '127.0.0.1/32',
    '::1/128'
]);

/**
 * Validates a configuration object against strict security and format requirements.
 *
 * @param {object} config Configuration to validate
 * @throws {TypeError|Error} If configuration fails validation
 * @returns {boolean} True if valid
 */
function validateConfig(config) {
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
        throw new TypeError('License configuration must be a non-null object');
    }

    // 1. Product ID
    if (typeof config.productId !== 'string' || !config.productId.trim()) {
        throw new TypeError('Configuration productId must be a non-empty string');
    }

    // 2. Storage validation
    if (!config.storage || typeof config.storage !== 'object') {
        throw new TypeError('Configuration storage must be an object');
    }
    if (typeof config.storage.tableName !== 'string' || !/^[a-zA-Z0-9_]+$/.test(config.storage.tableName)) {
        throw new Error('Configuration storage.tableName must be a valid SQL identifier (alphanumeric and underscore only)');
    }
    if (typeof config.storage.vaultPath !== 'string' || !config.storage.vaultPath.trim()) {
        throw new TypeError('Configuration storage.vaultPath must be a non-empty file path');
    }

    // 3. Cache validation
    if (!config.cache || typeof config.cache !== 'object') {
        throw new TypeError('Configuration cache must be an object');
    }
    if (typeof config.cache.healthyTtlMs !== 'number' || config.cache.healthyTtlMs < 0) {
        throw new TypeError('Configuration cache.healthyTtlMs must be a non-negative number');
    }
    if (typeof config.cache.degradedTtlMs !== 'number' || config.cache.degradedTtlMs < 0) {
        throw new TypeError('Configuration cache.degradedTtlMs must be a non-negative number');
    }

    // 4. Keystore validation
    if (!config.keystore || typeof config.keystore !== 'object' || Array.isArray(config.keystore)) {
        throw new TypeError('Configuration keystore must be a non-empty dictionary object');
    }

    const keyIds = Object.keys(config.keystore);
    if (keyIds.length === 0) {
        throw new Error('Configuration keystore must contain at least one trusted public key');
    }

    for (const keyId of keyIds) {
        const entry = config.keystore[keyId];
        if (!entry || typeof entry !== 'object') {
            throw new TypeError(`Keystore entry '${keyId}' must be an object`);
        }

        const rawKey = entry.publicKey || entry;
        if (typeof rawKey === 'string') {
            // Strictly assert NO private key markers exist
            if (rawKey.includes('PRIVATE KEY')) {
                throw new Error(`SECURITY VIOLATION: Private key detected in keystore entry '${keyId}'. Private keys are strictly prohibited!`);
            }
        }
    }

    return true;
}

/**
 * Creates a merged, validated, and frozen configuration instance.
 *
 * @param {object} [overrides={}] Optional configuration overrides
 * @returns {Readonly<object>} Immutable configuration instance
 */
function createLicenseConfig(overrides = {}) {
    const rawTableName = overrides.storage?.tableName || process.env.LICENSE_TABLE_NAME || DEFAULT_STORAGE.tableName;
    const rawVaultPath = overrides.storage?.vaultPath || process.env.LICENSE_VAULT_PATH || DEFAULT_STORAGE.vaultPath;

    let trustedProxies = DEFAULT_TRUSTED_PROXIES;
    if (process.env.LICENSE_TRUSTED_PROXIES) {
        trustedProxies = process.env.LICENSE_TRUSTED_PROXIES
            .split(',')
            .map(ip => ip.trim())
            .filter(Boolean);
    } else if (overrides.trustedProxies && Array.isArray(overrides.trustedProxies)) {
        trustedProxies = overrides.trustedProxies;
    }

    const config = {
        productId: overrides.productId || DEFAULT_PRODUCT_ID,
        storage: {
            tableName: rawTableName,
            vaultPath: rawVaultPath
        },
        cache: {
            healthyTtlMs: overrides.cache?.healthyTtlMs ?? DEFAULT_CACHE.healthyTtlMs,
            degradedTtlMs: overrides.cache?.degradedTtlMs ?? DEFAULT_CACHE.degradedTtlMs
        },
        trustedProxies: Object.freeze([...trustedProxies]),
        keystore: overrides.keystore || DEFAULT_KEYSTORE
    };

    validateConfig(config);

    // Deep freeze storage, cache, and top-level config
    Object.freeze(config.storage);
    Object.freeze(config.cache);
    return Object.freeze(config);
}

// Default singleton configuration instance
const defaultLicenseConfig = createLicenseConfig();

module.exports = {
    licenseConfig: defaultLicenseConfig,
    createLicenseConfig,
    validateConfig,
    DEFAULT_PRODUCT_ID,
    DEFAULT_KEYSTORE,
    DEFAULT_STORAGE,
    DEFAULT_CACHE,
    DEFAULT_TRUSTED_PROXIES
};
