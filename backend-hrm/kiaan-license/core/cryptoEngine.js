/**
 * Kiaan License Engine — Cryptographic Verification Engine
 * Module: backend-hrm/kiaan-license/core/cryptoEngine.js
 *
 * Implements PureEd25519 (RFC 8032) entitlement digital signature verification
 * using Node.js native `crypto` module.
 *
 * Cryptographic Contract:
 * - Digital Signature Algorithm: PureEd25519 (RFC 8032)
 * - Message Digest: Direct canonical UTF-8 bytes (Node.js verify algorithm argument is `null`)
 * - Canonicalization Scheme: RFC 8785 JSON Canonicalization Scheme (JCS)
 * - Signature Encoding: 64-byte raw binary signature, Base64 encoded
 * - Key Identification: Explicit `key_id` mapped via trusted public Keystore
 * - Private Keys: NEVER present, loaded, or processed in this client verification module
 */

'use strict';

const crypto = require('crypto');
const { canonicalizeToBuffer } = require('./canonicalizer');

/**
 * Expected algorithm identifier in the entitlement envelope.
 */
const SUPPORTED_ALGORITHM = 'Ed25519';

/**
 * Strict Base64 validation regex for a 64-byte Ed25519 signature.
 * 64 bytes in standard Base64 evaluates to exactly 86 base64 characters plus '==' padding (total 88 chars).
 */
const BASE64_ED25519_SIG_REGEX = /^[A-Za-z0-9+/]{86}==$/;

/**
 * Verification result status codes.
 */
const VerificationCodes = Object.freeze({
    VERIFIED: 'VERIFIED',
    MALFORMED_ENVELOPE: 'MALFORMED_ENVELOPE',
    MISSING_ENVELOPE_FIELDS: 'MISSING_ENVELOPE_FIELDS',
    UNSUPPORTED_ALGORITHM: 'UNSUPPORTED_ALGORITHM',
    INVALID_KEYSTORE: 'INVALID_KEYSTORE',
    MISSING_KEY_ID: 'MISSING_KEY_ID',
    UNKNOWN_KEY_ID: 'UNKNOWN_KEY_ID',
    REVOKED_KEY: 'REVOKED_KEY',
    INVALID_SIGNATURE_FORMAT: 'INVALID_SIGNATURE_FORMAT',
    INVALID_SIGNATURE_LENGTH: 'INVALID_SIGNATURE_LENGTH',
    CANONICALIZATION_FAILED: 'CANONICALIZATION_FAILED',
    MALFORMED_PUBLIC_KEY: 'MALFORMED_PUBLIC_KEY',
    INVALID_KEY_TYPE: 'INVALID_KEY_TYPE',
    INVALID_SIGNATURE: 'INVALID_SIGNATURE',
    VERIFICATION_ERROR: 'VERIFICATION_ERROR'
});

/**
 * Verifies a signed entitlement envelope against a trusted public Keystore.
 *
 * @param {object} envelope The signed envelope { key_id, algorithm, payload, signature }
 * @param {object} keystore Dictionary of trusted public keys keyed by key_id
 * @param {object} [options] Optional verification parameters
 * @returns {object} Verification result { valid: boolean, code: string, reason?: string, payload?: object, keyId?: string }
 */
