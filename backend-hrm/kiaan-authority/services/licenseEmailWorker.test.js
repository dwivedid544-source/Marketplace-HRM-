/**
 * Kiaan Central License Authority — Transactional License Email Outbox Worker Tests
 * Module: backend-hrm/kiaan-authority/services/licenseEmailWorker.test.js
 *
 * Comprehensive test suite for Phase 2B.8F:
 * - Group A: Outbox creation & staging with encryption
 * - Group B: Secure storage & authenticated AES-256-GCM envelope
 * - Group C: Worker claiming, concurrency locks, and abandoned lease recovery
 * - Group D: Successful delivery, provider dispatch, and post-send key purging
 * - Group E: Failure handling, sanitized last_error, and deterministic backoff
 * - Group F: Idempotency and zero duplicate generation
 * - Group G: Secret containment and zero secret leakage
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const util = require('util');

const {
    validateEncryptionKey,
    sealOutboxPayload,
    unsealOutboxPayload,
    isSealedPayload,
    sanitizeOutboxError,
    KEY_LENGTH_BYTES
} = require('./outboxCrypto');
const {
    BaseEmailProvider,
    BrevoSmtpEmailProvider,
    MockEmailProvider
} = require('./emailProvider');
const {
    LicenseEmailWorker,
    renderLicenseEmail,
    DEFAULT_LEASE_DURATION_MS,
    DEFAULT_MAX_RETRIES,
    DEFAULT_BASE_BACKOFF_MS
} = require('./licenseEmailWorker');
const { OrderIngestionService } = require('./orderIngestionService');

// High-entropy 32-byte test keys (isolated test-only secrets)
const TEST_ENCRYPTION_KEY = crypto.randomBytes(32);
const TEST_PEPPER = crypto.randomBytes(32).toString('hex');

/**
 * Creates an in-memory mock database conforming to MySQL2 query interface
 * with exact outbox queue and locking semantics.
 */
function createMockOutboxDatabase(initialRows = []) {
    let idCounter = 1;
    const outbox = [];

    for (const r of initialRows) {
        outbox.push({
            id: r.id || idCounter++,
            order_id: r.order_id || 100,
            license_id: r.license_id || 'LIC-2026-TEST-0001',
            recipient_email: r.recipient_email || 'buyer@example.com',
            recipient_name: r.recipient_name || 'Buyer One',
            subject: r.subject || 'Your Software License',
            html_content: r.html_content || '<html>test</html>',
            status: r.status || 'queued',
            retry_count: r.retry_count || 0,
            last_error: r.last_error || null,
            locked_at: r.locked_at ? new Date(r.locked_at) : null,
            sent_at: r.sent_at ? new Date(r.sent_at) : null,
            created_at: r.created_at ? new Date(r.created_at) : new Date(),
            updated_at: r.updated_at ? new Date(r.updated_at) : new Date()
        });
    }

    const db = {
        outbox,
        queryLog: [],

        async query(sql, params = []) {
            const normalizedSql = sql.toLowerCase().replace(/\s+/g, ' ').trim();
            db.queryLog.push({ sql: normalizedSql, params });

            // 1. SELECT candidates query
            if (normalizedSql.includes('from license_email_outbox') && normalizedSql.includes('where (status = \'queued\')')) {
                const [leaseCutoff, maxRetries, backoffCutoff, limit] = params;

                const candidates = outbox.filter(row => {
                    if (row.status === 'queued') return true;
                    if (row.status === 'processing' && (!row.locked_at || row.locked_at < leaseCutoff)) return true;
                    if (row.status === 'failed' && row.retry_count < maxRetries && row.updated_at <= backoffCutoff) return true;
                    return false;
                }).slice(0, limit || 10);

                return [candidates.map(c => ({ ...c }))];
            }

            // 2. Atomic claim UPDATE query
            if (normalizedSql.includes('update license_email_outbox') && normalizedSql.includes('set status = \'processing\'')) {
                const [lockedAt, updatedAt, jobId, leaseCutoff, maxRetries, backoffCutoff] = params;
                const row = outbox.find(r => r.id === Number(jobId));

                if (!row) {
                    return [{ affectedRows: 0 }];
                }

                // Check eligibility condition
                const isQueued = row.status === 'queued';
                const isExpiredLease = row.status === 'processing' && (!row.locked_at || row.locked_at < leaseCutoff);
                const isRetryableFailed = row.status === 'failed' && row.retry_count < maxRetries && row.updated_at <= backoffCutoff;

                if (isQueued || isExpiredLease || isRetryableFailed) {
                    row.status = 'processing';
                    row.locked_at = new Date(lockedAt);
                    row.updated_at = new Date(updatedAt);
                    return [{ affectedRows: 1 }];
                }

                return [{ affectedRows: 0 }];
            }

            // 3. SELECT single row by id
            if (normalizedSql.includes('from license_email_outbox') && normalizedSql.includes('where id = ?')) {
                const [jobId] = params;
                const row = outbox.find(r => r.id === Number(jobId));
                return [row ? [{ ...row }] : []];
            }

            // 4. UPDATE on successful delivery (sent)
            if (normalizedSql.includes('update license_email_outbox') && normalizedSql.includes('set status = \'sent\'')) {
                const [sentAt, updatedAt, jobId] = params;
                const row = outbox.find(r => r.id === Number(jobId));
                if (row) {
                    row.status = 'sent';
                    row.sent_at = new Date(sentAt);
                    row.last_error = null;
                    row.locked_at = null;
                    row.html_content = '[DELIVERED_AND_PURGED]';
                    row.updated_at = new Date(updatedAt);
                    return [{ affectedRows: 1 }];
                }
                return [{ affectedRows: 0 }];
            }

            // 5. UPDATE on failure
            if (normalizedSql.includes('update license_email_outbox') && normalizedSql.includes('set status = \'failed\'')) {
                const [retryCount, safeError, updatedAt, jobId] = params;
                const row = outbox.find(r => r.id === Number(jobId));
                if (row) {
                    row.status = 'failed';
                    row.retry_count = retryCount;
                    row.last_error = safeError;
                    row.locked_at = null;
                    row.updated_at = new Date(updatedAt);
                    return [{ affectedRows: 1 }];
                }
                return [{ affectedRows: 0 }];
            }

            return [[]];
        }
    };

    return db;
}

