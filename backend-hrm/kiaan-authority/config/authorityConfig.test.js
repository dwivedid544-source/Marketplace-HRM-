/**
 * Unit & Security Test Suite — Central Authority Configuration Loader (Phase 2B.8C.4)
 * Module: backend-hrm/kiaan-authority/config/authorityConfig.test.js
 *
 * Verifies all 14 mandatory test cases and architectural security requirements:
 * 1. Missing production private key fails closed.
 * 2. Missing required pepper fails.
 * 3. Valid Ed25519 configuration succeeds.
 * 4. Invalid PEM fails safely without leaking error context.
 * 5. RSA key is rejected (strict Ed25519 enforcement).
 * 6. Mismatched expected public key fails.
 * 7. Invalid key ID fails (format validation).
 * 8. Private key path loading works using temporary test file.
 * 9. Both key sources configured is rejected (mutual exclusion).
 * 10. Escaped newline PEM (\n) is handled safely.
 * 11. Pepper shorter than 32 bytes is rejected.
 * 12. Private key and pepper are not exposed through JSON or inspection.
 * 13. Development/test unconfigured state is explicit.
 * 14. No automatic key generation occurs in production mode.
 * 15. Signer factory integration with AuthoritySigner and client verification.
 * 16. Insecure or trivial pepper patterns are rejected.
 * 17. Non-existent private key file path fails safely.
 */

'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const util = require('util');

const {
    AuthorityConfig,
    loadAuthorityConfig,
    validateAuthorityConfig,
    DEFAULT_KEY_ID,
    SUPPORTED_ALGORITHM,
    MIN_PEPPER_LENGTH
} = require('./authorityConfig');

const { AuthoritySigner } = require('../core/authoritySigner');
const { verifyEnvelope } = require('../../kiaan-license/core/cryptoEngine');

/**
 * Generates an ephemeral in-memory Ed25519 keypair for test use only.
 * @returns {{ privateKeyPem: string, publicKeyPem: string, privateKey: crypto.KeyObject, publicKey: crypto.KeyObject }}
 */
function generateTestEd25519Keypair() {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
    const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' });
    const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' });
    return { privateKeyPem, publicKeyPem, privateKey, publicKey };
}

/**
 * Generates a high-entropy test pepper of at least 32 bytes.
 * @param {number} [bytes=32]
 * @returns {string}
 */
function generateTestPepper(bytes = 32) {
    return crypto.randomBytes(bytes).toString('hex'); // 64 hex characters = 32 bytes
}

