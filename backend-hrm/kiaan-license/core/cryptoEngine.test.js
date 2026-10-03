/**
 * Kiaan License Engine — Crypto Engine Unit Test Suite
 * Module: backend-hrm/kiaan-license/core/cryptoEngine.test.js
 *
 * Verifies PureEd25519 entitlement signature verification:
 * - Dynamic generation of ephemeral test-only Ed25519 keypairs (confined strictly to this test)
 * - Positive path: Valid signature verification with RFC 8785 canonicalization
 * - Negative path: Tampered payload, wrong keys, unknown keys, revoked keys
 * - Structural and encoding validations: Base64 format, 64-byte signature length, missing fields
 * - Fail-safe handling: Malformed public keys, canonicalizer errors, non-ed25519 keys
 */

'use strict';

const assert = require('assert');
const crypto = require('crypto');
const { verifyEnvelope, VerificationCodes, SUPPORTED_ALGORITHM } = require('./cryptoEngine');
const { canonicalizeToBuffer } = require('./canonicalizer');

let totalTests = 0;
let passedTests = 0;

function runTest(name, fn) {
    totalTests++;
    try {
        fn();
        passedTests++;
        console.log(`  ✓ ${name}`);
    } catch (err) {
        console.error(`  ✗ ${name}`);
        console.error(`    Error: ${err.message}`);
        throw err;
    }
}

/**
 * Test-only signing helper.
 * Generates an Ed25519 signature over canonical payload bytes using a test-only private key.
 * Confined exclusively to this test file.
 */
function createTestSignedEnvelope(payload, testPrivateKey, keyId = 'test-ed25519-key-1', algorithm = 'Ed25519') {
    const dataBuffer = canonicalizeToBuffer(payload);
    const signatureBuffer = crypto.sign(null, dataBuffer, testPrivateKey);

    return {
        key_id: keyId,
        algorithm: algorithm,
        payload: payload,
        signature: signatureBuffer.toString('base64')
    };
}

console.log('\n======================================================');
console.log('  ED25519 CRYPTO ENGINE TEST SUITE');
console.log('======================================================\n');

// Generate test-only key pairs in memory (ephemeral, never persisted)
const testPair1 = crypto.generateKeyPairSync('ed25519');
const testPair2 = crypto.generateKeyPairSync('ed25519');

const testPubPem1 = testPair1.publicKey.export({ type: 'spki', format: 'pem' });
const testPubPem2 = testPair2.publicKey.export({ type: 'spki', format: 'pem' });

const testKeystore = {
    'test-key-1': {
        status: 'VALID',
        publicKey: testPubPem1
    },
    'test-key-2': {
        status: 'VALID',
        publicKey: testPubPem2
    },
    'test-key-revoked': {
        status: 'REVOKED',
        publicKey: testPubPem1
    }
};

const samplePayload = {
    entitlement_id: 'ent_99887766',
    license_id: 'lic_12345678',
    product_id: 'kiaan-hrm',
    customer_id: 'cust_001',
    licensed_domain: 'hrm.enterprise.com',
    tier: 'enterprise',
    features: ['biometric', 'payroll'],
    max_users: 100,
    sequence_number: 1,
    issued_at: '2026-10-03T11:00:00.000Z',
    expires_at: null
};

// ---------------------------------------------------------------------------
// 1. POSITIVE VERIFICATION TESTS
// ---------------------------------------------------------------------------
console.log('Group 1: Positive Cryptographic Verification');

runTest('Valid Ed25519 signature successfully verified', () => {
    const envelope = createTestSignedEnvelope(samplePayload, testPair1.privateKey, 'test-key-1');
    const result = verifyEnvelope(envelope, testKeystore);

    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.code, VerificationCodes.VERIFIED);
    assert.strictEqual(result.keyId, 'test-key-1');
    assert.deepStrictEqual(result.payload, samplePayload);
});

runTest('Verification succeeds with direct KeyObject or raw PEM in keystore', () => {
    const rawKeystore = {
        'test-key-direct-pem': testPubPem1,
        'test-key-direct-obj': testPair1.publicKey
    };

    const env1 = createTestSignedEnvelope(samplePayload, testPair1.privateKey, 'test-key-direct-pem');
    const res1 = verifyEnvelope(env1, rawKeystore);
    assert.strictEqual(res1.valid, true);
    assert.strictEqual(res1.code, VerificationCodes.VERIFIED);

    const env2 = createTestSignedEnvelope(samplePayload, testPair1.privateKey, 'test-key-direct-obj');
    const res2 = verifyEnvelope(env2, rawKeystore);
    assert.strictEqual(res2.valid, true);
    assert.strictEqual(res2.code, VerificationCodes.VERIFIED);
});

