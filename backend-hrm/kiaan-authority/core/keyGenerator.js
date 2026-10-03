/**
 * Kiaan Central License Authority — Secure License Key Generator & HMAC Engine
 * Module: backend-hrm/kiaan-authority/core/keyGenerator.js
 *
 * Implements cryptographically secure license key generation, Crockford Base32
 * formatting, CRC16-CCITT typo-detection checksum validation, key normalization,
 * and HMAC-SHA256 key hashing at rest with pepper isolation.
 *
 * Cryptographic Contract & Specifications:
 * 1. Entropy:
 *    - Exactly 160 bits (20 bytes) of cryptographically secure pseudo-random entropy
 *      sourced exclusively via Node.js native `crypto.randomBytes(20)`.
 *    - Strictly satisfies and exceeds the >= 128-bit security requirement.
 * 2. Encoding & Character Layout:
 *    - Encoding Alphabet: Douglas Crockford Base32 (0123456789ABCDEFGHJKMNPQRSTVWXYZ).
 *    - 20 bytes (160 bits) maps bijectively to exactly 32 Crockford characters (32 * 5 = 160 bits).
 *    - Payload Padding: Exactly ZERO padding bits for payload entropy.
 *    - Payload Blocks: 8 blocks of 4 characters each (b0..b7).
 * 3. Typo-Detection Checksum (CRC16-CCITT):
 *    - NOT A SECURITY MECHANISM: CRC16-CCITT is strictly a fast, client-side error-detecting
 *      checksum designed to catch typographical errors (transpositions, single-character typos)
 *      before database lookup. It provides ZERO cryptographic authentication or tamper-proofing.
 *    - Cryptographic authentication and integrity are strictly provided by HMAC-SHA256 at rest
 *      and Ed25519 digital signatures in transit.
 *    - Polynomial: 0x1021, Initial Value: 0xFFFF.
 *    - Computed over: `${prefix}-${b0}-${b1}-${b2}-${b3}-${b4}-${b5}-${b6}-${b7}`.
 *    - Checksum Block: 1 block of 4 Crockford characters (b8 / CCCC).
 *    - Checksum Padding: The 16-bit CRC occupies 16 bits of the 20-bit block. Bits 3..0 of
 *      the 4th character are zero-padding bits and are strictly enforced to be zero.
 * 4. Canonical Key Structure:
 *    - Format: `PREFIX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-CCCC`
 *    - 9 blocks of 4 Crockford Base32 characters (36 total characters after prefix).
 *    - Example: `KHRM-7A39-K2XP-88N4-92MF-1B4C-99ZX-78TR-42MN-H000` (49 characters total).
 * 5. HMAC-SHA256 Construction:
 *    - Construction: `HMAC-SHA256(key = CENTRAL_LICENSE_PEPPER, message = normalized_license_key)`
 *    - Pepper: Minimum 32 bytes (256 bits) of high-entropy secret material.
 *      - If pepper is a `Buffer`, its raw binary bytes are used directly as the HMAC key.
 *      - If pepper is a `string`, it is interpreted as UTF-8 bytes (`Buffer.byteLength(pepper, 'utf8') >= 32`).
 *    - Message: `normalized_license_key` (canonical uppercase string encoded as UTF-8).
 *    - Comparison: Fixed-length 32-byte constant-time comparison via `crypto.timingSafeEqual`.
 * 6. Masked Hints:
 *    - Database column: `key_hint VARCHAR(25)`
 *    - Structure: `KHRM-XXXX-****-****-CCCC` (24 characters, fits in VARCHAR(25)).
 *    - Masks 140 bits of entropy (blocks 1 through 7).
 * 7. Deprecation & Migration:
 *    - The legacy 80-bit 5-block key format (`KHRM-XXXX-XXXX-XXXX-XXXX-XXXX`) is STRICTLY REJECTED
 *      by `normalizeKey` and `validateKey` with error code `DEPRECATED_FORMAT`.
 */

'use strict';

const crypto = require('crypto');
const {
    CROCKFORD_ALPHABET,
    crc16Ccitt,
    encodeCrc16ToCrockford,
    decodeCrockfordToCrc16,
    encodeBytesToCrockford,
    decodeCrockfordToBytes,
    normalizeCrockfordChar
} = require('./crockfordBase32');

/**
 * Default product key prefix for Kiaan HRM.
 */
const DEFAULT_PREFIX = 'KHRM';

/**
 * Minimum required pepper length in bytes for HMAC-SHA256.
 */
