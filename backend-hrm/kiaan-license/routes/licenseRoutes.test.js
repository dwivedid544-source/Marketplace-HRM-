/**
 * Kiaan License Engine — License Controller & Routes Test Suite
 * Module: backend-hrm/kiaan-license/routes/licenseRoutes.test.js
 *
 * Verifies all security requirements from Phase 2B.5F:
 * 1. All five endpoints (/status, /activate, /sync, /recover, /diagnostics)
 * 2. Authentication & role enforcement (Superadmin only for privileged endpoints)
 * 3. Invalid/tampered signature rejection (400)
 * 4. Product and domain mismatch rejection (403)
 * 5. Sequence rollback rejection (409)
 * 6. Idempotent activation (200, isIdempotent: true)
 * 7. Synchronous cache invalidation post-mutation
 * 8. Storage engine failure handling (503)
 * 9. Vault conflict handling (423) & unsafe SELECT_VAULT rejection (400)
 * 10. Strict sensitive data redaction on public status & diagnostics
 * 11. Request shape and payload size limits (>64KB rejected with 400)
 * 12. Diagnostics non-mutating behavior (autoHeal: false)
 */

'use strict';

const assert = require('assert');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const { createLicenseRouter } = require('./licenseRoutes');
const { createLicenseCache } = require('../core/licenseCache');
const { createLicenseConfig } = require('../config/licenseConfig');
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
    },
    'test-key-revoked': {
        keyId: 'test-key-revoked',
        algorithm: 'Ed25519',
        publicKey: testPubPem,
        status: 'REVOKED'
    }
};

const TEST_JWT_SECRET = 'test-secret-key-routes-1234567890';

function createSignedEnvelope(payloadOverrides = {}, seq = 1, keyId = 'test-key-1') {
    const fullPayload = {
        entitlement_id: 'ent_routes_test',
        product_id: 'kiaan-hrm',
        licensed_domain: 'hrm.enterprise.com',
        sequence_number: seq,
        domain_aliases: ['hrm-alt.enterprise.com'],
        features: ['payroll', 'attendance'],
        tier: 'enterprise',
        max_employees: 500,
        customer: 'Acme Corp',
        issued_at: '2026-01-01T00:00:00.000Z',
        ...payloadOverrides
    };

    const canonicalBytes = canonicalizeToBuffer(fullPayload);
    const signature = crypto.sign(null, canonicalBytes, testPrivKey).toString('base64');

    return {
        algorithm: 'Ed25519',
        key_id: keyId,
        payload: fullPayload,
        signature: signature
    };
}

function makeRequest(router, { method = 'GET', url = '/status', headers = {}, body = null }) {
    return new Promise((resolve, reject) => {
        const req = {
            method: method.toUpperCase(),
            url: url,
            path: url.split('?')[0],
            headers: { host: 'hrm.enterprise.com', ...headers },
            socket: { remoteAddress: '127.0.0.1' },
            body: body
        };

        let statusCode = 200;
        let responseHeaders = {};

        const res = {
            status(code) {
                statusCode = code;
                return this;
            },
            setHeader(name, val) {
                responseHeaders[name.toLowerCase()] = val;
                return this;
            },
            json(data) {
                resolve({
                    status: statusCode,
                    headers: responseHeaders,
                    body: data
                });
            },
            send(data) {
                resolve({
                    status: statusCode,
                    headers: responseHeaders,
                    body: data
                });
            },
            end() {
                resolve({
                    status: statusCode,
                    headers: responseHeaders,
                    body: null
                });
            }
        };

        const next = (err) => {
            if (err) return reject(err);
            resolve({
                status: 404,
                headers: responseHeaders,
                body: { message: 'Not Found' }
            });
        };

        router(req, res, next);
    });
}

function createSuperAdminToken() {
    return jwt.sign({ id: 1, role: 'superadmin', name: 'Master Admin' }, TEST_JWT_SECRET, { expiresIn: '1h' });
}

function createEmployeeToken() {
    return jwt.sign({ id: 10, role: 'employee', name: 'Staff John' }, TEST_JWT_SECRET, { expiresIn: '1h' });
}

function createTenantAdminToken() {
    return jwt.sign({ id: 5, role: 'admin', company_id: 1 }, TEST_JWT_SECRET, { expiresIn: '1h' });
}