// ---------------------------------------------------------------------------
// 2. CRYPTOGRAPHIC TAMPERING & KEY INTEGRITY
// ---------------------------------------------------------------------------
console.log('\nGroup 2: Tamper Resistance & Key Integrity');

runTest('Tampered payload property rejected', () => {
    const envelope = createTestSignedEnvelope(samplePayload, testPair1.privateKey, 'test-key-1');
    // Tamper with max_users
    envelope.payload.max_users = 1000;

    const result = verifyEnvelope(envelope, testKeystore);
    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.code, VerificationCodes.INVALID_SIGNATURE);
});

runTest('Tampered payload string rejected', () => {
    const envelope = createTestSignedEnvelope(samplePayload, testPair1.privateKey, 'test-key-1');
    // Tamper with domain
    envelope.payload.licensed_domain = 'hacked.domain.com';

    const result = verifyEnvelope(envelope, testKeystore);
    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.code, VerificationCodes.INVALID_SIGNATURE);
});

runTest('Tampered signature bytes rejected', () => {
    const envelope = createTestSignedEnvelope(samplePayload, testPair1.privateKey, 'test-key-1');
    // Modify one byte of the Base64 signature
    const sigBuffer = Buffer.from(envelope.signature, 'base64');
    sigBuffer[0] = sigBuffer[0] ^ 0xFF; // Flip bits of first byte
    envelope.signature = sigBuffer.toString('base64');

    const result = verifyEnvelope(envelope, testKeystore);
    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.code, VerificationCodes.INVALID_SIGNATURE);
});

runTest('Signature made with different key rejected (Key 2 signature against Key 1 public key)', () => {
    // Signed with PrivateKey 2, but envelope claims key_id 'test-key-1'
    const envelope = createTestSignedEnvelope(samplePayload, testPair2.privateKey, 'test-key-1');
    const result = verifyEnvelope(envelope, testKeystore);

    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.code, VerificationCodes.INVALID_SIGNATURE);
});

// ---------------------------------------------------------------------------
// 3. KEY MANAGEMENT & KEYSTORE ENFORCEMENT
// ---------------------------------------------------------------------------
console.log('\nGroup 3: Key Management & Keystore Enforcement');

runTest('Unknown key ID rejected', () => {
    const envelope = createTestSignedEnvelope(samplePayload, testPair1.privateKey, 'unknown-untrusted-key');
    const result = verifyEnvelope(envelope, testKeystore);

    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.code, VerificationCodes.UNKNOWN_KEY_ID);
    assert(result.reason.includes('not found in the trusted keystore'));
});

runTest('Revoked key explicitly rejected', () => {
    const envelope = createTestSignedEnvelope(samplePayload, testPair1.privateKey, 'test-key-revoked');
    const result = verifyEnvelope(envelope, testKeystore);

    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.code, VerificationCodes.REVOKED_KEY);
    assert(result.reason.includes('has been revoked'));
});

runTest('Invalid or missing keystore rejected', () => {
    const envelope = createTestSignedEnvelope(samplePayload, testPair1.privateKey, 'test-key-1');

    assert.strictEqual(verifyEnvelope(envelope, null).code, VerificationCodes.INVALID_KEYSTORE);
    assert.strictEqual(verifyEnvelope(envelope, undefined).code, VerificationCodes.INVALID_KEYSTORE);
    assert.strictEqual(verifyEnvelope(envelope, 'invalid').code, VerificationCodes.INVALID_KEYSTORE);
    assert.strictEqual(verifyEnvelope(envelope, []).code, VerificationCodes.INVALID_KEYSTORE);
});

// ---------------------------------------------------------------------------
// 4. STRUCTURAL & ENCODING VALIDATION
// ---------------------------------------------------------------------------
console.log('\nGroup 4: Structural & Encoding Validation');

runTest('Null or non-object envelope rejected', () => {
    assert.strictEqual(verifyEnvelope(null, testKeystore).code, VerificationCodes.MALFORMED_ENVELOPE);
    assert.strictEqual(verifyEnvelope(undefined, testKeystore).code, VerificationCodes.MALFORMED_ENVELOPE);
    assert.strictEqual(verifyEnvelope('string', testKeystore).code, VerificationCodes.MALFORMED_ENVELOPE);
    assert.strictEqual(verifyEnvelope([], testKeystore).code, VerificationCodes.MALFORMED_ENVELOPE);
});