const MIN_PEPPER_LENGTH = 32;

/**
 * Exact entropy bytes required: 20 bytes = 160 bits (>= 128-bit requirement).
 */
const ENTROPY_BYTES = 20;

/**
 * Total payload characters: 32 Crockford characters (8 blocks of 4).
 * 32 characters * 5 bits = 160 bits (zero padding bits).
 */
const PAYLOAD_CHARS = 32;

/**
 * Total checksum characters: 4 Crockford characters (1 block of 4).
 * Encodes 16-bit CRC16-CCITT integer.
 */
const CHECKSUM_CHARS = 4;

/**
 * Total characters in the canonical key body after prefix: 36 characters (9 blocks of 4).
 */
const TOTAL_KEY_CHARS = PAYLOAD_CHARS + CHECKSUM_CHARS; // 36

/**
 * Strict regex for canonical 9-block key format:
 * PREFIX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-CCCC
 * (36 Crockford characters across 9 blocks of 4)
 */
const CANONICAL_KEY_REGEX = /^[A-Z0-9]{3,8}(-[0-9A-HJ-NP-Z]{4}){9}$/;

/**
 * Regex for legacy deprecated 5-block format (80 bits entropy):
 * Used strictly for identifying and rejecting deprecated keys.
 */
const LEGACY_5_BLOCK_REGEX = /^[A-Z0-9]{3,8}(-[0-9A-HJ-NP-Z]{4}){5}$/;

/**
 * Validates that an injected pepper meets cryptographic strength requirements.
 *
 * Pepper Contract:
 * - If pepper is a `Buffer`, its length must be at least 32 bytes.
 * - If pepper is a `string`, its UTF-8 byte length must be at least 32 bytes.
 * - Trivial or insecure patterns are rejected.
 * - Secret pepper values are never exposed in exception messages.
 *
 * @param {string|Buffer} pepper Secret pepper string or buffer
 * @throws {TypeError|Error} If pepper is invalid, missing, or under 32 bytes
 */
function validatePepper(pepper) {
    if (!pepper) {
        throw new Error('PEPPER CONFIGURATION ERROR: License pepper is required and cannot be empty.');
    }

    if (typeof pepper !== 'string' && !Buffer.isBuffer(pepper)) {
        throw new TypeError('PEPPER CONFIGURATION ERROR: Pepper must be a string or Buffer.');
    }

    const byteLength = Buffer.isBuffer(pepper) ? pepper.length : Buffer.byteLength(pepper, 'utf8');
    if (byteLength < MIN_PEPPER_LENGTH) {
        throw new Error(`PEPPER CONFIGURATION ERROR: Pepper must be at least ${MIN_PEPPER_LENGTH} bytes of high-entropy data.`);
    }

    // Reject trivial dummy values without leaking pepper content
    const strVal = (Buffer.isBuffer(pepper) ? pepper.toString('utf8') : pepper).toLowerCase();
    const trivialPatterns = ['password', '12345678', 'change_me', 'secret', 'default', 'test_pepper_dummy'];
    for (const pat of trivialPatterns) {
        if (strVal.includes(pat) && byteLength < 48) {
            throw new Error('PEPPER CONFIGURATION ERROR: Insecure or trivial pepper pattern detected.');
        }
    }
}

/**
 * Normalizes a raw license key string into canonical 9-block format.
 *
 * Transformations:
 * 1. Strips all internal and surrounding whitespace.
 * 2. Uppercases all characters.
 * 3. Validates prefix (expected 3-8 alphanumeric characters).
 * 4. Replaces permissive Crockford aliases (O/o -> 0, I/i/L/l -> 1).
 * 5. Prohibits 'U' and 'u' to avoid accidental obscenities.
 * 6. Explicitly rejects deprecated 80-bit 5-block formats.
 * 7. Reassembles body into exactly 9 blocks of 4 Crockford characters:
 *    `PREFIX-b0-b1-b2-b3-b4-b5-b6-b7-CCCC`
 *
 * @param {string} rawKey Raw user-supplied license key
 * @param {string} [expectedPrefix=DEFAULT_PREFIX] Expected product prefix
 * @returns {string} Normalized canonical license key
 * @throws {Error} If key format, length, or characters are invalid
 */