async function runTests() {
    console.log('==============================================================================');
    console.log('  CENTRAL AUTHORITY — CONFIGURATION LOADER & STARTUP VALIDATOR (PHASE 2B.8C.4)');
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

    // -------------------------------------------------------------------------
    // TEST 1: Missing production private key fails closed
    // -------------------------------------------------------------------------
    it('1. Missing production private key fails closed', () => {
        const testPepper = generateTestPepper(32);
        assert.throws(
            () => {
                loadAuthorityConfig({
                    env: {
                        NODE_ENV: 'production',
                        CENTRAL_LICENSE_PEPPER: testPepper
                    }
                });
            },
            (err) => {
                assert.strictEqual(err.code, 'CONFIG_MISSING_PRIVATE_KEY');
                assert(err.message.includes('CONFIG_MISSING_PRIVATE_KEY'));
                return true;
            }
        );
    });

    // -------------------------------------------------------------------------
    // TEST 2: Missing required pepper fails
    // -------------------------------------------------------------------------
    it('2. Missing required pepper fails in production and required mode', () => {
        const { privateKeyPem } = generateTestEd25519Keypair();

        // In production mode
        assert.throws(
            () => {
                loadAuthorityConfig({
                    env: {
                        NODE_ENV: 'production',
                        CENTRAL_SIGNING_PRIVATE_KEY: privateKeyPem
                    }
                });
            },
            (err) => {
                assert.strictEqual(err.code, 'CONFIG_MISSING_PEPPER');
                return true;
            }
        );

        // In dev mode with explicit requirePepper
        assert.throws(
            () => {
                loadAuthorityConfig({
                    env: {
                        NODE_ENV: 'development',
                        CENTRAL_SIGNING_PRIVATE_KEY: privateKeyPem
                    },
                    requirePepper: true
                });
            },
            (err) => {
                assert.strictEqual(err.code, 'CONFIG_MISSING_PEPPER');
                return true;
            }
        );
    });

    // -------------------------------------------------------------------------
    // TEST 3: Valid Ed25519 configuration succeeds
    // -------------------------------------------------------------------------
    it('3. Valid Ed25519 configuration succeeds', () => {
        const { privateKeyPem, publicKeyPem } = generateTestEd25519Keypair();
        const testPepper = generateTestPepper(32);

        const config = loadAuthorityConfig({
            env: {
                NODE_ENV: 'production',
                CENTRAL_SIGNING_KEY_ID: 'kiaan-root-2026-v1',
                CENTRAL_SIGNING_PRIVATE_KEY: privateKeyPem,
                CENTRAL_EXPECTED_PUBLIC_KEY: publicKeyPem,
                CENTRAL_LICENSE_PEPPER: testPepper
            }
        });

        assert(config instanceof AuthorityConfig);
        assert.strictEqual(config.isConfigured, true);
        assert.strictEqual(config.canSign, true);
        assert.strictEqual(config.hasPepper, true);
        assert.strictEqual(config.keyId, 'kiaan-root-2026-v1');
        assert.strictEqual(config.algorithm, 'Ed25519');
        assert.strictEqual(config.nodeEnv, 'production');
        assert.strictEqual(config.getPepper(), testPepper);
        assert(config.getPrivateKey() instanceof crypto.KeyObject);
        assert.strictEqual(config.getPrivateKey().asymmetricKeyType, 'ed25519');
        assert.strictEqual(validateAuthorityConfig(config), true);
    });

    // -------------------------------------------------------------------------
    // TEST 4: Invalid PEM fails safely
    // -------------------------------------------------------------------------
    it('4. Invalid PEM fails safely without leaking key contents', () => {
        const testPepper = generateTestPepper(32);
        const badPem = '-----BEGIN PRIVATE KEY-----\nNOT_A_VALID_BASE64_OR_PEM_KEY\n-----END PRIVATE KEY-----';

        assert.throws(
            () => {
                loadAuthorityConfig({
                    env: {
                        NODE_ENV: 'development',
                        CENTRAL_SIGNING_PRIVATE_KEY: badPem,
                        CENTRAL_LICENSE_PEPPER: testPepper
                    }
                });
            },
            (err) => {
                assert.strictEqual(err.code, 'CONFIG_KEY_PARSE_ERROR');
                assert(!err.message.includes('NOT_A_VALID_BASE64'));
                return true;
            }
        );
    });

    // -------------------------------------------------------------------------
    // TEST 5: RSA key is rejected
    // -------------------------------------------------------------------------
    it('5. RSA key is rejected with CONFIG_INVALID_KEY_TYPE', () => {
        const testPepper = generateTestPepper(32);
        const rsaPair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
        const rsaPrivatePem = rsaPair.privateKey.export({ type: 'pkcs8', format: 'pem' });

        assert.throws(
            () => {
                loadAuthorityConfig({
                    env: {
                        NODE_ENV: 'development',
                        CENTRAL_SIGNING_PRIVATE_KEY: rsaPrivatePem,
                        CENTRAL_LICENSE_PEPPER: testPepper
                    }
                });
            },
            (err) => {
                assert.strictEqual(err.code, 'CONFIG_INVALID_KEY_TYPE');
                assert(err.message.includes("expected 'ed25519'"));
                assert(err.message.includes("'rsa'"));
                return true;
            }
        );
    });

    // -------------------------------------------------------------------------
    // TEST 6: Mismatched expected public key fails
    // -------------------------------------------------------------------------
    it('6. Mismatched expected public key fails with CONFIG_KEY_MISMATCH', () => {
        const pairA = generateTestEd25519Keypair();
        const pairB = generateTestEd25519Keypair();
        const testPepper = generateTestPepper(32);

        assert.throws(
            () => {
                loadAuthorityConfig({
                    env: {
                        NODE_ENV: 'development',
                        CENTRAL_SIGNING_PRIVATE_KEY: pairA.privateKeyPem,
                        CENTRAL_EXPECTED_PUBLIC_KEY: pairB.publicKeyPem,
                        CENTRAL_LICENSE_PEPPER: testPepper
                    }
                });
            },
            (err) => {
                assert.strictEqual(err.code, 'CONFIG_KEY_MISMATCH');
                assert(err.message.includes('CONFIG_KEY_MISMATCH'));
                return true;
            }
        );
    });

    // -------------------------------------------------------------------------
    // TEST 7: Invalid key ID fails
    // -------------------------------------------------------------------------
    it('7. Invalid key ID fails with CONFIG_INVALID_KEY_ID', () => {
        const { privateKeyPem } = generateTestEd25519Keypair();
        const testPepper = generateTestPepper(32);

        // Illegal characters
        assert.throws(
            () => {
                loadAuthorityConfig({
                    env: {
                        CENTRAL_SIGNING_KEY_ID: 'key@root!$',
                        CENTRAL_SIGNING_PRIVATE_KEY: privateKeyPem,
                        CENTRAL_LICENSE_PEPPER: testPepper
                    }
                });
            },
            (err) => {
                assert.strictEqual(err.code, 'CONFIG_INVALID_KEY_ID');
                return true;
            }
        );

        // Empty string
        assert.throws(
            () => {
                loadAuthorityConfig({
                    env: {
                        CENTRAL_SIGNING_KEY_ID: '   ',
                        CENTRAL_SIGNING_PRIVATE_KEY: privateKeyPem,
                        CENTRAL_LICENSE_PEPPER: testPepper
                    }
                });
            },
            (err) => {
                assert.strictEqual(err.code, 'CONFIG_INVALID_KEY_ID');
                return true;
            }
        );
    });

    // -------------------------------------------------------------------------
    // TEST 8: Private key path loading works using temporary test file
    // -------------------------------------------------------------------------
    it('8. Private key path loading works using a temporary test file', () => {
        const { privateKeyPem } = generateTestEd25519Keypair();
        const testPepper = generateTestPepper(32);
        const tempKeyFile = path.join(os.tmpdir(), `kiaan-test-key-${Date.now()}-${Math.random().toString(36).slice(2)}.pem`);

        try {
            fs.writeFileSync(tempKeyFile, privateKeyPem, { encoding: 'utf8', mode: 0o600 });

            const config = loadAuthorityConfig({
                env: {
                    NODE_ENV: 'production',
                    CENTRAL_SIGNING_PRIVATE_KEY_PATH: tempKeyFile,
                    CENTRAL_LICENSE_PEPPER: testPepper
                }
            });

            assert.strictEqual(config.isConfigured, true);
            assert.strictEqual(config.canSign, true);
            assert.strictEqual(config.getPrivateKey().asymmetricKeyType, 'ed25519');
        } finally {
            if (fs.existsSync(tempKeyFile)) {
                fs.unlinkSync(tempKeyFile);
            }
        }
    });

    // -------------------------------------------------------------------------
    // TEST 9: Both key sources configured is rejected (mutual exclusion)
    // -------------------------------------------------------------------------
    it('9. Both key sources configured is rejected with CONFIG_MUTUAL_EXCLUSION_ERROR', () => {
        const { privateKeyPem } = generateTestEd25519Keypair();
        const testPepper = generateTestPepper(32);

        assert.throws(
            () => {
                loadAuthorityConfig({
                    env: {
                        NODE_ENV: 'development',
                        CENTRAL_SIGNING_PRIVATE_KEY: privateKeyPem,
                        CENTRAL_SIGNING_PRIVATE_KEY_PATH: '/some/path/to/key.pem',
                        CENTRAL_LICENSE_PEPPER: testPepper
                    }
                });
            },
            (err) => {
                assert.strictEqual(err.code, 'CONFIG_MUTUAL_EXCLUSION_ERROR');
                return true;
            }
        );
    });

    // -------------------------------------------------------------------------
    // TEST 10: Escaped newline PEM (\n) is handled safely
    // -------------------------------------------------------------------------
    it('10. Escaped newline PEM is handled safely', () => {
        const { privateKeyPem } = generateTestEd25519Keypair();
        const testPepper = generateTestPepper(32);
        // Convert real newlines to literal \n
        const escapedPem = privateKeyPem.replace(/\r?\n/g, '\\n');

        const config = loadAuthorityConfig({
            env: {
                NODE_ENV: 'development',
                CENTRAL_SIGNING_PRIVATE_KEY: escapedPem,
                CENTRAL_LICENSE_PEPPER: testPepper
            }
        });

        assert.strictEqual(config.isConfigured, true);
        assert.strictEqual(config.canSign, true);
        assert.strictEqual(config.getPrivateKey().asymmetricKeyType, 'ed25519');
    });

    // -------------------------------------------------------------------------
    // TEST 11: Pepper shorter than 32 bytes is rejected
    // -------------------------------------------------------------------------
    it('11. Pepper shorter than 32 bytes is rejected with CONFIG_WEAK_PEPPER', () => {
        const { privateKeyPem } = generateTestEd25519Keypair();
        const shortPepper = 'short-secret-under-32-bytes!'; // 28 bytes

        assert.throws(
            () => {
                loadAuthorityConfig({
                    env: {
                        NODE_ENV: 'development',
                        CENTRAL_SIGNING_PRIVATE_KEY: privateKeyPem,
                        CENTRAL_LICENSE_PEPPER: shortPepper
                    }
                });
            },
            (err) => {
                assert.strictEqual(err.code, 'CONFIG_WEAK_PEPPER');
                assert(err.message.includes('32 bytes'));
                return true;
            }
        );
    });

    // -------------------------------------------------------------------------
    // TEST 12: Private key and pepper are not exposed through JSON or inspection
    // -------------------------------------------------------------------------
    it('12. Private key and pepper are not exposed through JSON serialization or inspection', () => {
        const { privateKeyPem } = generateTestEd25519Keypair();
        const testPepper = generateTestPepper(32);

        const config = loadAuthorityConfig({
            env: {
                NODE_ENV: 'development',
                CENTRAL_SIGNING_PRIVATE_KEY: privateKeyPem,
                CENTRAL_LICENSE_PEPPER: testPepper
            }
        });

        // 1. JSON.stringify check
        const jsonStr = JSON.stringify(config);
        assert(!jsonStr.includes('PRIVATE KEY'), 'JSON.stringify must not contain private key marker');
        assert(!jsonStr.includes(testPepper), 'JSON.stringify must not contain pepper value');
        const parsed = JSON.parse(jsonStr);
        assert.strictEqual(parsed.isConfigured, true);
        assert.strictEqual(parsed.canSign, true);
        assert.strictEqual(parsed.hasPepper, true);
        assert.strictEqual(parsed.privateKey, undefined);
        assert.strictEqual(parsed.pepper, undefined);

        // 2. util.inspect check
        const inspected = util.inspect(config);
        assert(!inspected.includes('PRIVATE KEY'), 'util.inspect must not contain private key marker');
        assert(!inspected.includes(testPepper), 'util.inspect must not contain pepper value');

        // 3. Object enumeration check
        const keys = Object.keys(config);
        assert(!keys.includes('privateKey'), 'Object.keys must not include privateKey');
        assert(!keys.includes('pepper'), 'Object.keys must not include pepper');
    });

    // -------------------------------------------------------------------------
    // TEST 13: Development/test unconfigured state is explicit
    // -------------------------------------------------------------------------
    it('13. Development/test unconfigured state is explicit', () => {
        const config = loadAuthorityConfig({
            env: {
                NODE_ENV: 'development'
            }
        });

        assert.strictEqual(config.isConfigured, false);
        assert.strictEqual(config.canSign, false);
        assert.strictEqual(config.hasPepper, false);

        assert.throws(
            () => config.getPrivateKey(),
            (err) => {
                assert.strictEqual(err.code, 'CONFIG_UNCONFIGURED_ERROR');
                return true;
            }
        );

        assert.throws(
            () => config.getPepper(),
            (err) => {
                assert.strictEqual(err.code, 'CONFIG_UNCONFIGURED_ERROR');
                return true;
            }
        );
    });

    // -------------------------------------------------------------------------
    // TEST 14: No automatic key generation occurs in production mode
    // -------------------------------------------------------------------------
    it('14. No automatic key generation occurs in production mode', () => {
        const testPepper = generateTestPepper(32);

        // Asserts loader throws rather than generating a fallback key
        assert.throws(
            () => {
                loadAuthorityConfig({
                    env: {
                        NODE_ENV: 'production',
                        CENTRAL_LICENSE_PEPPER: testPepper
                    }
                });
            },
            (err) => {
                assert.strictEqual(err.code, 'CONFIG_MISSING_PRIVATE_KEY');
                return true;
            }
        );

        // Also check dev mode: key is NOT generated silently
        const devConfig = loadAuthorityConfig({
            env: {
                NODE_ENV: 'development'
            }
        });
        assert.strictEqual(devConfig.canSign, false);
    });

    // -------------------------------------------------------------------------
    // TEST 15: Signer factory integration with AuthoritySigner & client verification
    // -------------------------------------------------------------------------
    it('15. Creates valid AuthoritySigner that produces client-verifiable envelopes', () => {
        const { privateKeyPem, publicKeyPem } = generateTestEd25519Keypair();
        const testPepper = generateTestPepper(32);

        const config = loadAuthorityConfig({
            env: {
                NODE_ENV: 'production',
                CENTRAL_SIGNING_KEY_ID: 'test-authority-key-1',
                CENTRAL_SIGNING_PRIVATE_KEY: privateKeyPem,
                CENTRAL_EXPECTED_PUBLIC_KEY: publicKeyPem,
                CENTRAL_LICENSE_PEPPER: testPepper
            }
        });

        // Instantiate signer via factory
        const signer = config.createSigner(AuthoritySigner);
        assert(signer instanceof AuthoritySigner);
        assert.strictEqual(signer.keyId, 'test-authority-key-1');

        // Sign test envelope
        const payload = {
            product_id: 'kiaan-hrm',
            licensed_domain: 'hrm.enterprise.example.com',
            sequence_number: 1
        };
        const envelope = signer.signEnvelope(payload);

        // Verify with client verification engine
        const keystore = {
            'test-authority-key-1': {
                keyId: 'test-authority-key-1',
                algorithm: 'Ed25519',
                publicKey: publicKeyPem,
                status: 'VALID'
            }
        };

        const result = verifyEnvelope(envelope, keystore);
        assert.strictEqual(result.valid, true);
        assert.strictEqual(result.code, 'VERIFIED');
    });

    // -------------------------------------------------------------------------
    // TEST 16: Trivial or insecure pepper pattern is rejected
    // -------------------------------------------------------------------------
    it('16. Trivial or insecure pepper pattern is rejected', () => {
        const { privateKeyPem } = generateTestEd25519Keypair();
        // 36 characters but contains trivial 'password'
        const trivialPepper = 'password-is-insecure-and-weak-123456';

        assert.throws(
            () => {
                loadAuthorityConfig({
                    env: {
                        NODE_ENV: 'development',
                        CENTRAL_SIGNING_PRIVATE_KEY: privateKeyPem,
                        CENTRAL_LICENSE_PEPPER: trivialPepper
                    }
                });
            },
            (err) => {
                assert.strictEqual(err.code, 'CONFIG_WEAK_PEPPER');
                return true;
            }
        );
    });

    // -------------------------------------------------------------------------
    // TEST 17: Non-existent private key file path fails safely
    // -------------------------------------------------------------------------
    it('17. Non-existent private key file path fails with CONFIG_KEY_FILE_ERROR', () => {
        const testPepper = generateTestPepper(32);
        const nonExistentPath = path.join(os.tmpdir(), `non-existent-key-${Date.now()}.pem`);

        assert.throws(
            () => {
                loadAuthorityConfig({
                    env: {
                        NODE_ENV: 'development',
                        CENTRAL_SIGNING_PRIVATE_KEY_PATH: nonExistentPath,
                        CENTRAL_LICENSE_PEPPER: testPepper
                    }
                });
            },
            (err) => {
                assert.strictEqual(err.code, 'CONFIG_KEY_FILE_ERROR');
                return true;
            }
        );
    });

    // -------------------------------------------------------------------------
    // TEST 18: Constants alignment across modules
    // -------------------------------------------------------------------------
    it('18. Constants align with AuthoritySigner and KeyGenerator standards', () => {
        const { DEFAULT_KEY_ID: signerDefaultKeyId, SUPPORTED_ALGORITHM: signerAlgo } = require('../core/authoritySigner');
        const { MIN_PEPPER_LENGTH: keyGenMinPepper } = require('../core/keyGenerator');

        assert.strictEqual(DEFAULT_KEY_ID, signerDefaultKeyId);
        assert.strictEqual(SUPPORTED_ALGORITHM, signerAlgo);
        assert.strictEqual(MIN_PEPPER_LENGTH, keyGenMinPepper);
    });

    console.log('\n==============================================================================');
    console.log(`  TEST RESULTS: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
    console.log('==============================================================================\n');

    if (failed > 0) {
        process.exit(1);
    }
}

runTests();