// ==============================================================================
// GROUP A: OUTBOX CREATION & STAGING
// ==============================================================================

test('A1. OrderIngestionService stages AES-256-GCM sealed outbox record when encryption key configured', async () => {
    // Setup mock database for order ingestion
    const orders = [];
    const licenses = [];
    const outbox = [];
    let idGen = 1;

    const mockDb = {
        async query(sql, params) {
            const n = sql.toLowerCase().replace(/\s+/g, ' ');
            if (n.includes('select') && n.includes('marketplace_products')) {
                return [[{ product_id: 'kiaan-hrm', product_name: 'Kiaan HRM Pro', is_active: 1 }]];
            }
            if (n.includes('select') && n.includes('marketplace_sales_channels')) {
                return [[{ channel_id: 'kiaan_direct', is_active: 1 }]];
            }
            if (n.includes('select') && n.includes('marketplace_editions')) {
                return [[{
                    edition_code: 'full_source',
                    sku: 'KHRM-SRC-LIFETIME',
                    edition_name: 'Kiaan HRM Pro — Full Source Edition',
                    product_id: 'kiaan-hrm',
                    has_backend_source: 1,
                    has_extended_features: 0,
                    default_entitlements: '{}',
                    is_active: 1
                }]];
            }
            if (n.includes('insert into marketplace_orders')) {
                orders.push({ id: idGen++, sku: params[6] });
                return [{ insertId: orders[orders.length - 1].id, affectedRows: 1 }];
            }
            if (n.includes('insert into marketplace_licenses')) {
                licenses.push({ id: idGen++, license_id: params[0] });
                return [{ insertId: licenses[licenses.length - 1].id, affectedRows: 1 }];
            }
            if (n.includes('insert into license_email_outbox')) {
                outbox.push({
                    id: idGen++,
                    order_id: params[0],
                    license_id: params[1],
                    recipient_email: params[2],
                    recipient_name: params[3],
                    subject: params[4],
                    html_content: params[5],
                    status: 'queued'
                });
                return [{ insertId: outbox[outbox.length - 1].id, affectedRows: 1 }];
            }
            return [[]];
        },
        async getConnection() {
            return {
                query: this.query.bind(this),
                beginTransaction: async () => {},
                commit: async () => {},
                rollback: async () => {},
                release: () => {}
            };
        }
    };

    const ingestionService = new OrderIngestionService({
        db: mockDb,
        pepper: TEST_PEPPER,
        outboxEncryptionKey: TEST_ENCRYPTION_KEY
    });

    const result = await ingestionService.ingestOrder({
        salesChannelId: 'kiaan_direct',
        channelOrderId: 'order_enc_test_01',
        buyerEmail: 'client@kiaan.com',
        buyerName: 'Kiaan Enterprise Client',
        productId: 'kiaan-hrm',
        editionCode: 'full_source',
        sku: 'KHRM-SRC-LIFETIME',
        quantity: 1,
        paymentStatus: 'PAID',
        paymentReference: 'pay_ref_enc_01'
    });

    assert.strictEqual(result.licenses.length, 1);
    assert.strictEqual(outbox.length, 1);

    const stagedRow = outbox[0];
    assert.strictEqual(stagedRow.recipient_email, 'client@kiaan.com');
    assert.strictEqual(stagedRow.status, 'queued');

    // Verify content is sealed envelope JSON
    assert.strictEqual(isSealedPayload(stagedRow.html_content), true);

    // Verify plaintext license key is NOT present anywhere in html_content
    const plaintextKey = result.licenses[0].licenseKey;
    assert.strictEqual(stagedRow.html_content.includes(plaintextKey), false);

    // Unseal and verify accurate payload recovery
    const unsealed = unsealOutboxPayload(stagedRow.html_content, TEST_ENCRYPTION_KEY);
    assert.strictEqual(unsealed.isSealed, true);
    assert.strictEqual(unsealed.payload.licenseKey, plaintextKey);
    assert.strictEqual(unsealed.payload.buyerName, 'Kiaan Enterprise Client');
});

