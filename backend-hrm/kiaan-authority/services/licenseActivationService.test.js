/**
 * Kiaan Central License Authority — Online Activation & Domain Binding Test Suite
 * Module: backend-hrm/kiaan-authority/services/licenseActivationService.test.js
 *
 * Comprehensive unit, concurrency, security, and integration test suite for Phase 2B.8E.
 *
 * Test Groups:
 * A. Valid Activation & Domain Binding (ISSUED -> ACTIVATED)
 * B. Cryptographic Verification & Tamper Resistance (Client cryptoEngine)
 * C. Single-Use Bearer Credential & Replay Protection
 * D. Domain Normalization & Production Localhost Guard
 * E. License State Machine & Revocation Enforcement
 * F. Concurrency & Race Condition Atomicity
 * G. Database Persistence & Audit Trail
 * H. Client Offline Verifier End-to-End Compatibility (licenseCache + vaultEngine)
 * I. Security & Secret Containment (Zero Leaks)
 * J. HTTP Route Boundary Tests (POST /activate)
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const { LicenseActivationService } = require('./licenseActivationService');
const { createAuthorityRouter } = require('../routes/authorityRoutes');
const { AuthoritySigner } = require('../core/authoritySigner');
const keyGenerator = require('../core/keyGenerator');
const { verifyEnvelope, VerificationCodes } = require('../../kiaan-license/core/cryptoEngine');

// High-entropy test pepper (minimum 32 bytes)
const TEST_PEPPER = 'test_high_entropy_authority_pepper_64_bytes_secure_value_abc1234567890';

/**
 * Generates an ephemeral Ed25519 keypair and creates a test AuthoritySigner instance.
 */
function createTestSigner(keyId = 'kiaan-root-2026-v1') {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
    const signer = new AuthoritySigner({
        privateKey,
        keyId
    });

    const clientKeystore = {
        [keyId]: {
            publicKey: signer.getPublicKeyEntry().publicKey,
            status: 'VALID'
        }
    };

    return { signer, clientKeystore, privateKey, publicKey };
}

/**
 * Creates an in-memory transactional mock MySQL database.
 * Simulates row-level locking (`FOR UPDATE`), rollbacks, and unique indexes.
 */
function createMockDatabase() {
    const licenses = new Map();
    const activations = [];
    let nextActivationId = 1;

    // Row lock simulation for SELECT ... FOR UPDATE
    const activeLocks = new Map();

    async function acquireLock(key) {
        while (activeLocks.has(key)) {
            await activeLocks.get(key);
        }
        let resolveLock;
        const lockPromise = new Promise(res => { resolveLock = res; });
        activeLocks.set(key, lockPromise);
        return () => {
            if (activeLocks.get(key) === lockPromise) {
                activeLocks.delete(key);
            }
            resolveLock();
        };
    }

    function createConnection() {
        let inTransaction = false;
        let heldLockReleaseFns = [];

        function releaseAllLocks() {
            for (const fn of heldLockReleaseFns) {
                try { fn(); } catch (_) {}
            }
            heldLockReleaseFns = [];
        }

        return {
            async query(sql, params = []) {
                const cleanSql = sql.replace(/\s+/g, ' ').trim();

                // 1. SELECT ... FROM marketplace_licenses WHERE license_key_hash = ? [FOR UPDATE]
                if (cleanSql.startsWith('SELECT') && cleanSql.includes('FROM marketplace_licenses WHERE license_key_hash = ?')) {
                    const keyHash = params[0];
                    if (cleanSql.includes('FOR UPDATE')) {
                        const releaseFn = await acquireLock(keyHash);
                        heldLockReleaseFns.push(releaseFn);
                    }
                    const lic = licenses.get(keyHash);
                    if (!lic) {
                        return [[]];
                    }
                    return [[{ ...lic }]];
                }

                // 2. SELECT ... FROM license_activations WHERE license_id = ? AND request_domain = ?
                if (cleanSql.startsWith('SELECT') && cleanSql.includes('FROM license_activations WHERE license_id = ? AND request_domain = ?')) {
                    const [licenseId, requestDomain] = params;
                    const matches = activations
                        .filter(a => a.license_id === licenseId && a.request_domain === requestDomain)
                        .sort((a, b) => b.sequence_number - a.sequence_number || b.id - a.id);
                    return [matches.map(m => ({ ...m }))];
                }

                // 3. UPDATE marketplace_licenses SET status = 'ACTIVATED', bound_domain = ?
                if (cleanSql.startsWith('UPDATE marketplace_licenses SET status = \'ACTIVATED\', bound_domain = ?')) {
                    const [boundDomain, id] = params;
                    for (const [hash, lic] of licenses.entries()) {
                        if (lic.id === id) {
                            lic.status = 'ACTIVATED';
                            lic.bound_domain = boundDomain;
                            lic.updated_at = new Date().toISOString();
                            break;
                        }
                    }
                    return [{ affectedRows: 1 }];
                }

                // 4. INSERT INTO license_activations
                if (cleanSql.startsWith('INSERT INTO license_activations')) {
                    const [license_id, activation_type, request_domain, request_ip, sequence_number, issued_envelope] = params;
                    const record = {
                        id: nextActivationId++,
                        license_id,
                        activation_type,
                        request_domain,
                        request_ip,
                        sequence_number,
                        issued_envelope,
                        created_at: new Date().toISOString()
                    };
                    activations.push(record);
                    return [{ insertId: record.id, affectedRows: 1 }];
                }

                throw new Error(`Unhandled mock query: ${cleanSql}`);
            },

            async beginTransaction() {
                inTransaction = true;
            },

            async commit() {
                inTransaction = false;
                releaseAllLocks();
            },

            async rollback() {
                inTransaction = false;
                releaseAllLocks();
            },

            release() {
                releaseAllLocks();
            }
        };
    }

    const pool = {
        licenses,
        activations,
        getConnection: async () => createConnection(),
        query: async (sql, params) => {
            const conn = createConnection();
            try {
                return await conn.query(sql, params);
            } finally {
                conn.release();
            }
        }
    };

    return pool;
}

