/**
 * Kiaan Central License Authority — Outbox Cryptographic Envelope
 * Module: backend-hrm/kiaan-authority/services/outboxCrypto.js
 *
 * Implements authenticated encryption (AES-256-GCM) for license email outbox
 * payloads. Ensures that plaintext license keys are NEVER stored unencrypted
 * in persistent storage (e.g. `license_email_outbox.html_content`).
 *
 * Security Requirements & Guarantees:
 * 1. Authenticated Encryption: AES-256-GCM with 128-bit authentication tag.
 * 2. Dedicated Encryption Key: Must be 32 bytes (256 bits) from OUTBOX_ENCRYPTION_KEY.
 *    Never reuses CENTRAL_LICENSE_PEPPER or derives keys from buyer email/license ID.
 * 3. Unique Nonce/IV: Random 12-byte (96-bit) CSPRNG IV per record (NIST SP 800-38D).
 * 4. Authentication Integrity: Tampered ciphertext or wrong key throws
 *    PAYLOAD_AUTHENTICATION_FAILED without leaking plaintext or keys.
 * 5. Secret Containment: Plaintext keys, peppers, and encryption keys are scrubbed
 *    from error messages and logs.
 */

'use strict';

const crypto = require('crypto');

/**
 * Supported authenticated encryption algorithm.
 */
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';

/**
 * Expected IV length for AES-GCM (12 bytes / 96 bits).
 */
const GCM_IV_LENGTH_BYTES = 12;

/**
 * Expected authentication tag length for AES-GCM (16 bytes / 128 bits).
 */
const GCM_TAG_LENGTH_BYTES = 16;

/**
 * Minimum required encryption key length (32 bytes / 256 bits).
 */
const KEY_LENGTH_BYTES = 32;

/**
 * Envelope marker for sealed email payloads.
 */
const SEALED_PAYLOAD_TYPE = 'SEALED_EMAIL_PAYLOAD';

/**
 * Known trivial patterns rejected during key validation.
 */
const TRIVIAL_KEY_PATTERNS = Object.freeze([
    '0000000000000000000000000000000000000000000000000000000000000000',
    '1234567890123456789012345678901234567890123456789012345678901234',
    'password',
    'change_me',
    'default'
]);

/**
 * Validates and normalizes an AES-256 encryption key.
 *
 * @param {string|Buffer} rawKey Key as Buffer or 64-char hex string
 * @returns {Buffer} Normalized 32-byte key buffer
 * @throws {Error} If key is missing, weak, or invalid length
 */
function validateEncryptionKey(rawKey) {
    if (!rawKey) {
        const err = new Error('CONFIG_MISSING_ENCRYPTION_KEY: Outbox encryption key is required.');
        err.code = 'CONFIG_MISSING_ENCRYPTION_KEY';
        throw err;
    }

    let keyBuffer;
    if (Buffer.isBuffer(rawKey)) {
        keyBuffer = rawKey;
    } else if (typeof rawKey === 'string') {
        const trimmed = rawKey.trim();
        // Check for 64-character hex string
        if (/^[a-fA-F0-9]{64}$/.test(trimmed)) {
            keyBuffer = Buffer.from(trimmed, 'hex');
        } else {
            // Raw UTF-8 string
            keyBuffer = Buffer.from(trimmed, 'utf8');
        }
    } else {
        const err = new Error('CONFIG_INVALID_KEY_TYPE: Outbox encryption key must be a string or Buffer.');
        err.code = 'CONFIG_INVALID_KEY_TYPE';
        throw err;
    }

    if (keyBuffer.length !== KEY_LENGTH_BYTES) {
        const err = new Error(
            `CONFIG_WEAK_ENCRYPTION_KEY: Outbox encryption key must be exactly ${KEY_LENGTH_BYTES} bytes (256 bits). Received ${keyBuffer.length} bytes.`
        );
        err.code = 'CONFIG_WEAK_ENCRYPTION_KEY';
        throw err;
    }

    // Reject known trivial patterns
    const hex = keyBuffer.toString('hex').toLowerCase();
    for (const pattern of TRIVIAL_KEY_PATTERNS) {
        if (hex.includes(pattern.toLowerCase())) {
            const err = new Error('CONFIG_TRIVIAL_ENCRYPTION_KEY: Outbox encryption key contains an insecure trivial pattern.');
            err.code = 'CONFIG_TRIVIAL_ENCRYPTION_KEY';
            throw err;
        }
    }

    return keyBuffer;
}

/**
 * Determines whether a string represents a sealed outbox payload envelope.
 *
 * @param {string} content Stored outbox content
 * @returns {boolean} True if sealed envelope JSON
 */
function isSealedPayload(content) {
    if (typeof content !== 'string') return false;
    const trimmed = content.trim();
    if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return false;
    return trimmed.includes(`"type":"${SEALED_PAYLOAD_TYPE}"`) ||
           trimmed.includes(`"type": "${SEALED_PAYLOAD_TYPE}"`);
}

/**
 * Seals an email payload object using authenticated AES-256-GCM.
 *
 * @param {object} payload Payload object containing sensitive license parameters
 * @param {string|Buffer} key 32-byte encryption key
 * @returns {string} Sealed JSON envelope string for safe persistent storage
 */
