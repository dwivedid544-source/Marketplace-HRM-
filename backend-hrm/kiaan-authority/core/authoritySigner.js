/**
 * Kiaan Central License Authority — Central Ed25519 Authority Signer
 * Module: backend-hrm/kiaan-authority/core/authoritySigner.js
 *
 * Implements an isolated, cryptographically secure Ed25519 license signer that
 * generates signed entitlement envelopes adhering strictly to the client-side
 * verification contract defined in `backend-hrm/kiaan-license/core/cryptoEngine.js`.
 *
 * Cryptographic Specifications:
 * 1. Digital Signature Algorithm: PureEd25519 (RFC 8032).
 * 2. Canonicalization: RFC 8785 JSON Canonicalization Scheme (JCS) via `canonicalizer.js`.
 * 3. Message Digest: Direct canonical UTF-8 bytes (Node.js crypto.sign algorithm argument is `null`).
 * 4. Signature Encoding: Raw 64-byte signature, standard Base64 encoded (88 characters, ending in '==').
 * 5. Envelope Structure: Strict 4-field envelope { algorithm, key_id, payload, signature }.
 * 6. Memory Isolation: Private key material is strictly encapsulated in private class fields (#privateKey).
 * 7. Information Disclosure Resistance: `toJSON()`, `util.inspect.custom`, and error messages
 *    strictly redact private key references.
 */

'use strict';

const crypto = require('crypto');
const util = require('util');
const { canonicalizeToBuffer } = require('../../kiaan-license/core/canonicalizer');

/**
 * Expected algorithm identifier for entitlement envelopes.
 */
const SUPPORTED_ALGORITHM = 'Ed25519';

/**
 * Default key ID registered in client-side licenseConfig keystore.
 */
const DEFAULT_KEY_ID = 'kiaan-root-2026-v1';

/**
 * Approved product identifier for Kiaan HRM Pro.
 */
const APPROVED_PRODUCT_ID = 'kiaan-hrm';

/**
 * Strict Base64 validation regex for 64-byte Ed25519 signature (88 chars ending in ==).
 */
const BASE64_ED25519_SIG_REGEX = /^[A-Za-z0-9+/]{86}==$/;

/**
 * Hostname validation regex (standard domain name or loopback/local labels, no protocol or port).
 */
const DOMAIN_REGEX = /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$|^localhost$|^127\.0\.0\.1$|^::1$/;

class AuthoritySigner {
    /** @type {crypto.KeyObject} */
    #privateKey;

    /** @type {crypto.KeyObject} */
    #publicKey;

    /** @type {string} */
    #publicKeyPem;

    /** @type {string} */
    #keyId;

