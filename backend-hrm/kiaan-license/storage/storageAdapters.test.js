/**
 * Kiaan License Engine — Storage Adapters & Config Test Suite
 * Module: backend-hrm/kiaan-license/storage/storageAdapters.test.js
 *
 * Verifies:
 * 1. Configuration validation, keystore security, and deep-freeze immutability
 * 2. Filesystem Adapter atomic write, read, missing file, corruption, and path redaction
 * 3. MySQL Adapter parameterized queries, missing table handling, and DB outage fail-safe
 * 4. Integration with vaultEngine (reconcileVaults & persistEntitlement)
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const {
    licenseConfig,
    createLicenseConfig,
    validateConfig,
    DEFAULT_PRODUCT_ID,
    DEFAULT_KEYSTORE
} = require('../config/licenseConfig');

const {
    createFilesystemAdapter,
    sanitizePathInError
} = require('./filesystemAdapter');

const {
    createMysqlAdapter,
    DB_CONNECTION_ERROR_CODES
} = require('./mysqlAdapter');

const {
    reconcileVaults,
    persistEntitlement,
    VaultStatus,
    WriteStatus
} = require('../core/vaultEngine');

const { canonicalizeToBuffer } = require('../core/canonicalizer');

let totalTests = 0;
let passedTests = 0;

async function runTest(name, fn) {
    totalTests++;
    try {
        await fn();
        passedTests++;
        console.log(`  ✓ ${name}`);
    } catch (err) {
        console.error(`  ✗ ${name}`);
        console.error(`    Error: ${err.message}`);
        throw err;
    }
}

// Generate ephemeral test keypair for cryptographic envelope verification
const testKeyPair = crypto.generateKeyPairSync('ed25519');
const testPubPem = testKeyPair.publicKey.export({ type: 'spki', format: 'pem' });
const testPrivKey = testKeyPair.privateKey;

const testKeystore = {
    'test-key-1': {
        keyId: 'test-key-1',
        algorithm: 'Ed25519',
        publicKey: testPubPem,
        status: 'VALID'
    }
};

function createSignedEnvelope(payload, seq = 1) {
    const fullPayload = {
        entitlement_id: 'ent_test_100',
        product_id: 'kiaan-hrm',
        licensed_domain: 'hrm.test.local',
        sequence_number: seq,
        ...payload
    };

    const canonicalBytes = canonicalizeToBuffer(fullPayload);
    const signature = crypto.sign(null, canonicalBytes, testPrivKey).toString('base64');

    return {
        algorithm: 'Ed25519',
        key_id: 'test-key-1',
        payload: fullPayload,
        signature: signature
    };
}

(async function executeTestSuite() {
    console.log('\n======================================================');
    console.log('  KIAAN LICENSE STORAGE ADAPTERS & CONFIG TEST SUITE');
    console.log('======================================================\n');

    // =========================================================================
    // GROUP 1: CONFIGURATION & KEYSTORE INTEGRITY
    // =========================================================================
    console.log('Group 1: Configuration Validation & Security');

    await runTest('Default licenseConfig loads valid defaults', () => {
        assert.strictEqual(licenseConfig.productId, DEFAULT_PRODUCT_ID);
        assert.strictEqual(licenseConfig.storage.tableName, 'system_licenses');
        assert.ok(licenseConfig.keystore['kiaan-root-2026-v1']);
        assert.strictEqual(licenseConfig.cache.healthyTtlMs, 30000);
        assert.strictEqual(licenseConfig.cache.degradedTtlMs, 5000);
    });

    await runTest('Default Keystore contains valid SPKI public key and ZERO private keys', () => {
        const rootEntry = licenseConfig.keystore['kiaan-root-2026-v1'];
        assert.ok(rootEntry.publicKey.includes('BEGIN PUBLIC KEY'));
        assert.ok(!rootEntry.publicKey.includes('PRIVATE KEY'));

        // Verify Node.js crypto accepts it as a public key
        const keyObj = crypto.createPublicKey(rootEntry.publicKey);
        assert.strictEqual(keyObj.asymmetricKeyType, 'ed25519');
    });

    await runTest('Configuration object is deep-frozen (immutable)', () => {
        assert.throws(() => {
            licenseConfig.productId = 'hacked';
        }, TypeError);

        assert.throws(() => {
            licenseConfig.storage.tableName = 'malicious';
        }, TypeError);
    });

    await runTest('Validation strictly rejects private key injection in keystore', () => {
        assert.throws(() => {
            createLicenseConfig({
                keystore: {
                    'bad-key': {
                        keyId: 'bad-key',
                        algorithm: 'Ed25519',
                        publicKey: '-----BEGIN PRIVATE KEY-----\nMIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQg...\n-----END PRIVATE KEY-----',
                        status: 'VALID'
                    }
                }
            });
        }, /SECURITY VIOLATION: Private key detected/);
    });

    await runTest('Validation strictly rejects SQL injection in storage table name', () => {
        assert.throws(() => {
            createLicenseConfig({
                storage: {
                    tableName: 'system_licenses; DROP TABLE users; --',
                    vaultPath: '/tmp/test.lic'
                }
            });
        }, /valid SQL identifier/);
    });

    await runTest('Validation rejects invalid cache TTL values', () => {
        assert.throws(() => {
            validateConfig({
                productId: 'kiaan-hrm',
                storage: { tableName: 'valid_table', vaultPath: '/tmp/test.lic' },
                cache: { healthyTtlMs: -100, degradedTtlMs: 5000 },
                keystore: DEFAULT_KEYSTORE
            });
        }, TypeError);
    });

    // =========================================================================
    // GROUP 2: FILESYSTEM STORAGE ADAPTER
    // =========================================================================
    console.log('\nGroup 2: Filesystem Storage Adapter');

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kiaan-fs-test-'));
    const tempVaultPath = path.join(tempDir, 'sub', 'vault', 'license.lic');

    try {
        const fsAdapter = createFilesystemAdapter({ vaultPath: tempVaultPath });

        await runTest('Missing vault returns null (clean MISSING signal)', async () => {
            const result = await fsAdapter.read();
            assert.strictEqual(result, null);
            assert.strictEqual(await fsAdapter.exists(), false);
        });

        const envelopeSeq1 = createSignedEnvelope({ customer: 'Acme Corp' }, 1);

        await runTest('Atomic write creates directory and persists valid envelope', async () => {
            const success = await fsAdapter.write(envelopeSeq1);
            assert.strictEqual(success, true);
            assert.strictEqual(await fsAdapter.exists(), true);

            const readBack = await fsAdapter.read();
            assert.deepStrictEqual(readBack, envelopeSeq1);
        });

        await runTest('Atomic replacement updates content without leaving temp files behind', async () => {
            const envelopeSeq2 = createSignedEnvelope({ customer: 'Acme Corp' }, 2);
            await fsAdapter.write(envelopeSeq2);

            const readBack = await fsAdapter.read();
            assert.strictEqual(readBack.payload.sequence_number, 2);

            // Verify no leftover .tmp files exist in the vault directory
            const dirFiles = fs.readdirSync(path.dirname(tempVaultPath));
            const tmpFiles = dirFiles.filter(f => f.startsWith('.license.tmp.'));
            assert.strictEqual(tmpFiles.length, 0);
        });

        await runTest('Write rejects invalid or null envelope arguments', async () => {
            await assert.rejects(async () => {
                await fsAdapter.write(null);
            }, TypeError);

            await assert.rejects(async () => {
                await fsAdapter.write({ algorithm: 'Ed25519' }); // missing fields
            }, TypeError);
        });

        await runTest('Read handles empty vault file as MALFORMED_STORED_DATA', async () => {
            fs.writeFileSync(tempVaultPath, '   \n  ', 'utf8');
            await assert.rejects(async () => {
                await fsAdapter.read();
            }, (err) => {
                assert.strictEqual(err.code, 'MALFORMED_STORED_DATA');
                return true;
            });
        });

        await runTest('Read handles corrupted JSON as MALFORMED_STORED_DATA', async () => {
            fs.writeFileSync(tempVaultPath, '{ "broken": json', 'utf8');
            await assert.rejects(async () => {
                await fsAdapter.read();
            }, (err) => {
                assert.strictEqual(err.code, 'MALFORMED_STORED_DATA');
                return true;
            });
        });

        await runTest('Path sanitization redacts absolute host path in error messages', () => {
            const originalErr = new Error(`Failed to access ${tempVaultPath} inside ${path.dirname(tempVaultPath)}`);
            const sanitized = sanitizePathInError(originalErr, tempVaultPath);
            assert.ok(!sanitized.message.includes(tempVaultPath));
            assert.ok(!sanitized.message.includes(path.dirname(tempVaultPath)));
            assert.ok(sanitized.message.includes('[VAULT_FILE]'));
        });

        await runTest('Sanitized path accessor returns safe descriptor', () => {
            const desc = fsAdapter.getSanitizedPath();
            assert.strictEqual(desc, '[VAULT_DIR]/license.lic');
            assert.ok(!desc.includes(tempDir));
        });
    } finally {
        // Cleanup temp test directory
        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
        } catch {}
    }

    // =========================================================================
    // GROUP 3: MYSQL STORAGE ADAPTER
    // =========================================================================
    console.log('\nGroup 3: MySQL Storage Adapter');

    // In-memory mock database pool for isolated testing
    function createMockPool(initialState = {}) {
        let rows = initialState.rows || [];
        let tableExists = initialState.tableExists !== false;
        let connectionHealthy = initialState.connectionHealthy !== false;
        let lastQuery = null;

        return {
            get lastQuery() { return lastQuery; },
            setRows(newRows) { rows = newRows; },
            setTableExists(exists) { tableExists = exists; },
            setConnectionHealthy(healthy) { connectionHealthy = healthy; },
            async query(sql, params) {
                lastQuery = { sql, params };

                if (!connectionHealthy) {
                    const connErr = new Error('connect ECONNREFUSED 127.0.0.1:3306');
                    connErr.code = 'ECONNREFUSED';
                    throw connErr;
                }

                if (!tableExists) {
                    const tableErr = new Error("Table 'test_db.system_licenses' doesn't exist");
                    tableErr.code = 'ER_NO_SUCH_TABLE';
                    tableErr.errno = 1146;
                    throw tableErr;
                }

                if (sql.startsWith('SELECT 1 as ping')) {
                    return [[{ ping: 1 }]];
                }

                if (sql.startsWith('SELECT 1 FROM')) {
                    return [[{ 1: 1 }]];
                }

                if (sql.includes('SELECT * FROM') || sql.includes('SELECT id FROM')) {
                    return [rows];
                }

                if (sql.includes('INSERT INTO')) {
                    const newRow = {
                        id: rows.length + 1,
                        envelope_json: params[1],
                        key_id: params[2],
                        algorithm: params[3],
                        sequence_number: params[4]
                    };
                    rows.push(newRow);
                    return [{ insertId: newRow.id, affectedRows: 1 }];
                }

                if (sql.includes('UPDATE')) {
                    if (rows.length > 0) {
                        rows[0].envelope_json = params[1];
                        rows[0].key_id = params[2];
                        rows[0].algorithm = params[3];
                        rows[0].sequence_number = params[4];
                    }
                    return [{ affectedRows: 1 }];
                }

                return [[]];
            }
        };
    }

    const envelopeSeq1 = createSignedEnvelope({ customer: 'Acme Corp' }, 1);

    await runTest('Constructor rejects invalid pool object', () => {
        assert.throws(() => {
            createMysqlAdapter(null);
        }, TypeError);

        assert.throws(() => {
            createMysqlAdapter({});
        }, TypeError);
    });

    await runTest('Constructor rejects invalid table identifier', () => {
        const mockPool = createMockPool();
        assert.throws(() => {
            createMysqlAdapter(mockPool, { tableName: 'licenses; DROP TABLE;' });
        }, /Invalid table name identifier/);
    });

    await runTest('Empty database table returns null (clean MISSING signal)', async () => {
        const mockPool = createMockPool({ rows: [] });
        const mysqlAdapter = createMysqlAdapter(mockPool);

        const result = await mysqlAdapter.read();
        assert.strictEqual(result, null);
    });

    await runTest('Missing database table (ER_NO_SUCH_TABLE) returns null on read', async () => {
        const mockPool = createMockPool({ tableExists: false });
        const mysqlAdapter = createMysqlAdapter(mockPool);

        const result = await mysqlAdapter.read();
        assert.strictEqual(result, null);
        assert.strictEqual(await mysqlAdapter.hasTable(), false);
    });

    await runTest('Missing database table throws TABLE_NOT_FOUND on write', async () => {
        const mockPool = createMockPool({ tableExists: false });
        const mysqlAdapter = createMysqlAdapter(mockPool);

        await assert.rejects(async () => {
            await mysqlAdapter.write(envelopeSeq1);
        }, (err) => {
            assert.strictEqual(err.code, 'TABLE_NOT_FOUND');
            return true;
        });
    });

    await runTest('Database connection failure throws DB_UNAVAILABLE (fail-safe)', async () => {
        const mockPool = createMockPool({ connectionHealthy: false });
        const mysqlAdapter = createMysqlAdapter(mockPool);

        await assert.rejects(async () => {
            await mysqlAdapter.read();
        }, (err) => {
            assert.strictEqual(err.code, 'DB_UNAVAILABLE');
            return true;
        });

        assert.strictEqual(await mysqlAdapter.isAvailable(), false);
    });

    await runTest('Write and read roundtrip with envelope_json column', async () => {
        const mockPool = createMockPool({ rows: [] });
        const mysqlAdapter = createMysqlAdapter(mockPool);

        const writeSuccess = await mysqlAdapter.write(envelopeSeq1);
        assert.strictEqual(writeSuccess, true);

        const readBack = await mysqlAdapter.read();
        assert.deepStrictEqual(readBack, envelopeSeq1);
    });

    await runTest('Read backward-compatibility with separate legacy columns', async () => {
        const legacyRow = {
            id: 1,
            algorithm: 'Ed25519',
            key_id: envelopeSeq1.key_id,
            license_data: JSON.stringify(envelopeSeq1.payload),
            signature: envelopeSeq1.signature,
            sequence_number: 1
        };

        const mockPool = createMockPool({ rows: [legacyRow] });
        const mysqlAdapter = createMysqlAdapter(mockPool);

        const readBack = await mysqlAdapter.read();
        assert.strictEqual(readBack.algorithm, 'Ed25519');
        assert.strictEqual(readBack.key_id, envelopeSeq1.key_id);
        assert.strictEqual(readBack.signature, envelopeSeq1.signature);
        assert.deepStrictEqual(readBack.payload, envelopeSeq1.payload);
    });

    await runTest('Corrupted JSON stored in database throws MALFORMED_STORED_DATA', async () => {
        const corruptRow = {
            id: 1,
            envelope_json: '{"unclosed": json'
        };

        const mockPool = createMockPool({ rows: [corruptRow] });
        const mysqlAdapter = createMysqlAdapter(mockPool);

        await assert.rejects(async () => {
            await mysqlAdapter.read();
        }, (err) => {
            assert.strictEqual(err.code, 'MALFORMED_STORED_DATA');
            return true;
        });
    });

    // =========================================================================
    // GROUP 4: INTEGRATION WITH VAULT ENGINE
    // =========================================================================
    console.log('\nGroup 4: Integration with vaultEngine Core');

    const integDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kiaan-integ-test-'));
    const integVaultPath = path.join(integDir, 'license.lic');

    try {
        const realFsAdapter = createFilesystemAdapter({ vaultPath: integVaultPath });
        const mockPool = createMockPool({ rows: [] });
        const realMysqlAdapter = createMysqlAdapter(mockPool);

        await runTest('reconcileVaults initially reports STATUS_UNLICENSED when both vaults empty', async () => {
            const result = await reconcileVaults({
                primaryAdapter: realMysqlAdapter,
                mirrorAdapter: realFsAdapter,
                keystore: testKeystore
            });
            assert.strictEqual(result.status, VaultStatus.UNLICENSED);
            assert.strictEqual(result.authoritative, null);
        });

        await runTest('persistEntitlement writes to both adapters and leaves system HEALTHY', async () => {
            const envelope1 = createSignedEnvelope({ customer: 'Acme Corp' }, 1);

            const writeRes = await persistEntitlement({
                primaryAdapter: realMysqlAdapter,
                mirrorAdapter: realFsAdapter,
                keystore: testKeystore,
                envelope: envelope1
            });

            assert.strictEqual(writeRes.success, true);
            assert.strictEqual(writeRes.code, WriteStatus.SUCCESS);

            // Reconcile and verify HEALTHY status
            const reconc = await reconcileVaults({
                primaryAdapter: realMysqlAdapter,
                mirrorAdapter: realFsAdapter,
                keystore: testKeystore
            });
            assert.strictEqual(reconc.status, VaultStatus.HEALTHY);
            assert.strictEqual(reconc.vaults.primary.sequenceNumber, 1);
            assert.strictEqual(reconc.authoritative.payload.sequence_number, 1);
        });

        await runTest('Monotonic upgrade: persisting sequence 2 updates both adapters', async () => {
            const envelope2 = createSignedEnvelope({ customer: 'Acme Corp' }, 2);

            const writeRes = await persistEntitlement({
                primaryAdapter: realMysqlAdapter,
                mirrorAdapter: realFsAdapter,
                keystore: testKeystore,
                envelope: envelope2
            });

            assert.strictEqual(writeRes.success, true);

            const reconc = await reconcileVaults({
                primaryAdapter: realMysqlAdapter,
                mirrorAdapter: realFsAdapter,
                keystore: testKeystore
            });
            assert.strictEqual(reconc.status, VaultStatus.HEALTHY);
            assert.strictEqual(reconc.vaults.primary.sequenceNumber, 2);
            assert.strictEqual(reconc.authoritative.payload.sequence_number, 2);
        });

        await runTest('Self-healing: MySQL missing auto-heals from Filesystem vault', async () => {
            // Simulate database restore/wipe where MySQL table is empty
            mockPool.setRows([]);

            const reconc = await reconcileVaults({
                primaryAdapter: realMysqlAdapter,
                mirrorAdapter: realFsAdapter,
                keystore: testKeystore,
                options: { autoHeal: true }
            });

            assert.strictEqual(reconc.status, VaultStatus.SELF_HEALED);
            assert.strictEqual(reconc.healTarget, 'primary');
            assert.strictEqual(reconc.healResult.success, true);

            // Verify MySQL was self-healed
            const mysqlRead = await realMysqlAdapter.read();
            assert.ok(mysqlRead);
            assert.strictEqual(mysqlRead.payload.sequence_number, 2);
        });

        await runTest('Partial persistence failure reported if MySQL fails during write', async () => {
            mockPool.setConnectionHealthy(false);

            const envelope3 = createSignedEnvelope({ customer: 'Acme Corp' }, 3);

            const writeRes = await persistEntitlement({
                primaryAdapter: realMysqlAdapter,
                mirrorAdapter: realFsAdapter,
                keystore: testKeystore,
                envelope: envelope3
            });

            assert.strictEqual(writeRes.success, false);
            assert.strictEqual(writeRes.code, WriteStatus.PARTIAL_FAILURE);
            assert.strictEqual(writeRes.details.primary.success, false);
            assert.strictEqual(writeRes.details.mirror.success, true);
        });

    } finally {
        try {
            fs.rmSync(integDir, { recursive: true, force: true });
        } catch {}
    }

    console.log('\n======================================================');
    console.log(`  ALL ${passedTests} / ${totalTests} TESTS PASSED SUCCESSFULLY!`);
    console.log('======================================================\n');
})();