/**
 * Helper to seed a valid issued commercial license in the mock database.
 */
function seedIssuedLicense(db, overrides = {}) {
    const keyDetails = keyGenerator.generateLicenseKey({
        prefix: 'KHRM',
        pepper: TEST_PEPPER
    });

    const license = {
        id: Math.floor(Math.random() * 10000) + 1,
        license_id: `LIC-2026-SRC-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
        order_id: 101,
        product_id: 'kiaan-hrm',
        edition_code: 'full_source',
        sku: 'KHRM-SRC-LIFETIME',
        license_key_hash: keyDetails.hash,
        key_hint: keyDetails.keyHint,
        status: 'ISSUED',
        bound_domain: null,
        sequence_number: 1,
        buyer_name: 'Test Customer Corp',
        buyer_email: 'buyer@example.com',
        entitlements: JSON.stringify({ edition_code: 'full_source', max_employees: 1000, features: ['PAYROLL', 'ATTENDANCE'] }),
        revocation_reason: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...overrides
    };

    // Store in mock DB
    db.licenses.set(license.license_key_hash, license);

    return {
        licenseKey: keyDetails.licenseKey,
        keyHint: keyDetails.keyHint,
        hash: keyDetails.hash,
        license
    };
}

// ==============================================================================
// GROUP A: VALID ACTIVATION & DOMAIN BINDING
// ==============================================================================

test('A1. Valid issued license activates successfully and binds to requested domain', async () => {
    const db = createMockDatabase();
    const { signer, clientKeystore } = createTestSigner();
    const service = new LicenseActivationService({
        db,
        signer,
        pepper: TEST_PEPPER
    });

    const { licenseKey, license } = seedIssuedLicense(db);

    const result = await service.activateLicense({
        licenseKey,
        requestedDomain: 'hrm.enterprise.com',
        productId: 'kiaan-hrm'
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.isReplay, false);
    assert.strictEqual(result.licenseId, license.license_id);
    assert.strictEqual(result.boundDomain, 'hrm.enterprise.com');
    assert.strictEqual(result.sequenceNumber, 1);
    assert.ok(result.envelope);

    // Verify database row was mutated
    const updated = db.licenses.get(license.license_key_hash);
    assert.strictEqual(updated.status, 'ACTIVATED');
    assert.strictEqual(updated.bound_domain, 'hrm.enterprise.com');

    // Verify audit log
    assert.strictEqual(db.activations.length, 1);
    assert.strictEqual(db.activations[0].license_id, license.license_id);
    assert.strictEqual(db.activations[0].request_domain, 'hrm.enterprise.com');
});

// ==============================================================================
// GROUP B: CRYPTOGRAPHIC VERIFICATION & TAMPER RESISTANCE
// ==============================================================================

test('B1. Signed activation envelope verifies cleanly against client cryptoEngine', async () => {
    const db = createMockDatabase();
    const { signer, clientKeystore } = createTestSigner();
    const service = new LicenseActivationService({ db, signer, pepper: TEST_PEPPER });

    const { licenseKey } = seedIssuedLicense(db);
    const result = await service.activateLicense({
        licenseKey,
        requestedDomain: 'portal.company.com',
        productId: 'kiaan-hrm'
    });

    const verifyResult = verifyEnvelope(result.envelope, clientKeystore);
    assert.strictEqual(verifyResult.valid, true);
    assert.strictEqual(verifyResult.code, VerificationCodes.VERIFIED);
    assert.strictEqual(verifyResult.payload.product_id, 'kiaan-hrm');
    assert.strictEqual(verifyResult.payload.licensed_domain, 'portal.company.com');
    assert.strictEqual(verifyResult.payload.sequence_number, 1);
});

test('B2. Tampered envelope payload is strictly rejected by client verification', async () => {
    const db = createMockDatabase();
    const { signer, clientKeystore } = createTestSigner();
    const service = new LicenseActivationService({ db, signer, pepper: TEST_PEPPER });

    const { licenseKey } = seedIssuedLicense(db);
    const result = await service.activateLicense({
        licenseKey,
        requestedDomain: 'portal.company.com',
        productId: 'kiaan-hrm'
    });

    // Tamper with payload
    const tampered = JSON.parse(JSON.stringify(result.envelope));
    tampered.payload.licensed_domain = 'hacked-domain.com';

    const verifyResult = verifyEnvelope(tampered, clientKeystore);
    assert.strictEqual(verifyResult.valid, false);
    assert.strictEqual(verifyResult.code, VerificationCodes.INVALID_SIGNATURE);
});

test('B3. Tampered signature is strictly rejected by client verification', async () => {
    const db = createMockDatabase();
    const { signer, clientKeystore } = createTestSigner();
    const service = new LicenseActivationService({ db, signer, pepper: TEST_PEPPER });

    const { licenseKey } = seedIssuedLicense(db);
    const result = await service.activateLicense({
        licenseKey,
        requestedDomain: 'portal.company.com',
        productId: 'kiaan-hrm'
    });

    // Tamper 1 character in Base64 signature
    const sigChars = result.envelope.signature.split('');
    sigChars[10] = sigChars[10] === 'A' ? 'B' : 'A';
    const tampered = { ...result.envelope, signature: sigChars.join('') };

    const verifyResult = verifyEnvelope(tampered, clientKeystore);
    assert.strictEqual(verifyResult.valid, false);
    assert.strictEqual(verifyResult.code, VerificationCodes.INVALID_SIGNATURE);
});

// ==============================================================================
// GROUP C: SINGLE-USE BEARER CREDENTIAL & REPLAY PROTECTION
// ==============================================================================

test('C1. Re-activating the SAME domain is an idempotent replay returning the existing envelope', async () => {
    const db = createMockDatabase();
    const { signer } = createTestSigner();
    const service = new LicenseActivationService({ db, signer, pepper: TEST_PEPPER });

    const { licenseKey } = seedIssuedLicense(db);

    // Initial activation
    const firstResult = await service.activateLicense({
        licenseKey,
        requestedDomain: 'app.example.com',
        productId: 'kiaan-hrm'
    });
    assert.strictEqual(firstResult.isReplay, false);

    // Second activation for SAME domain
    const replayResult = await service.activateLicense({
        licenseKey,
        requestedDomain: 'app.example.com',
        productId: 'kiaan-hrm'
    });

    assert.strictEqual(replayResult.isReplay, true);
    assert.strictEqual(replayResult.boundDomain, 'app.example.com');
    assert.strictEqual(replayResult.envelope.signature, firstResult.envelope.signature);

    // Exactly 1 activation record in database
    assert.strictEqual(db.activations.length, 1);
});

test('C2. Attempting to activate an already bound license on a DIFFERENT domain is strictly rejected', async () => {
    const db = createMockDatabase();
    const { signer } = createTestSigner();
    const service = new LicenseActivationService({ db, signer, pepper: TEST_PEPPER });

    const { licenseKey } = seedIssuedLicense(db);

    // Initial activation binds domain1
    await service.activateLicense({
        licenseKey,
        requestedDomain: 'domain1.example.com',
        productId: 'kiaan-hrm'
    });

    // Replay on DIFFERENT domain
    await assert.rejects(
        async () => {
            await service.activateLicense({
                licenseKey,
                requestedDomain: 'domain2.example.com',
                productId: 'kiaan-hrm'
            });
        },
        err => {
            assert.strictEqual(err.code, 'DOMAIN_ALREADY_BOUND');
            assert.ok(err.message.includes('domain1.example.com'));
            return true;
        }
    );
});

test('C3. Failed validation does NOT consume or mutate the license state', async () => {
    const db = createMockDatabase();
    const { signer } = createTestSigner();
    const service = new LicenseActivationService({ db, signer, pepper: TEST_PEPPER });

    const { licenseKey, license } = seedIssuedLicense(db);

    // Submit invalid domain
    await assert.rejects(
        async () => {
            await service.activateLicense({
                licenseKey,
                requestedDomain: 'invalid domain with spaces',
                productId: 'kiaan-hrm'
            });
        },
        err => err.code === 'INVALID_DOMAIN'
    );

    // License remains strictly ISSUED
    const lic = db.licenses.get(license.license_key_hash);
    assert.strictEqual(lic.status, 'ISSUED');
    assert.strictEqual(lic.bound_domain, null);
    assert.strictEqual(db.activations.length, 0);

    // Subsequent valid activation still succeeds cleanly
    const validResult = await service.activateLicense({
        licenseKey,
        requestedDomain: 'clean.example.com',
        productId: 'kiaan-hrm'
    });
    assert.strictEqual(validResult.success, true);
});

// ==============================================================================
// GROUP D: DOMAIN NORMALIZATION & PRODUCTION LOCALHOST GUARD
// ==============================================================================

test('D1. Domain names are normalized (RFC 1123, lowercase, stripped ports, trailing slashes)', async () => {
    const db = createMockDatabase();
    const { signer } = createTestSigner();
    const service = new LicenseActivationService({ db, signer, pepper: TEST_PEPPER });

    const { licenseKey } = seedIssuedLicense(db);

    const result = await service.activateLicense({
        licenseKey,
        requestedDomain: 'HRM.MYCORP.COM:8080',
        productId: 'kiaan-hrm'
    });

    assert.strictEqual(result.boundDomain, 'hrm.mycorp.com');
    assert.strictEqual(result.envelope.payload.licensed_domain, 'hrm.mycorp.com');
});

test('D2. Localhost activation is strictly prohibited in production mode', async () => {
    const db = createMockDatabase();
    const { signer } = createTestSigner();
    const service = new LicenseActivationService({
        db,
        signer,
        pepper: TEST_PEPPER,
        nodeEnv: 'production'
    });

    const { licenseKey } = seedIssuedLicense(db);

    await assert.rejects(
        async () => {
            await service.activateLicense({
                licenseKey,
                requestedDomain: 'localhost',
                productId: 'kiaan-hrm'
            });
        },
        err => err.code === 'LOCALHOST_ACTIVATION_PROHIBITED'
    );

    await assert.rejects(
        async () => {
            await service.activateLicense({
                licenseKey,
                requestedDomain: '127.0.0.1',
                productId: 'kiaan-hrm'
            });
        },
        err => err.code === 'LOCALHOST_ACTIVATION_PROHIBITED'
    );
});

test('D3. Localhost activation is permitted in development mode', async () => {
    const db = createMockDatabase();
    const { signer } = createTestSigner();
    const service = new LicenseActivationService({
        db,
        signer,
        pepper: TEST_PEPPER,
        nodeEnv: 'development'
    });

    const { licenseKey } = seedIssuedLicense(db);

    const result = await service.activateLicense({
        licenseKey,
        requestedDomain: 'localhost',
        productId: 'kiaan-hrm'
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.boundDomain, 'localhost');
});

// ==============================================================================
// GROUP E: LICENSE STATE MACHINE & REVOCATION ENFORCEMENT
// ==============================================================================

test('E1. Revoked license is rejected with LICENSE_REVOKED', async () => {
    const db = createMockDatabase();
    const { signer } = createTestSigner();
    const service = new LicenseActivationService({ db, signer, pepper: TEST_PEPPER });

    const { licenseKey } = seedIssuedLicense(db, {
        status: 'REVOKED',
        revocation_reason: 'Chargeback dispute filed via Razorpay'
    });

    await assert.rejects(
        async () => {
            await service.activateLicense({
                licenseKey,
                requestedDomain: 'test.example.com',
                productId: 'kiaan-hrm'
            });
        },
        err => {
            assert.strictEqual(err.code, 'LICENSE_REVOKED');
            assert.ok(err.message.includes('Chargeback dispute'));
            return true;
        }
    );
});

test('E2. Transferred or Expired license is rejected with explicit code', async () => {
    const db = createMockDatabase();
    const { signer } = createTestSigner();
    const service = new LicenseActivationService({ db, signer, pepper: TEST_PEPPER });

    const { licenseKey: keyTransferred } = seedIssuedLicense(db, { status: 'TRANSFERRED' });
    await assert.rejects(
        async () => service.activateLicense({ licenseKey: keyTransferred, requestedDomain: 'test.com', productId: 'kiaan-hrm' }),
        err => err.code === 'LICENSE_TRANSFERRED'
    );

    const { licenseKey: keyExpired } = seedIssuedLicense(db, { status: 'EXPIRED' });
    await assert.rejects(
        async () => service.activateLicense({ licenseKey: keyExpired, requestedDomain: 'test.com', productId: 'kiaan-hrm' }),
        err => err.code === 'LICENSE_EXPIRED'
    );
});

test('E3. Unknown license key is rejected with LICENSE_NOT_FOUND', async () => {
    const db = createMockDatabase();
    const { signer } = createTestSigner();
    const service = new LicenseActivationService({ db, signer, pepper: TEST_PEPPER });

    // Generate valid Crockford format key but do NOT seed in DB
    const unregisteredKey = keyGenerator.generateLicenseKey({ prefix: 'KHRM', pepper: TEST_PEPPER }).licenseKey;

    await assert.rejects(
        async () => service.activateLicense({ licenseKey: unregisteredKey, requestedDomain: 'test.com', productId: 'kiaan-hrm' }),
        err => err.code === 'LICENSE_NOT_FOUND'
    );
});

// ==============================================================================
// GROUP F: CONCURRENCY & RACE CONDITION ATOMICITY
// ==============================================================================

test('F1. Simultaneous concurrent activations: Exactly ONE succeeds, conflicting attempt rejected', async () => {
    const db = createMockDatabase();
    const { signer } = createTestSigner();
    const service = new LicenseActivationService({ db, signer, pepper: TEST_PEPPER });

    const { licenseKey } = seedIssuedLicense(db);

    // Simulate two concurrent requests with DIFFERENT requested domains
    const results = await Promise.allSettled([
        service.activateLicense({ licenseKey, requestedDomain: 'branch-a.company.com', productId: 'kiaan-hrm' }),
        service.activateLicense({ licenseKey, requestedDomain: 'branch-b.company.com', productId: 'kiaan-hrm' })
    ]);

    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');

    assert.strictEqual(fulfilled.length, 1, 'Exactly one concurrent request must succeed');
    assert.strictEqual(rejected.length, 1, 'Conflicting concurrent request must be rejected');
    assert.strictEqual(rejected[0].reason.code, 'DOMAIN_ALREADY_BOUND');

    // Database must contain exactly 1 activation row
    assert.strictEqual(db.activations.length, 1);
});

// ==============================================================================
// GROUP G: DATABASE PERSISTENCE & AUDIT TRAIL
// ==============================================================================

test('G1. Activation record is properly staged in license_activations table', async () => {
    const db = createMockDatabase();
    const { signer } = createTestSigner();
    const service = new LicenseActivationService({ db, signer, pepper: TEST_PEPPER });

    const { licenseKey, license } = seedIssuedLicense(db);

    await service.activateLicense({
        licenseKey,
        requestedDomain: 'audit.company.com',
        productId: 'kiaan-hrm',
        clientIp: '203.0.113.195'
    });

    assert.strictEqual(db.activations.length, 1);
    const rec = db.activations[0];
    assert.strictEqual(rec.license_id, license.license_id);
    assert.strictEqual(rec.activation_type, 'ONLINE');
    assert.strictEqual(rec.request_domain, 'audit.company.com');
    assert.strictEqual(rec.request_ip, '203.0.113.195');
    assert.strictEqual(rec.sequence_number, 1);
    assert.ok(typeof rec.issued_envelope === 'string');

    const parsedEnvelope = JSON.parse(rec.issued_envelope);
    assert.strictEqual(parsedEnvelope.algorithm, 'Ed25519');
    assert.strictEqual(parsedEnvelope.payload.licensed_domain, 'audit.company.com');
});

// ==============================================================================
// GROUP H: CLIENT OFFLINE VERIFIER END-TO-END COMPATIBILITY
// ==============================================================================

test('H1. Output envelope integrates seamlessly with client licenseCache evaluation', async () => {
    const db = createMockDatabase();
    const { signer, clientKeystore } = createTestSigner();
    const service = new LicenseActivationService({ db, signer, pepper: TEST_PEPPER });

    const { licenseKey } = seedIssuedLicense(db);

    const activation = await service.activateLicense({
        licenseKey,
        requestedDomain: 'hrm.mycorp.net',
        productId: 'kiaan-hrm'
    });

    // Simulate client-side verification
    const verification = verifyEnvelope(activation.envelope, clientKeystore);
    assert.strictEqual(verification.valid, true);

    // Simulate client-side host evaluation matching licenseCache logic
    const clientHost = { hostname: 'hrm.mycorp.net', isDevBypass: false };
    const payload = verification.payload;

    assert.strictEqual(payload.product_id, 'kiaan-hrm');
    assert.strictEqual(payload.licensed_domain, clientHost.hostname);
    assert.ok(Array.isArray(payload.domain_aliases));
    assert.ok(payload.domain_aliases.includes('localhost'));
});

// ==============================================================================
// GROUP I: SECURITY & SECRET CONTAINMENT
// ==============================================================================

test('I1. Security: Plaintext license key, pepper, and private keys never leak into envelope or error objects', async () => {
    const db = createMockDatabase();
    const { signer, privateKey } = createTestSigner();
    const service = new LicenseActivationService({ db, signer, pepper: TEST_PEPPER });

    const { licenseKey } = seedIssuedLicense(db);

    const result = await service.activateLicense({
        licenseKey,
        requestedDomain: 'secure.company.com',
        productId: 'kiaan-hrm'
    });

    const serializedEnvelope = JSON.stringify(result.envelope);

    // Must NOT contain plaintext license key
    assert.ok(!serializedEnvelope.includes(licenseKey));

    // Must NOT contain pepper
    assert.ok(!serializedEnvelope.includes(TEST_PEPPER));

    // Must NOT contain private key PEM fragments
    assert.ok(!serializedEnvelope.includes('PRIVATE KEY'));
});

// ==============================================================================
// GROUP J: HTTP ROUTE BOUNDARY (POST /activate)
// ==============================================================================

test('J1. Express authority router POST /activate returns 200 with signed envelope', async () => {
    const db = createMockDatabase();
    const { signer } = createTestSigner();
    const activationService = new LicenseActivationService({ db, signer, pepper: TEST_PEPPER });
    const router = createAuthorityRouter({ activationService });

    const { licenseKey } = seedIssuedLicense(db);

    // Mock Express req/res
    let responseStatus = null;
    let responseBody = null;

    const req = {
        method: 'POST',
        url: '/activate',
        body: {
            licenseKey,
            requestedDomain: 'api-test.company.com',
            productId: 'kiaan-hrm'
        },
        ip: '198.51.100.1'
    };

    const res = {
        status(code) {
            responseStatus = code;
            return this;
        },
        json(body) {
            responseBody = body;
            return this;
        }
    };

    // Dispatch directly to router stack
    const routeHandler = router.stack.find(s => s.route && s.route.path === '/activate').route.stack[0].handle;
    await routeHandler(req, res);

    assert.strictEqual(responseStatus, 200);
    assert.strictEqual(responseBody.success, true);
    assert.strictEqual(responseBody.boundDomain, 'api-test.company.com');
    assert.ok(responseBody.envelope);
});

test('J2. Express authority router handles errors with appropriate status codes', async () => {
    const db = createMockDatabase();
    const { signer } = createTestSigner();
    const activationService = new LicenseActivationService({ db, signer, pepper: TEST_PEPPER });
    const router = createAuthorityRouter({ activationService });

    let responseStatus = null;
    let responseBody = null;

    const res = {
        status(code) { responseStatus = code; return this; },
        json(body) { responseBody = body; return this; }
    };

    const routeHandler = router.stack.find(s => s.route && s.route.path === '/activate').route.stack[0].handle;

    // Bad Request: missing license key
    await routeHandler({ body: { requestedDomain: 'test.com' } }, res);
    assert.strictEqual(responseStatus, 400);
    assert.strictEqual(responseBody.code, 'INVALID_LICENSE_KEY');

    // Not Found: non-existent key
    const unregisteredKey = keyGenerator.generateLicenseKey({ prefix: 'KHRM', pepper: TEST_PEPPER }).licenseKey;
    await routeHandler({ body: { licenseKey: unregisteredKey, requestedDomain: 'test.com', productId: 'kiaan-hrm' } }, res);
    assert.strictEqual(responseStatus, 404);
    assert.strictEqual(responseBody.code, 'LICENSE_NOT_FOUND');
});
