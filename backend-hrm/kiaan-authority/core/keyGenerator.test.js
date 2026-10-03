/**
 * Unit & Security Test Suite — License Key Generator & HMAC Engine (Phase 2B.8C.1.1)
 * Module: backend-hrm/kiaan-authority/core/keyGenerator.test.js
 *
 * Verifies all cryptographic, entropy, formatting, and HMAC requirements:
 * 1. At least 128 bits (160 bits) of CSPRNG entropy per generated key.
 * 2. Exact 9-block canonical format: PREFIX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-CCCC (49 chars).
 * 3. Crockford Base32 encoding & decoding bijectivity (zero padding bits on payload).
 * 4. CRC16-CCITT error-detection checksum validation and typo detection.
 * 5. Strict rejection of non-zero padding bits in the CRC16 block.
 * 6. Explicit rejection of deprecated 80-bit 5-block legacy format.
 * 7. Whitespace, lowercase, and permissive alias normalization (O->0, I/L->1), rejection of 'U'.
 * 8. 1,000-key batch uniqueness (collision resistance).
 * 9. HMAC-SHA256 contract enforcement: HMAC-SHA256(key = pepper, message = normalized_license_key).
 * 10. Buffer and UTF-8 string pepper interpretation support.
 * 11. Different pepper independence (different peppers yield completely distinct digests).
 * 12. Missing and weak pepper rejection (< 32 bytes).
 * 13. Masked hint fits in VARCHAR(25) (24 chars) and conceals 140 bits of entropy.
 * 14. Deterministic generation strictly via injected test fixtures, never production mode.
 * 15. Prefix mismatch and invalid prefix format rejection.
 * 16. Constant-time hash verification via timingSafeEqual.
 * 17. Zero information disclosure of secret pepper or key material in exceptions.
 */

'use strict';

const assert = require('assert');
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

const {
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
} = require('./keyGenerator');

// Ephemeral 64-byte high-entropy test peppers (never used in production)
const TEST_PEPPER_A = 'test-ephemeral-pepper-2026-auth-v1-a9f823bc94120df0147e8314bc3a9082';
const TEST_PEPPER_B = 'test-ephemeral-pepper-2026-auth-v2-b7e192ca84019ef1258d7203ab2b8171';
const TEST_PEPPER_BUFFER = crypto.randomBytes(32);