// ==============================================================================
// GROUP B: SECURE STORAGE & CRYPTOGRAPHIC ENVELOPE
// ==============================================================================

test('B1. AES-256-GCM encryption creates unique random IV per record', () => {
    const payload = {
        licenseKey: '4f7a9c8b1e2d3f4a5b6c7d8e9f0a1b2c3d4e5f6a',
        buyerName: 'Alice',
        orderNumber: 'ORD-2026-0001'
    };

    const sealed1 = JSON.parse(sealOutboxPayload(payload, TEST_ENCRYPTION_KEY));
    const sealed2 = JSON.parse(sealOutboxPayload(payload, TEST_ENCRYPTION_KEY));

    assert.notStrictEqual(sealed1.iv, sealed2.iv, 'Two encryptions must have distinct random IVs');
    assert.notStrictEqual(sealed1.ciphertext, sealed2.ciphertext, 'Ciphertexts must differ due to unique IV');
    assert.strictEqual(sealed1.algorithm, 'aes-256-gcm');
});

test('B2. Correct encryption key cleanly decrypts payload; wrong key fails authentication', () => {
    const payload = {
        licenseKey: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0',
        editionName: 'Kiaan HRM Pro'
    };

    const sealedStr = sealOutboxPayload(payload, TEST_ENCRYPTION_KEY);

    // Success with matching key
    const decrypted = unsealOutboxPayload(sealedStr, TEST_ENCRYPTION_KEY);
    assert.strictEqual(decrypted.isSealed, true);
    assert.strictEqual(decrypted.payload.licenseKey, payload.licenseKey);

    // Fails with wrong key
    const wrongKey = crypto.randomBytes(32);
    assert.throws(
        () => unsealOutboxPayload(sealedStr, wrongKey),
        err => err.code === 'PAYLOAD_AUTHENTICATION_FAILED'
    );
});

test('B3. Tampering with ciphertext or authentication tag fails closed', () => {
    const payload = { licenseKey: '11223344556677889900aabbccddeeff00112233' };
    const sealed = JSON.parse(sealOutboxPayload(payload, TEST_ENCRYPTION_KEY));

    // Tamper ciphertext
    const tamperedCipher = { ...sealed };
    const cChars = tamperedCipher.ciphertext.split('');
    cChars[0] = cChars[0] === 'a' ? 'b' : 'a';
    tamperedCipher.ciphertext = cChars.join('');

    assert.throws(
        () => unsealOutboxPayload(JSON.stringify(tamperedCipher), TEST_ENCRYPTION_KEY),
        err => err.code === 'PAYLOAD_AUTHENTICATION_FAILED'
    );

    // Tamper auth tag
    const tamperedTag = { ...sealed };
    const tChars = tamperedTag.tag.split('');
    tChars[0] = tChars[0] === 'f' ? '0' : 'f';
    tamperedTag.tag = tChars.join('');

    assert.throws(
        () => unsealOutboxPayload(JSON.stringify(tamperedTag), TEST_ENCRYPTION_KEY),
        err => err.code === 'PAYLOAD_AUTHENTICATION_FAILED'
    );
});