function verifyEnvelope(envelope, keystore, options = {}) {
    try {
        // 1. Envelope Structure Validation
        if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
            return {
                valid: false,
                code: VerificationCodes.MALFORMED_ENVELOPE,
                reason: 'Envelope must be a non-null object'
            };
        }

        const { algorithm, key_id, payload, signature } = envelope;

        if (typeof algorithm !== 'string' || typeof key_id !== 'string' || payload === undefined || typeof signature !== 'string') {
            return {
                valid: false,
                code: VerificationCodes.MISSING_ENVELOPE_FIELDS,
                reason: 'Envelope is missing required fields (algorithm, key_id, payload, signature)'
            };
        }

        // 2. Algorithm Validation
        if (algorithm !== SUPPORTED_ALGORITHM) {
            return {
                valid: false,
                code: VerificationCodes.UNSUPPORTED_ALGORITHM,
                reason: `Unsupported algorithm: '${algorithm}'. Only '${SUPPORTED_ALGORITHM}' is permitted.`
            };
        }

        // 3. Keystore & Key ID Validation
        if (!keystore || typeof keystore !== 'object' || Array.isArray(keystore)) {
            return {
                valid: false,
                code: VerificationCodes.INVALID_KEYSTORE,
                reason: 'A valid keystore object is required for signature verification'
            };
        }

        const keyEntry = keystore[key_id];
        if (!keyEntry) {
            return {
                valid: false,
                code: VerificationCodes.UNKNOWN_KEY_ID,
                reason: `Signing key ID '${key_id}' was not found in the trusted keystore`
            };
        }

        // Check if key is explicitly marked as revoked in the keystore
        if (typeof keyEntry === 'object' && keyEntry !== null && keyEntry.status === 'REVOKED') {
            return {
                valid: false,
                code: VerificationCodes.REVOKED_KEY,
                reason: `The key '${key_id}' has been revoked`
            };
        }

        // Extract raw public key (supports { publicKey: '...', status: 'VALID' } or direct PEM/DER/KeyObject)
        const rawPublicKey = (typeof keyEntry === 'object' && keyEntry !== null && keyEntry.publicKey !== undefined)
            ? keyEntry.publicKey
            : keyEntry;

        // 4. Base64 Signature Format & Length Validation
        if (!BASE64_ED25519_SIG_REGEX.test(signature)) {
            return {
                valid: false,
                code: VerificationCodes.INVALID_SIGNATURE_FORMAT,
                reason: 'Signature is not a valid 64-byte Ed25519 Base64 string'
            };
        }

        const signatureBuffer = Buffer.from(signature, 'base64');
        if (signatureBuffer.length !== 64) {
            return {
                valid: false,
                code: VerificationCodes.INVALID_SIGNATURE_LENGTH,
                reason: `Decoded signature length is ${signatureBuffer.length} bytes; exactly 64 bytes required`
            };
        }

        // 5. Payload Canonicalization (RFC 8785)
        let payloadBuffer;
        try {
            payloadBuffer = canonicalizeToBuffer(payload);
        } catch (err) {
            return {
                valid: false,
                code: VerificationCodes.CANONICALIZATION_FAILED,
                reason: 'Payload could not be canonicalized according to RFC 8785'
            };
        }

        // 6. Public Key Parsing
        let publicKeyObj;
        try {
            publicKeyObj = (rawPublicKey instanceof crypto.KeyObject)
                ? rawPublicKey
                : crypto.createPublicKey(rawPublicKey);
        } catch (err) {
            return {
                valid: false,
                code: VerificationCodes.MALFORMED_PUBLIC_KEY,
                reason: 'Failed to parse public verification key'
            };
        }

        if (publicKeyObj.asymmetricKeyType !== 'ed25519') {
            return {
                valid: false,
                code: VerificationCodes.INVALID_KEY_TYPE,
                reason: `Key must be of type 'ed25519', got '${publicKeyObj.asymmetricKeyType}'`
            };
        }

        // 7. PureEd25519 Cryptographic Verification
        // Note: For PureEd25519, algorithm parameter must be null in Node.js crypto.verify
        let isVerified = false;
        try {
            isVerified = crypto.verify(null, payloadBuffer, publicKeyObj, signatureBuffer);
        } catch (err) {
            return {
                valid: false,
                code: VerificationCodes.VERIFICATION_ERROR,
                reason: 'Underlying cryptographic verification call failed'
            };
        }

        if (!isVerified) {
            return {
                valid: false,
                code: VerificationCodes.INVALID_SIGNATURE,
                reason: 'Cryptographic signature verification failed'
            };
        }

        // 8. Verification Successful
        return {
            valid: true,
            code: VerificationCodes.VERIFIED,
            keyId: key_id,
            payload: payload
        };

    } catch (err) {
        // Fail-safe catch: Any unexpected runtime exception results in a safe failure
        return {
            valid: false,
            code: VerificationCodes.VERIFICATION_ERROR,
            reason: 'Unexpected error during verification'
        };
    }
}

module.exports = {
    verifyEnvelope,
    SUPPORTED_ALGORITHM,
    VerificationCodes
};