    /**
     * Instantiates an AuthoritySigner service.
     *
     * @param {object} config Signer configuration
     * @param {string|Buffer|crypto.KeyObject} config.privateKey PKCS#8 Ed25519 Private Key
     * @param {string} [config.keyId=DEFAULT_KEY_ID] Trusted key identifier
     * @param {string|Buffer|crypto.KeyObject} [config.expectedPublicKey] Optional expected public key for pairing validation
     * @param {object} [config.options] Configuration flags (e.g. { nodeEnv: 'production' })
     */
    constructor(config = {}) {
        if (!config || typeof config !== 'object' || Array.isArray(config)) {
            throw new TypeError('SIGNER_CONFIGURATION_ERROR: Signer configuration must be a non-null object.');
        }

        const nodeEnv = config.options?.nodeEnv || process.env.NODE_ENV || 'development';

        // 1. Private Key Presence Check
        if (!config.privateKey) {
            throw new Error('SIGNER_CONFIGURATION_ERROR: Private signing key is required and cannot be empty.');
        }

        // 2. Private Key Ingestion & Validation
        let privKeyObj;
        try {
            if (config.privateKey instanceof crypto.KeyObject) {
                if (config.privateKey.type !== 'private') {
                    throw new Error('Injected KeyObject must be of type "private".');
                }
                privKeyObj = config.privateKey;
            } else if (typeof config.privateKey === 'string' || Buffer.isBuffer(config.privateKey)) {
                privKeyObj = crypto.createPrivateKey(config.privateKey);
            } else {
                throw new TypeError('Private key must be a PEM string, Buffer, or crypto.KeyObject.');
            }
        } catch (err) {
            throw new Error(`SIGNER_KEY_ERROR: Failed to load private signing key: ${err.message}`);
        }

        // 3. Algorithm Enforcement: Strictly Ed25519
        if (privKeyObj.asymmetricKeyType !== 'ed25519') {
            throw new Error(`SIGNER_KEY_ERROR: Incompatible key algorithm: expected 'ed25519', got '${privKeyObj.asymmetricKeyType}'.`);
        }

        // 4. Derive Public Key
        let derivedPubKeyObj;
        let derivedPubPem;
        try {
            derivedPubKeyObj = crypto.createPublicKey(privKeyObj);
            derivedPubPem = derivedPubKeyObj.export({ type: 'spki', format: 'pem' });
        } catch (err) {
            throw new Error(`SIGNER_KEY_ERROR: Failed to derive public key from private key: ${err.message}`);
        }

        // 5. Expected Public Key Matching (if supplied)
        if (config.expectedPublicKey) {
            let expectedPubKeyObj;
            try {
                if (config.expectedPublicKey instanceof crypto.KeyObject) {
                    expectedPubKeyObj = config.expectedPublicKey;
                } else if (typeof config.expectedPublicKey === 'string' || Buffer.isBuffer(config.expectedPublicKey)) {
                    expectedPubKeyObj = crypto.createPublicKey(config.expectedPublicKey);
                } else {
                    throw new TypeError('Expected public key must be a PEM string, Buffer, or crypto.KeyObject.');
                }
            } catch (err) {
                throw new Error(`SIGNER_KEY_MISMATCH: Failed to parse expected public key: ${err.message}`);
            }

            if (expectedPubKeyObj.asymmetricKeyType !== 'ed25519') {
                throw new Error(`SIGNER_KEY_MISMATCH: Expected public key is of type '${expectedPubKeyObj.asymmetricKeyType}', expected 'ed25519'.`);
            }

            const expectedPubPem = expectedPubKeyObj.export({ type: 'spki', format: 'pem' });
            if (derivedPubPem.trim() !== expectedPubPem.trim()) {
                throw new Error('SIGNER_KEY_MISMATCH: Injected private key does not correspond to the expected public key.');
            }
        }

        // 6. Key ID Validation
        const rawKeyId = config.keyId !== undefined ? config.keyId : DEFAULT_KEY_ID;
        if (typeof rawKeyId !== 'string' || !rawKeyId.trim()) {
            throw new TypeError('SIGNER_CONFIGURATION_ERROR: Key ID must be a non-empty string.');
        }

        const keyId = rawKeyId.trim();
        if (!/^[a-zA-Z0-9_-]+$/.test(keyId)) {
            throw new Error(`SIGNER_CONFIGURATION_ERROR: Malformed Key ID '${keyId}'. Must contain only alphanumeric, hyphen, and underscore characters.`);
        }

        // 7. Startup Self-Verification Sanity Check
        try {
            const probePayload = { _probe: true, timestamp: Date.now() };
            const probeBuffer = canonicalizeToBuffer(probePayload);
            const probeSignature = crypto.sign(null, probeBuffer, privKeyObj);
            const isSelfValid = crypto.verify(null, probeBuffer, derivedPubKeyObj, probeSignature);
            if (!isSelfValid) {
                throw new Error('Internal Ed25519 self-verification failed.');
            }
        } catch (err) {
            throw new Error(`SIGNER_INITIALIZATION_ERROR: Self-verification sanity check failed: ${err.message}`);
        }

        // 8. Seal Internal State
        this.#privateKey = privKeyObj;
        this.#publicKey = derivedPubKeyObj;
        this.#publicKeyPem = derivedPubPem;
        this.#keyId = keyId;

        Object.freeze(this);
    }

