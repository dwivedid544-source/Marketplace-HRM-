/**
 * Kiaan Central License Authority — Configuration Loader & Startup Validator
 * Module: backend-hrm/kiaan-authority/config/authorityConfig.js
 *
 * Provides a hardened, isolated configuration boundary for the Kiaan Central
 * License Authority. Validates Ed25519 digital signing credentials and HMAC-SHA256
 * license pepper at startup with fail-closed security guarantees in production.
 *
 * ARCHITECTURAL NOTICE:
 * This loader is an isolated configuration boundary and is NOT YET WIRED into
 * production startup or server.js. It must be explicitly invoked by authority
 * bootstrap components when ready.
 *
 * Security Requirements & Guarantees:
 * 1. Zero Key Generation: Never generates keys automatically in any environment.
 * 2. Fail-Closed: Strictly rejects startup in production if signing keys or pepper
 *    are missing, malformed, or weak.
 * 3. Mutual Exclusion: Rejects configurations where both direct PEM and file path
 *    are simultaneously provided to prevent configuration ambiguity.
 * 4. Algorithm Enforcement: Strictly enforces PureEd25519 (RFC 8032).
 * 5. Public Key Pairing: If CENTRAL_EXPECTED_PUBLIC_KEY is provided, verifies that
 *    the private key's derived public key strictly matches the expected public key.
 * 6. Pepper Strength: Enforces minimum 32 bytes (256 bits) of high-entropy pepper
 *    for license key HMAC hashing. Rejects trivial or weak patterns.
 * 7. Information Disclosure Protection: Private keys and pepper material are held
 *    in private class fields (#privateKey, #pepper) and are never exposed via
 *    JSON serialization, util.inspect, console logs, or thrown errors.
 * 8. Explicit Unconfigured State: In non-production environments without keys, returns
 *    an explicit unconfigured state rather than throwing or fabricating test keys.
 */

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const util = require('util');

/**
 * Expected digital signature algorithm for Kiaan Central Authority.
 */
const SUPPORTED_ALGORITHM = 'Ed25519';

/**
 * Default trusted root key ID registered in client-side license keystore.
 */
const DEFAULT_KEY_ID = 'kiaan-root-2026-v1';

/**
 * Minimum required pepper length in bytes for HMAC-SHA256 (256 bits).
 */
const MIN_PEPPER_LENGTH = 32;

/**
 * Strict regex for Key ID format: alphanumeric, hyphens, and underscores only.
 */
const KEY_ID_REGEX = /^[a-zA-Z0-9_-]+$/;

/**
 * Known trivial patterns rejected during pepper validation.
 */
const TRIVIAL_PEPPER_PATTERNS = Object.freeze([
    'password',
    '12345678',
    'change_me',
    'secret',
    'default',
    'test_pepper_dummy'
]);

/**
 * Safely normalizes PEM strings by converting escaped literal \n to real newlines.
 *
 * @param {string} raw Raw PEM string
 * @returns {string} Normalized PEM string
 */
function normalizePemString(raw) {
    if (typeof raw !== 'string') {
        return '';
    }
    let trimmed = raw.trim();
    if (trimmed.includes('\\n')) {
        trimmed = trimmed.replace(/\\n/g, '\n');
    }
    return trimmed;
}

/**
 * Sanitizes and validates an injected HMAC pepper string or Buffer.
 *
 * @param {string|Buffer} pepper Pepper to validate
 * @throws {Error} If pepper is invalid, under 32 bytes, or trivial
 */
