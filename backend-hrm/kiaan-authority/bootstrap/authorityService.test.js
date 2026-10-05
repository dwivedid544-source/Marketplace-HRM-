/**
 * Kiaan Central License Authority — Authority Service Container Unit Tests
 * Module: backend-hrm/kiaan-authority/bootstrap/authorityService.test.js
 *
 * Verifies the isolated Authority Service Container:
 * 1. Development unconfigured state (non-fatal, explicit status).
 * 2. Valid configured signer with ephemeral Ed25519 keys.
 * 3. Missing required production key fail-closed.
 * 4. Missing required pepper fail-closed.
 * 5. Invalid key rejection (malformed PEM and non-Ed25519).
 * 6. Missing authority tables sets UNAVAILABLE without DDL.
 * 7. Database readiness query failure handling.
 * 8. Zero automatic key generation.
 * 9. Zero secret leakage through JSON, inspection, or status descriptors.
 * 10. Existing client cryptoEngine verification compatibility.
 * 11. Repeated initialization and shutdown lifecycle.
 * 12. Clean, sanitized error handling.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const util = require('util');

const {
    AuthorityService,
    AuthorityStatus,
    REQUIRED_AUTHORITY_TABLES,
    checkDatabaseReadiness,
    createAuthorityService,
    initAuthority
} = require('./authorityService');

const { verifyEnvelope } = require('../../kiaan-license/core/cryptoEngine');

// ─── Ephemeral In-Memory Cryptographic Fixtures ───
const { privateKey: ephemeralPrivKey, publicKey: ephemeralPubKey } = crypto.generateKeyPairSync('ed25519');
const EPHEMERAL_PRIV_PEM = ephemeralPrivKey.export({ type: 'pkcs8', format: 'pem' });
const EPHEMERAL_PUB_PEM = ephemeralPubKey.export({ type: 'spki', format: 'pem' });
const TEST_PEPPER = 'test_high_entropy_authority_pepper_64_bytes_secure_value_abc1234567890';

// Canonical test license payload
const VALID_PAYLOAD = Object.freeze({
    license_id: 'LIC-TEST-AUTH-SERVICE-2026-001',
    product_id: 'kiaan-hrm',
    licensed_domain: 'localhost',
    domain_aliases: ['127.0.0.1'],
    customer: {
        company_name: 'Authority Service Test Corp',
        email: 'tester@localhost.internal'
    },
    entitlements: {
        plan: 'Enterprise',
        max_employees: 500,
        features: ['ATTENDANCE', 'PAYROLL', 'LEAVES']
    },
    validity: {
        issued_at: '2026-01-01T00:00:00.000Z',
        expires_at: '2027-01-01T00:00:00.000Z'
    },
    sequence_number: 1
});

// Helper creating a mock database containing specified tables
function createMockDb(tables = REQUIRED_AUTHORITY_TABLES, shouldFail = false, errorCode = 'ECONNREFUSED') {
    return {
        executedQueries: [],
        query: async function (sql, params) {
            this.executedQueries.push({ sql, params });
            if (shouldFail) {
                const err = new Error(`Database connection failed: ${errorCode}`);
                err.code = errorCode;
                throw err;
            }
            return [tables.map(tbl => ({ TABLE_NAME: tbl }))];
        }
    };
}

test('1. Development unconfigured state (non-fatal, explicit dormant status)', async () => {
    const service = await initAuthority({
        nodeEnv: 'development',
        env: {}
    });

    assert.strictEqual(service.status, AuthorityStatus.UNCONFIGURED);
    assert.strictEqual(service.isReady, false);
    assert.strictEqual(service.canSign, false);
    assert.strictEqual(service.hasPepper, false);
    assert.strictEqual(service.nodeEnv, 'development');
    assert.strictEqual(typeof service.statusReason, 'string');
    assert.match(service.statusReason, /not configured/i);

    // Attempting to retrieve signer or sign must throw clean error
    assert.throws(
        () => service.getSigner(),
        err => err.code === 'AUTHORITY_NOT_CONFIGURED'
    );
    assert.throws(
        () => service.signLicense(VALID_PAYLOAD),
        err => err.code === 'AUTHORITY_NOT_CONFIGURED'
    );
});

test('2. Valid configured signer with ephemeral Ed25519 keys', async () => {
    const mockDb = createMockDb(REQUIRED_AUTHORITY_TABLES);
    const service = await initAuthority({
        nodeEnv: 'development',
        env: {
            CENTRAL_SIGNING_KEY_ID: 'test-authority-root-2026',
            CENTRAL_SIGNING_PRIVATE_KEY: EPHEMERAL_PRIV_PEM,
            CENTRAL_LICENSE_PEPPER: TEST_PEPPER
        },
        db: mockDb
    });

    assert.strictEqual(service.status, AuthorityStatus.READY);
    assert.strictEqual(service.isReady, true);
    assert.strictEqual(service.canSign, true);
    assert.strictEqual(service.hasPepper, true);
    assert.strictEqual(service.keyId, 'test-authority-root-2026');
    assert.strictEqual(service.algorithm, 'Ed25519');
    assert.strictEqual(service.missingTables.length, 0);

    const signer = service.getSigner();
    assert.ok(signer);
    assert.strictEqual(typeof signer.signEnvelope, 'function');

    const envelope = service.signEnvelope(VALID_PAYLOAD);
    assert.strictEqual(envelope.algorithm, 'Ed25519');
    assert.strictEqual(envelope.key_id, 'test-authority-root-2026');
    assert.strictEqual(typeof envelope.signature, 'string');

    // Also verify alias signLicense
    const envelope2 = service.signLicense(VALID_PAYLOAD);
    assert.strictEqual(envelope2.signature, envelope.signature);
});

test('3. Missing required production key fails closed', async () => {
    // Mode A: production environment
    await assert.rejects(
        async () => {
            await initAuthority({
                nodeEnv: 'production',
                env: {
                    CENTRAL_LICENSE_PEPPER: TEST_PEPPER
                }
            });
        },
        err => err.code === 'CONFIG_MISSING_PRIVATE_KEY'
    );

    // Mode B: explicit requireAuthority: true in development
    await assert.rejects(
        async () => {
            await initAuthority({
                nodeEnv: 'development',
                requireAuthority: true,
                env: {
                    CENTRAL_LICENSE_PEPPER: TEST_PEPPER
                }
            });
        },
        err => err.code === 'CONFIG_MISSING_PRIVATE_KEY'
    );
});

test('4. Missing required pepper fails closed', async () => {
    // Production without pepper
    await assert.rejects(
        async () => {
            await initAuthority({
                nodeEnv: 'production',
                env: {
                    CENTRAL_SIGNING_PRIVATE_KEY: EPHEMERAL_PRIV_PEM
                }
            });
        },
        err => err.code === 'CONFIG_MISSING_PEPPER'
    );

    // requirePepper flag
    await assert.rejects(
        async () => {
            await initAuthority({
                nodeEnv: 'development',
                requirePepper: true,
                env: {
                    CENTRAL_SIGNING_PRIVATE_KEY: EPHEMERAL_PRIV_PEM
                }
            });
        },
        err => err.code === 'CONFIG_MISSING_PEPPER'
    );
});

test('5. Invalid key rejection (malformed PEM and non-Ed25519 RSA)', async () => {
    // Malformed PEM
    await assert.rejects(
        async () => {
            await initAuthority({
                nodeEnv: 'development',
                requireSigning: true,
                env: {
                    CENTRAL_SIGNING_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\nINVALID_CORRUPT_BASE64\n-----END PRIVATE KEY-----',
                    CENTRAL_LICENSE_PEPPER: TEST_PEPPER
                }
            });
        },
        err => err.code === 'CONFIG_KEY_PARSE_ERROR'
    );

    // Non-Ed25519 RSA private key
    const { privateKey: rsaPrivKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const rsaPem = rsaPrivKey.export({ type: 'pkcs8', format: 'pem' });

    await assert.rejects(
        async () => {
            await initAuthority({
                nodeEnv: 'development',
                requireSigning: true,
                env: {
                    CENTRAL_SIGNING_PRIVATE_KEY: rsaPem,
                    CENTRAL_LICENSE_PEPPER: TEST_PEPPER
                }
            });
        },
        err => err.code === 'CONFIG_INVALID_KEY_TYPE'
    );
});

test('6. Missing authority tables marks UNAVAILABLE without executing DDL', async () => {
    // Mock DB has only 2 of the 7 required tables
    const partialTables = ['marketplace_products', 'marketplace_editions'];
    const mockDb = createMockDb(partialTables);

    const service = await initAuthority({
        nodeEnv: 'development',
        env: {
            CENTRAL_SIGNING_PRIVATE_KEY: EPHEMERAL_PRIV_PEM,
            CENTRAL_LICENSE_PEPPER: TEST_PEPPER
        },
        db: mockDb
    });

    assert.strictEqual(service.status, AuthorityStatus.UNAVAILABLE);
    assert.strictEqual(service.isReady, false);
    assert.strictEqual(service.canSign, true); // Signer is created, but service is not ready
    assert.strictEqual(service.missingTables.length, 5);
    assert.ok(service.missingTables.includes('marketplace_licenses'));
    assert.ok(service.missingTables.includes('license_activations'));

    // Critical assertion: Only read queries were executed (zero DDL)
    assert.strictEqual(mockDb.executedQueries.length, 1);
    const querySql = mockDb.executedQueries[0].sql.toLowerCase();
    assert.match(querySql, /^select /);
    assert.ok(!querySql.includes('create '));
    assert.ok(!querySql.includes('alter '));
    assert.ok(!querySql.includes('drop '));

    // When requireDb is true in required mode, it fails closed
    await assert.rejects(
        async () => {
            await initAuthority({
                nodeEnv: 'development',
                requireAuthority: true,
                requireDb: true,
                env: {
                    CENTRAL_SIGNING_PRIVATE_KEY: EPHEMERAL_PRIV_PEM,
                    CENTRAL_LICENSE_PEPPER: TEST_PEPPER
                },
                db: mockDb
            });
        },
        err => err.code === 'AUTHORITY_DATABASE_UNAVAILABLE'
    );

    // Also verify checkDatabaseReadiness with db.execute and direct rows array
    const executeDb = {
        execute: async () => partialTables.map(tbl => ({ TABLE_NAME: tbl }))
    };
    const executeResult = await checkDatabaseReadiness(executeDb);
    assert.strictEqual(executeResult.ready, false);
    assert.strictEqual(executeResult.missingTables.length, 5);
});

test('7. Database readiness query failure is handled safely', async () => {
    const failingDb = createMockDb([], true, 'ECONNREFUSED');

    const service = await initAuthority({
        nodeEnv: 'development',
        env: {
            CENTRAL_SIGNING_PRIVATE_KEY: EPHEMERAL_PRIV_PEM,
            CENTRAL_LICENSE_PEPPER: TEST_PEPPER
        },
        db: failingDb
    });

    assert.strictEqual(service.status, AuthorityStatus.UNAVAILABLE);
    assert.strictEqual(service.isReady, false);
    assert.strictEqual(service.missingTables.length, 7);
    assert.strictEqual(service.lastError.code, 'ECONNREFUSED');
    assert.match(service.statusReason, /Database readiness check error|Database readiness check failed/);

    // Also verify checkDatabaseReadiness with null db
    const nullDbResult = await checkDatabaseReadiness(null);
    assert.strictEqual(nullDbResult.ready, false);
    assert.strictEqual(nullDbResult.error, 'NO_DATABASE_CONNECTION');
});

test('8. Zero automatic key generation occurs in any mode', async () => {
    // Start unconfigured service
    const service = await initAuthority({
        nodeEnv: 'development',
        env: {}
    });

    // Ensure no keys were generated or assigned
    assert.strictEqual(service.canSign, false);
    assert.throws(() => service.getSigner());

    // Verify raw private key property cannot be found or accessed
    assert.strictEqual(service.privateKey, undefined);
    assert.strictEqual(service._privateKey, undefined);
    assert.strictEqual(service.pepper, undefined);
});

test('9. Zero secret leakage through JSON, util.inspect, or status descriptors', async () => {
    const service = await initAuthority({
        nodeEnv: 'development',
        env: {
            CENTRAL_SIGNING_PRIVATE_KEY: EPHEMERAL_PRIV_PEM,
            CENTRAL_LICENSE_PEPPER: TEST_PEPPER
        }
    });

    // JSON serialization
    const serializedJson = JSON.stringify(service);
    assert.strictEqual(serializedJson.includes('PRIVATE KEY'), false);
    assert.strictEqual(serializedJson.includes(TEST_PEPPER), false);

    // util.inspect
    const inspected = util.inspect(service);
    assert.strictEqual(inspected.includes('PRIVATE KEY'), false);
    assert.strictEqual(inspected.includes(TEST_PEPPER), false);
    assert.match(inspected, /\[AuthorityService: status=READY/);

    // getStatus() descriptor
    const statusObj = service.getStatus();
    const statusJson = JSON.stringify(statusObj);
    assert.strictEqual(statusJson.includes('PRIVATE KEY'), false);
    assert.strictEqual(statusJson.includes(TEST_PEPPER), false);
    assert.strictEqual(statusObj.canSign, true);
    assert.strictEqual(statusObj.hasPepper, true);

    // config descriptor
    const configDesc = service.config;
    const configJson = JSON.stringify(configDesc);
    assert.strictEqual(configJson.includes('PRIVATE KEY'), false);
    assert.strictEqual(configJson.includes(TEST_PEPPER), false);
});

test('10. Existing client cryptoEngine verification compatibility', async () => {
    const KEY_ID = 'test-client-keystore-compat-2026';
    const mockDb = createMockDb(REQUIRED_AUTHORITY_TABLES);

    const service = await initAuthority({
        nodeEnv: 'development',
        env: {
            CENTRAL_SIGNING_KEY_ID: KEY_ID,
            CENTRAL_SIGNING_PRIVATE_KEY: EPHEMERAL_PRIV_PEM,
            CENTRAL_LICENSE_PEPPER: TEST_PEPPER
        },
        db: mockDb
    });

    // Sign payload using service
    const envelope = service.signLicense(VALID_PAYLOAD);

    // Construct client keystore with the ephemeral public key
    const clientKeystore = Object.freeze({
        [KEY_ID]: Object.freeze({
            keyId: KEY_ID,
            algorithm: 'Ed25519',
            publicKey: EPHEMERAL_PUB_PEM,
            status: 'VALID'
        })
    });

    // Client verification must succeed completely
    const verifyResult = verifyEnvelope(envelope, clientKeystore);
    assert.strictEqual(verifyResult.valid, true);
    assert.strictEqual(verifyResult.code, 'VERIFIED');
    assert.strictEqual(verifyResult.keyId, KEY_ID);
    assert.strictEqual(verifyResult.payload.license_id, VALID_PAYLOAD.license_id);
    assert.strictEqual(verifyResult.payload.customer.company_name, VALID_PAYLOAD.customer.company_name);
});

test('11. Repeated initialization and shutdown lifecycle', async () => {
    const service = createAuthorityService();
    assert.strictEqual(service.status, AuthorityStatus.UNINITIALIZED);
    assert.strictEqual(service.isReady, false);

    // First init (unconfigured)
    await service.init({ nodeEnv: 'development', env: {} });
    assert.strictEqual(service.status, AuthorityStatus.UNCONFIGURED);

    // Second init (configured)
    await service.init({
        nodeEnv: 'development',
        env: {
            CENTRAL_SIGNING_PRIVATE_KEY: EPHEMERAL_PRIV_PEM,
            CENTRAL_LICENSE_PEPPER: TEST_PEPPER
        }
    });
    assert.strictEqual(service.status, AuthorityStatus.READY);
    assert.strictEqual(service.isReady, true);
    assert.strictEqual(service.canSign, true);

    // Shutdown
    service.shutdown();
    assert.strictEqual(service.status, AuthorityStatus.SHUTDOWN);
    assert.strictEqual(service.isReady, false);
    assert.strictEqual(service.canSign, false);
    assert.throws(() => service.getSigner());

    // Re-initialize after shutdown
    await service.init({
        nodeEnv: 'development',
        env: {
            CENTRAL_SIGNING_PRIVATE_KEY: EPHEMERAL_PRIV_PEM,
            CENTRAL_LICENSE_PEPPER: TEST_PEPPER
        }
    });
    assert.strictEqual(service.status, AuthorityStatus.READY);
    assert.strictEqual(service.isReady, true);
});

test('12. Clean, sanitized error handling across all failure modes', async () => {
    // 1. Weak pepper error code
    await assert.rejects(
        async () => {
            await initAuthority({
                nodeEnv: 'production',
                env: {
                    CENTRAL_SIGNING_PRIVATE_KEY: EPHEMERAL_PRIV_PEM,
                    CENTRAL_LICENSE_PEPPER: 'short_pepper'
                }
            });
        },
        err => {
            assert.strictEqual(err.code, 'CONFIG_WEAK_PEPPER');
            assert.strictEqual(err.message.includes('short_pepper'), false);
            return true;
        }
    );

    // 2. Mutual exclusion error code
    await assert.rejects(
        async () => {
            await initAuthority({
                nodeEnv: 'production',
                env: {
                    CENTRAL_SIGNING_PRIVATE_KEY: EPHEMERAL_PRIV_PEM,
                    CENTRAL_SIGNING_PRIVATE_KEY_PATH: '/path/to/key.pem',
                    CENTRAL_LICENSE_PEPPER: TEST_PEPPER
                }
            });
        },
        err => err.code === 'CONFIG_MUTUAL_EXCLUSION_ERROR'
    );

    // 3. Database check error handling with standalone checker
    const customChecker = async () => {
        const err = new Error('Custom DB query timeout');
        err.code = 'ETIMEDOUT';
        throw err;
    };

    const service = await initAuthority({
        nodeEnv: 'development',
        env: {
            CENTRAL_SIGNING_PRIVATE_KEY: EPHEMERAL_PRIV_PEM,
            CENTRAL_LICENSE_PEPPER: TEST_PEPPER
        },
        db: {},
        dbChecker: customChecker
    });

    assert.strictEqual(service.status, AuthorityStatus.UNAVAILABLE);
    assert.strictEqual(service.lastError.code, 'ETIMEDOUT');
    assert.strictEqual(service.lastError.message.includes('Custom DB query timeout'), true);
});