    /**
     * Active signing key ID.
     * @returns {string}
     */
    get keyId() {
        return this.#keyId;
    }

    /**
     * Active signature algorithm.
     * @returns {string}
     */
    get algorithm() {
        return SUPPORTED_ALGORITHM;
    }

    /**
     * Exports the public key entry suitable for injection into a trusted client keystore.
     *
     * @returns {{ keyId: string, algorithm: string, publicKey: string, status: string }}
     */
    getPublicKeyEntry() {
        return Object.freeze({
            keyId: this.#keyId,
            algorithm: SUPPORTED_ALGORITHM,
            publicKey: this.#publicKeyPem,
            status: 'VALID'
        });
    }

    /**
     * Signs an entitlement payload into an immutable, client-compatible Ed25519 envelope.
     *
     * Validation Rules:
     * - Payload must be a plain object (not null or array).
     * - `product_id` must be strictly 'kiaan-hrm'.
     * - `licensed_domain` must be a non-empty valid hostname or IP.
     * - `sequence_number` must be an integer >= 1.
     * - Payload is defensively cloned to isolate callers from mutations.
     *
     * @param {object} payload Authorization entitlements
     * @returns {object} Immutable signed envelope { algorithm, key_id, payload, signature }
     */
    signEnvelope(payload) {
        // 1. Structure validation
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
            throw new TypeError('INVALID_PAYLOAD: Payload must be a non-null plain object.');
        }

        // 2. Product ID validation
        if (payload.product_id !== APPROVED_PRODUCT_ID) {
            throw new Error(`INVALID_PRODUCT_ID: Product ID must be strictly '${APPROVED_PRODUCT_ID}', got '${payload.product_id}'.`);
        }

        // 3. Licensed domain validation
        if (typeof payload.licensed_domain !== 'string' || !payload.licensed_domain.trim()) {
            throw new Error('INVALID_DOMAIN: licensed_domain must be a non-empty string.');
        }

        const domainTrimmed = payload.licensed_domain.trim().toLowerCase();
        if (!DOMAIN_REGEX.test(domainTrimmed)) {
            throw new Error(`INVALID_DOMAIN: licensed_domain '${payload.licensed_domain}' is not a valid hostname or IP address.`);
        }

        // Validate domain_aliases if provided
        if (payload.domain_aliases !== undefined) {
            if (!Array.isArray(payload.domain_aliases)) {
                throw new TypeError('INVALID_DOMAIN_ALIASES: domain_aliases must be an array of strings.');
            }
            for (const alias of payload.domain_aliases) {
                if (typeof alias !== 'string' || !alias.trim()) {
                    throw new Error('INVALID_DOMAIN_ALIASES: All domain_aliases must be non-empty strings.');
                }
            }
        }

        // 4. Sequence number validation
        if (typeof payload.sequence_number !== 'number' || !Number.isInteger(payload.sequence_number) || payload.sequence_number < 1) {
            throw new Error('INVALID_SEQUENCE_NUMBER: sequence_number must be an integer greater than or equal to 1.');
        }

        // 5. Defensive Deep Clone
        // Protects against external mutations to the caller's payload reference after signing
        let safePayload;
        try {
            safePayload = JSON.parse(JSON.stringify(payload));
        } catch (err) {
            throw new Error(`INVALID_PAYLOAD: Failed to serialize payload for signing: ${err.message}`);
        }

        // 6. RFC 8785 Canonicalization
        let canonicalBuffer;
        try {
            canonicalBuffer = canonicalizeToBuffer(safePayload);
        } catch (err) {
            throw new Error(`CANONICALIZATION_FAILED: Payload contains non-canonicalizable values: ${err.message}`);
        }