test('B4. Weak, short, or trivial encryption keys are strictly rejected', () => {
    // Missing key
    assert.throws(
        () => validateEncryptionKey(null),
        err => err.code === 'CONFIG_MISSING_ENCRYPTION_KEY'
    );

    // Short key (< 32 bytes)
    assert.throws(
        () => validateEncryptionKey('short_key_16_byte'),
        err => err.code === 'CONFIG_WEAK_ENCRYPTION_KEY'
    );

    // Trivial key (all zeros)
    const zeroKey = Buffer.alloc(32, 0);
    assert.throws(
        () => validateEncryptionKey(zeroKey),
        err => err.code === 'CONFIG_TRIVIAL_ENCRYPTION_KEY'
    );
});

// ==============================================================================
// GROUP C: WORKER CLAIMING & LEASE CONCURRENCY
// ==============================================================================

test('C1. Worker atomically claims eligible queued job', async () => {
    const db = createMockOutboxDatabase([
        { id: 1, status: 'queued', recipient_email: 'test@kiaan.com' }
    ]);
    const mockEmail = new MockEmailProvider();
    const worker = new LicenseEmailWorker({
        db,
        emailProvider: mockEmail,
        encryptionKey: TEST_ENCRYPTION_KEY
    });

    const claimed = await worker.claimJob(1);
    assert.strictEqual(claimed, true);

    const row = db.outbox.find(r => r.id === 1);
    assert.strictEqual(row.status, 'processing');
    assert.ok(row.locked_at instanceof Date);
});

test('C2. Concurrent workers cannot simultaneously claim the same job', async () => {
    const db = createMockOutboxDatabase([
        { id: 1, status: 'queued', recipient_email: 'race@kiaan.com' }
    ]);
    const mockEmail = new MockEmailProvider();
    const worker1 = new LicenseEmailWorker({ db, emailProvider: mockEmail, encryptionKey: TEST_ENCRYPTION_KEY });
    const worker2 = new LicenseEmailWorker({ db, emailProvider: mockEmail, encryptionKey: TEST_ENCRYPTION_KEY });

    // Worker 1 claims first
    const claim1 = await worker1.claimJob(1);
    assert.strictEqual(claim1, true);

    // Worker 2 attempts to claim while locked
    const claim2 = await worker2.claimJob(1);
    assert.strictEqual(claim2, false, 'Second worker must be prevented from claiming an already locked job');
});

test('C3. Abandoned lease is safely reclaimed after lease duration expires', async () => {
    // Staged row locked 10 minutes ago (lease duration = 5 mins)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const db = createMockOutboxDatabase([
        { id: 1, status: 'processing', locked_at: tenMinutesAgo, recipient_email: 'abandoned@kiaan.com' }
    ]);
    const mockEmail = new MockEmailProvider();
    const worker = new LicenseEmailWorker({
        db,
        emailProvider: mockEmail,
        encryptionKey: TEST_ENCRYPTION_KEY,
        leaseDurationMs: 5 * 60 * 1000
    });

    // Abandoned job is eligible and can be reclaimed
    const claimed = await worker.claimJob(1);
    assert.strictEqual(claimed, true, 'Worker should reclaim job whose lease expired');

    const row = db.outbox.find(r => r.id === 1);
    assert.strictEqual(row.status, 'processing');
    // Lock timestamp refreshed to current time
    assert.ok(row.locked_at.getTime() > tenMinutesAgo.getTime());
});

test('C4. Active lease within timeout cannot be claimed by another worker', async () => {
    // Staged row locked 1 minute ago (lease duration = 5 mins)
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    const db = createMockOutboxDatabase([
        { id: 1, status: 'processing', locked_at: oneMinuteAgo, recipient_email: 'active@kiaan.com' }
    ]);
    const mockEmail = new MockEmailProvider();
    const worker = new LicenseEmailWorker({
        db,
        emailProvider: mockEmail,
        encryptionKey: TEST_ENCRYPTION_KEY,
        leaseDurationMs: 5 * 60 * 1000
    });

    const claimed = await worker.claimJob(1);
    assert.strictEqual(claimed, false, 'Worker must NOT claim a job with an active, unexpired lease');
});

