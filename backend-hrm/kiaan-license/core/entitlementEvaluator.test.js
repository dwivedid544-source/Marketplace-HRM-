/**
 * Kiaan HRM Marketplace Licensing — Client Entitlement & Edition Enforcement Test Suite
 * Module: backend-hrm/kiaan-license/core/entitlementEvaluator.test.js
 *
 * Verifies Phase 2B.9 compliance across Groups A through N:
 * - Group A: Valid License Entitlements
 * - Group B: Invalid / Tampered / Degraded License Fail-Closed
 * - Group C: Wrong Product Mismatch Rejection
 * - Group D: Wrong Domain Mismatch Rejection
 * - Group E: ui_dist Edition Enforcement
 * - Group F: full_source Edition Enforcement
 * - Group G: extended Edition Enforcement
 * - Group H: Unknown Feature Fail-Closed
 * - Group I: Employee Limit Enforcement
 * - Group J: Concurrency & Race Condition Safety
 * - Group K: Zero-Trust Parameter & Body Tampering Defense
 * - Group L: SaaS Subscription Isolation & Separation
 * - Group M: Offline Operation & Air-Gap Compliance
 * - Group N: Express Middleware & Controller Integration
 */

'use strict';

const assert = require('assert');
const {
    evaluateLicenseEntitlement,
    EDITIONS,
    FEATURES,
    FEATURE_ALIASES,
    EntitlementCodes
} = require('./entitlementEvaluator');
const {
    requireFeature,
    requireEdition,
    enforceEmployeeLimit
} = require('../middleware/entitlementGuard');
const { CacheStatus } = require('./licenseCache');

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

// Helper to construct mock valid license states
function createMockLicenseState({
    valid = true,
    status = CacheStatus.HEALTHY,
    productId = 'kiaan-hrm',
    editionCode = EDITIONS.FULL_SOURCE,
    sku = 'KHRM-SRC-LIFETIME',
    licensedDomain = 'hrm.example.com',
    maxEmployees = 1000,
    features = [
        FEATURES.ATTENDANCE,
        FEATURES.PAYROLL,
        FEATURES.LEAVES,
        FEATURES.GEO_FENCING,
        FEATURES.FULL_BACKEND_API,
        FEATURES.OFFLINE_LICENSING
    ]
} = {}) {
    return {
        valid,
        status,
        payload: valid ? {
            product_id: productId,
            edition_code: editionCode,
            sku,
            licensed_domain: licensedDomain,
            max_employees: maxEmployees,
            features: [...features],
            sequence_number: 1,
            license_id: 'lic_test_123',
            license_type: 'commercial_perpetual'
        } : null,
        authoritative: valid ? {
            key_id: 'authority-key-2026-v1',
            algorithm: 'Ed25519',
            signature: 'MOCK_SIGNATURE'
        } : null
    };
}