        // 7. PureEd25519 Signing (algorithm parameter is strictly null)
        let signatureBuffer;
        try {
            signatureBuffer = crypto.sign(null, canonicalBuffer, this.#privateKey);
        } catch (err) {
            throw new Error(`SIGNING_FAILED: Underlying cryptographic signing operation failed: ${err.message}`);
        }

        if (signatureBuffer.length !== 64) {
            throw new Error(`SIGNING_FAILED: Expected 64-byte signature, got ${signatureBuffer.length} bytes.`);
        }

        const signatureBase64 = signatureBuffer.toString('base64');
        if (!BASE64_ED25519_SIG_REGEX.test(signatureBase64)) {
            throw new Error('SIGNING_FAILED: Produced signature does not match required 88-character Base64 format.');
        }

        // 8. Return Immutable Envelope
        return Object.freeze({
            algorithm: SUPPORTED_ALGORITHM,
            key_id: this.#keyId,
            payload: safePayload,
            signature: signatureBase64
        });
    }

    /**
     * Verifies an envelope against the active public key (internal self-verification).
     *
     * @param {object} envelope Envelope to verify
     * @returns {{ valid: boolean, code: string, reason?: string }}
     */
    verifySelf(envelope) {
        if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
            return { valid: false, code: 'MALFORMED_ENVELOPE', reason: 'Envelope must be a non-null object.' };
        }

        const { algorithm, key_id, payload, signature } = envelope;

        if (algorithm !== SUPPORTED_ALGORITHM) {
            return { valid: false, code: 'UNSUPPORTED_ALGORITHM', reason: `Algorithm must be '${SUPPORTED_ALGORITHM}'.` };
        }

        if (key_id !== this.#keyId) {
            return { valid: false, code: 'UNKNOWN_KEY_ID', reason: `Key ID mismatch: expected '${this.#keyId}', got '${key_id}'.` };
        }

        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
            return { valid: false, code: 'MISSING_ENVELOPE_FIELDS', reason: 'Envelope payload must be a non-null object.' };
        }

        if (typeof signature !== 'string' || !BASE64_ED25519_SIG_REGEX.test(signature)) {
            return { valid: false, code: 'INVALID_SIGNATURE_FORMAT', reason: 'Signature must be an 88-character Base64 string.' };
        }

        const signatureBuffer = Buffer.from(signature, 'base64');
        if (signatureBuffer.length !== 64) {
            return { valid: false, code: 'INVALID_SIGNATURE_LENGTH', reason: 'Decoded signature must be exactly 64 bytes.' };
        }

        let payloadBuffer;
        try {
            payloadBuffer = canonicalizeToBuffer(payload);
        } catch {
            return { valid: false, code: 'CANONICALIZATION_FAILED', reason: 'Failed to canonicalize payload.' };
        }

        let isVerified = false;
        try {
            isVerified = crypto.verify(null, payloadBuffer, this.#publicKey, signatureBuffer);
        } catch {
            return { valid: false, code: 'VERIFICATION_ERROR', reason: 'Underlying verification call failed.' };
        }

        if (!isVerified) {
            return { valid: false, code: 'INVALID_SIGNATURE', reason: 'Cryptographic signature verification failed.' };
        }

        return { valid: true, code: 'VERIFIED' };
    }

    /**
     * Redacted JSON serialization. Never exposes private key references.
     * @returns {object}
     */
    toJSON() {
        return {
            keyId: this.#keyId,
            algorithm: SUPPORTED_ALGORITHM,
            status: 'INITIALIZED'
        };
    }

    /**
     * Custom inspector for node console/util.inspect. Redacts private key material.
     * @returns {string}
     */
    [util.inspect.custom]() {
        return `[AuthoritySigner: keyId=${this.#keyId}, algorithm=${SUPPORTED_ALGORITHM}]`;
    }
}

module.exports = {
    AuthoritySigner,
    SUPPORTED_ALGORITHM,
    DEFAULT_KEY_ID,
    APPROVED_PRODUCT_ID,
    BASE64_ED25519_SIG_REGEX
};