// ==============================================================================
// GROUP D: SUCCESSFUL DELIVERY & KEY PURGING
// ==============================================================================

test('D1. Worker delivers email via provider, updates status to SENT, and purges key from storage', async () => {
    const rawPayload = {
        licenseKey: '9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d',
        keyHint: '9E8D...1E0D',
        buyerName: 'Enterprise Client',
        orderNumber: 'ORD-2026-DELIVERY-01',
        editionName: 'Kiaan HRM Pro — Extended Edition',
        sku: 'KHRM-EXT-LIFETIME',
        unitIndex: 1,
        totalUnits: 1
    };

    const sealedContent = sealOutboxPayload(rawPayload, TEST_ENCRYPTION_KEY);

    const db = createMockOutboxDatabase([
        {
            id: 42,
            order_id: 101,
            license_id: 'LIC-2026-EXT-9E8D7C6B',
            recipient_email: 'buyer@enterprise.com',
            recipient_name: 'Enterprise Client',
            subject: 'Your Kiaan HRM Pro License',
            html_content: sealedContent,
            status: 'queued'
        }
    ]);

    const mockEmail = new MockEmailProvider();
    const worker = new LicenseEmailWorker({
        db,
        emailProvider: mockEmail,
        encryptionKey: TEST_ENCRYPTION_KEY
    });

    const result = await worker.processJob(42);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.claimed, true);

    // Verify email was dispatched to mock provider
    assert.strictEqual(mockEmail.sentEmails.length, 1);
    const sent = mockEmail.sentEmails[0];
    assert.strictEqual(sent.to, 'buyer@enterprise.com');
    assert.strictEqual(sent.toName, 'Enterprise Client');
    assert.strictEqual(sent.html.includes(rawPayload.licenseKey), true, 'Dispatched email HTML must contain license key');
    assert.strictEqual(sent.text.includes(rawPayload.licenseKey), true, 'Dispatched plain text must contain license key');
    assert.strictEqual(sent.html.includes('Kiaan HRM Pro'), true);

    // Verify database row state: SENT, sent_at set, last_error null
    const row = db.outbox.find(r => r.id === 42);
    assert.strictEqual(row.status, 'sent');
    assert.ok(row.sent_at instanceof Date);
    assert.strictEqual(row.last_error, null);
    assert.strictEqual(row.locked_at, null);

    // CRITICAL: Plaintext/sealed key purged from persistent storage after delivery
    assert.strictEqual(row.html_content, '[DELIVERED_AND_PURGED]');
    assert.strictEqual(row.html_content.includes(rawPayload.licenseKey), false);
});

// ==============================================================================
// GROUP E: FAILURE, SANITIZED LAST_ERROR, & EXPONENTIAL BACKOFF
// ==============================================================================

test('E1. Provider dispatch failure increments retry count and sets sanitized last_error', async () => {
    const rawPayload = {
        licenseKey: 'secret_key_4f7a9c8b1e2d3f4a5b6c7d8e9f0a1b2c3d4e5f6a',
        buyerName: 'Failing Buyer'
    };
    const sealedContent = sealOutboxPayload(rawPayload, TEST_ENCRYPTION_KEY);

    const db = createMockOutboxDatabase([
        {
            id: 55,
            recipient_email: 'fail@example.com',
            html_content: sealedContent,
            status: 'queued',
            retry_count: 0
        }
    ]);

    const mockEmail = new MockEmailProvider();
    // Simulate provider failure containing a sensitive token or key in error
    mockEmail.failNext(new Error('Brevo 503 Service Unavailable: error key 4f7a9c8b1e2d3f4a5b6c7d8e9f0a1b2c3d4e5f6a Bearer xkeysib-12345'));

    const worker = new LicenseEmailWorker({
        db,
        emailProvider: mockEmail,
        encryptionKey: TEST_ENCRYPTION_KEY
    });

    const result = await worker.processJob(55);
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.retryCount, 1);

    const row = db.outbox.find(r => r.id === 55);
    assert.strictEqual(row.status, 'failed');
    assert.strictEqual(row.retry_count, 1);
    assert.strictEqual(row.locked_at, null, 'Lease must be released on failure');

    // Verify error is sanitized — zero keys or tokens
    assert.strictEqual(row.last_error.includes('4f7a9c8b1e2d3f4a5b6c7d8e9f0a1b2c3d4e5f6a'), false);
    assert.strictEqual(row.last_error.includes('xkeysib-12345'), false);
    assert.strictEqual(row.last_error.includes('[REDACTED_LICENSE_KEY]'), true);
});

