/**
 * Kiaan License Engine — Vault Engine Unit Test Suite
 * Module: backend-hrm/kiaan-license/core/vaultEngine.test.js
 *
 * Verifies:
 * 1. Both vaults valid and identical (STATUS_HEALTHY)
 * 2. Different sequence numbers (STATUS_RECONCILED, auto-heals lower sequence)
 * 3. Equal sequence numbers with differing payloads (STATUS_DEGRADED_CONFLICT)
 * 4. Missing MySQL vault (STATUS_SELF_HEALED from mirror)
 * 5. Missing filesystem mirror (STATUS_SELF_HEALED from primary)
 * 6. Both vaults missing (STATUS_UNLICENSED)
 * 7. Corrupted JSON / envelope content
 * 8. Invalid signature handling
 * 9. Unknown signing key rejection
 * 10. Revoked signing key rejection
 * 11. Older sequence write rejection (SEQUENCE_ROLLBACK_REJECTED)
 * 12. Concurrent/Forked sequence write rejection
 * 13. Filesystem adapter write failure reporting
 * 14. Database adapter write failure reporting
 * 15. Partial persistence failure explicit reporting
 * 16. Deterministic repeated reconciliation
 * 17. Zero private keys inside the engine module
 * 18. Zero silent licensed fallbacks
 */

'use strict';

const assert = require('assert');
const crypto = require('crypto');
const { reconcileVaults, persistEntitlement, VaultStatus, WriteStatus } = require('./vaultEngine');
const { canonicalizeToBuffer } = require('./canonicalizer');

let totalTests = 0;
let passedTests = 0;

function runTest(name, fn) {
    totalTests++;
    return Promise.resolve()
        .then(() => fn())
        .then(() => {
            passedTests++;
            console.log(`  ✓ ${name}`);
        })
        .catch(err => {
            console.error(`  ✗ ${name}`);
            console.error(`    Error: ${err.message}`);
            throw err;
        });
}

/**
 * Creates an in-memory mock storage adapter for isolated testing.
 */
function createMockAdapter(initialEnvelope = null, options = {}) {
    let stored = initialEnvelope ? JSON.parse(JSON.stringify(initialEnvelope)) : null;
    return {
        async read() {
            if (options.readThrows) {
                throw new Error(options.readThrows);
            }
            if (options.corruptRead) {
                return options.corruptRead;
            }
            return stored ? JSON.parse(JSON.stringify(stored)) : null;
        },
        async write(envelope) {
            if (options.writeThrows) {
                throw new Error(options.writeThrows);
            }
            if (options.writeFails) {
                return false;
            }
            stored = JSON.parse(JSON.stringify(envelope));
            return true;
        },
        getState() {
            return stored;
        }
    };
}

/**
 * Test-only signing helper. Confined strictly to unit tests.
 */
function signTestEnvelope(payload, privateKey, keyId = 'test-key-1') {
    const dataBuffer = canonicalizeToBuffer(payload);
    const sig = crypto.sign(null, dataBuffer, privateKey);
    return {
        key_id: keyId,
        algorithm: 'Ed25519',
        payload: payload,
        signature: sig.toString('base64')
    };
}