function normalizeKey(rawKey, expectedPrefix = DEFAULT_PREFIX) {
    if (typeof rawKey !== 'string' || !rawKey.trim()) {
        throw new TypeError('License key must be a non-empty string');
    }

    const prefixUpper = String(expectedPrefix).toUpperCase().trim();
    if (!/^[A-Z0-9]{3,8}$/.test(prefixUpper)) {
        throw new Error(`Invalid prefix '${prefixUpper}': must be 3-8 alphanumeric characters`);
    }

    // 1. Remove all whitespace
    let clean = rawKey.trim().toUpperCase().replace(/\s+/g, '');

    // 2. Check if key has an explicit hyphen-separated prefix
    const firstHyphenIdx = clean.indexOf('-');
    if (firstHyphenIdx !== -1) {
        const potentialPrefix = clean.substring(0, firstHyphenIdx);
        if (/^[A-Z0-9]{3,8}$/.test(potentialPrefix) && potentialPrefix !== prefixUpper) {
            throw new Error(`Invalid license key prefix: expected '${prefixUpper}', got '${potentialPrefix}'`);
        }
    }

    // 3. Extract body
    let body = clean;
    if (clean.startsWith(`${prefixUpper}-`)) {
        body = clean.substring(prefixUpper.length + 1);
    } else if (clean.startsWith(prefixUpper)) {
        body = clean.substring(prefixUpper.length);
    }

    // 4. Remove all hyphens from body
    body = body.replace(/-/g, '');

    // 5. Explicitly detect and reject deprecated 80-bit 5-block format (20 characters)
    if (body.length === 20) {
        const err = new Error('Legacy 80-bit (5-block) license key format is deprecated. A minimum 128-bit key format (9 blocks of 4) is required.');
        err.code = 'DEPRECATED_FORMAT';
        throw err;
    }

    if (body.length !== TOTAL_KEY_CHARS) {
        throw new Error(`Invalid license key length: expected ${TOTAL_KEY_CHARS} characters (9 blocks of 4) after prefix '${prefixUpper}-', got ${body.length}`);
    }

    // 6. Normalize individual Crockford characters
    let normalizedBody = '';
    for (let i = 0; i < body.length; i++) {
        normalizedBody += normalizeCrockfordChar(body[i]);
    }

    // 7. Reassemble into canonical 9-block structure: PREFIX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-CCCC
    const blocks = [];
    for (let i = 0; i < TOTAL_KEY_CHARS; i += 4) {
        blocks.push(normalizedBody.substring(i, i + 4));
    }

    return `${prefixUpper}-${blocks.join('-')}`;
}

/**
 * Validates a license key's structure, alphabet, and embedded CRC16-CCITT typo-detection checksum.
 *
 * Validation Steps:
 * 1. Key normalization and canonical regex matching (9 blocks of 4 characters).
 * 2. Deprecated 5-block format rejection.
 * 3. Extraction of 8 payload blocks (b0..b7) and 1 checksum block (CCCC).
 * 4. CRC16-CCITT recalculation over `${prefix}-${b0}-${b1}-${b2}-${b3}-${b4}-${b5}-${b6}-${b7}`.
 * 5. Checksum decoding and strict zero-padding bit verification.
 * 6. Constant-time 16-bit integer buffer comparison.
 *
 * @param {string} rawKey License key to validate
 * @param {string} [expectedPrefix=DEFAULT_PREFIX] Expected product prefix
 * @returns {{ valid: boolean, normalizedKey?: string, code: string, reason?: string }} Validation result
 */
function validateKey(rawKey, expectedPrefix = DEFAULT_PREFIX) {
    try {
        const normalized = normalizeKey(rawKey, expectedPrefix);

        if (!CANONICAL_KEY_REGEX.test(normalized)) {
            return {
                valid: false,
                code: 'INVALID_FORMAT',
                reason: 'License key does not match canonical 9-block structure'
            };
        }

        // Split into parts: parts[0] is prefix, parts[1..8] are payload blocks, parts[9] is checksum block
        const parts = normalized.split('-');
        const prefix = parts[0];
        const payloadString = parts.slice(0, 9).join('-'); // prefix + 8 payload blocks
        const checksumBlock = parts[9];

        // Recalculate expected CRC16-CCITT over payloadString
        const expectedCrc = crc16Ccitt(payloadString);
        let actualCrc;
        try {
            actualCrc = decodeCrockfordToCrc16(checksumBlock);
        } catch (_) {
            return {
                valid: false,
                normalizedKey: normalized,
                code: 'INVALID_CHECKSUM',
                reason: 'License key checksum verification failed (invalid checksum encoding or corrupted padding bits)'
            };
        }

        // Constant-time 16-bit integer buffer comparison
        const bufExpected = Buffer.alloc(2);
        bufExpected.writeUInt16BE(expectedCrc, 0);
        const bufActual = Buffer.alloc(2);
        bufActual.writeUInt16BE(actualCrc, 0);

        if (!crypto.timingSafeEqual(bufExpected, bufActual)) {
            return {
                valid: false,
                normalizedKey: normalized,
                code: 'INVALID_CHECKSUM',
                reason: 'License key checksum verification failed (typographical error detected)'
            };
        }

        return {
            valid: true,
            normalizedKey: normalized,
            code: 'VALID'
        };
    } catch (err) {
        if (err.code === 'DEPRECATED_FORMAT') {
            return {
                valid: false,
                code: 'DEPRECATED_FORMAT',
                reason: err.message
            };
        }
        return {
            valid: false,
            code: 'MALFORMED_KEY',
            reason: err.message
        };
    }
}

