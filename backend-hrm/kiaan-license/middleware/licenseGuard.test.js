/**
 * Kiaan License Engine — License Guard & Cache Dedicated Test Suite
 * Module: backend-hrm/kiaan-license/middleware/licenseGuard.test.js
 *
 * Verifies all 14 mandatory test cases from Phase 2B.5D:
 * 1. Healthy license pass-through
 * 2. Unlicensed protected-route denial
 * 3. Corrupted license denial
 * 4. Conflict response (HTTP 423)
 * 5. Storage-unavailable response (HTTP 503)
 * 6. Public route classification
 * 7. Exact recovery route matching
 * 8. Missing, malformed, expired, and invalid JWT
 * 9. Valid Superadmin recovery access
 * 10. Tenant Admin and Employee denial
 * 11. Cache expiry and invalidation
 * 12. Concurrent cold requests (in-flight request coalescing)
 * 13. No sensitive information in responses
 * 14. Non-recovery routes denied even with Superadmin JWT when unlicensed
 */

'use strict';

const assert = require('assert');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const { createLicenseCache, CacheStatus } = require('../core/licenseCache');
const { createLicenseGuard, isPublicRoute, isRecoveryRoute, matchesRoute, PUBLIC_ROUTES } = require('./licenseGuard');
const { canonicalizeToBuffer } = require('../core/canonicalizer');
const { createLicenseConfig } = require('../config/licenseConfig');

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

const TEST_JWT_SECRET = 'super-secret-jwt-key-for-testing-only-12345';