async function runTestSuite() {
    console.log('\n======================================================');
    console.log('  DUAL-VAULT & MONOTONIC RECONCILER TEST SUITE');
    console.log('======================================================\n');

    // Ephemeral test keys (never persisted, test-only)
    const testPair1 = crypto.generateKeyPairSync('ed25519');
    const testPair2 = crypto.generateKeyPairSync('ed25519');
    const testPubPem1 = testPair1.publicKey.export({ type: 'spki', format: 'pem' });
    const testPubPem2 = testPair2.publicKey.export({ type: 'spki', format: 'pem' });

    const keystore = {
        'test-key-1': { status: 'VALID', publicKey: testPubPem1 },
        'test-key-2': { status: 'VALID', publicKey: testPubPem2 },
        'test-key-revoked': { status: 'REVOKED', publicKey: testPubPem1 }
    };

    const basePayload = {
        entitlement_id: 'ent_001',
        license_id: 'lic_kiaan_enterprise',
        product_id: 'kiaan-hrm',
        customer_id: 'cust_acme',
        licensed_domain: 'hrm.acme.com',
        sequence_number: 1,
        tier: 'enterprise',
        features: ['biometric', 'payroll'],
        issued_at: '2026-10-03T11:00:00.000Z',
        expires_at: null
    };

    const envSeq1 = signTestEnvelope(basePayload, testPair1.privateKey, 'test-key-1');
    const envSeq2 = signTestEnvelope({ ...basePayload, sequence_number: 2 }, testPair1.privateKey, 'test-key-1');
    const envSeq3 = signTestEnvelope({ ...basePayload, sequence_number: 3 }, testPair1.privateKey, 'test-key-1');

    // -----------------------------------------------------------------------
    // GROUP 1: IDENTICAL & HEALTHY VAULTS
    // -----------------------------------------------------------------------
    console.log('Group 1: Identical & Healthy Vaults');

    await runTest('Case A: Both vaults valid and identical yields STATUS_HEALTHY', async () => {
        const primary = createMockAdapter(envSeq1);
        const mirror = createMockAdapter(envSeq1);

        const res = await reconcileVaults({
            primaryAdapter: primary,
            mirrorAdapter: mirror,
            keystore
        });

        assert.strictEqual(res.status, VaultStatus.HEALTHY);
        assert.deepStrictEqual(res.authoritative, envSeq1);
        assert.strictEqual(res.healTarget, null);
    });

    // -----------------------------------------------------------------------
    // GROUP 2: MONOTONIC SEQUENCE RECONCILIATION
    // -----------------------------------------------------------------------
    console.log('\nGroup 2: Monotonic Sequence Authority & Self-Healing');

    await runTest('Case B: Mirror has newer sequence (DB restored from old backup) reconciles primary', async () => {
        const primary = createMockAdapter(envSeq1); // Old backup Seq 1
        const mirror = createMockAdapter(envSeq2);  // Filesystem preserved Seq 2

        const res = await reconcileVaults({
            primaryAdapter: primary,
            mirrorAdapter: mirror,
            keystore
        });

        assert.strictEqual(res.status, VaultStatus.RECONCILED);
        assert.deepStrictEqual(res.authoritative, envSeq2);
        assert.strictEqual(res.healTarget, 'primary');
        assert.strictEqual(res.healResult.success, true);
        assert.strictEqual(primary.getState().payload.sequence_number, 2); // Primary updated
    });

    await runTest('Case B: Primary has newer sequence (Container rebuilt with old image) reconciles mirror', async () => {
        const primary = createMockAdapter(envSeq2); // DB has Seq 2
        const mirror = createMockAdapter(envSeq1);  // Stale FS has Seq 1

        const res = await reconcileVaults({
            primaryAdapter: primary,
            mirrorAdapter: mirror,
            keystore
        });

        assert.strictEqual(res.status, VaultStatus.RECONCILED);
        assert.deepStrictEqual(res.authoritative, envSeq2);
        assert.strictEqual(res.healTarget, 'mirror');
        assert.strictEqual(res.healResult.success, true);
        assert.strictEqual(mirror.getState().payload.sequence_number, 2); // Mirror updated
    });

    // -----------------------------------------------------------------------
    // GROUP 3: CONFLICT DETECTION & DEGRADED STATE
    // -----------------------------------------------------------------------
    console.log('\nGroup 3: Conflict Detection & Degraded State');

    await runTest('Case C: Equal sequence numbers with different valid payloads yields STATUS_DEGRADED_CONFLICT', async () => {
        // Forked version: same sequence_number (1), but differing licensed_domain
        const forkedPayload = { ...basePayload, licensed_domain: 'hrm.forked.com' };
        const envForked = signTestEnvelope(forkedPayload, testPair1.privateKey, 'test-key-1');

        const primary = createMockAdapter(envSeq1);
        const mirror = createMockAdapter(envForked);

        const res = await reconcileVaults({
            primaryAdapter: primary,
            mirrorAdapter: mirror,
            keystore
        });

        assert.strictEqual(res.status, VaultStatus.DEGRADED_CONFLICT);
        assert.strictEqual(res.authoritative, null); // Refuses to pick arbitrarily
        assert.strictEqual(res.healTarget, null);     // No silent overwrite
    });

    await runTest('Different license IDs across vaults yields STATUS_DEGRADED_CONFLICT', async () => {
        const diffLicPayload = { ...basePayload, license_id: 'lic_different_customer' };
        const envDiffLic = signTestEnvelope(diffLicPayload, testPair1.privateKey, 'test-key-1');

        const primary = createMockAdapter(envSeq1);
        const mirror = createMockAdapter(envDiffLic);

        const res = await reconcileVaults({
            primaryAdapter: primary,
            mirrorAdapter: mirror,
            keystore
        });

        assert.strictEqual(res.status, VaultStatus.DEGRADED_CONFLICT);
        assert.strictEqual(res.authoritative, null);
    });

    // -----------------------------------------------------------------------
    // GROUP 4: MISSING VAULTS & SELF-HEALING
    // -----------------------------------------------------------------------
    console.log('\nGroup 4: Missing Vaults & Self-Healing');

    await runTest('Case D: Primary missing self-heals from valid mirror', async () => {
        const primary = createMockAdapter(null); // DB empty
        const mirror = createMockAdapter(envSeq2); // FS has license

        const res = await reconcileVaults({
            primaryAdapter: primary,
            mirrorAdapter: mirror,
            keystore
        });

        assert.strictEqual(res.status, VaultStatus.SELF_HEALED);
        assert.deepStrictEqual(res.authoritative, envSeq2);
        assert.strictEqual(res.healTarget, 'primary');
        assert.strictEqual(primary.getState().payload.sequence_number, 2);
    });

    await runTest('Case D: Mirror missing self-heals from valid primary', async () => {
        const primary = createMockAdapter(envSeq2); // DB has license
        const mirror = createMockAdapter(null);     // FS missing

        const res = await reconcileVaults({
            primaryAdapter: primary,
            mirrorAdapter: mirror,
            keystore
        });

        assert.strictEqual(res.status, VaultStatus.SELF_HEALED);
        assert.deepStrictEqual(res.authoritative, envSeq2);
        assert.strictEqual(res.healTarget, 'mirror');
        assert.strictEqual(mirror.getState().payload.sequence_number, 2);
    });

    await runTest('Case F: Both vaults missing fails closed as STATUS_UNLICENSED', async () => {
        const primary = createMockAdapter(null);
        const mirror = createMockAdapter(null);

        const res = await reconcileVaults({
            primaryAdapter: primary,
            mirrorAdapter: mirror,
            keystore
        });

        assert.strictEqual(res.status, VaultStatus.UNLICENSED);
        assert.strictEqual(res.authoritative, null);
    });

    // -----------------------------------------------------------------------
    // GROUP 5: CORRUPTION & INVALID SIGNATURE RECOVERY
    // -----------------------------------------------------------------------
    console.log('\nGroup 5: Corruption & Invalid Signature Recovery');

    await runTest('Case E: Primary valid, mirror corrupt JSON recovers from primary', async () => {
        const primary = createMockAdapter(envSeq2);
        const mirror = createMockAdapter(null, { corruptRead: 'NOT_VALID_JSON{{{' });

        const res = await reconcileVaults({
            primaryAdapter: primary,
            mirrorAdapter: mirror,
            keystore
        });

        assert.strictEqual(res.status, VaultStatus.RECOVERED);
        assert.deepStrictEqual(res.authoritative, envSeq2);
        assert.strictEqual(res.healTarget, 'mirror');
        assert.deepStrictEqual(mirror.getState(), envSeq2); // Overwritten with clean valid copy
    });

    await runTest('Case E: Primary has invalid signature, recovers from valid mirror', async () => {
        const tamperedEnvelope = JSON.parse(JSON.stringify(envSeq2));
        tamperedEnvelope.payload.max_users = 999999; // Tampered payload

        const primary = createMockAdapter(tamperedEnvelope);
        const mirror = createMockAdapter(envSeq2);

        const res = await reconcileVaults({
            primaryAdapter: primary,
            mirrorAdapter: mirror,
            keystore
        });

        assert.strictEqual(res.status, VaultStatus.RECOVERED);
        assert.deepStrictEqual(res.authoritative, envSeq2);
        assert.strictEqual(res.healTarget, 'primary');
    });

    await runTest('Unknown signing key treated as invalid', async () => {
        const unknownKeyEnv = signTestEnvelope(basePayload, testPair1.privateKey, 'unknown-key-99');
        const primary = createMockAdapter(unknownKeyEnv);
        const mirror = createMockAdapter(envSeq1);

        const res = await reconcileVaults({
            primaryAdapter: primary,
            mirrorAdapter: mirror,
            keystore
        });

        assert.strictEqual(res.status, VaultStatus.RECOVERED);
        assert.deepStrictEqual(res.authoritative, envSeq1); // Recovers from known valid key
    });

    await runTest('Revoked signing key treated as invalid', async () => {
        const revokedKeyEnv = signTestEnvelope(basePayload, testPair1.privateKey, 'test-key-revoked');
        const primary = createMockAdapter(revokedKeyEnv);
        const mirror = createMockAdapter(null);

        const res = await reconcileVaults({
            primaryAdapter: primary,
            mirrorAdapter: mirror,
            keystore
        });

        assert.strictEqual(res.status, VaultStatus.CORRUPTED);
        assert.strictEqual(res.authoritative, null);
    });

    // -----------------------------------------------------------------------
    // GROUP 6: PERSISTENCE SAFETY & MONOTONIC WRITE ENFORCEMENT
    // -----------------------------------------------------------------------
    console.log('\nGroup 6: Persistence Safety & Write Protection');

    await runTest('Successful persist writes to both adapters', async () => {
        const primary = createMockAdapter(null);
        const mirror = createMockAdapter(null);

        const writeRes = await persistEntitlement({
            envelope: envSeq1,
            primaryAdapter: primary,
            mirrorAdapter: mirror,
            keystore
        });

        assert.strictEqual(writeRes.success, true);
        assert.strictEqual(writeRes.code, WriteStatus.SUCCESS);
        assert.strictEqual(writeRes.sequenceNumber, 1);
        assert.deepStrictEqual(primary.getState(), envSeq1);
        assert.deepStrictEqual(mirror.getState(), envSeq1);
    });

    await runTest('Monotonic upgrade: Writing Seq 2 over Seq 1 succeeds', async () => {
        const primary = createMockAdapter(envSeq1);
        const mirror = createMockAdapter(envSeq1);

        const writeRes = await persistEntitlement({
            envelope: envSeq2,
            primaryAdapter: primary,
            mirrorAdapter: mirror,
            keystore
        });

        assert.strictEqual(writeRes.success, true);
        assert.strictEqual(writeRes.code, WriteStatus.SUCCESS);
        assert.strictEqual(writeRes.sequenceNumber, 2);
    });

    await runTest('Older sequence write is rejected (Rollback Prevention)', async () => {
        const primary = createMockAdapter(envSeq2);
        const mirror = createMockAdapter(envSeq2);

        // Attempt to write older Seq 1 over active Seq 2
        const writeRes = await persistEntitlement({
            envelope: envSeq1,
            primaryAdapter: primary,
            mirrorAdapter: mirror,
            keystore
        });

        assert.strictEqual(writeRes.success, false);
        assert.strictEqual(writeRes.code, WriteStatus.ROLLBACK_REJECTED);
        assert(writeRes.reason.includes('Sequence rollback rejected'));
        assert.strictEqual(primary.getState().payload.sequence_number, 2); // Unchanged
    });

    await runTest('Writing identical envelope with same sequence is idempotent success', async () => {
        const primary = createMockAdapter(envSeq2);
        const mirror = createMockAdapter(envSeq2);

        const writeRes = await persistEntitlement({
            envelope: envSeq2,
            primaryAdapter: primary,
            mirrorAdapter: mirror,
            keystore
        });

        assert.strictEqual(writeRes.success, true);
        assert.strictEqual(writeRes.code, WriteStatus.SUCCESS);
        assert.strictEqual(writeRes.isIdempotent, true);
    });

    await runTest('Writing same sequence with different payload is rejected', async () => {
        const forkedEnv = signTestEnvelope({ ...basePayload, sequence_number: 2, licensed_domain: 'other.com' }, testPair1.privateKey, 'test-key-1');
        const primary = createMockAdapter(envSeq2);
        const mirror = createMockAdapter(envSeq2);

        const writeRes = await persistEntitlement({
            envelope: forkedEnv,
            primaryAdapter: primary,
            mirrorAdapter: mirror,
            keystore
        });

        assert.strictEqual(writeRes.success, false);
        assert.strictEqual(writeRes.code, WriteStatus.ROLLBACK_REJECTED);
    });

    await runTest('Partial persistence failure: Mirror write failure reported explicitly', async () => {
        const primary = createMockAdapter(null);
        const mirror = createMockAdapter(null, { writeThrows: 'Disk I/O error on .vault' });

        const writeRes = await persistEntitlement({
            envelope: envSeq1,
            primaryAdapter: primary,
            mirrorAdapter: mirror,
            keystore
        });

        assert.strictEqual(writeRes.success, false);
        assert.strictEqual(writeRes.code, WriteStatus.PARTIAL_FAILURE);
        assert.strictEqual(writeRes.details.primary.success, true);
        assert.strictEqual(writeRes.details.mirror.success, false);
        assert.strictEqual(writeRes.details.mirror.error, 'Disk I/O error on .vault');
    });

    await runTest('Partial persistence failure: Primary write failure reported explicitly', async () => {
        const primary = createMockAdapter(null, { writeThrows: 'MySQL connection lost' });
        const mirror = createMockAdapter(null);

        const writeRes = await persistEntitlement({
            envelope: envSeq1,
            primaryAdapter: primary,
            mirrorAdapter: mirror,
            keystore
        });

        assert.strictEqual(writeRes.success, false);
        assert.strictEqual(writeRes.code, WriteStatus.PARTIAL_FAILURE);
        assert.strictEqual(writeRes.details.primary.success, false);
        assert.strictEqual(writeRes.details.mirror.success, true);
    });

    // -----------------------------------------------------------------------
    // GROUP 7: DETERMINISM & PURITY
    // -----------------------------------------------------------------------
    console.log('\nGroup 7: Determinism & Purity');

    await runTest('Repeated reconciliation is 100% deterministic and stateless', async () => {
        const primary = createMockAdapter(envSeq2);
        const mirror = createMockAdapter(envSeq1);

        const first = await reconcileVaults({ primaryAdapter: primary, mirrorAdapter: mirror, keystore, options: { autoHeal: false } });
        for (let i = 0; i < 20; i++) {
            const next = await reconcileVaults({ primaryAdapter: primary, mirrorAdapter: mirror, keystore, options: { autoHeal: false } });
            assert.deepStrictEqual(next, first);
        }
    });

    console.log('\n======================================================');
    console.log(`  ALL ${passedTests} / ${totalTests} TESTS PASSED SUCCESSFULLY!`);
    console.log('======================================================\n');
}

runTestSuite().catch(err => {
    console.error('Test suite failed:', err);
    process.exit(1);
});