/**
 * Generates a cryptographically secure random license key providing 160 bits of CSPRNG entropy
 * with an embedded CRC16-CCITT typo-detection checksum.
 *
 * Entropy Calculation:
 * - CSPRNG source: `crypto.randomBytes(20)` (20 bytes * 8 bits/byte = 160 bits).
 * - Crockford Base32 encoding: 20 bytes -> 32 characters (32 * 5 bits = 160 bits, 0 padding bits).
 * - Blocks: 8 payload blocks of 4 characters = 32 characters.
 * - Typo-detection checksum: 1 block of 4 characters encoding 16-bit CRC16-CCITT.
 * - Total key format: `PREFIX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-CCCC` (9 blocks of 4).
 *
 * @param {object} [options={}] Generation options
 * @param {string} [options.prefix=DEFAULT_PREFIX] Product prefix (e.g. 'KHRM', 'KPOS')
 * @param {string|Buffer} [options.pepper] Optional pepper to compute HMAC-SHA256 hash immediately
 * @param {Function} [options.randomBytesFn] Optional CSPRNG generator (for deterministic tests)
 * @returns {{ licenseKey: string, keyHint: string, hash?: string, entropyBits: number }} Generated key details
 */
function generateLicenseKey(options = {}) {
    const prefix = (options.prefix || DEFAULT_PREFIX).toUpperCase().trim();
    if (!/^[A-Z0-9]{3,8}$/.test(prefix)) {
        throw new Error(`Invalid prefix '${prefix}': must be 3-8 alphanumeric characters`);
    }
    const randomBytesFn = options.randomBytesFn || crypto.randomBytes;

    // 1. Generate 20 raw bytes (160 bits) of CSPRNG entropy
    const rawEntropy = randomBytesFn(ENTROPY_BYTES);
    if (!Buffer.isBuffer(rawEntropy) || rawEntropy.length !== ENTROPY_BYTES) {
        throw new Error(`CSPRNG generator must return a Buffer of exactly ${ENTROPY_BYTES} bytes`);
    }

    // 2. Encode 20 bytes into 32 Crockford Base32 characters (zero padding bits)
    const payloadChars = encodeBytesToCrockford(rawEntropy);
    const blocks = [];
    for (let i = 0; i < PAYLOAD_CHARS; i += 4) {
        blocks.push(payloadChars.substring(i, i + 4));
    }

    // 3. Compute CRC16-CCITT typo-detection checksum over prefix and 8 payload blocks
    const payloadString = `${prefix}-${blocks.join('-')}`;
    const crc = crc16Ccitt(payloadString);

    // 4. Encode CRC16 into block 8 (4 Crockford Base32 characters with verified zero padding)
    const checksumBlock = encodeCrc16ToCrockford(crc);

    const licenseKey = `${payloadString}-${checksumBlock}`;
    const keyHint = generateKeyHint(licenseKey, prefix);

    const result = {
        licenseKey,
        keyHint,
        entropyBits: ENTROPY_BYTES * 8 // 160 bits
    };

    // If pepper is provided, compute HMAC-SHA256 hash immediately
    if (options.pepper) {
        result.hash = hashLicenseKey(licenseKey, options.pepper, prefix);
    }

    return result;
}