function createSignedEnvelope(payloadOverrides = {}, seq = 1) {
    const fullPayload = {
        entitlement_id: 'ent_test_guard',
        product_id: 'kiaan-hrm',
        licensed_domain: 'hrm.enterprise.com',
        sequence_number: seq,
        domain_aliases: ['hrm-alt.enterprise.com'],
        features: ['payroll', 'attendance'],
        ...payloadOverrides
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

function createMockContext({ method = 'GET', path = '/', headers = {}, socket = {} } = {}) {
    const req = {
        method,
        path,
        headers: { host: 'hrm.enterprise.com', ...headers },
        socket: { remoteAddress: '127.0.0.1', ...socket }
    };

    let statusCode = 200;
    let jsonBody = null;
    let nextCalled = false;

    const res = {
        status(code) {
            statusCode = code;
            return this;
        },
        json(body) {
            jsonBody = body;
            return this;
        },
        get statusCode() { return statusCode; },
        get jsonBody() { return jsonBody; }
    };

    const next = (err) => {
        nextCalled = true;
        if (err) throw err;
    };

    return { req, res, next, isNextCalled: () => nextCalled };
}

(async function executeTestSuite() {
    console.log('\n======================================================');
    console.log('  KIAAN LICENSE CACHE & GUARD DEDICATED TEST SUITE');
    console.log('======================================================\n');

    // =========================================================================
    // GROUP 1: LICENSE CACHE MECHANICS
    // =========================================================================
    console.log('Group 1: License Cache Mechanics');

    await runTest('In-flight request coalescing (prevents duplicate cold queries)', async () => {
        let readCount = 0;
        const delayedEnvelope = createSignedEnvelope({}, 1);

        const mockPrimary = {
            read: async () => {
                readCount++;
                // Artificial small delay to test concurrent overlap
                await new Promise(resolve => setTimeout(resolve, 20));
                return delayedEnvelope;
            },
            write: async () => true
        };
        const mockMirror = {
            read: async () => delayedEnvelope,
            write: async () => true
        };

        const cache = createLicenseCache({
            primaryAdapter: mockPrimary,
            mirrorAdapter: mockMirror,
            keystore: testKeystore
        });

        // Fire 20 concurrent requests simultaneously
        const promises = [];
        for (let i = 0; i < 20; i++) {
            promises.push(cache.getState({ normalizedHost: 'hrm.enterprise.com', isDevBypass: false }));
        }

        const results = await Promise.all(promises);

        // All 20 calls must return valid HEALTHY state
        for (const res of results) {
            assert.strictEqual(res.valid, true);
            assert.strictEqual(res.status, CacheStatus.HEALTHY);
        }

        // Exact assertion: readCount must be exactly 1 despite 20 concurrent callers!
        assert.strictEqual(readCount, 1);
    });

    await runTest('Cache expiry forces cold refresh after TTL', async () => {
        let currentTime = 100000;
        let readCount = 0;

        const envelope = createSignedEnvelope({}, 1);
        const mockPrimary = {
            read: async () => {
                readCount++;
                return envelope;
            },
            write: async () => true
        };
        const mockMirror = {
            read: async () => envelope,
            write: async () => true
        };

        const cache = createLicenseCache({
            primaryAdapter: mockPrimary,
            mirrorAdapter: mockMirror,
            keystore: testKeystore,
            nowFn: () => currentTime,
            config: createLicenseConfig({
                cache: { healthyTtlMs: 30000, degradedTtlMs: 5000 }
            })
        });

        // Request 1: cold
        await cache.getState();
        assert.strictEqual(readCount, 1);

        // Request 2 (at +10s, within TTL): warm cache hit
        currentTime += 10000;
        await cache.getState();
        assert.strictEqual(readCount, 1);

        // Request 3 (at +35s, after TTL expired): cold refresh
        currentTime += 25000;
        await cache.getState();
        assert.strictEqual(readCount, 2);
    });

    await runTest('Explicit invalidation forces immediate cold re-query', async () => {
        let readCount = 0;
        const envelope = createSignedEnvelope({}, 1);

        const mockPrimary = {
            read: async () => {
                readCount++;
                return envelope;
            },
            write: async () => true
        };
        const mockMirror = {
            read: async () => envelope,
            write: async () => true
        };

        const cache = createLicenseCache({
            primaryAdapter: mockPrimary,
            mirrorAdapter: mockMirror,
            keystore: testKeystore
        });

        await cache.getState();
        assert.strictEqual(readCount, 1);

        // Invalidate explicitly (e.g. after license activation)
        cache.invalidate();

        await cache.getState();
        assert.strictEqual(readCount, 2);
    });

    await runTest('Transient storage failure is NEVER cached', async () => {
        let callCount = 0;

        const mockFailingPrimary = {
            read: async () => {
                callCount++;
                const err = new Error('Database connection failed');
                err.code = 'DB_UNAVAILABLE';
                throw err;
            },
            write: async () => true
        };
        const mockFailingMirror = {
            read: async () => {
                const err = new Error('Permission denied');
                err.code = 'VAULT_PERMISSION_DENIED';
                throw err;
            },
            write: async () => true
        };

        const cache = createLicenseCache({
            primaryAdapter: mockFailingPrimary,
            mirrorAdapter: mockFailingMirror,
            keystore: testKeystore
        });

        const state1 = await cache.getState();
        assert.strictEqual(state1.status, CacheStatus.STORAGE_UNAVAILABLE);

        // Second call immediately afterwards: must NOT hit cache
        const state2 = await cache.getState();
        assert.strictEqual(state2.status, CacheStatus.STORAGE_UNAVAILABLE);
        assert.strictEqual(callCount, 2); // Confirms re-evaluation was attempted!
    });

    await runTest('Domain mismatch detected for unauthorized hostnames', async () => {
        const envelope = createSignedEnvelope({ licensed_domain: 'hrm.enterprise.com' }, 1);
        const cache = createLicenseCache({
            primaryAdapter: { read: async () => envelope, write: async () => true },
            mirrorAdapter: { read: async () => envelope, write: async () => true },
            keystore: testKeystore
        });

        const allowedResult = await cache.getState({
            normalizedHost: 'hrm.enterprise.com',
            isDevBypass: false
        });
        assert.strictEqual(allowedResult.valid, true);

        const deniedResult = await cache.getState({
            normalizedHost: 'pirate.domain.com',
            isDevBypass: false
        });
        assert.strictEqual(deniedResult.valid, false);
        assert.strictEqual(deniedResult.status, CacheStatus.DOMAIN_MISMATCH);
    });

    await runTest('Product mismatch detected when license product_id differs', async () => {
        const envelope = createSignedEnvelope({ product_id: 'restaurant-pos' }, 1);
        const cache = createLicenseCache({
            primaryAdapter: { read: async () => envelope, write: async () => true },
            mirrorAdapter: { read: async () => envelope, write: async () => true },
            keystore: testKeystore
        });

        const result = await cache.getState({ normalizedHost: 'hrm.enterprise.com', isDevBypass: false });
        assert.strictEqual(result.valid, false);
        assert.strictEqual(result.status, CacheStatus.PRODUCT_MISMATCH);
    });

    // =========================================================================
    // GROUP 2: ROUTE CLASSIFICATION & PUBLIC BYPASSES
    // =========================================================================
    console.log('\nGroup 2: Route Classification & Public Bypasses');

    await runTest('isPublicRoute correctly identifies public endpoints', () => {
        assert.strictEqual(isPublicRoute('GET', '/'), true);
        assert.strictEqual(isPublicRoute('GET', '/favicon.ico'), true);
        assert.strictEqual(isPublicRoute('POST', '/api/login'), true);
        assert.strictEqual(isPublicRoute('POST', '/api/public/forgot-password-request'), true);
        assert.strictEqual(isPublicRoute('POST', '/api/public/reset-password-verify'), true);
        assert.strictEqual(isPublicRoute('GET', '/api/license/status'), true);
        assert.strictEqual(isPublicRoute('POST', '/api/payment/webhook'), true);
        assert.strictEqual(isPublicRoute('GET', '/api/public/site-info'), true);
        assert.strictEqual(isPublicRoute('GET', '/socket.io/?EIO=4&transport=polling'), true);

        // Protected routes must NOT be public
        assert.strictEqual(isPublicRoute('GET', '/api/employees'), false);
        assert.strictEqual(isPublicRoute('GET', '/api/profile'), false);
        assert.strictEqual(isPublicRoute('GET', '/api/superadmin/companies'), false);
    });

    await runTest('isRecoveryRoute correctly identifies exact recovery routes', () => {
        assert.strictEqual(isRecoveryRoute('GET', '/api/license/diagnostics'), true);
        assert.strictEqual(isRecoveryRoute('POST', '/api/license/activate'), true);
        assert.strictEqual(isRecoveryRoute('POST', '/api/license/sync'), true);
        assert.strictEqual(isRecoveryRoute('POST', '/api/license/recover'), true);
        assert.strictEqual(isRecoveryRoute('POST', '/api/backup/restore'), true);

        // General superadmin routes are NOT recovery routes
        assert.strictEqual(isRecoveryRoute('GET', '/api/superadmin/companies'), false);
        assert.strictEqual(isRecoveryRoute('POST', '/api/superadmin/company'), false);
        assert.strictEqual(isRecoveryRoute('GET', '/api/superadmin/plans'), false);
    });

    await runTest('Malformed Host header immediately returns HTTP 400 Bad Request', async () => {
        const cache = createLicenseCache({
            primaryAdapter: { read: async () => null, write: async () => true },
            mirrorAdapter: { read: async () => null, write: async () => true }
        });
        const guard = createLicenseGuard({ licenseCache: cache });

        const ctx = createMockContext({
            headers: { host: 'invalid@host.com:99999' } // Invalid port & credentials
        });

        await guard(ctx.req, ctx.res, ctx.next);

        assert.strictEqual(ctx.res.statusCode, 400);
        assert.strictEqual(ctx.res.jsonBody.success, false);
        assert.strictEqual(ctx.isNextCalled(), false);
    });

    await runTest('Public route passes through even when installation is completely UNLICENSED', async () => {
        const cache = createLicenseCache({
            primaryAdapter: { read: async () => null, write: async () => true },
            mirrorAdapter: { read: async () => null, write: async () => true }
        });
        const guard = createLicenseGuard({ licenseCache: cache });

        const ctx = createMockContext({ method: 'POST', path: '/api/login' });

        await guard(ctx.req, ctx.res, ctx.next);

        assert.strictEqual(ctx.isNextCalled(), true);
    });

    // =========================================================================
    // GROUP 3: LICENSE GUARD STATE ENFORCEMENT
    // =========================================================================
    console.log('\nGroup 3: License Guard State Enforcement');

    const healthyEnvelope = createSignedEnvelope({}, 1);

    await runTest('1. Healthy license pass-through: allows protected route and attaches req.license', async () => {
        const cache = createLicenseCache({
            primaryAdapter: { read: async () => healthyEnvelope, write: async () => true },
            mirrorAdapter: { read: async () => healthyEnvelope, write: async () => true },
            keystore: testKeystore
        });
        const guard = createLicenseGuard({ licenseCache: cache });

        const ctx = createMockContext({ method: 'GET', path: '/api/employees' });

        await guard(ctx.req, ctx.res, ctx.next);

        assert.strictEqual(ctx.isNextCalled(), true);
        assert.ok(ctx.req.license);
        assert.strictEqual(ctx.req.license.valid, true);
        assert.strictEqual(ctx.req.license.status, CacheStatus.HEALTHY);
    });

    await runTest('2. Unlicensed protected-route denial: returns HTTP 403 LICENSE_REQUIRED', async () => {
        const cache = createLicenseCache({
            primaryAdapter: { read: async () => null, write: async () => true },
            mirrorAdapter: { read: async () => null, write: async () => true }
        });
        const guard = createLicenseGuard({ licenseCache: cache });

        const ctx = createMockContext({ method: 'GET', path: '/api/payroll' });

        await guard(ctx.req, ctx.res, ctx.next);

        assert.strictEqual(ctx.isNextCalled(), false);
        assert.strictEqual(ctx.res.statusCode, 403);
        assert.strictEqual(ctx.res.jsonBody.code, 'LICENSE_REQUIRED');
    });

    await runTest('3. Corrupted license denial: returns HTTP 403 LICENSE_CORRUPTED', async () => {
        const cache = createLicenseCache({
            primaryAdapter: { read: async () => ({ bad: 'signature' }), write: async () => true },
            mirrorAdapter: { read: async () => ({ bad: 'signature' }), write: async () => true },
            keystore: testKeystore
        });
        const guard = createLicenseGuard({ licenseCache: cache });

        const ctx = createMockContext({ method: 'GET', path: '/api/attendance' });

        await guard(ctx.req, ctx.res, ctx.next);

        assert.strictEqual(ctx.isNextCalled(), false);
        assert.strictEqual(ctx.res.statusCode, 403);
        assert.strictEqual(ctx.res.jsonBody.code, 'LICENSE_CORRUPTED');
    });

    await runTest('4. Conflict response: equal-sequence conflict returns HTTP 423 LICENSE_CONFLICT', async () => {
        const envA = createSignedEnvelope({ customer: 'Branch A' }, 5);
        const envB = createSignedEnvelope({ customer: 'Branch B' }, 5);

        const cache = createLicenseCache({
            primaryAdapter: { read: async () => envA, write: async () => true },
            mirrorAdapter: { read: async () => envB, write: async () => true },
            keystore: testKeystore
        });
        const guard = createLicenseGuard({ licenseCache: cache });

        const ctx = createMockContext({ method: 'GET', path: '/api/employees' });

        await guard(ctx.req, ctx.res, ctx.next);

        assert.strictEqual(ctx.isNextCalled(), false);
        assert.strictEqual(ctx.res.statusCode, 423);
        assert.strictEqual(ctx.res.jsonBody.code, 'LICENSE_CONFLICT');
    });

    await runTest('5. Storage-unavailable response: returns HTTP 503 LICENSE_STORAGE_FAILURE', async () => {
        const cache = createLicenseCache({
            primaryAdapter: {
                read: async () => {
                    const err = new Error('Database pool closed');
                    err.code = 'DB_UNAVAILABLE';
                    throw err;
                },
                write: async () => true
            },
            mirrorAdapter: {
                read: async () => {
                    const err = new Error('Permission denied');
                    err.code = 'VAULT_PERMISSION_DENIED';
                    throw err;
                },
                write: async () => true
            }
        });
        const guard = createLicenseGuard({ licenseCache: cache });

        const ctx = createMockContext({ method: 'GET', path: '/api/profile' });

        await guard(ctx.req, ctx.res, ctx.next);

        assert.strictEqual(ctx.isNextCalled(), false);
        assert.strictEqual(ctx.res.statusCode, 503);
        assert.strictEqual(ctx.res.jsonBody.code, 'LICENSE_STORAGE_FAILURE');
    });

    // =========================================================================
    // GROUP 4: CRYPTOGRAPHIC SUPERADMIN RECOVERY ACCESS & DENIAL
    // =========================================================================
    console.log('\nGroup 4: Cryptographic Superadmin Recovery Access & Denial');

    // Create an un-licensed cache for testing recovery access
    const unlicensedCache = createLicenseCache({
        primaryAdapter: { read: async () => null, write: async () => true },
        mirrorAdapter: { read: async () => null, write: async () => true }
    });

    const guard = createLicenseGuard({
        licenseCache: unlicensedCache,
        jwtSecret: TEST_JWT_SECRET
    });

    await runTest('8a. Recovery route with missing Authorization header returns HTTP 401', async () => {
        const ctx = createMockContext({
            method: 'POST',
            path: '/api/license/activate'
        });

        await guard(ctx.req, ctx.res, ctx.next);

        assert.strictEqual(ctx.isNextCalled(), false);
        assert.strictEqual(ctx.res.statusCode, 401);
        assert.strictEqual(ctx.res.jsonBody.code, 'UNAUTHORIZED');
    });

    await runTest('8b. Recovery route with malformed Authorization header returns HTTP 401', async () => {
        const ctx = createMockContext({
            method: 'POST',
            path: '/api/license/activate',
            headers: { authorization: 'Basic dXNlcjpwYXNz' } // Not Bearer
        });

        await guard(ctx.req, ctx.res, ctx.next);

        assert.strictEqual(ctx.isNextCalled(), false);
        assert.strictEqual(ctx.res.statusCode, 401);
        assert.strictEqual(ctx.res.jsonBody.code, 'UNAUTHORIZED');
    });

    await runTest('8c. Recovery route with invalid / tampered JWT returns HTTP 401 INVALID_TOKEN', async () => {
        const ctx = createMockContext({
            method: 'POST',
            path: '/api/license/activate',
            headers: { authorization: 'Bearer invalid.fake.token' }
        });

        await guard(ctx.req, ctx.res, ctx.next);

        assert.strictEqual(ctx.isNextCalled(), false);
        assert.strictEqual(ctx.res.statusCode, 401);
        assert.strictEqual(ctx.res.jsonBody.code, 'INVALID_TOKEN');
    });

    await runTest('8d. Recovery route with expired JWT returns HTTP 401 TOKEN_EXPIRED', async () => {
        const expiredToken = jwt.sign(
            { id: 1, role: 'superadmin' },
            TEST_JWT_SECRET,
            { expiresIn: -10 } // Expired 10s ago
        );

        const ctx = createMockContext({
            method: 'POST',
            path: '/api/license/activate',
            headers: { authorization: `Bearer ${expiredToken}` }
        });

        await guard(ctx.req, ctx.res, ctx.next);

        assert.strictEqual(ctx.isNextCalled(), false);
        assert.strictEqual(ctx.res.statusCode, 401);
        assert.strictEqual(ctx.res.jsonBody.code, 'TOKEN_EXPIRED');
    });

    await runTest('10a. Recovery route with Employee role returns HTTP 403 SUPERADMIN_REQUIRED', async () => {
        const employeeToken = jwt.sign(
            { id: 25, role: 'employee', employee_id: 10 },
            TEST_JWT_SECRET
        );

        const ctx = createMockContext({
            method: 'POST',
            path: '/api/license/activate',
            headers: { authorization: `Bearer ${employeeToken}` }
        });

        await guard(ctx.req, ctx.res, ctx.next);

        assert.strictEqual(ctx.isNextCalled(), false);
        assert.strictEqual(ctx.res.statusCode, 403);
        assert.strictEqual(ctx.res.jsonBody.code, 'SUPERADMIN_REQUIRED');
    });

    await runTest('10b. Recovery route with Tenant Admin role returns HTTP 403 SUPERADMIN_REQUIRED', async () => {
        const adminToken = jwt.sign(
            { id: 5, role: 'admin', company_id: 2 },
            TEST_JWT_SECRET
        );

        const ctx = createMockContext({
            method: 'POST',
            path: '/api/license/activate',
            headers: { authorization: `Bearer ${adminToken}` }
        });

        await guard(ctx.req, ctx.res, ctx.next);

        assert.strictEqual(ctx.isNextCalled(), false);
        assert.strictEqual(ctx.res.statusCode, 403);
        assert.strictEqual(ctx.res.jsonBody.code, 'SUPERADMIN_REQUIRED');
    });

    await runTest('9. Valid Superadmin recovery access: permits exact recovery route, attaches req.user', async () => {
        const superadminToken = jwt.sign(
            { id: 1, role: 'superadmin', name: 'Root SuperAdmin' },
            TEST_JWT_SECRET
        );

        const ctx = createMockContext({
            method: 'POST',
            path: '/api/license/activate',
            headers: { authorization: `Bearer ${superadminToken}` }
        });

        await guard(ctx.req, ctx.res, ctx.next);

        assert.strictEqual(ctx.isNextCalled(), true);
        assert.strictEqual(ctx.req.isRecoveryAccess, true);
        assert.strictEqual(ctx.req.user.role, 'superadmin');
    });

    await runTest('14. Superadmin JWT on a NON-recovery route while unlicensed is BLOCKED', async () => {
        // Critical test: Proves that /api/superadmin is NOT a blanket backdoor!
        const superadminToken = jwt.sign(
            { id: 1, role: 'superadmin', name: 'Root SuperAdmin' },
            TEST_JWT_SECRET
        );

        const ctx = createMockContext({
            method: 'GET',
            path: '/api/superadmin/companies', // Operational SaaS route, NOT recovery route
            headers: { authorization: `Bearer ${superadminToken}` }
        });

        await guard(ctx.req, ctx.res, ctx.next);

        assert.strictEqual(ctx.isNextCalled(), false);
        assert.strictEqual(ctx.res.statusCode, 403);
        assert.strictEqual(ctx.res.jsonBody.code, 'LICENSE_REQUIRED');
    });

    // =========================================================================
    // GROUP 5: ZERO INFORMATION LEAKAGE IN RESPONSES
    // =========================================================================
    console.log('\nGroup 5: Information Leakage & Security Assurance');

    await runTest('13. No sensitive cryptographic keys, paths, or signatures in responses', async () => {
        const cache = createLicenseCache({
            primaryAdapter: { read: async () => null, write: async () => true },
            mirrorAdapter: { read: async () => null, write: async () => true }
        });
        const guard = createLicenseGuard({ licenseCache: cache, jwtSecret: TEST_JWT_SECRET });

        const ctx = createMockContext({ method: 'GET', path: '/api/payroll' });
        await guard(ctx.req, ctx.res, ctx.next);

        const bodyStr = JSON.stringify(ctx.res.jsonBody);
        assert.ok(!bodyStr.includes('BEGIN PUBLIC KEY'));
        assert.ok(!bodyStr.includes('BEGIN PRIVATE KEY'));
        assert.ok(!bodyStr.includes('signature'));
        assert.ok(!bodyStr.includes('.lic'));
        assert.ok(!bodyStr.includes('vault'));
        assert.ok(!bodyStr.includes('stack'));
        assert.ok(!bodyStr.includes('system_licenses'));
    });

    // =========================================================================
    // GROUP 6: ROUTE NORMALIZATION & TRAILING SLASH INTEGRITY
    // =========================================================================
    console.log('\nGroup 6: Route Normalization & Trailing Slash Integrity');

    await runTest('Route Normalization 1-11: Public, recovery, query, and boundary checks', async () => {
        // 1. isPublicRoute('POST', '/api/login') === true
        assert.strictEqual(isPublicRoute('POST', '/api/login'), true, '1. /api/login must be public');

        // 2. isPublicRoute('POST', '/api/login/') === true
        assert.strictEqual(isPublicRoute('POST', '/api/login/'), true, '2. /api/login/ with trailing slash must be public');

        // 3. isPublicRoute('POST', '/api/login///') === true
        assert.strictEqual(isPublicRoute('POST', '/api/login///'), true, '3. /api/login/// with multiple trailing slashes must be public');

        // 4. isPublicRoute('POST', '/api/login?ref=portal') === true
        assert.strictEqual(isPublicRoute('POST', '/api/login?ref=portal'), true, '4. /api/login?ref=portal must be public');

        // 5. isPublicRoute('POST', '/api/login/?ref=portal') === true
        assert.strictEqual(isPublicRoute('POST', '/api/login/?ref=portal'), true, '5. /api/login/?ref=portal with slash and query must be public');

        // 6. isPublicRoute('GET', '/') === true
        assert.strictEqual(isPublicRoute('GET', '/'), true, '6. / must be public');

        // 7. isPublicRoute('GET', '///') === true
        assert.strictEqual(isPublicRoute('GET', '///'), true, '7. /// root with multiple slashes must be public');

        // 8. isRecoveryRoute('POST', '/api/license/activate') === true
        assert.strictEqual(isRecoveryRoute('POST', '/api/license/activate'), true, '8. /api/license/activate must be a recovery route');

        // 9. isRecoveryRoute('POST', '/api/license/activate/') === true
        assert.strictEqual(isRecoveryRoute('POST', '/api/license/activate/'), true, '9. /api/license/activate/ with trailing slash must be a recovery route');

        // 10. matchesRoute('GET', '/api/employees/', []) === false
        assert.strictEqual(matchesRoute('GET', '/api/employees/', []), false, '10. /api/employees/ must NOT match an empty list');
        assert.strictEqual(isPublicRoute('GET', '/api/employees/'), false, '10b. /api/employees/ must NOT be public');

        // 11. matchesRoute('POST', '/api/login/admin', PUBLIC_ROUTES) === false
        assert.strictEqual(matchesRoute('POST', '/api/login/admin', PUBLIC_ROUTES), false, '11. /api/login/admin subpath must NOT match public route');
    });

    console.log('\n======================================================');
    console.log(`  ALL ${passedTests} / ${totalTests} TESTS PASSED SUCCESSFULLY!`);
    console.log('======================================================\n');
})();