function validatePepper(pepper) {
    if (!pepper) {
        const err = new Error('CONFIG_MISSING_PEPPER: License pepper is required and cannot be empty.');
        err.code = 'CONFIG_MISSING_PEPPER';
        throw err;
    }

    if (typeof pepper !== 'string' && !Buffer.isBuffer(pepper)) {
        const err = new Error('CONFIG_WEAK_PEPPER: License pepper must be a string or Buffer.');
        err.code = 'CONFIG_WEAK_PEPPER';
        throw err;
    }

    const byteLen = Buffer.isBuffer(pepper) ? pepper.length : Buffer.byteLength(pepper, 'utf8');
    if (byteLen < MIN_PEPPER_LENGTH) {
        const err = new Error(`CONFIG_WEAK_PEPPER: CENTRAL_LICENSE_PEPPER must be at least ${MIN_PEPPER_LENGTH} bytes of high-entropy data (got ${byteLen} bytes).`);
        err.code = 'CONFIG_WEAK_PEPPER';
        throw err;
    }

    const strVal = (Buffer.isBuffer(pepper) ? pepper.toString('utf8') : pepper).toLowerCase();
    for (const pat of TRIVIAL_PEPPER_PATTERNS) {
        if (strVal.includes(pat) && byteLen < 48) {
            const err = new Error('CONFIG_WEAK_PEPPER: Insecure or trivial pepper pattern detected.');
            err.code = 'CONFIG_WEAK_PEPPER';
            throw err;
        }
    }
}

/**
 * Immutable Authority Configuration descriptor.
 *
 * Encapsulates validated authority settings with strict secret containment.
 */
class AuthorityConfig {
    /** @type {string} */
    #keyId;

    /** @type {string} */
    #algorithm;

    /** @type {string} */
    #nodeEnv;

    /** @type {boolean} */
    #isConfigured;

    /** @type {crypto.KeyObject|null} */
    #privateKey;

    /** @type {string|null} */
    #expectedPublicKeyPem;

    /** @type {string|Buffer|null} */
    #pepper;

    /**
     * Internal constructor. Callers should instantiate via `loadAuthorityConfig()`.
     *
     * @param {object} params Internal config parameters
     */
    constructor(params = {}) {
        this.#keyId = params.keyId || DEFAULT_KEY_ID;
        this.#algorithm = SUPPORTED_ALGORITHM;
        this.#nodeEnv = params.nodeEnv || 'development';
        this.#isConfigured = Boolean(params.isConfigured);
        this.#privateKey = params.privateKey || null;
        this.#expectedPublicKeyPem = params.expectedPublicKeyPem || null;
        this.#pepper = params.pepper || null;

        Object.freeze(this);
    }

    /**
     * Trusted signing key identifier.
     * @returns {string}
     */
    get keyId() {
        return this.#keyId;
    }

    /**
     * Active asymmetric signature algorithm.
     * @returns {string}
     */
    get algorithm() {
        return this.#algorithm;
    }

    /**
     * Current runtime environment.
     * @returns {string}
     */
    get nodeEnv() {
        return this.#nodeEnv;
    }

    /**
     * Indicates whether the authority has valid signing credentials configured.
     * @returns {boolean}
     */
    get isConfigured() {
        return this.#isConfigured;
    }

    /**
     * Indicates whether digital license signing is active and available.
     * @returns {boolean}
     */
    get canSign() {
        return this.#isConfigured && this.#privateKey !== null;
    }

    /**
     * Indicates whether a valid license pepper is configured.
     * @returns {boolean}
     */
    get hasPepper() {
        return this.#pepper !== null;
    }

    /**
     * Returns the SPKI PEM public key expected for client verification, if configured.
     * @returns {string|null}
     */
    get expectedPublicKeyPem() {
        return this.#expectedPublicKeyPem;
    }

    /**
     * Deliberate internal accessor for the Ed25519 private KeyObject.
     *
     * @returns {crypto.KeyObject}
     * @throws {Error} If private key is not configured
     */
    getPrivateKey() {
        if (!this.canSign || !this.#privateKey) {
            const err = new Error('CONFIG_UNCONFIGURED_ERROR: Signing private key is not configured.');
            err.code = 'CONFIG_UNCONFIGURED_ERROR';
            throw err;
        }
        return this.#privateKey;
    }

    /**
     * Deliberate internal accessor for the license pepper.
     *
     * @returns {string|Buffer}
     * @throws {Error} If pepper is not configured
     */
    getPepper() {
        if (!this.#pepper) {
            const err = new Error('CONFIG_UNCONFIGURED_ERROR: License pepper is not configured.');
            err.code = 'CONFIG_UNCONFIGURED_ERROR';
            throw err;
        }
        return this.#pepper;
    }