/**
 * Hashes a license key at rest using keyed HMAC-SHA256 with an injected secret pepper.
 *
 * HMAC Construction:
 * `HMAC-SHA256(key = CENTRAL_LICENSE_PEPPER, message = normalized_license_key)`
 *
 * Security Requirements:
 * 1. Zero Plaintext Persistence: Plaintext keys are never stored in the database.
 * 2. Pepper Semantics:
 *    - If `pepper` is a `Buffer`, its raw binary bytes are used directly as the key.
 *    - If `pepper` is a `string`, it is interpreted as UTF-8 bytes (`Buffer.byteLength >= 32`).
 * 3. Normalization Invariance: The key is normalized to its canonical form prior to hashing,
 *    guaranteeing that whitespace, casing, and permissive aliases yield the identical digest.
 * 4. Zero Logging: Keys, pepper, and sensitive hashes are never logged.
 *
 * @param {string} rawKey Raw or normalized license key
 * @param {string|Buffer} pepper Secret server pepper
 * @param {string} [expectedPrefix=DEFAULT_PREFIX] Expected product prefix
 * @returns {string} 64-character lowercase hexadecimal HMAC-SHA256 digest
 * @throws {Error} If key is invalid or pepper fails strength requirements
 */
function hashLicenseKey(rawKey, pepper, expectedPrefix = DEFAULT_PREFIX) {
    validatePepper(pepper);

    const validation = validateKey(rawKey, expectedPrefix);
    if (!validation.valid) {
        throw new Error(`Cannot hash invalid license key: ${validation.reason || validation.code}`);
    }

    const hmac = crypto.createHmac('sha256', pepper);
    hmac.update(validation.normalizedKey, 'utf8');
    return hmac.digest('hex');
}

/**
 * Constant-time comparison between a user-supplied key and a stored HMAC-SHA256 hash.
 * Protects against side-channel timing attacks.
 *
 * Both the calculated and expected digests are validated to be exactly 32 bytes (256 bits)
 * and compared using `crypto.timingSafeEqual`.
 *
 * @param {string} rawKey User-supplied license key
 * @param {string} expectedHashHex 64-character hexadecimal stored hash
 * @param {string|Buffer} pepper Secret server pepper
 * @param {string} [expectedPrefix=DEFAULT_PREFIX] Expected product prefix
 * @returns {boolean} True if key matches hash, false otherwise
 */
function verifyKeyHash(rawKey, expectedHashHex, pepper, expectedPrefix = DEFAULT_PREFIX) {
    validatePepper(pepper);

    try {
        if (typeof expectedHashHex !== 'string' || !/^[0-9a-fA-F]{64}$/.test(expectedHashHex)) {
            return false;
        }

        const calculatedHashHex = hashLicenseKey(rawKey, pepper, expectedPrefix);

        const bufCalculated = Buffer.from(calculatedHashHex, 'hex');
        const bufExpected = Buffer.from(expectedHashHex, 'hex');

        if (bufCalculated.length !== 32 || bufExpected.length !== 32) {
            return false;
        }

        return crypto.timingSafeEqual(bufCalculated, bufExpected);
    } catch (_) {
        return false;
    }
}

/**
 * Generates a masked key hint suitable for safe display in consoles, invoices, and audit logs.
 * Reveals only the product prefix, boundary block b0, and checksum block b8.
 *
 * Example:
 * Input:  `KHRM-7A39-K2XP-88N4-92MF-1B4C-99ZX-78TR-42MN-H000`
 * Output: `KHRM-7A39-****-****-H000` (exact 24 characters)
 *
 * Fits cleanly in the `key_hint VARCHAR(25)` database schema column.
 * Masks blocks 1 through 7 (140 bits of cryptographic entropy concealed).
 *
 * @param {string} rawKey License key
 * @param {string} [expectedPrefix=DEFAULT_PREFIX] Expected product prefix
 * @returns {string} Masked key hint (24 characters)
 */
function generateKeyHint(rawKey, expectedPrefix = DEFAULT_PREFIX) {
    const normalized = normalizeKey(rawKey, expectedPrefix);
    const parts = normalized.split('-');
    // parts[0]: prefix, parts[1]: b0, parts[2..8]: b1..b7, parts[9]: b8 (checksum)
    return `${parts[0]}-${parts[1]}-****-****-${parts[9]}`;
}

module.exports = {
    DEFAULT_PREFIX,
    MIN_PEPPER_LENGTH,
    ENTROPY_BYTES,
    PAYLOAD_CHARS,
    CHECKSUM_CHARS,
    TOTAL_KEY_CHARS,
    CANONICAL_KEY_REGEX,
    LEGACY_5_BLOCK_REGEX,
    generateLicenseKey,
    normalizeKey,
    validateKey,
    hashLicenseKey,
    verifyKeyHash,
    generateKeyHint,
    validatePepper
};