function sealOutboxPayload(payload, key) {
    if (!payload || typeof payload !== 'object') {
        const err = new Error('INVALID_PAYLOAD: Payload to seal must be a non-null object.');
        err.code = 'INVALID_PAYLOAD';
        throw err;
    }

    const keyBuffer = validateEncryptionKey(key);
    const iv = crypto.randomBytes(GCM_IV_LENGTH_BYTES);

    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, keyBuffer, iv);
    const plaintext = JSON.stringify(payload);

    let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
    ciphertext += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    const envelope = {
        type: SEALED_PAYLOAD_TYPE,
        version: 1,
        algorithm: ENCRYPTION_ALGORITHM,
        iv: iv.toString('hex'),
        tag: authTag.toString('hex'),
        ciphertext: ciphertext
    };

    return JSON.stringify(envelope);
}

/**
 * Unseals an email payload from persistent storage.
 * If the content is an authenticated sealed envelope, decrypts and validates it.
 * If the content is legacy unsealed HTML, returns it safely with `isSealed: false`.
 *
 * @param {string} content Stored outbox content
 * @param {string|Buffer} [key] 32-byte encryption key (required if content is sealed)
 * @returns {{ isSealed: boolean, payload?: object, rawHtml?: string }}
 * @throws {Error} PAYLOAD_AUTHENTICATION_FAILED if tampering or incorrect key is detected
 */
function unsealOutboxPayload(content, key) {
    if (typeof content !== 'string') {
        const err = new Error('INVALID_CONTENT: Content must be a string.');
        err.code = 'INVALID_CONTENT';
        throw err;
    }

    if (!isSealedPayload(content)) {
        return {
            isSealed: false,
            rawHtml: content
        };
    }

    let envelope;
    try {
        envelope = JSON.parse(content);
    } catch (_) {
        const err = new Error('PAYLOAD_CORRUPTED: Sealed payload contains malformed JSON.');
        err.code = 'PAYLOAD_CORRUPTED';
        throw err;
    }

    if (!envelope || envelope.type !== SEALED_PAYLOAD_TYPE) {
        return { isSealed: false, rawHtml: content };
    }

    if (!envelope.iv || !envelope.tag || !envelope.ciphertext) {
        const err = new Error('PAYLOAD_MALFORMED: Sealed payload missing iv, tag, or ciphertext.');
        err.code = 'PAYLOAD_MALFORMED';
        throw err;
    }

    const keyBuffer = validateEncryptionKey(key);

    let ivBuffer;
    let tagBuffer;
    try {
        ivBuffer = Buffer.from(envelope.iv, 'hex');
        tagBuffer = Buffer.from(envelope.tag, 'hex');
    } catch (_) {
        const err = new Error('PAYLOAD_MALFORMED: Failed to decode hex iv or tag.');
        err.code = 'PAYLOAD_MALFORMED';
        throw err;
    }

    if (ivBuffer.length !== GCM_IV_LENGTH_BYTES || tagBuffer.length !== GCM_TAG_LENGTH_BYTES) {
        const err = new Error('PAYLOAD_MALFORMED: Invalid IV or authentication tag length.');
        err.code = 'PAYLOAD_MALFORMED';
        throw err;
    }

    try {
        const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, keyBuffer, ivBuffer);
        decipher.setAuthTag(tagBuffer);

        let decrypted = decipher.update(envelope.ciphertext, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        const payload = JSON.parse(decrypted);
        return {
            isSealed: true,
            payload
        };
    } catch (err) {
        // Fail closed on authentication or decryption failure
        const authErr = new Error('PAYLOAD_AUTHENTICATION_FAILED: Sealed payload failed cryptographic authentication check.');
        authErr.code = 'PAYLOAD_AUTHENTICATION_FAILED';
        throw authErr;
    }
}

/**
 * Sanitizes any error message to guarantee that sensitive credentials,
 * plaintext license keys, peppers, or encryption keys are never leaked.
 *
 * @param {Error|string} err Error or error message to sanitize
 * @returns {string} Sanitized, secret-free error message
 */
function sanitizeOutboxError(err) {
    if (!err) return 'Unknown error occurred';
    let msg = typeof err === 'string' ? err : (err.message || String(err));

    // Redact 40-character hex keys (e.g. 160-bit license keys)
    msg = msg.replace(/\b[a-fA-F0-9]{40}\b/g, '[REDACTED_LICENSE_KEY]');

    // Redact 64-character hex strings (e.g. 256-bit peppers, encryption keys, private key fragments)
    msg = msg.replace(/\b[a-fA-F0-9]{64}\b/g, '[REDACTED_SECRET]');

    // Redact Bearer / API tokens
    msg = msg.replace(/xkeysib-[a-zA-Z0-9_-]+/g, '[REDACTED_API_KEY]');
    msg = msg.replace(/Bearer\s+[a-zA-Z0-9._-]+/gi, 'Bearer [REDACTED_TOKEN]');

    // Limit length to safe column size (MySQL TEXT)
    if (msg.length > 500) {
        msg = msg.slice(0, 497) + '...';
    }

    return msg;
}

module.exports = {
    ENCRYPTION_ALGORITHM,
    GCM_IV_LENGTH_BYTES,
    GCM_TAG_LENGTH_BYTES,
    KEY_LENGTH_BYTES,
    SEALED_PAYLOAD_TYPE,
    validateEncryptionKey,
    isSealedPayload,
    sealOutboxPayload,
    unsealOutboxPayload,
    sanitizeOutboxError
};