runTest('Missing envelope fields rejected', () => {
    const base = createTestSignedEnvelope(samplePayload, testPair1.privateKey, 'test-key-1');

    assert.strictEqual(verifyEnvelope({ ...base, algorithm: undefined }, testKeystore).code, VerificationCodes.MISSING_ENVELOPE_FIELDS);
    assert.strictEqual(verifyEnvelope({ ...base, key_id: undefined }, testKeystore).code, VerificationCodes.MISSING_ENVELOPE_FIELDS);
    assert.strictEqual(verifyEnvelope({ ...base, payload: undefined }, testKeystore).code, VerificationCodes.MISSING_ENVELOPE_FIELDS);
    assert.strictEqual(verifyEnvelope({ ...base, signature: undefined }, testKeystore).code, VerificationCodes.MISSING_ENVELOPE_FIELDS);
});

runTest('Unsupported algorithm rejected', () => {
    const envelope = createTestSignedEnvelope(samplePayload, testPair1.privateKey, 'test-key-1', 'RSA-SHA256');
    const result = verifyEnvelope(envelope, testKeystore);

    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.code, VerificationCodes.UNSUPPORTED_ALGORITHM);
    assert(result.reason.includes('Unsupported algorithm'));
});

runTest('Malformed Base64 signature format rejected', () => {
    const envelope = createTestSignedEnvelope(samplePayload, testPair1.privateKey, 'test-key-1');

    envelope.signature = 'not-valid-base64!!!';
    assert.strictEqual(verifyEnvelope(envelope, testKeystore).code, VerificationCodes.INVALID_SIGNATURE_FORMAT);

    envelope.signature = '==invalid';
    assert.strictEqual(verifyEnvelope(envelope, testKeystore).code, VerificationCodes.INVALID_SIGNATURE_FORMAT);
});

runTest('Signature length other than 64 bytes rejected', () => {
    const envelope = createTestSignedEnvelope(samplePayload, testPair1.privateKey, 'test-key-1');

    // Valid Base64, but 32 bytes instead of 64 bytes
    envelope.signature = Buffer.alloc(32).toString('base64');
    assert.strictEqual(verifyEnvelope(envelope, testKeystore).code, VerificationCodes.INVALID_SIGNATURE_FORMAT);
});

// ---------------------------------------------------------------------------
// 5. FAIL-SAFE BEHAVIOR & ERROR CONTAINMENT
// ---------------------------------------------------------------------------
console.log('\nGroup 5: Fail-Safe Behavior & Error Containment');

runTest('Malformed public key in keystore handled safely', () => {
    const badKeystore = {
        'bad-key': '-----BEGIN PUBLIC KEY-----\nNOT_A_VALID_KEY\n-----END PUBLIC KEY-----'
    };
    const envelope = createTestSignedEnvelope(samplePayload, testPair1.privateKey, 'bad-key');
    const result = verifyEnvelope(envelope, badKeystore);

    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.code, VerificationCodes.MALFORMED_PUBLIC_KEY);
});

runTest('Non-Ed25519 public key in keystore rejected (e.g. RSA key)', () => {
    // Generate an RSA keypair to test key-type checking
    const rsaPair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const rsaPubPem = rsaPair.publicKey.export({ type: 'spki', format: 'pem' });

    const rsaKeystore = {
        'rsa-key': rsaPubPem
    };
    const envelope = createTestSignedEnvelope(samplePayload, testPair1.privateKey, 'rsa-key');
    const result = verifyEnvelope(envelope, rsaKeystore);

    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.code, VerificationCodes.INVALID_KEY_TYPE);
    assert(result.reason.includes("must be of type 'ed25519'"));
});

runTest('Canonicalizer failure in payload handled safely', () => {
    // Construct envelope with payload containing invalid primitive (NaN)
    const badPayload = { invalid: NaN };
    const envelope = {
        key_id: 'test-key-1',
        algorithm: 'Ed25519',
        payload: badPayload,
        signature: Buffer.alloc(64).toString('base64')
    };

    const result = verifyEnvelope(envelope, testKeystore);
    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.code, VerificationCodes.CANONICALIZATION_FAILED);
});

runTest('Repeated verification is 100% deterministic and stateless', () => {
    const envelope = createTestSignedEnvelope(samplePayload, testPair1.privateKey, 'test-key-1');

    for (let i = 0; i < 50; i++) {
        const result = verifyEnvelope(envelope, testKeystore);
        assert.strictEqual(result.valid, true);
        assert.strictEqual(result.code, VerificationCodes.VERIFIED);
    }
});

console.log('\n======================================================');
console.log(`  ALL ${passedTests} / ${totalTests} TESTS PASSED SUCCESSFULLY!`);
console.log('======================================================\n');