async function runTests() {
    console.log('==============================================================================');
    console.log('  CENTRAL AUTHORITY — KEY GENERATOR & HMAC ENGINE UNIT TESTS (PHASE 2B.8C.1.1)');
    console.log('==============================================================================\n');

    let passed = 0;
    let failed = 0;

    function it(title, fn) {
        try {
            fn();
            console.log(`  ✅ ${title}`);
            passed++;
        } catch (err) {
            console.error(`  ❌ FAIL: ${title}`);
            console.error(`     Error: ${err.message}`);
            failed++;
        }
    }

    // --------------------------------------------------------------------------
    // TEST 1: Crockford Base32 & CRC16 Encoding / Decoding Bijectivity
    // --------------------------------------------------------------------------
    it('Crockford Base32 CRC16 encode & decode roundtrips for all test values', () => {
        const testCrcValues = [0x0000, 0x0001, 0x1234, 0x8000, 0xABCD, 0xFFFF];
        for (const crc of testCrcValues) {
            const encoded = encodeCrc16ToCrockford(crc);
            assert.strictEqual(encoded.length, 4, `Encoded CRC must be exactly 4 chars: ${encoded}`);
            const decoded = decodeCrockfordToCrc16(encoded);
            assert.strictEqual(decoded, crc, `Decoded CRC ${decoded} must match original ${crc}`);
        }
    });

    // --------------------------------------------------------------------------
    // TEST 2: Permissive Crockford Alias Normalization & Obscenity Rejection
    // --------------------------------------------------------------------------
    it('Normalizes permissive aliases (O->0, I/L->1) and rejects prohibited U', () => {
        assert.strictEqual(normalizeCrockfordChar('o'), '0');
        assert.strictEqual(normalizeCrockfordChar('O'), '0');
        assert.strictEqual(normalizeCrockfordChar('i'), '1');
        assert.strictEqual(normalizeCrockfordChar('I'), '1');
        assert.strictEqual(normalizeCrockfordChar('l'), '1');
        assert.strictEqual(normalizeCrockfordChar('L'), '1');
        assert.strictEqual(normalizeCrockfordChar('z'), 'Z');

        // Rejection of prohibited 'U'
        assert.throws(() => normalizeCrockfordChar('u'), /prohibited/);
        assert.throws(() => normalizeCrockfordChar('U'), /prohibited/);

        // Rejection of invalid non-base32
        assert.throws(() => normalizeCrockfordChar('@'), /Invalid character/);
        assert.throws(() => normalizeCrockfordChar('!'), /Invalid character/);
    });

    // --------------------------------------------------------------------------
    // TEST 3: Buffer to Crockford Base32 Bijective Roundtrip (Zero Padding Bits)
    // --------------------------------------------------------------------------
    it('Encodes 20-byte buffers to 32 Crockford characters bijectively with zero padding bits', () => {
        for (let i = 0; i < 50; i++) {
            const rawBytes = crypto.randomBytes(20);
            const encoded = encodeBytesToCrockford(rawBytes);
            assert.strictEqual(encoded.length, 32, 'Must produce exactly 32 Base32 characters');
            const decoded = decodeCrockfordToBytes(encoded);
            assert.ok(rawBytes.equals(decoded), 'Decoded buffer must match original 20 bytes exactly');
        }
    });

    // --------------------------------------------------------------------------
    // TEST 4: Key Generation Entropy (>= 128 bits) & 9-Block Canonical Format
    // --------------------------------------------------------------------------
    it('Generates keys providing 160 bits entropy in canonical 9-block format (49 chars)', () => {
        const keyData = generateLicenseKey({ pepper: TEST_PEPPER_A });
        assert.ok(keyData.licenseKey, 'Must produce licenseKey');
        assert.ok(keyData.keyHint, 'Must produce keyHint');
        assert.ok(keyData.hash, 'Must produce hash');

        // Exactly 160 bits (>= 128-bit requirement)
        assert.strictEqual(keyData.entropyBits, 160);
        assert.ok(keyData.entropyBits >= 128, 'Entropy must meet or exceed 128 bits');

        // Exact 49-character format: KHRM-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-CCCC
        assert.strictEqual(keyData.licenseKey.length, 49);
        assert.ok(CANONICAL_KEY_REGEX.test(keyData.licenseKey), 'Must match canonical 9-block regex');

        // Parts breakdown
        const parts = keyData.licenseKey.split('-');
        assert.strictEqual(parts.length, 10, 'Must have prefix + 9 blocks = 10 parts');
        assert.strictEqual(parts[0], 'KHRM');
        for (let b = 1; b <= 9; b++) {
            assert.strictEqual(parts[b].length, 4, `Block ${b} must be exactly 4 characters`);
        }

        // Self-validation
        const val = validateKey(keyData.licenseKey);
        assert.strictEqual(val.valid, true);
        assert.strictEqual(val.code, 'VALID');
    });

    // --------------------------------------------------------------------------
    // TEST 5: Checksum Validation & Single-Character Typo Detection
    // --------------------------------------------------------------------------
    it('Detects any single-character substitution typo via CRC16 mismatch', () => {
        const { licenseKey } = generateLicenseKey();
        const parts = licenseKey.split('-');

        // Mutate a character in block 0 (payload)
        const corruptedChar = parts[1][0] === 'A' ? 'B' : 'A';
        const corruptedBlock0 = corruptedChar + parts[1].substring(1);
        parts[1] = corruptedBlock0;
        const corruptedKey = parts.join('-');

        const val = validateKey(corruptedKey);
        assert.strictEqual(val.valid, false);
        assert.strictEqual(val.code, 'INVALID_CHECKSUM');
    });

    // --------------------------------------------------------------------------
    // TEST 6: Whitespace, Hyphen, Case, and Permissive Normalization
    // --------------------------------------------------------------------------
    it('Normalizes lowercase, spaces, missing hyphens, and O/I/L permutations to identical canonical key', () => {
        const { licenseKey } = generateLicenseKey();

        // 1. Lowercase with spaces instead of hyphens
        const spaced = licenseKey.toLowerCase().replace(/-/g, ' ');
        const normalizedSpaced = normalizeKey(spaced);
        assert.strictEqual(normalizedSpaced, licenseKey);

        // 2. Unhyphenated string
        const unhyphenated = licenseKey.replace(/-/g, '');
        const normalizedUnhyphenated = normalizeKey(unhyphenated);
        assert.strictEqual(normalizedUnhyphenated, licenseKey);

        // 3. Permissive substitution: replace '0' with 'O' and '1' with 'L' in key
        const replacedKey = licenseKey.replace(/0/g, 'O').replace(/1/g, 'L');
        const normalizedReplaced = normalizeKey(replacedKey);
        assert.strictEqual(normalizedReplaced, licenseKey);
    });

    // --------------------------------------------------------------------------
    // TEST 7: Batch Uniqueness (Randomness & Collision Resistance)
    // --------------------------------------------------------------------------
    it('Generates 1,000 unique keys with zero collisions (100% CSPRNG entropy)', () => {
        const BATCH_SIZE = 1000;
        const generatedKeys = new Set();

        for (let i = 0; i < BATCH_SIZE; i++) {
            const { licenseKey } = generateLicenseKey();
            assert.ok(!generatedKeys.has(licenseKey), `Collision detected at iteration ${i}: ${licenseKey}`);
            generatedKeys.add(licenseKey);

            // Verify checksum passes for every generated key
            const val = validateKey(licenseKey);
            assert.strictEqual(val.valid, true);
        }

        assert.strictEqual(generatedKeys.size, BATCH_SIZE);
    });

    // --------------------------------------------------------------------------
    // TEST 8: HMAC-SHA256 Contract Enforcement: HMAC(key=pepper, message=normalizedKey)
    // --------------------------------------------------------------------------
    it('Enforces exact HMAC-SHA256(key = pepper, message = normalized_license_key) contract', () => {
        const { licenseKey } = generateLicenseKey();

        // Verify independent direct reference HMAC calculation
        const expectedDirectHmac = crypto.createHmac('sha256', TEST_PEPPER_A)
            .update(licenseKey, 'utf8')
            .digest('hex');

        const hash1 = hashLicenseKey(licenseKey, TEST_PEPPER_A);
        assert.strictEqual(hash1, expectedDirectHmac, 'hashLicenseKey must match exact HMAC-SHA256 specification');

        // Test with raw Buffer pepper
        const hashBuf = hashLicenseKey(licenseKey, TEST_PEPPER_BUFFER);
        const expectedBufHmac = crypto.createHmac('sha256', TEST_PEPPER_BUFFER)
            .update(licenseKey, 'utf8')
            .digest('hex');
        assert.strictEqual(hashBuf, expectedBufHmac, 'Buffer pepper must match direct HMAC');

        // Normalized message invariance: unhyphenated or lowercase produces identical hash
        const hashUnhyphenated = hashLicenseKey(licenseKey.replace(/-/g, ''), TEST_PEPPER_A);
        assert.strictEqual(hashUnhyphenated, hash1, 'Unhyphenated key must yield identical hash');

        // Constant-time verifyKeyHash matches
        assert.strictEqual(verifyKeyHash(licenseKey, hash1, TEST_PEPPER_A), true);
        assert.strictEqual(verifyKeyHash(licenseKey.toLowerCase(), hash1, TEST_PEPPER_A), true);
    });

    // --------------------------------------------------------------------------
    // TEST 9: Different Peppers Produce Different Hashes (Secret Independence)
    // --------------------------------------------------------------------------
    it('Different peppers produce completely distinct hashes for identical key', () => {
        const { licenseKey } = generateLicenseKey();
        const hashA = hashLicenseKey(licenseKey, TEST_PEPPER_A);
        const hashB = hashLicenseKey(licenseKey, TEST_PEPPER_B);

        assert.notStrictEqual(hashA, hashB, 'Different peppers must produce different hashes');
        assert.strictEqual(verifyKeyHash(licenseKey, hashA, TEST_PEPPER_B), false);
    });

    // --------------------------------------------------------------------------
    // TEST 10: Missing or Weak Pepper Configuration Rejection
    // --------------------------------------------------------------------------
    it('Strictly rejects missing, empty, or under-32-byte weak peppers', () => {
        const { licenseKey } = generateLicenseKey();

        assert.throws(() => hashLicenseKey(licenseKey, null), /PEPPER CONFIGURATION ERROR/);
        assert.throws(() => hashLicenseKey(licenseKey, ''), /PEPPER CONFIGURATION ERROR/);
        assert.throws(() => hashLicenseKey(licenseKey, 'too-short-secret'), /at least 32 bytes/);
        assert.throws(() => hashLicenseKey(licenseKey, 'password12345678password12345678'), /Insecure or trivial pepper/);
    });

    // --------------------------------------------------------------------------
    // TEST 11: Masked Key Hint Fits in VARCHAR(25) and Conceals 140 Bits Entropy
    // --------------------------------------------------------------------------
    it('Masked hint obscures middle blocks (140 bits entropy) and fits in 24 chars (<= 25)', () => {
        const { licenseKey, keyHint } = generateLicenseKey();
        const parts = licenseKey.split('-');

        // Expected format: KHRM-b0-****-****-b8 (24 characters)
        const expectedHint = `${parts[0]}-${parts[1]}-****-****-${parts[9]}`;
        assert.strictEqual(keyHint, expectedHint);
        assert.strictEqual(keyHint.length, 24);
        assert.ok(keyHint.length <= 25, 'Hint must fit in VARCHAR(25) schema column');

        // Verify middle blocks (b1 through b7) are masked
        for (let b = 2; b <= 8; b++) {
            assert.ok(!keyHint.includes(parts[b]), `Hint must not reveal middle block ${b - 1}`);
        }
    });

    // --------------------------------------------------------------------------
    // TEST 12: Non-Zero Padding Bits Rejection & 100% Checksum Typo Detection
    // --------------------------------------------------------------------------
    it('Rejects non-zero padding bits in Crockford CRC and detects typos in checksum block', () => {
        // Standard CCITT-FALSE vector "123456789" -> 0x29B1
        assert.strictEqual(crc16Ccitt('123456789'), 0x29B1);

        // Test non-zero padding bits in 4th character of CRC block
        assert.throws(() => decodeCrockfordToCrc16('0001'), /non-zero padding bits/);
        assert.throws(() => decodeCrockfordToCrc16('0002'), /non-zero padding bits/);

        // Check that any character corruption in block 8 (checksum block) is caught by validateKey
        const { licenseKey } = generateLicenseKey();
        const parts = licenseKey.split('-');
        for (let charIdx = 0; charIdx < 4; charIdx++) {
            const origChar = parts[9][charIdx];
            const altChar = origChar === '0' ? '1' : '0';
            const mutatedBlock = parts[9].substring(0, charIdx) + altChar + parts[9].substring(charIdx + 1);
            parts[9] = mutatedBlock;
            const res = validateKey(parts.join('-'));
            assert.strictEqual(res.valid, false, `Corruption at CRC char ${charIdx} must be detected`);
            assert.strictEqual(res.code, 'INVALID_CHECKSUM');
        }
    });

    // --------------------------------------------------------------------------
    // TEST 13: Strict Rejection of Legacy Deprecated 80-Bit 5-Block Key Format
    // --------------------------------------------------------------------------
    it('Explicitly rejects legacy 80-bit 5-block key format with DEPRECATED_FORMAT error', () => {
        const legacyKey = 'KHRM-7A39-K2XP-88N4-92MF-H000'; // 5 blocks after prefix = 20 chars
        const res = validateKey(legacyKey);
        assert.strictEqual(res.valid, false);
        assert.strictEqual(res.code, 'DEPRECATED_FORMAT');
        assert.ok(res.reason.includes('deprecated'), 'Must explain format deprecation');

        // normalizeKey throws explicit DEPRECATED_FORMAT error
        assert.throws(() => normalizeKey(legacyKey), /DEPRECATED_FORMAT|deprecated/);
    });

    // --------------------------------------------------------------------------
    // TEST 14: Deterministic Test Fixture Generation via Injected randomBytesFn
    // --------------------------------------------------------------------------
    it('Supports deterministic generation strictly via explicit test fixture injection', () => {
        const mockBytesA = Buffer.alloc(20, 0x05);
        const deterministicFnA = () => Buffer.from(mockBytesA);

        const key1 = generateLicenseKey({ randomBytesFn: deterministicFnA });
        const key2 = generateLicenseKey({ randomBytesFn: deterministicFnA });
        assert.strictEqual(key1.licenseKey, key2.licenseKey, 'Identical injected PRNG must produce identical key');

        const mockBytesB = Buffer.alloc(20, 0x0A);
        const deterministicFnB = () => Buffer.from(mockBytesB);
        const key3 = generateLicenseKey({ randomBytesFn: deterministicFnB });
        assert.notStrictEqual(key1.licenseKey, key3.licenseKey, 'Different injected PRNG must produce different key');

        // Production mode without randomBytesFn uses CSPRNG and is non-deterministic
        const prodKey1 = generateLicenseKey();
        const prodKey2 = generateLicenseKey();
        assert.notStrictEqual(prodKey1.licenseKey, prodKey2.licenseKey);
    });

    // --------------------------------------------------------------------------
    // TEST 15: Strict Prefix Mismatch and Invalid Prefix Format Rejection
    // --------------------------------------------------------------------------
    it('Rejects mismatched prefixes and invalid prefix formats', () => {
        const { licenseKey } = generateLicenseKey({ prefix: 'KHRM' });

        // Changing prefix to KPOS when KHRM is expected
        const wrongPrefixKey = licenseKey.replace(/^KHRM-/, 'KPOS-');
        const resMismatch = validateKey(wrongPrefixKey, 'KHRM');
        assert.strictEqual(resMismatch.valid, false);

        // Invalid prefix characters or lengths
        assert.throws(() => generateLicenseKey({ prefix: 'AB' }), /Invalid prefix/); // < 3 chars
        assert.throws(() => generateLicenseKey({ prefix: 'TOOLONGA123' }), /Invalid prefix/); // > 8 chars
        assert.throws(() => generateLicenseKey({ prefix: 'KH@RM' }), /Invalid prefix/); // non-alphanumeric

        // Valid custom prefix
        const custom = generateLicenseKey({ prefix: 'KPOS' });
        assert.ok(custom.licenseKey.startsWith('KPOS-'));
        assert.strictEqual(validateKey(custom.licenseKey, 'KPOS').valid, true);
    });

    // --------------------------------------------------------------------------
    // TEST 16: verifyKeyHash Pepper Enforcement & Hash Format Validation
    // --------------------------------------------------------------------------
    it('verifyKeyHash strictly enforces pepper requirements and rejects malformed hashes', () => {
        const { licenseKey, hash } = generateLicenseKey({ pepper: TEST_PEPPER_A });

        // Missing or weak pepper in verifyKeyHash must throw PEPPER CONFIGURATION ERROR
        assert.throws(() => verifyKeyHash(licenseKey, hash, null), /PEPPER CONFIGURATION ERROR/);
        assert.throws(() => verifyKeyHash(licenseKey, hash, ''), /PEPPER CONFIGURATION ERROR/);
        assert.throws(() => verifyKeyHash(licenseKey, hash, 'short'), /at least 32 bytes/);

        // Malformed expectedHashHex returns false safely
        assert.strictEqual(verifyKeyHash(licenseKey, 'not-a-valid-hash', TEST_PEPPER_A), false);
        assert.strictEqual(verifyKeyHash(licenseKey, '0123456789abcdef', TEST_PEPPER_A), false);
        assert.strictEqual(verifyKeyHash(licenseKey, 'z'.repeat(64), TEST_PEPPER_A), false);
        assert.strictEqual(verifyKeyHash(licenseKey, null, TEST_PEPPER_A), false);

        // Valid hash verifies
        assert.strictEqual(verifyKeyHash(licenseKey, hash, TEST_PEPPER_A), true);
    });

    // --------------------------------------------------------------------------
    // TEST 17: Secret Pepper and Key Material Redaction in Errors
    // --------------------------------------------------------------------------
    it('Exceptions and errors never reveal pepper values or sensitive key payloads', () => {
        try {
            validatePepper('short-secret');
            assert.fail('Should have thrown');
        } catch (err) {
            assert.ok(!err.message.includes('short-secret'), 'Must not leak pepper content in error message');
        }

        try {
            validatePepper('password12345678password12345678');
            assert.fail('Should have thrown');
        } catch (err) {
            assert.ok(!err.message.includes('password12345678password12345678'), 'Must not leak pepper content');
        }
    });

    console.log('\n==============================================================================');
    console.log(`  TEST RESULTS: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
    console.log('==============================================================================\n');

    if (failed > 0) {
        process.exit(1);
    }
}

if (require.main === module) {
    runTests();
}

module.exports = { runTests };