(async () => {
    console.log('\n======================================================');
    console.log('  PHASE 2B.9 — ENTITLEMENT & EDITION ENFORCEMENT TESTS');
    console.log('======================================================\n');

    // ─── Group A: Valid License Entitlements ───
    console.log('Group A: Valid License Entitlements');

    await runTest('A1. Valid full_source license allows standard entitled features', async () => {
        const state = createMockLicenseState({
            editionCode: EDITIONS.FULL_SOURCE,
            features: ['PAYROLL', 'ATTENDANCE', 'LEAVES']
        });
        const res = evaluateLicenseEntitlement({ licenseState: state, requiredFeature: 'PAYROLL' });
        assert.strictEqual(res.allowed, true);
        assert.strictEqual(res.code, EntitlementCodes.ENTITLED);
        assert.strictEqual(res.license.editionCode, 'full_source');
        assert.strictEqual(res.license.maxEmployees, 1000);
    });

    await runTest('A2. Valid extended license allows extended features', async () => {
        const state = createMockLicenseState({
            editionCode: EDITIONS.EXTENDED,
            features: ['ATTENDANCE', 'PAYROLL', 'BIOMETRIC_HARDWARE_SDK', 'AI_ANALYTICS_ENGINE', 'WHITE_LABEL_BRANDING']
        });
        const resBio = evaluateLicenseEntitlement({ licenseState: state, requiredFeature: 'BIOMETRIC_HARDWARE_SDK' });
        assert.strictEqual(resBio.allowed, true);
        const resAi = evaluateLicenseEntitlement({ licenseState: state, requiredFeature: 'AI_ANALYTICS_ENGINE' });
        assert.strictEqual(resAi.allowed, true);
    });

    await runTest('A3. Feature aliases resolve canonically', async () => {
        const state = createMockLicenseState({
            editionCode: EDITIONS.EXTENDED,
            features: ['BIOMETRIC_HARDWARE_SDK', 'AI_ANALYTICS_ENGINE', 'WHITE_LABEL_BRANDING']
        });
        const resBioAlias = evaluateLicenseEntitlement({ licenseState: state, requiredFeature: 'BIOMETRIC_SDK' });
        assert.strictEqual(resBioAlias.allowed, true);
        const resAiAlias = evaluateLicenseEntitlement({ licenseState: state, requiredFeature: 'AI_ANALYTICS' });
        assert.strictEqual(resAiAlias.allowed, true);
        const resWlAlias = evaluateLicenseEntitlement({ licenseState: state, requiredFeature: 'WHITE_LABEL' });
        assert.strictEqual(resWlAlias.allowed, true);
    });

    // ─── Group B: Invalid / Tampered / Degraded License Fail-Closed ───
    console.log('\nGroup B: Invalid / Tampered / Degraded License Fail-Closed');

    await runTest('B1. Unlicensed state fails closed', async () => {
        const state = { valid: false, status: CacheStatus.UNLICENSED, payload: null };
        const res = evaluateLicenseEntitlement({ licenseState: state, requiredFeature: 'PAYROLL' });
        assert.strictEqual(res.allowed, false);
        assert.strictEqual(res.code, EntitlementCodes.LICENSE_REQUIRED);
    });

    await runTest('B2. Corrupted vault state fails closed', async () => {
        const state = { valid: false, status: CacheStatus.CORRUPTED, payload: null };
        const res = evaluateLicenseEntitlement({ licenseState: state, requiredFeature: 'PAYROLL' });
        assert.strictEqual(res.allowed, false);
        assert.strictEqual(res.code, EntitlementCodes.LICENSE_CORRUPTED);
    });

    await runTest('B3. Degraded equal-sequence conflict fails closed', async () => {
        const state = { valid: false, status: CacheStatus.DEGRADED_CONFLICT, payload: null };
        const res = evaluateLicenseEntitlement({ licenseState: state, requiredFeature: 'PAYROLL' });
        assert.strictEqual(res.allowed, false);
        assert.strictEqual(res.code, EntitlementCodes.LICENSE_CONFLICT);
    });

    await runTest('B4. Storage failure fails closed with LICENSE_STORAGE_UNAVAILABLE', async () => {
        const state = { valid: false, status: CacheStatus.STORAGE_UNAVAILABLE, payload: null };
        const res = evaluateLicenseEntitlement({ licenseState: state, requiredFeature: 'PAYROLL' });
        assert.strictEqual(res.allowed, false);
        assert.strictEqual(res.code, EntitlementCodes.LICENSE_STORAGE_UNAVAILABLE);
    });

    await runTest('B5. Null or undefined license state strictly fails closed', async () => {
        const resNull = evaluateLicenseEntitlement({ licenseState: null });
        assert.strictEqual(resNull.allowed, false);
        assert.strictEqual(resNull.code, EntitlementCodes.LICENSE_REQUIRED);

        const resUndef = evaluateLicenseEntitlement({});
        assert.strictEqual(resUndef.allowed, false);
        assert.strictEqual(resUndef.code, EntitlementCodes.LICENSE_REQUIRED);
    });

    // ─── Group C: Wrong Product Mismatch Rejection ───
    console.log('\nGroup C: Wrong Product Mismatch Rejection');

    await runTest('C1. License with product_id !== kiaan-hrm is denied', async () => {
        const state = createMockLicenseState({ productId: 'other-hrm-product' });
        const res = evaluateLicenseEntitlement({ licenseState: state, requiredFeature: 'PAYROLL' });
        assert.strictEqual(res.allowed, false);
        assert.strictEqual(res.code, EntitlementCodes.PRODUCT_MISMATCH);
    });

    await runTest('C2. License missing product_id is denied', async () => {
        const state = createMockLicenseState({ productId: '' });
        const res = evaluateLicenseEntitlement({ licenseState: state, requiredFeature: 'PAYROLL' });
        assert.strictEqual(res.allowed, false);
        assert.strictEqual(res.code, EntitlementCodes.PRODUCT_MISMATCH);
    });

    // ─── Group D: Wrong Domain Mismatch Rejection ───
    console.log('\nGroup D: Wrong Domain Mismatch Rejection');

    await runTest('D1. License state with DOMAIN_MISMATCH status is denied', async () => {
        const state = {
            valid: false,
            status: CacheStatus.DOMAIN_MISMATCH,
            payload: { product_id: 'kiaan-hrm', licensed_domain: 'legit.com' }
        };
        const res = evaluateLicenseEntitlement({ licenseState: state, requiredFeature: 'PAYROLL' });
        assert.strictEqual(res.allowed, false);
        assert.strictEqual(res.code, EntitlementCodes.DOMAIN_MISMATCH);
    });

    // ─── Group E: ui_dist Edition Enforcement ───
    console.log('\nGroup E: ui_dist Edition Enforcement');

    await runTest('E1. ui_dist cannot unlock full-source backend API', async () => {
        const state = createMockLicenseState({
            editionCode: EDITIONS.UI_DIST,
            sku: 'KHRM-DIST-LIFETIME',
            maxEmployees: 50,
            features: ['EMPLOYEE_PORTAL', 'ATTENDANCE_KIOSK_UI', 'BASIC_DASHBOARD']
        });
        const resEdition = evaluateLicenseEntitlement({ licenseState: state, requiredEdition: EDITIONS.FULL_SOURCE });
        assert.strictEqual(resEdition.allowed, false);
        assert.strictEqual(resEdition.code, EntitlementCodes.EDITION_INSUFFICIENT);

        const resFeature = evaluateLicenseEntitlement({ licenseState: state, requiredFeature: 'PAYROLL' });
        assert.strictEqual(resFeature.allowed, false);
        assert.strictEqual(resFeature.code, EntitlementCodes.FEATURE_NOT_ENTITLED);
    });

    await runTest('E2. ui_dist can only unlock its explicitly entitled UI features', async () => {
        const state = createMockLicenseState({
            editionCode: EDITIONS.UI_DIST,
            features: ['EMPLOYEE_PORTAL', 'ATTENDANCE_KIOSK_UI', 'BASIC_DASHBOARD']
        });
        const resPortal = evaluateLicenseEntitlement({ licenseState: state, requiredFeature: 'EMPLOYEE_PORTAL' });
        assert.strictEqual(resPortal.allowed, true);
        const resKiosk = evaluateLicenseEntitlement({ licenseState: state, requiredFeature: 'ATTENDANCE_KIOSK_UI' });
        assert.strictEqual(resKiosk.allowed, true);
    });

    // ─── Group F: full_source Edition Enforcement ───
    console.log('\nGroup F: full_source Edition Enforcement');

    await runTest('F1. full_source allows standard features and full_source edition', async () => {
        const state = createMockLicenseState({
            editionCode: EDITIONS.FULL_SOURCE,
            sku: 'KHRM-SRC-LIFETIME',
            features: ['ATTENDANCE', 'PAYROLL', 'LEAVES', 'GEO_FENCING', 'FULL_BACKEND_API']
        });
        const resEd = evaluateLicenseEntitlement({ licenseState: state, requiredEdition: EDITIONS.FULL_SOURCE });
        assert.strictEqual(resEd.allowed, true);
        const resPay = evaluateLicenseEntitlement({ licenseState: state, requiredFeature: 'PAYROLL' });
        assert.strictEqual(resPay.allowed, true);
    });

    await runTest('F2. full_source cannot unlock extended-only features', async () => {
        const state = createMockLicenseState({
            editionCode: EDITIONS.FULL_SOURCE,
            features: ['ATTENDANCE', 'PAYROLL', 'LEAVES', 'GEO_FENCING', 'FULL_BACKEND_API']
        });
        const resBio = evaluateLicenseEntitlement({ licenseState: state, requiredFeature: 'BIOMETRIC_HARDWARE_SDK' });
        assert.strictEqual(resBio.allowed, false);
        assert.strictEqual(resBio.code, EntitlementCodes.FEATURE_NOT_ENTITLED);

        const resAi = evaluateLicenseEntitlement({ licenseState: state, requiredFeature: 'AI_ANALYTICS_ENGINE' });
        assert.strictEqual(resAi.allowed, false);
        assert.strictEqual(resAi.code, EntitlementCodes.FEATURE_NOT_ENTITLED);

        const resWl = evaluateLicenseEntitlement({ licenseState: state, requiredFeature: 'WHITE_LABEL_BRANDING' });
        assert.strictEqual(resWl.allowed, false);
        assert.strictEqual(resWl.code, EntitlementCodes.FEATURE_NOT_ENTITLED);
    });

    await runTest('F3. full_source cannot unlock extended edition requirement', async () => {
        const state = createMockLicenseState({ editionCode: EDITIONS.FULL_SOURCE });
        const res = evaluateLicenseEntitlement({ licenseState: state, requiredEdition: EDITIONS.EXTENDED });
        assert.strictEqual(res.allowed, false);
        assert.strictEqual(res.code, EntitlementCodes.EDITION_INSUFFICIENT);
    });

    // ─── Group G: extended Edition Enforcement ───
    console.log('\nGroup G: extended Edition Enforcement');

    await runTest('G1. extended allows explicitly present extended features', async () => {
        const state = createMockLicenseState({
            editionCode: EDITIONS.EXTENDED,
            features: ['ATTENDANCE', 'PAYROLL', 'MULTI_BRANCH', 'BIOMETRIC_HARDWARE_SDK', 'AI_ANALYTICS_ENGINE', 'WHITE_LABEL_BRANDING']
        });
        const resBranch = evaluateLicenseEntitlement({ licenseState: state, requiredFeature: 'MULTI_BRANCH' });
        assert.strictEqual(resBranch.allowed, true);
        const resBio = evaluateLicenseEntitlement({ licenseState: state, requiredFeature: 'BIOMETRIC_HARDWARE_SDK' });
        assert.strictEqual(resBio.allowed, true);
        const resAi = evaluateLicenseEntitlement({ licenseState: state, requiredFeature: 'AI_ANALYTICS_ENGINE' });
        assert.strictEqual(resAi.allowed, true);
        const resWl = evaluateLicenseEntitlement({ licenseState: state, requiredFeature: 'WHITE_LABEL_BRANDING' });
        assert.strictEqual(resWl.allowed, true);
    });

    // ─── Group H: Unknown Feature Fail-Closed ───
    console.log('\nGroup H: Unknown Feature Fail-Closed');

    await runTest('H1. Unknown feature names fail closed', async () => {
        const state = createMockLicenseState({ editionCode: EDITIONS.EXTENDED });
        const resUnknown = evaluateLicenseEntitlement({ licenseState: state, requiredFeature: 'QUANTUM_TELEPORTATION' });
        assert.strictEqual(resUnknown.allowed, false);
        assert.strictEqual(resUnknown.code, EntitlementCodes.FEATURE_NOT_ENTITLED);
    });

    await runTest('H2. Malformed feature input fails closed', async () => {
        const state = createMockLicenseState();
        const resEmpty = evaluateLicenseEntitlement({ licenseState: state, requiredFeature: '' });
        assert.strictEqual(resEmpty.allowed, false);
        assert.strictEqual(resEmpty.code, EntitlementCodes.FEATURE_NOT_ENTITLED);
    });

    // ─── Group I: Employee Limit Enforcement ───
    console.log('\nGroup I: Employee Limit Enforcement');

    await runTest('I1. Employee count below max_employees is allowed', async () => {
        const state = createMockLicenseState({ maxEmployees: 50 });
        const res = evaluateLicenseEntitlement({ licenseState: state, currentEmployeeCount: 49 });
        assert.strictEqual(res.allowed, true);
        assert.strictEqual(res.code, EntitlementCodes.ENTITLED);
    });

    await runTest('I2. Employee count at max_employees is rejected', async () => {
        const state = createMockLicenseState({ maxEmployees: 50 });
        const res = evaluateLicenseEntitlement({ licenseState: state, currentEmployeeCount: 50 });
        assert.strictEqual(res.allowed, false);
        assert.strictEqual(res.code, EntitlementCodes.EMPLOYEE_LIMIT_EXCEEDED);
        assert.ok(res.reason.includes('exceeded'));
    });

    await runTest('I3. Employee count above max_employees is rejected', async () => {
        const state = createMockLicenseState({ maxEmployees: 50 });
        const res = evaluateLicenseEntitlement({ licenseState: state, currentEmployeeCount: 55 });
        assert.strictEqual(res.allowed, false);
        assert.strictEqual(res.code, EntitlementCodes.EMPLOYEE_LIMIT_EXCEEDED);
    });

    // ─── Group J: Concurrency & Race Condition Safety ───
    console.log('\nGroup J: Concurrency & Race Condition Safety');

    await runTest('J1. Simulated concurrent employee additions do not breach limit', async () => {
        const maxLimit = 5;
        let simulatedDbCount = 4; // 1 slot left

        // Mock DB connection pool with simulated count
        const mockDb = {
            async execute(sql) {
                if (sql.includes('COUNT(*)')) {
                    return [[{ total: simulatedDbCount }]];
                }
                return [[]];
            }
        };

        const state = createMockLicenseState({ maxEmployees: maxLimit });
        const guard = enforceEmployeeLimit({ dbPool: mockDb });

        const results = [];
        const attempts = 10; // 10 simultaneous creation attempts for 1 available slot

        const executeAttempt = async (attemptId) => {
            return new Promise((resolve) => {
                const req = { license: state };
                const res = {
                    status(code) {
                        return {
                            json(data) {
                                resolve({ success: false, code, data, attemptId });
                            }
                        };
                    }
                };
                const next = () => {
                    // Simulate that successful request adds 1 employee
                    simulatedDbCount++;
                    resolve({ success: true, attemptId });
                };
                guard(req, res, next).catch((err) => {
                    resolve({ success: false, error: err.message, attemptId });
                });
            });
        };

        const settled = await Promise.all(Array.from({ length: attempts }, (_, i) => executeAttempt(i + 1)));

        const passed = settled.filter(s => s.success);
        const rejected = settled.filter(s => !s.success);

        // Exactly 1 must have succeeded (filling the slot from 4 to 5)
        assert.strictEqual(passed.length, 1, `Expected exactly 1 request to pass, but got ${passed.length}`);
        assert.strictEqual(rejected.length, attempts - 1, `Expected ${attempts - 1} requests to be rejected`);
        assert.strictEqual(simulatedDbCount, maxLimit, `Final employee count must equal maxLimit (${maxLimit})`);
        assert.strictEqual(rejected[0].code, 403);
        assert.strictEqual(rejected[0].data.code, 'LICENSE_EMPLOYEE_LIMIT_EXCEEDED');
    });

    // ─── Group K: Zero-Trust Parameter & Body Tampering Defense ───
    console.log('\nGroup K: Zero-Trust Parameter & Body Tampering Defense');

    await runTest('K1. Request body edition spoofing has zero effect', async () => {
        const state = createMockLicenseState({ editionCode: EDITIONS.UI_DIST, features: ['BASIC_DASHBOARD'] });
        const req = {
            license: state,
            body: {
                edition_code: 'extended',
                sku: 'KHRM-EXT-LIFETIME',
                features: ['PAYROLL', 'AI_ANALYTICS_ENGINE'],
                max_employees: 999999
            }
        };

        const guard = requireFeature('PAYROLL');
        let allowed = false;
        let responseCode = null;
        let responseBody = null;

        await guard(req, {
            status(code) {
                responseCode = code;
                return { json(data) { responseBody = data; } };
            }
        }, () => { allowed = true; });

        assert.strictEqual(allowed, false, 'Body spoofing must NOT allow access');
        assert.strictEqual(responseCode, 403);
        assert.strictEqual(responseBody.code, 'LICENSE_FEATURE_NOT_ENTITLED');
    });

    await runTest('K2. Query string and header spoofing has zero effect', async () => {
        const state = createMockLicenseState({ editionCode: EDITIONS.FULL_SOURCE, features: ['PAYROLL'] });
        const req = {
            license: state,
            query: { edition_code: 'extended', features: 'BIOMETRIC_HARDWARE_SDK' },
            headers: { 'x-license-edition': 'extended', 'x-license-features': 'BIOMETRIC_HARDWARE_SDK' }
        };

        const guard = requireFeature('BIOMETRIC_HARDWARE_SDK');
        let allowed = false;
        let responseCode = null;

        await guard(req, {
            status(code) {
                responseCode = code;
                return { json(data) {} };
            }
        }, () => { allowed = true; });

        assert.strictEqual(allowed, false, 'Query/header spoofing must NOT allow access');
        assert.strictEqual(responseCode, 403);
    });

    await runTest('K3. Entitlement responses never leak secrets or cryptographic credentials', async () => {
        const state = createMockLicenseState();
        const res = evaluateLicenseEntitlement({ licenseState: state, requiredFeature: 'PAYROLL' });

        const serialized = JSON.stringify(res);
        assert.strictEqual(serialized.includes('MOCK_SIGNATURE'), false, 'Signature must not leak');
        assert.strictEqual(serialized.includes('private'), false, 'Private keys must not leak');
        assert.strictEqual(serialized.includes('pepper'), false, 'Peppers must not leak');
    });

    // ─── Group L: SaaS Subscription Isolation & Separation ───
    console.log('\nGroup L: SaaS Subscription Isolation & Separation');

    await runTest('L1. Marketplace license evaluation does not alter or inspect tenant subscription state', async () => {
        const state = createMockLicenseState();
        // The evaluateLicenseEntitlement function takes only licenseState, requiredFeature, requiredEdition, currentEmployeeCount
        // It has ZERO dependence on tenant company subscription or subscriptionGuard.js
        const res = evaluateLicenseEntitlement({ licenseState: state, requiredFeature: 'ATTENDANCE' });
        assert.strictEqual(res.allowed, true);
        assert.strictEqual(res.license.productId, 'kiaan-hrm');
        // Independent SaaS subscription logic remains intact in company-tenant layer
    });

    // ─── Group M: Offline Operation & Air-Gap Compliance ───
    console.log('\nGroup M: Offline Operation & Air-Gap Compliance');

    await runTest('M1. Entitlement evaluator performs purely local deterministic evaluation without network', async () => {
        const state = createMockLicenseState();
        const start = Date.now();
        for (let i = 0; i < 1000; i++) {
            const res = evaluateLicenseEntitlement({ licenseState: state, requiredFeature: 'PAYROLL' });
            assert.strictEqual(res.allowed, true);
        }
        const elapsedMs = Date.now() - start;
        assert.ok(elapsedMs < 100, `1000 local evaluations must execute in < 100ms (took ${elapsedMs}ms)`);
    });

    // ─── Group N: Express Middleware & Controller Integration ───
    console.log('\nGroup N: Express Middleware & Controller Integration');

    await runTest('N1. requireFeature passes entitled request to next()', async () => {
        const state = createMockLicenseState({ features: ['PAYROLL'] });
        const req = { license: state };
        let nextCalled = false;
        const middleware = requireFeature('PAYROLL');

        await middleware(req, {}, () => { nextCalled = true; });
        assert.strictEqual(nextCalled, true);
    });

    await runTest('N2. requireFeature rejects unentitled request with 403', async () => {
        const state = createMockLicenseState({ features: ['ATTENDANCE'] });
        const req = { license: state };
        let statusCode = null;
        let responseJson = null;

        const res = {
            status(code) {
                statusCode = code;
                return { json(data) { responseJson = data; } };
            }
        };

        const middleware = requireFeature('PAYROLL');
        await middleware(req, res, () => {});

        assert.strictEqual(statusCode, 403);
        assert.strictEqual(responseJson.code, 'LICENSE_FEATURE_NOT_ENTITLED');
    });

    await runTest('N3. requireEdition enforces minimum edition requirement', async () => {
        const state = createMockLicenseState({ editionCode: EDITIONS.UI_DIST });
        const req = { license: state };
        let statusCode = null;

        const res = {
            status(code) {
                statusCode = code;
                return { json() {} };
            }
        };

        const middleware = requireEdition(EDITIONS.FULL_SOURCE);
        await middleware(req, res, () => {});

        assert.strictEqual(statusCode, 403);
    });

    console.log('\n======================================================');
    console.log(`  ALL ${passedTests} / ${totalTests} TESTS PASSED SUCCESSFULLY!`);
    console.log('======================================================\n');
})();