    /**
     * Exports a safe configuration dictionary suitable for initializing an AuthoritySigner.
     *
     * @returns {{ privateKey: crypto.KeyObject, keyId: string, expectedPublicKey: string|null, options: { nodeEnv: string } }}
     */
    getSignerConfig() {
        return {
            privateKey: this.getPrivateKey(),
            keyId: this.#keyId,
            expectedPublicKey: this.#expectedPublicKeyPem,
            options: { nodeEnv: this.#nodeEnv }
        };
    }

    /**
     * Deliberate factory interface for instantiating an AuthoritySigner service.
     *
     * @param {Function} AuthoritySignerClass Constructor for AuthoritySigner
     * @returns {object} Instantiated AuthoritySigner instance
     */
    createSigner(AuthoritySignerClass) {
        if (typeof AuthoritySignerClass !== 'function') {
            throw new TypeError('AuthoritySigner class constructor is required.');
        }
        return new AuthoritySignerClass(this.getSignerConfig());
    }

    /**
     * Redacted JSON serialization. Never exposes private key or pepper material.
     *
     * @returns {object} Sanitized public configuration metadata
     */
    toJSON() {
        return {
            keyId: this.#keyId,
            algorithm: this.#algorithm,
            nodeEnv: this.#nodeEnv,
            isConfigured: this.#isConfigured,
            canSign: this.canSign,
            hasPepper: this.hasPepper,
            hasExpectedPublicKey: this.#expectedPublicKeyPem !== null
        };
    }

    /**
     * Custom inspector for node console and util.inspect. Redacts all secrets.
     *
     * @returns {string}
     */
    [util.inspect.custom]() {
        return `[AuthorityConfig: keyId=${this.#keyId}, configured=${this.#isConfigured}, canSign=${this.canSign}, hasPepper=${this.hasPepper}, env=${this.#nodeEnv}]`;
    }
}

/**
 * Loads, resolves, and validates authority configuration from environment variables or overrides.
 *
 * Supported Environment Variables:
 * - `CENTRAL_SIGNING_KEY_ID`: Identifier for the signing key (default: 'kiaan-root-2026-v1').
 * - `CENTRAL_SIGNING_PRIVATE_KEY`: Raw or escaped PKCS#8 Ed25519 PEM string.
 * - `CENTRAL_SIGNING_PRIVATE_KEY_PATH`: File path to PKCS#8 Ed25519 PEM file.
 * - `CENTRAL_EXPECTED_PUBLIC_KEY`: Optional SPKI Ed25519 PEM to assert private-public pairing.
 * - `CENTRAL_LICENSE_PEPPER`: Secret pepper for HMAC-SHA256 license hashing (>= 32 bytes).
 * - `NODE_ENV`: 'production', 'development', or 'test'.
 *
 * @param {object} [options={}] Loader options
 * @param {object} [options.env=process.env] Custom environment dictionary
 * @param {boolean} [options.requireSigning] Force fail-closed if signing keys are missing
 * @param {boolean} [options.requirePepper] Force fail-closed if pepper is missing
 * @param {object} [options.fs=fs] Custom file system implementation (for testing)
 * @returns {AuthorityConfig} Validated, immutable authority configuration
 */
function loadAuthorityConfig(options = {}) {
    const env = options.env || process.env;
    const fsModule = options.fs || fs;
    const rawNodeEnv = options.nodeEnv || env.NODE_ENV || 'development';
    const nodeEnv = String(rawNodeEnv).trim().toLowerCase();
    const isProduction = nodeEnv === 'production';

    const requireSigning = options.requireSigning !== undefined ? Boolean(options.requireSigning) : isProduction;
    const requirePepper = options.requirePepper !== undefined ? Boolean(options.requirePepper) : isProduction;

    // 1. Key ID Resolution & Validation
    let keyId = DEFAULT_KEY_ID;
    if (env.CENTRAL_SIGNING_KEY_ID !== undefined) {
        const rawKeyId = String(env.CENTRAL_SIGNING_KEY_ID).trim();
        if (!rawKeyId) {
            const err = new Error('CONFIG_INVALID_KEY_ID: CENTRAL_SIGNING_KEY_ID cannot be empty if specified.');
            err.code = 'CONFIG_INVALID_KEY_ID';
            throw err;
        }
        if (!KEY_ID_REGEX.test(rawKeyId)) {
            const err = new Error(`CONFIG_INVALID_KEY_ID: Malformed Key ID '${rawKeyId}'. Must contain only alphanumeric, hyphen, and underscore characters.`);
            err.code = 'CONFIG_INVALID_KEY_ID';
            throw err;
        }
        keyId = rawKeyId;
    }

    // 2. Pepper Resolution & Validation
    let pepper = null;
    const rawPepper = env.CENTRAL_LICENSE_PEPPER;
    if (rawPepper !== undefined && rawPepper !== null && rawPepper !== '') {
        validatePepper(rawPepper);
        pepper = rawPepper;
    } else if (requirePepper) {
        const err = new Error('CONFIG_MISSING_PEPPER: CENTRAL_LICENSE_PEPPER is required in production environment.');
        err.code = 'CONFIG_MISSING_PEPPER';
        throw err;
    }

    // 3. Private Key Source Resolution
    const directKeyVal = env.CENTRAL_SIGNING_PRIVATE_KEY;
    const pathKeyVal = env.CENTRAL_SIGNING_PRIVATE_KEY_PATH;

    const hasDirectKey = typeof directKeyVal === 'string' && directKeyVal.trim().length > 0;
    const hasPathKey = typeof pathKeyVal === 'string' && pathKeyVal.trim().length > 0;

    // Mutual Exclusion Check: Reject simultaneous configuration
    if (hasDirectKey && hasPathKey) {
        const err = new Error('CONFIG_MUTUAL_EXCLUSION_ERROR: Both CENTRAL_SIGNING_PRIVATE_KEY and CENTRAL_SIGNING_PRIVATE_KEY_PATH are configured. Only one private key source is permitted.');
        err.code = 'CONFIG_MUTUAL_EXCLUSION_ERROR';
        throw err;
    }

    // Missing Key Handling
    if (!hasDirectKey && !hasPathKey) {
        if (requireSigning) {
            const err = new Error('CONFIG_MISSING_PRIVATE_KEY: Central signing private key is required but neither CENTRAL_SIGNING_PRIVATE_KEY nor CENTRAL_SIGNING_PRIVATE_KEY_PATH is configured.');
            err.code = 'CONFIG_MISSING_PRIVATE_KEY';
            throw err;
        }

        // Return explicit unconfigured state for non-production environments
        return new AuthorityConfig({
            keyId,
            nodeEnv,
            isConfigured: false,
            privateKey: null,
            expectedPublicKeyPem: null,
            pepper
        });
    }

    // 4. Ingest Raw Key PEM
    let rawPem = '';
    if (hasPathKey) {
        const filePath = pathKeyVal.trim();
        try {
            rawPem = fsModule.readFileSync(filePath, 'utf8');
        } catch (fsErr) {
            const err = new Error(`CONFIG_KEY_FILE_ERROR: Unable to read private key from path '${filePath}': ${fsErr.message}`);
            err.code = 'CONFIG_KEY_FILE_ERROR';
            throw err;
        }

        if (!rawPem || !rawPem.trim()) {
            const err = new Error(`CONFIG_KEY_FILE_ERROR: Private key file at '${filePath}' is empty.`);
            err.code = 'CONFIG_KEY_FILE_ERROR';
            throw err;
        }
    } else {
        rawPem = directKeyVal;
    }

    // 5. Normalize PEM formatting (handle escaped \n safely)
    const normalizedPem = normalizePemString(rawPem);

    // 6. Parse and Validate Private Key Object
    let privKeyObj;
    try {
        privKeyObj = crypto.createPrivateKey(normalizedPem);
    } catch (_) {
        const err = new Error('CONFIG_KEY_PARSE_ERROR: Failed to parse private signing key. Ensure valid PKCS#8 PEM formatting.');
        err.code = 'CONFIG_KEY_PARSE_ERROR';
        throw err;
    }

    if (privKeyObj.type !== 'private') {
        const err = new Error('CONFIG_KEY_PARSE_ERROR: Loaded key is not an asymmetric private key.');
        err.code = 'CONFIG_KEY_PARSE_ERROR';
        throw err;
    }

    // Algorithm Enforcement: Strictly Ed25519
    if (privKeyObj.asymmetricKeyType !== 'ed25519') {
        const err = new Error(`CONFIG_INVALID_KEY_TYPE: Incompatible key algorithm: expected 'ed25519', got '${privKeyObj.asymmetricKeyType}'.`);
        err.code = 'CONFIG_INVALID_KEY_TYPE';
        throw err;
    }

    // 7. Derive Public Key
    let derivedPubKeyObj;
    let derivedPubPem;
    try {
        derivedPubKeyObj = crypto.createPublicKey(privKeyObj);
        derivedPubPem = derivedPubKeyObj.export({ type: 'spki', format: 'pem' });
    } catch (_) {
        const err = new Error('CONFIG_KEY_DERIVATION_ERROR: Failed to derive public key from private signing key.');
        err.code = 'CONFIG_KEY_DERIVATION_ERROR';
        throw err;
    }

    // 8. Expected Public Key Verification (if supplied)
    let expectedPublicKeyPem = null;
    const rawExpectedPub = env.CENTRAL_EXPECTED_PUBLIC_KEY;
    if (rawExpectedPub !== undefined && rawExpectedPub !== null && String(rawExpectedPub).trim() !== '') {
        const normalizedExpectedPub = normalizePemString(String(rawExpectedPub));
        let expectedPubKeyObj;
        try {
            expectedPubKeyObj = crypto.createPublicKey(normalizedExpectedPub);
        } catch (_) {
            const err = new Error('CONFIG_PUBLIC_KEY_PARSE_ERROR: Failed to parse expected public key. Ensure valid SPKI PEM formatting.');
            err.code = 'CONFIG_PUBLIC_KEY_PARSE_ERROR';
            throw err;
        }

        if (expectedPubKeyObj.asymmetricKeyType !== 'ed25519') {
            const err = new Error(`CONFIG_INVALID_KEY_TYPE: Expected public key is of type '${expectedPubKeyObj.asymmetricKeyType}', expected 'ed25519'.`);
            err.code = 'CONFIG_INVALID_KEY_TYPE';
            throw err;
        }

        const expectedExported = expectedPubKeyObj.export({ type: 'spki', format: 'pem' });
        if (derivedPubPem.trim() !== expectedExported.trim()) {
            const err = new Error('CONFIG_KEY_MISMATCH: Injected private key does not correspond to expected public key.');
            err.code = 'CONFIG_KEY_MISMATCH';
            throw err;
        }
        expectedPublicKeyPem = expectedExported;
    }

    // 9. Assemble and return immutable AuthorityConfig instance
    return new AuthorityConfig({
        keyId,
        nodeEnv,
        isConfigured: true,
        privateKey: privKeyObj,
        expectedPublicKeyPem,
        pepper
    });
}

/**
 * Validates an existing AuthorityConfig instance or throws sanitized configuration errors.
 *
 * @param {AuthorityConfig} config Configuration instance to validate
 * @returns {boolean} True if configuration is valid and meets environment requirements
 */
function validateAuthorityConfig(config) {
    if (!config || !(config instanceof AuthorityConfig)) {
        const err = new Error('CONFIG_INVALID_INSTANCE: Expected an instance of AuthorityConfig.');
        err.code = 'CONFIG_INVALID_INSTANCE';
        throw err;
    }

    if (config.nodeEnv === 'production') {
        if (!config.canSign) {
            const err = new Error('CONFIG_MISSING_PRIVATE_KEY: Production authority configuration must have signing credentials configured.');
            err.code = 'CONFIG_MISSING_PRIVATE_KEY';
            throw err;
        }
        if (!config.hasPepper) {
            const err = new Error('CONFIG_MISSING_PEPPER: Production authority configuration must have license pepper configured.');
            err.code = 'CONFIG_MISSING_PEPPER';
            throw err;
        }
    }

    return true;
}

module.exports = {
    AuthorityConfig,
    loadAuthorityConfig,
    validateAuthorityConfig,
    validatePepper,
    DEFAULT_KEY_ID,
    SUPPORTED_ALGORITHM,
    MIN_PEPPER_LENGTH,
    KEY_ID_REGEX
};