(async function executeTestSuite() {
    console.log('\n======================================================');
    console.log('  KIAAN LICENSE CONTROLLER & ROUTES TEST SUITE');
    console.log('======================================================\n');

    // Helper to spin up a mock router environment
    function createMockRouterEnv(initialState = {}) {
        let primaryVault = initialState.primary !== undefined ? initialState.primary : null;
        let mirrorVault = initialState.mirror !== undefined ? initialState.mirror : null;
        let storageHealthy = initialState.storageHealthy !== false;

        const primaryAdapter = {
            name: 'mysql',
            read: async () => {
                if (!storageHealthy) {
                    const err = new Error('Database connection failed');
                    err.code = 'DB_UNAVAILABLE';
                    throw err;
                }
                return primaryVault;
            },
            write: async (env) => {
                if (!storageHealthy) throw new Error('Database write failure');
                primaryVault = env;
                return true;
            }
        };

        const mirrorAdapter = {
            name: 'filesystem',
            read: async () => {
                if (!storageHealthy) {
                    const err = new Error('Permission denied accessing vault storage');
                    err.code = 'VAULT_PERMISSION_DENIED';
                    throw err;
                }
                return mirrorVault;
            },
            write: async (env) => {
                if (!storageHealthy) throw new Error('Filesystem write failure');
                mirrorVault = env;
                return true;
            },
            getSanitizedPath: () => '[VAULT_DIR]/license.lic'
        };

        const config = createLicenseConfig({
            productId: 'kiaan-hrm',
            keystore: testKeystore
        });

        const licenseCache = createLicenseCache({
            primaryAdapter,
            mirrorAdapter,
            keystore: testKeystore,
            config
        });

        const router = createLicenseRouter({
            licenseCache,
            primaryAdapter,
            mirrorAdapter,
            config,
            keystore: testKeystore,
            jwtSecret: TEST_JWT_SECRET
        });

        return {
            router,
            licenseCache,
            getPrimary: () => primaryVault,
            getMirror: () => mirrorVault,
            setStorageHealthy: (h) => { storageHealthy = h; },
            setVaults: (p, m) => { primaryVault = p; mirrorVault = m; }
        };
    }

    // =========================================================================
    // GROUP 1: PUBLIC STATUS ENDPOINT (GET /status)
    // =========================================================================
    console.log('Group 1: Minimal Public Status Endpoint (GET /status)');

    await runTest('Public status returns 200 with minimal info when licensed', async () => {
        const env = createSignedEnvelope({}, 1);
        const { router } = createMockRouterEnv({ primary: env, mirror: env });

        const res = await makeRequest(router, { method: 'GET', url: '/status' });

        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.success, true);
        assert.strictEqual(res.body.licensed, true);
        assert.strictEqual(res.body.status, 'STATUS_HEALTHY');
        assert.strictEqual(res.body.productId, 'kiaan-hrm');
        assert.strictEqual(res.body.message, 'Installation is licensed and active.');
    });

    await runTest('Public status strictly REDACTS sensitive data (customer, domain, keys, paths)', async () => {
        const env = createSignedEnvelope({ customer: 'Top Secret Corp', licensed_domain: 'classified.domain.com' }, 1);
        const { router } = createMockRouterEnv({ primary: env, mirror: env });

        const res = await makeRequest(router, { method: 'GET', url: '/status' });

        const raw = JSON.stringify(res.body);
        assert.ok(!raw.includes('Top Secret Corp'), 'Customer name leaked!');
        assert.ok(!raw.includes('classified.domain.com'), 'Domain leaked!');
        assert.ok(!raw.includes('signature'), 'Signature leaked!');
        assert.ok(!raw.includes('features'), 'Features list leaked!');
        assert.ok(!raw.includes('max_employees'), 'Employee limits leaked!');
        assert.ok(!raw.includes('license.lic'), 'File path leaked!');
    });

    await runTest('Public status returns 200 with licensed: false when unlicensed', async () => {
        const { router } = createMockRouterEnv({ primary: null, mirror: null });

        const res = await makeRequest(router, { method: 'GET', url: '/status' });

        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.success, false);
        assert.strictEqual(res.body.licensed, false);
        assert.strictEqual(res.body.status, 'STATUS_UNLICENSED');
        assert.strictEqual(res.body.productId, 'kiaan-hrm');
    });

    await runTest('Public status returns HTTP 503 when storage engine is unavailable', async () => {
        const { router, setStorageHealthy } = createMockRouterEnv();
        setStorageHealthy(false);

        const res = await makeRequest(router, { method: 'GET', url: '/status' });

        assert.strictEqual(res.status, 503);
        assert.strictEqual(res.body.success, false);
        assert.strictEqual(res.body.status, 'STATUS_STORAGE_UNAVAILABLE');
    });

    // =========================================================================
    // GROUP 2: AUTHENTICATION & ROLE ENFORCEMENT
    // =========================================================================
    console.log('\nGroup 2: Authentication & Role Enforcement');

    const superAdminToken = createSuperAdminToken();
    const employeeToken = createEmployeeToken();
    const tenantAdminToken = createTenantAdminToken();

    await runTest('Unauthenticated request to /activate, /sync, /recover, /diagnostics returns 401', async () => {
        const { router } = createMockRouterEnv();

        for (const endpoint of ['/activate', '/sync', '/recover']) {
            const res = await makeRequest(router, { method: 'POST', url: endpoint });
            assert.strictEqual(res.status, 401, `Expected 401 on ${endpoint}`);
            assert.strictEqual(res.body.code, 'UNAUTHORIZED');
        }

        const diagRes = await makeRequest(router, { method: 'GET', url: '/diagnostics' });
        assert.strictEqual(diagRes.status, 401);
    });

    await runTest('Expired token returns HTTP 401 TOKEN_EXPIRED', async () => {
        const { router } = createMockRouterEnv();
        const expired = jwt.sign({ id: 1, role: 'superadmin' }, TEST_JWT_SECRET, { expiresIn: -10 });

        const res = await makeRequest(router, {
            method: 'POST',
            url: '/sync',
            headers: { authorization: `Bearer ${expired}` }
        });

        assert.strictEqual(res.status, 401);
        assert.strictEqual(res.body.code, 'TOKEN_EXPIRED');
    });

    await runTest('Employee and Tenant Admin roles receive HTTP 403 SUPERADMIN_REQUIRED', async () => {
        const { router } = createMockRouterEnv();

        // Employee
        const empRes = await makeRequest(router, {
            method: 'POST',
            url: '/sync',
            headers: { authorization: `Bearer ${employeeToken}` }
        });
        assert.strictEqual(empRes.status, 403);
        assert.strictEqual(empRes.body.code, 'SUPERADMIN_REQUIRED');

        // Tenant Admin
        const adminRes = await makeRequest(router, {
            method: 'POST',
            url: '/sync',
            headers: { authorization: `Bearer ${tenantAdminToken}` }
        });
        assert.strictEqual(adminRes.status, 403);
        assert.strictEqual(adminRes.body.code, 'SUPERADMIN_REQUIRED');
    });

    await runTest('Body/query role spoofing without valid Superadmin JWT is completely ignored', async () => {
        const { router } = createMockRouterEnv();

        const res = await makeRequest(router, {
            method: 'POST',
            url: '/sync',
            headers: { authorization: `Bearer ${employeeToken}` },
            body: { role: 'superadmin' } // Attempt to spoof in body
        });

        assert.strictEqual(res.status, 403);
        assert.strictEqual(res.body.code, 'SUPERADMIN_REQUIRED');
    });

    // =========================================================================
    // GROUP 3: ACTIVATION (POST /activate)
    // =========================================================================
    console.log('\nGroup 3: License Activation (POST /activate)');

    await runTest('Successful activation stores envelope in dual vaults and updates cache', async () => {
        const { router, getPrimary, getMirror, licenseCache } = createMockRouterEnv({ primary: null, mirror: null });
        const envelope = createSignedEnvelope({}, 1);

        const res = await makeRequest(router, {
            method: 'POST',
            url: '/activate',
            headers: { authorization: `Bearer ${superAdminToken}` },
            body: { envelope }
        });

        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.success, true);
        assert.strictEqual(res.body.status, 'STATUS_HEALTHY');
        assert.strictEqual(res.body.sequenceNumber, 1);

        // Verify both vaults persisted
        assert.deepStrictEqual(getPrimary(), envelope);
        assert.deepStrictEqual(getMirror(), envelope);

        // Verify cache evaluates to healthy immediately
        const state = await licenseCache.getState({ normalizedHost: 'hrm.enterprise.com', isDevBypass: false });
        assert.strictEqual(state.valid, true);
    });

    await runTest('Activation accepts Base64 armored licenseKey string', async () => {
        const { router } = createMockRouterEnv({ primary: null, mirror: null });
        const envelope = createSignedEnvelope({}, 1);
        const base64Key = Buffer.from(JSON.stringify(envelope)).toString('base64');

        const res = await makeRequest(router, {
            method: 'POST',
            url: '/activate',
            headers: { authorization: `Bearer ${superAdminToken}` },
            body: { licenseKey: base64Key }
        });

        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.sequenceNumber, 1);
    });

    await runTest('Activation rejects oversized payloads (>64KB) with HTTP 400', async () => {
        const { router } = createMockRouterEnv();
        const hugeString = 'A'.repeat(70000);

        const res = await makeRequest(router, {
            method: 'POST',
            url: '/activate',
            headers: { authorization: `Bearer ${superAdminToken}` },
            body: { envelope: { padding: hugeString } }
        });

        assert.strictEqual(res.status, 400);
        assert.strictEqual(res.body.code, 'PAYLOAD_TOO_LARGE');
    });

    await runTest('Activation rejects tampered signature with HTTP 400 LICENSE_TAMPERED', async () => {
        const { router } = createMockRouterEnv();
        const envelope = createSignedEnvelope({}, 1);
        envelope.payload.max_employees = 999999; // Tampered without updating signature!

        const res = await makeRequest(router, {
            method: 'POST',
            url: '/activate',
            headers: { authorization: `Bearer ${superAdminToken}` },
            body: { envelope }
        });

        assert.strictEqual(res.status, 400);
        assert.strictEqual(res.body.code, 'LICENSE_TAMPERED');
    });

    await runTest('Activation rejects revoked signing key with HTTP 400 REVOKED_KEY', async () => {
        const { router } = createMockRouterEnv();
        const envelope = createSignedEnvelope({}, 1, 'test-key-revoked');

        const res = await makeRequest(router, {
            method: 'POST',
            url: '/activate',
            headers: { authorization: `Bearer ${superAdminToken}` },
            body: { envelope }
        });

        assert.strictEqual(res.status, 400);
        assert.strictEqual(res.body.code, 'REVOKED_KEY');
    });

    await runTest('Activation rejects product mismatch with HTTP 403', async () => {
        const { router } = createMockRouterEnv();
        const envelope = createSignedEnvelope({ product_id: 'restaurant-pos' }, 1);

        const res = await makeRequest(router, {
            method: 'POST',
            url: '/activate',
            headers: { authorization: `Bearer ${superAdminToken}` },
            body: { envelope }
        });

        assert.strictEqual(res.status, 403);
        assert.strictEqual(res.body.code, 'LICENSE_PRODUCT_MISMATCH');
    });

    await runTest('Activation rejects domain mismatch with HTTP 403', async () => {
        const { router } = createMockRouterEnv();
        const envelope = createSignedEnvelope({ licensed_domain: 'other.domain.com', domain_aliases: [] }, 1);

        const res = await makeRequest(router, {
            method: 'POST',
            url: '/activate',
            headers: {
                authorization: `Bearer ${superAdminToken}`,
                host: 'hrm.enterprise.com'
            },
            body: { envelope }
        });

        assert.strictEqual(res.status, 403);
        assert.strictEqual(res.body.code, 'LICENSE_DOMAIN_MISMATCH');
    });

    await runTest('Activation rejects sequence rollback with HTTP 409', async () => {
        const activeEnv = createSignedEnvelope({}, 5);
        const { router } = createMockRouterEnv({ primary: activeEnv, mirror: activeEnv });

        const olderEnv = createSignedEnvelope({}, 2); // Older sequence!

        const res = await makeRequest(router, {
            method: 'POST',
            url: '/activate',
            headers: { authorization: `Bearer ${superAdminToken}` },
            body: { envelope: olderEnv }
        });

        assert.strictEqual(res.status, 409);
        assert.strictEqual(res.body.code, 'SEQUENCE_ROLLBACK_REJECTED');
    });

    await runTest('Idempotent re-activation of identical envelope returns 200 with isIdempotent: true', async () => {
        const activeEnv = createSignedEnvelope({}, 2);
        const { router } = createMockRouterEnv({ primary: activeEnv, mirror: activeEnv });

        const res = await makeRequest(router, {
            method: 'POST',
            url: '/activate',
            headers: { authorization: `Bearer ${superAdminToken}` },
            body: { envelope: activeEnv }
        });

        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.isIdempotent, true);
    });

    // =========================================================================
    // GROUP 4: SYNCHRONIZATION (POST /sync)
    // =========================================================================
    console.log('\nGroup 4: Vault Synchronization (POST /sync)');

    await runTest('Sync auto-heals missing primary vault from valid mirror vault', async () => {
        const mirrorEnv = createSignedEnvelope({}, 2);
        const { router, getPrimary } = createMockRouterEnv({ primary: null, mirror: mirrorEnv });

        const res = await makeRequest(router, {
            method: 'POST',
            url: '/sync',
            headers: { authorization: `Bearer ${superAdminToken}` }
        });

        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.status, 'STATUS_SELF_HEALED');
        assert.strictEqual(res.body.healTarget, 'primary');

        // Verify primary was auto-healed
        assert.deepStrictEqual(getPrimary(), mirrorEnv);
    });

    await runTest('Sync on equal-sequence conflict returns HTTP 423 LICENSE_CONFLICT', async () => {
        const env1 = createSignedEnvelope({ customer: 'Branch A' }, 3);
        const env2 = createSignedEnvelope({ customer: 'Branch B' }, 3);
        const { router } = createMockRouterEnv({ primary: env1, mirror: env2 });

        const res = await makeRequest(router, {
            method: 'POST',
            url: '/sync',
            headers: { authorization: `Bearer ${superAdminToken}` }
        });

        assert.strictEqual(res.status, 423);
        assert.strictEqual(res.body.code, 'LICENSE_CONFLICT');
    });

    // =========================================================================
    // GROUP 5: CONFLICT RECOVERY (POST /recover)
    // =========================================================================
    console.log('\nGroup 5: Conflict Recovery (POST /recover)');

    await runTest('Recovery strictly REJECTS unverified SELECT_VAULT strategy with HTTP 400', async () => {
        const { router } = createMockRouterEnv();

        const res = await makeRequest(router, {
            method: 'POST',
            url: '/recover',
            headers: { authorization: `Bearer ${superAdminToken}` },
            body: { resolutionStrategy: 'SELECT_VAULT', selectedVault: 'primary' }
        });

        assert.strictEqual(res.status, 400);
        assert.strictEqual(res.body.code, 'UNSAFE_RECOVERY_STRATEGY');
    });

    await runTest('Recovery resolves equal-sequence conflict using signed override envelope', async () => {
        const env1 = createSignedEnvelope({ customer: 'Old A' }, 3);
        const env2 = createSignedEnvelope({ customer: 'Old B' }, 3);
        const { router, getPrimary, getMirror } = createMockRouterEnv({ primary: env1, mirror: env2 });

        const overrideEnvelope = createSignedEnvelope({ customer: 'Authoritative Corporate' }, 4);

        const res = await makeRequest(router, {
            method: 'POST',
            url: '/recover',
            headers: { authorization: `Bearer ${superAdminToken}` },
            body: { envelope: overrideEnvelope }
        });

        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.status, 'STATUS_HEALTHY');
        assert.strictEqual(res.body.sequenceNumber, 4);

        // Verify both vaults updated to authoritative override
        assert.deepStrictEqual(getPrimary(), overrideEnvelope);
        assert.deepStrictEqual(getMirror(), overrideEnvelope);
    });

    // =========================================================================
    // GROUP 6: READ-ONLY DIAGNOSTICS (GET /diagnostics)
    // =========================================================================
    console.log('\nGroup 6: Read-Only Diagnostics (GET /diagnostics)');

    await runTest('Diagnostics returns structured report for Superadmin without mutating vaults', async () => {
        const env = createSignedEnvelope({ customer: 'Acme Corp' }, 2);
        // Set mirror as missing to verify diagnostics does NOT auto-heal (autoHeal: false)
        const { router, getMirror } = createMockRouterEnv({ primary: env, mirror: null });

        const res = await makeRequest(router, {
            method: 'GET',
            url: '/diagnostics',
            headers: { authorization: `Bearer ${superAdminToken}` }
        });

        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.success, true);
        const diag = res.body.diagnostics;

        assert.strictEqual(diag.status, 'STATUS_SELF_HEALED');
        assert.strictEqual(diag.vault.primary.status, 'VALID');
        assert.strictEqual(diag.vault.mirror.status, 'MISSING');
        assert.strictEqual(diag.vault.mirror.sanitizedPath, '[VAULT_DIR]/license.lic');
        assert.strictEqual(diag.entitlement.sequenceNumber, 2);

        // Assert strictly non-mutating: mirror must STILL be null!
        assert.strictEqual(getMirror(), null, 'Diagnostics mutated the vault! autoHeal: false violated!');

        // Assert zero secrets leaked
        const rawDiag = JSON.stringify(diag);
        assert.ok(!rawDiag.includes('BEGIN PRIVATE KEY'));
        assert.ok(!rawDiag.includes('password'));
        assert.ok(!rawDiag.includes('stack'));
    });

    console.log('\n======================================================');
    console.log(`  ALL ${passedTests} / ${totalTests} TESTS PASSED SUCCESSFULLY!`);
    console.log('======================================================\n');
})();