test('E2. Deterministic backoff: Failed job is not claimed until backoff window elapses', async () => {
    // Just failed 10 seconds ago (base backoff is 60s)
    const tenSecondsAgo = new Date(Date.now() - 10 * 1000);
    const db = createMockOutboxDatabase([
        {
            id: 77,
            status: 'failed',
            retry_count: 1,
            updated_at: tenSecondsAgo,
            html_content: '<html>retry test</html>'
        }
    ]);

    const mockEmail = new MockEmailProvider();
    const worker = new LicenseEmailWorker({
        db,
        emailProvider: mockEmail,
        baseBackoffMs: 60 * 1000
    });

    // Should NOT be claimed because 10s < 60s backoff
    const claimed = await worker.claimJob(77);
    assert.strictEqual(claimed, false, 'Failed job must not be retried before backoff window');

    // Simulate time elapsed: 70 seconds ago (> 60s backoff)
    const seventySecondsAgo = new Date(Date.now() - 70 * 1000);
    db.outbox[0].updated_at = seventySecondsAgo;

    // Should now be claimable
    const claimedAfterBackoff = await worker.claimJob(77);
    assert.strictEqual(claimedAfterBackoff, true, 'Failed job must become claimable after backoff passes');
});

test('E3. Job exceeding maxRetries remains permanently failed and is not claimed', async () => {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const db = createMockOutboxDatabase([
        {
            id: 88,
            status: 'failed',
            retry_count: DEFAULT_MAX_RETRIES, // Max retries exhausted
            updated_at: tenMinutesAgo,
            html_content: '<html>exhausted</html>'
        }
    ]);

    const mockEmail = new MockEmailProvider();
    const worker = new LicenseEmailWorker({
        db,
        emailProvider: mockEmail,
        maxRetries: DEFAULT_MAX_RETRIES
    });

    const claimed = await worker.claimJob(88);
    assert.strictEqual(claimed, false, 'Job exceeding max retries must NOT be claimed');

    const candidates = await worker.fetchEligibleCandidates();
    assert.strictEqual(candidates.length, 0, 'Exhausted job must not appear in eligible candidate list');
});

// ==============================================================================
// GROUP F: IDEMPOTENCY & ZERO DUPLICATE GENERATION
// ==============================================================================

test('F1. Already SENT job is never processed again', async () => {
    const db = createMockOutboxDatabase([
        {
            id: 99,
            status: 'sent',
            sent_at: new Date(),
            html_content: '[DELIVERED_AND_PURGED]'
        }
    ]);

    const mockEmail = new MockEmailProvider();
    const worker = new LicenseEmailWorker({ db, emailProvider: mockEmail });

    const claimed = await worker.claimJob(99);
    assert.strictEqual(claimed, false, 'Already SENT job must never be claimed');

    const batch = await worker.processBatch();
    assert.strictEqual(batch.totalFound, 0);
    assert.strictEqual(mockEmail.sentEmails.length, 0);
});

test('F2. Worker retries never create duplicate outbox rows or licenses', async () => {
    const rawPayload = { licenseKey: 'test_key_for_idempotency', buyerName: 'Idempotent Buyer' };
    const sealedContent = sealOutboxPayload(rawPayload, TEST_ENCRYPTION_KEY);

    const db = createMockOutboxDatabase([
        { id: 101, status: 'queued', html_content: sealedContent, recipient_email: 'idem@test.com' }
    ]);

    const mockEmail = new MockEmailProvider();
    // First attempt fails
    mockEmail.failNext(new Error('Temporary network drop'));

    const worker = new LicenseEmailWorker({
        db,
        emailProvider: mockEmail,
        encryptionKey: TEST_ENCRYPTION_KEY,
        baseBackoffMs: 0 // zero backoff for instant retry in test
    });

    // Attempt 1 -> Failure
    const res1 = await worker.processJob(101);
    assert.strictEqual(res1.success, false);
    assert.strictEqual(db.outbox.length, 1, 'Retry must not insert a new outbox row');

    // Simulate backoff interval elapsed
    db.outbox[0].updated_at = new Date(Date.now() - 1000);

    // Attempt 2 -> Success
    const res2 = await worker.processJob(101);
    assert.strictEqual(res2.success, true);
    assert.strictEqual(db.outbox.length, 1, 'Total outbox rows must remain exactly 1');
    assert.strictEqual(mockEmail.sentEmails.length, 1, 'Exactly one email sent on successful attempt');
});

