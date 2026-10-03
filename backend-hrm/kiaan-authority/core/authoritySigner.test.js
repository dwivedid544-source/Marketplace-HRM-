/**
 * Unit & Security Test Suite — Central Ed25519 Authority Signer (Phase 2B.8C.2.1)
 * Module: backend-hrm/kiaan-authority/core/authoritySigner.test.js
 *
 * Verifies all 19 cryptographic, architectural, and security requirements:
 * 1. Valid Ed25519 envelope generation.
 * 2. Exact four-field envelope structure.
 * 3. 64-byte signature / 88-character Base64 representation.
 * 4. Existing client verifier compatibility (`cryptoEngine.verifyEnvelope`).
 * 5. Canonicalization consistency (reordered object keys yield identical signature).
 * 6. Payload mutation after signing (defensive deep-cloning invariance).
 * 7. Invalid payload rejection (null, array, primitives).
 * 8. Wrong product rejection (product_id !== 'kiaan-hrm').
 * 9. Missing/invalid domain rejection.
 * 10. Invalid sequence rejection (non-integer, <= 0, string).
 * 11. Wrong key type rejection (RSA or EC key rejected).
 * 12. Expected public-key mismatch rejection.
 * 13. Unknown key ID behavior in client verification.
 * 14. Revoked key behavior in client verification.
 * 15. Tampered payload rejection.
 * 16. Tampered signature rejection.
 * 17. Private-key redaction in JSON serialization.
 * 18. Missing production key failure.
 * 19. No private-key leakage in errors.
 */

'use strict';

const assert = require('assert');
const crypto = require('crypto');
const util = require('util');
const {
    AuthoritySigner,
    SUPPORTED_ALGORITHM,
    DEFAULT_KEY_ID,
    APPROVED_PRODUCT_ID,
    BASE64_ED25519_SIG_REGEX
} = require('./authoritySigner');

// Import the actual on-premise client verification engine to prove 100% contract compatibility
const { verifyEnvelope, VerificationCodes } = require('../../kiaan-license/core/cryptoEngine');