// ==============================================================================
// GROUP G: SECRET CONTAINMENT & ZERO SECRET LEAKAGE
// ==============================================================================

test('G1. Worker inspection and serialization never leak encryption key or secrets', () => {
    const worker = new LicenseEmailWorker({
        db: { query: async () => [[]] },
        encryptionKey: TEST_ENCRYPTION_KEY
    });

    const inspected = util.inspect(worker);
    assert.strictEqual(inspected.includes(TEST_ENCRYPTION_KEY.toString('hex')), false);
    assert.strictEqual(inspected.includes('hasEncryptionKey: true'), true);

    const json = JSON.stringify(worker);
    assert.strictEqual(json.includes(TEST_ENCRYPTION_KEY.toString('hex')), false);
});

test('G2. Logger safety: Plaintext license keys, peppers, and tokens never passed to logger', async () => {
    const loggedMessages = [];
    const safeLogger = {
        info: (msg) => loggedMessages.push(msg),
        warn: (msg) => loggedMessages.push(msg),
        error: (msg, detail) => loggedMessages.push(`${msg} ${detail || ''}`)
    };

    const rawPayload = {
        licenseKey: '4f7a9c8b1e2d3f4a5b6c7d8e9f0a1b2c3d4e5f6a',
        buyerName: 'Logged Buyer'
    };
    const sealedContent = sealOutboxPayload(rawPayload, TEST_ENCRYPTION_KEY);

    const db = createMockOutboxDatabase([
        { id: 202, status: 'queued', html_content: sealedContent, recipient_email: 'log@test.com' }
    ]);

    const mockEmail = new MockEmailProvider();
    mockEmail.failNext(new Error('Delivery error with key 4f7a9c8b1e2d3f4a5b6c7d8e9f0a1b2c3d4e5f6a and token xkeysib-sec123'));

    const worker = new LicenseEmailWorker({
        db,
        emailProvider: mockEmail,
        encryptionKey: TEST_ENCRYPTION_KEY,
        logger: safeLogger
    });

    await worker.processJob(202);

    for (const log of loggedMessages) {
        assert.strictEqual(log.includes('4f7a9c8b1e2d3f4a5b6c7d8e9f0a1b2c3d4e5f6a'), false);
        assert.strictEqual(log.includes('xkeysib-sec123'), false);
    }
});

test('G3. renderLicenseEmail generates compliant professional content without legal overreach', () => {
    const rendered = renderLicenseEmail({
        buyerName: 'Corporate Tech',
        orderNumber: 'ORD-2026-TEST',
        editionName: 'Kiaan HRM Pro — Full Source Edition',
        sku: 'KHRM-SRC-LIFETIME',
        licenseKey: '11223344556677889900aabbccddeeff00112233',
        keyHint: '1122...2233',
        unitIndex: 1,
        totalUnits: 1
    });

    assert.strictEqual(rendered.subject, 'Your Kiaan HRM Pro — Full Source Edition Software License [KHRM-SRC-LIFETIME]');
    assert.strictEqual(rendered.html.includes('Kiaan HRM Pro'), true);
    assert.strictEqual(rendered.html.includes('11223344556677889900aabbccddeeff00112233'), true);
    assert.strictEqual(rendered.html.includes('Domain Binding'), true);
    assert.strictEqual(rendered.html.includes('Perpetual License Scope'), true);
    assert.strictEqual(rendered.html.includes('support@kiaantechnology.com'), true);

    // Text alternative has matching details
    assert.strictEqual(rendered.text.includes('11223344556677889900aabbccddeeff00112233'), true);
    assert.strictEqual(rendered.text.includes('ORD-2026-TEST'), true);
});