async function runTests() {
    console.log('==============================================================================');
    console.log('  CENTRAL AUTHORITY — ED25519 AUTHORITY SIGNER UNIT TESTS (PHASE 2B.8C.2.1)');
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

    // Generate ephemeral in-memory Ed25519 keypairs (never persisted)
    const testPairPrimary = crypto.generateKeyPairSync('ed25519');
    const testPairAlternate = crypto.generateKeyPairSync('ed25519');

    const primaryPrivPem = testPairPrimary.privateKey.export({ type: 'pkcs8', format: 'pem' });
    const primaryPubPem = testPairPrimary.publicKey.export({ type: 'spki', format: 'pem' });
    const altPubPem = testPairAlternate.publicKey.export({ type: 'spki', format: 'pem' });

    // Client keystore mapping test keys
    const testClientKeystore = {
        [DEFAULT_KEY_ID]: {
            keyId: DEFAULT_KEY_ID,
            algorithm: 'Ed25519',
            publicKey: primaryPubPem,
            status: 'VALID'
        },
        'kiaan-revoked-key': {
            keyId: 'kiaan-revoked-key',
            algorithm: 'Ed25519',
            publicKey: primaryPubPem,
            status: 'REVOKED'
        }
    };

    const validSamplePayload = {
        license_id: 'LIC-2026-HRM-A8K29DF1',
        product_id: 'kiaan-hrm',
        edition: 'full_source',
        sku: 'KHRM-SRC-LIFETIME',
        licensed_domain: 'hrm.customer.com',
        domain_aliases: ['127.0.0.1', 'localhost'],
        customer: {
            company_name: 'Acme Corp',
            email: 'buyer@acme.com'
        },
        entitlements: {
            edition_code: 'full_source',
            has_backend_source: true,
            has_extended_features: false,
            max_employees: 1000,
            features: ['ATTENDANCE', 'PAYROLL', 'LEAVES']
        },
        validity: {
            issued_at: '2026-10-03T16:00:00.000Z',
            expires_at: '2099-12-31T23:59:59.000Z'
        },
        sequence_number: 1
    };

    // --------------------------------------------------------------------------
    // TEST 1: Valid Ed25519 Envelope Generation
    // --------------------------------------------------------------------------
    it('Generates a cryptographically valid Ed25519 signed license envelope', () => {
        const signer = new AuthoritySigner({
            privateKey: primaryPrivPem,
            keyId: DEFAULT_KEY_ID
        });

        const envelope = signer.signEnvelope(validSamplePayload);
        assert.ok(envelope, 'Envelope must be returned');

        // Internal self-verification
        const selfVerify = signer.verifySelf(envelope);
        assert.strictEqual(selfVerify.valid, true);
        assert.strictEqual(selfVerify.code, 'VERIFIED');
    });

    // --------------------------------------------------------------------------
    // TEST 2: Exact Four-Field Envelope Structure
    // --------------------------------------------------------------------------
    it('Produces exact 4-field envelope structure { algorithm, key_id, payload, signature }', () => {
        const signer = new AuthoritySigner({ privateKey: primaryPrivPem, keyId: DEFAULT_KEY_ID });
        const envelope = signer.signEnvelope(validSamplePayload);

        const keys = Object.keys(envelope).sort();
        assert.deepStrictEqual(keys, ['algorithm', 'key_id', 'payload', 'signature']);
        assert.strictEqual(envelope.algorithm, 'Ed25519');
        assert.strictEqual(envelope.key_id, DEFAULT_KEY_ID);
        assert.strictEqual(typeof envelope.payload, 'object');
        assert.strictEqual(typeof envelope.signature, 'string');
    });

    // --------------------------------------------------------------------------
    // TEST 3: 64-Byte Signature / 88-Character Base64 Representation
    // --------------------------------------------------------------------------
    it('Signature is exactly 64 raw bytes encoded as an 88-character Base64 string ending in ==', () => {
        const signer = new AuthoritySigner({ privateKey: primaryPrivPem, keyId: DEFAULT_KEY_ID });
        const envelope = signer.signEnvelope(validSamplePayload);

        assert.strictEqual(envelope.signature.length, 88);
        assert.ok(BASE64_ED25519_SIG_REGEX.test(envelope.signature));
        const sigBuf = Buffer.from(envelope.signature, 'base64');
        assert.strictEqual(sigBuf.length, 64);
    });

    // --------------------------------------------------------------------------
    // TEST 4: Existing Client Verifier Compatibility (cryptoEngine.verifyEnvelope)
    // --------------------------------------------------------------------------
    it('Signed envelope is 100% compatible and verifies against client cryptoEngine.verifyEnvelope', () => {
        const signer = new AuthoritySigner({ privateKey: primaryPrivPem, keyId: DEFAULT_KEY_ID });
        const envelope = signer.signEnvelope(validSamplePayload);

        // Verify with on-premise client verification engine
        const clientVerifyRes = verifyEnvelope(envelope, testClientKeystore);
        assert.strictEqual(clientVerifyRes.valid, true);
        assert.strictEqual(clientVerifyRes.code, VerificationCodes.VERIFIED);
        assert.strictEqual(clientVerifyRes.keyId, DEFAULT_KEY_ID);
        assert.deepStrictEqual(clientVerifyRes.payload, validSamplePayload);
    });

    // --------------------------------------------------------------------------
    // TEST 5: Canonicalization Consistency (Reordered Object Keys Produce Identical Signatures)
    // --------------------------------------------------------------------------
    it('Canonicalization consistency: Reordering object keys in payload produces identical signatures', () => {
        const signer = new AuthoritySigner({ privateKey: primaryPrivPem, keyId: DEFAULT_KEY_ID });

        // Reordered copy of payload
        const reorderedPayload = {
            sequence_number: 1,
            customer: {
                email: 'buyer@acme.com',
                company_name: 'Acme Corp'
            },
            product_id: 'kiaan-hrm',
            licensed_domain: 'hrm.customer.com',
            sku: 'KHRM-SRC-LIFETIME',
            license_id: 'LIC-2026-HRM-A8K29DF1',
            edition: 'full_source',
            validity: {
                expires_at: '2099-12-31T23:59:59.000Z',
                issued_at: '2026-10-03T16:00:00.000Z'
            },
            domain_aliases: ['127.0.0.1', 'localhost'],
            entitlements: {
                has_extended_features: false,
                features: ['ATTENDANCE', 'PAYROLL', 'LEAVES'],
                max_employees: 1000,
                edition_code: 'full_source',
                has_backend_source: true
            }
        };

        const env1 = signer.signEnvelope(validSamplePayload);
        const env2 = signer.signEnvelope(reorderedPayload);

        assert.strictEqual(env1.signature, env2.signature, 'PureEd25519 signature over canonical JCS must be identical');
    });

    // --------------------------------------------------------------------------
    // TEST 6: Payload Mutation After Signing (Defensive Deep-Cloning Invariance)
    // --------------------------------------------------------------------------
    it('Defensive cloning: Caller mutating original payload object cannot alter signed envelope', () => {
        const signer = new AuthoritySigner({ privateKey: primaryPrivPem, keyId: DEFAULT_KEY_ID });
        const mutablePayload = JSON.parse(JSON.stringify(validSamplePayload));

        const envelope = signer.signEnvelope(mutablePayload);

        // Mutate caller's object
        mutablePayload.sequence_number = 9999;
        mutablePayload.entitlements.features.push('MALICIOUS_FEATURE');
        mutablePayload.licensed_domain = 'hacked.domain.com';

        // Envelope payload must remain unchanged
        assert.strictEqual(envelope.payload.sequence_number, 1);
        assert.strictEqual(envelope.payload.licensed_domain, 'hrm.customer.com');
        assert.strictEqual(envelope.payload.entitlements.features.length, 3);

        // Client verification must still pass
        const clientVerifyRes = verifyEnvelope(envelope, testClientKeystore);
        assert.strictEqual(clientVerifyRes.valid, true);
    });

    // --------------------------------------------------------------------------
    // TEST 7: Invalid Payload Rejection (Null, Array, Primitives)
    // --------------------------------------------------------------------------
    it('Rejects invalid payload shapes (null, array, string, numbers)', () => {
        const signer = new AuthoritySigner({ privateKey: primaryPrivPem, keyId: DEFAULT_KEY_ID });

        assert.throws(() => signer.signEnvelope(null), /INVALID_PAYLOAD/);
        assert.throws(() => signer.signEnvelope([]), /INVALID_PAYLOAD/);
        assert.throws(() => signer.signEnvelope('not-an-object'), /INVALID_PAYLOAD/);
        assert.throws(() => signer.signEnvelope(12345), /INVALID_PAYLOAD/);
        assert.throws(() => signer.signEnvelope(undefined), /INVALID_PAYLOAD/);
    });

    // --------------------------------------------------------------------------
    // TEST 8: Wrong Product ID Rejection
    // --------------------------------------------------------------------------
    it('Strictly rejects payloads with incorrect product_id', () => {
        const signer = new AuthoritySigner({ privateKey: primaryPrivPem, keyId: DEFAULT_KEY_ID });

        const wrongProduct = { ...validSamplePayload, product_id: 'kiaan-pos' };
        assert.throws(() => signer.signEnvelope(wrongProduct), /INVALID_PRODUCT_ID/);

        const missingProduct = { ...validSamplePayload, product_id: undefined };
        assert.throws(() => signer.signEnvelope(missingProduct), /INVALID_PRODUCT_ID/);
    });

    // --------------------------------------------------------------------------
    // TEST 9: Missing or Malformed Domain Rejection
    // --------------------------------------------------------------------------
    it('Rejects missing, empty, or malformed licensed_domain', () => {
        const signer = new AuthoritySigner({ privateKey: primaryPrivPem, keyId: DEFAULT_KEY_ID });

        assert.throws(() => signer.signEnvelope({ ...validSamplePayload, licensed_domain: '' }), /INVALID_DOMAIN/);
        assert.throws(() => signer.signEnvelope({ ...validSamplePayload, licensed_domain: '   ' }), /INVALID_DOMAIN/);
        assert.throws(() => signer.signEnvelope({ ...validSamplePayload, licensed_domain: 'https://domain.com' }), /not a valid hostname/);
        assert.throws(() => signer.signEnvelope({ ...validSamplePayload, licensed_domain: 'domain.com:8080' }), /not a valid hostname/);
        assert.throws(() => signer.signEnvelope({ ...validSamplePayload, licensed_domain: 'domain.com/path' }), /not a valid hostname/);
    });

    // --------------------------------------------------------------------------
    // TEST 10: Invalid Sequence Number Rejection
    // --------------------------------------------------------------------------
    it('Rejects invalid sequence_number (non-integer, <= 0, string, NaN)', () => {
        const signer = new AuthoritySigner({ privateKey: primaryPrivPem, keyId: DEFAULT_KEY_ID });

        assert.throws(() => signer.signEnvelope({ ...validSamplePayload, sequence_number: 0 }), /INVALID_SEQUENCE_NUMBER/);
        assert.throws(() => signer.signEnvelope({ ...validSamplePayload, sequence_number: -5 }), /INVALID_SEQUENCE_NUMBER/);
        assert.throws(() => signer.signEnvelope({ ...validSamplePayload, sequence_number: 1.5 }), /INVALID_SEQUENCE_NUMBER/);
        assert.throws(() => signer.signEnvelope({ ...validSamplePayload, sequence_number: '1' }), /INVALID_SEQUENCE_NUMBER/);
        assert.throws(() => signer.signEnvelope({ ...validSamplePayload, sequence_number: NaN }), /INVALID_SEQUENCE_NUMBER/);
    });

    // --------------------------------------------------------------------------
    // TEST 11: Wrong Key Type Rejection (RSA / EC keys)
    // --------------------------------------------------------------------------
    it('Strictly rejects non-Ed25519 private keys (e.g. RSA, EC)', () => {
        const rsaPair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
        const rsaPrivPem = rsaPair.privateKey.export({ type: 'pkcs8', format: 'pem' });

        assert.throws(() => {
            new AuthoritySigner({ privateKey: rsaPrivPem });
        }, /SIGNER_KEY_ERROR.*expected 'ed25519'/);
    });

    // --------------------------------------------------------------------------
    // TEST 12: Expected Public-Key Mismatch Rejection
    // --------------------------------------------------------------------------
    it('Throws SIGNER_KEY_MISMATCH when injected private key does not match expected public key', () => {
        assert.throws(() => {
            new AuthoritySigner({
                privateKey: primaryPrivPem,
                expectedPublicKey: altPubPem // Alternate public key
            });
        }, /SIGNER_KEY_MISMATCH/);

        // Matching public key succeeds
        assert.doesNotThrow(() => {
            new AuthoritySigner({
                privateKey: primaryPrivPem,
                expectedPublicKey: primaryPubPem
            });
        });
    });

    // --------------------------------------------------------------------------
    // TEST 13: Unknown Key ID Behavior in Client Verification
    // --------------------------------------------------------------------------
    it('Signing with an unknown key ID is safely rejected by the client engine as UNKNOWN_KEY_ID', () => {
        const unmappedKeySigner = new AuthoritySigner({
            privateKey: primaryPrivPem,
            keyId: 'kiaan-untrusted-2099-v1'
        });

        const envelope = unmappedKeySigner.signEnvelope(validSamplePayload);
        const clientVerifyRes = verifyEnvelope(envelope, testClientKeystore);

        assert.strictEqual(clientVerifyRes.valid, false);
        assert.strictEqual(clientVerifyRes.code, VerificationCodes.UNKNOWN_KEY_ID);
    });

    // --------------------------------------------------------------------------
    // TEST 14: Revoked Key Behavior in Client Verification
    // --------------------------------------------------------------------------
    it('Signing with a key registered as REVOKED in client keystore produces REVOKED_KEY', () => {
        const revokedKeySigner = new AuthoritySigner({
            privateKey: primaryPrivPem,
            keyId: 'kiaan-revoked-key'
        });

        const envelope = revokedKeySigner.signEnvelope(validSamplePayload);
        const clientVerifyRes = verifyEnvelope(envelope, testClientKeystore);

        assert.strictEqual(clientVerifyRes.valid, false);
        assert.strictEqual(clientVerifyRes.code, VerificationCodes.REVOKED_KEY);
    });

    // --------------------------------------------------------------------------
    // TEST 15: Tampered Payload Rejection
    // --------------------------------------------------------------------------
    it('Altering even 1 bit in payload causes client verification to reject with INVALID_SIGNATURE', () => {
        const signer = new AuthoritySigner({ privateKey: primaryPrivPem, keyId: DEFAULT_KEY_ID });
        const envelope = signer.signEnvelope(validSamplePayload);

        // Create tampered copy of envelope
        const tamperedEnvelope = {
            ...envelope,
            payload: {
                ...envelope.payload,
                sequence_number: 2 // Tampered sequence number
            }
        };

        const clientVerifyRes = verifyEnvelope(tamperedEnvelope, testClientKeystore);
        assert.strictEqual(clientVerifyRes.valid, false);
        assert.strictEqual(clientVerifyRes.code, VerificationCodes.INVALID_SIGNATURE);
    });

    // --------------------------------------------------------------------------
    // TEST 16: Tampered Signature Rejection
    // --------------------------------------------------------------------------
    it('Altering 1 character in Base64 signature fails client verification', () => {
        const signer = new AuthoritySigner({ privateKey: primaryPrivPem, keyId: DEFAULT_KEY_ID });
        const envelope = signer.signEnvelope(validSamplePayload);

        // Mutate one character in signature
        const sig = envelope.signature;
        const mutatedChar = sig[10] === 'A' ? 'B' : 'A';
        const tamperedSig = sig.substring(0, 10) + mutatedChar + sig.substring(11);

        const tamperedEnvelope = { ...envelope, signature: tamperedSig };
        const clientVerifyRes = verifyEnvelope(tamperedEnvelope, testClientKeystore);

        assert.strictEqual(clientVerifyRes.valid, false);
        assert.strictEqual(clientVerifyRes.code, VerificationCodes.INVALID_SIGNATURE);
    });

    // --------------------------------------------------------------------------
    // TEST 17: Private-Key Redaction in JSON Serialization & Inspection
    // --------------------------------------------------------------------------
    it('JSON.stringify(signer) and util.inspect never expose private key references', () => {
        const signer = new AuthoritySigner({ privateKey: primaryPrivPem, keyId: DEFAULT_KEY_ID });

        const jsonSerialized = JSON.stringify(signer);
        assert.ok(!jsonSerialized.includes('PRIVATE KEY'));
        assert.ok(!jsonSerialized.includes(primaryPrivPem));
        assert.strictEqual(JSON.parse(jsonSerialized).keyId, DEFAULT_KEY_ID);

        // Node.js inspector
        const inspected = util.inspect(signer);
        assert.ok(!inspected.includes('PRIVATE KEY'));
        assert.ok(inspected.includes('[AuthoritySigner:'));
    });

    // --------------------------------------------------------------------------
    // TEST 18: Missing Production Key Failure
    // --------------------------------------------------------------------------
    it('Missing private key fails closed with SIGNER_CONFIGURATION_ERROR', () => {
        assert.throws(() => {
            new AuthoritySigner({ options: { nodeEnv: 'production' } });
        }, /SIGNER_CONFIGURATION_ERROR: Private signing key is required/);

        assert.throws(() => {
            new AuthoritySigner({ privateKey: '' });
        }, /SIGNER_CONFIGURATION_ERROR/);
    });

    // --------------------------------------------------------------------------
    // TEST 19: No Private-Key Leakage in Error Messages
    // --------------------------------------------------------------------------
    it('Error messages and exceptions never expose private key strings or fragments', () => {
        try {
            new AuthoritySigner({ privateKey: 'malformed-private-key-data-12345' });
            assert.fail('Should have thrown');
        } catch (err) {
            assert.ok(!err.message.includes('malformed-private-key-data-12345'), 'Must not leak input key material in error message');
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
