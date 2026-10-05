/**
 * Kiaan Central License Authority — Order Ingestion & Issuance Service Unit Tests
 * Module: backend-hrm/kiaan-authority/services/orderIngestionService.test.js
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { OrderIngestionService } = require('./orderIngestionService');
const { CanonicalOrderDTO } = require('../core/orderDto');
const keyGenerator = require('../core/keyGenerator');

// High-entropy test pepper (minimum 32 bytes)
const TEST_PEPPER = 'test_high_entropy_authority_pepper_64_bytes_secure_value_abc1234567890';

/**
 * Creates an in-memory transactional mock MySQL database.
 * Accurately simulates table registries, row-locking, transactions, and unique constraints.
 */
function createMockDatabase() {
    // Authoritative Registries
    const products = new Map([
        ['kiaan-hrm', { product_id: 'kiaan-hrm', product_name: 'Kiaan HRM Pro', is_active: 1 }]
    ]);

    const editions = new Map([
        ['KHRM-DIST-LIFETIME', {
            product_id: 'kiaan-hrm',
            edition_code: 'ui_dist',
            sku: 'KHRM-DIST-LIFETIME',
            edition_name: 'Kiaan HRM Pro — UI / Dist Edition',
            has_backend_source: 0,
            has_extended_features: 0,
            default_entitlements: JSON.stringify({ edition_code: 'ui_dist', max_employees: 50, features: ['EMPLOYEE_PORTAL'] }),
            is_active: 1
        }],
        ['KHRM-SRC-LIFETIME', {
            product_id: 'kiaan-hrm',
            edition_code: 'full_source',
            sku: 'KHRM-SRC-LIFETIME',
            edition_name: 'Kiaan HRM Pro — Full Source Code Edition',
            has_backend_source: 1,
            has_extended_features: 0,
            default_entitlements: JSON.stringify({ edition_code: 'full_source', max_employees: 1000, features: ['ATTENDANCE', 'PAYROLL'] }),
            is_active: 1
        }],
        ['KHRM-EXT-LIFETIME', {
            product_id: 'kiaan-hrm',
            edition_code: 'extended',
            sku: 'KHRM-EXT-LIFETIME',
            edition_name: 'Kiaan HRM Pro — Extended Edition',
            has_backend_source: 1,
            has_extended_features: 1,
            default_entitlements: JSON.stringify({ edition_code: 'extended', max_employees: 10000, features: ['ATTENDANCE', 'PAYROLL', 'BIOMETRIC'] }),
            is_active: 1
        }]
    ]);

    const channels = new Map([
        ['kiaan_direct', { channel_id: 'kiaan_direct', channel_name: 'Kiaan Direct Storefront', is_active: 1 }],
        ['codecanyon', { channel_id: 'codecanyon', channel_name: 'Envato / CodeCanyon', is_active: 1 }],
        ['appsumo', { channel_id: 'appsumo', channel_name: 'AppSumo Deal Platform', is_active: 1 }],
        ['manual_b2b', { channel_id: 'manual_b2b', channel_name: 'Manual B2B Corporate Orders', is_active: 1 }]
    ]);

    // Data tables
    const orders = [];
    const licenses = [];
    const outbox = [];
    const activations = [];

    let orderIdCounter = 1;
    let licenseIdCounter = 1;
    let outboxIdCounter = 1;

    // Concurrency lock simulation
    const lockedKeys = new Set();

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

    return {
        products,
        editions,
        channels,
        orders,
        licenses,
        outbox,
        activations,

        // Flag to simulate injection of database query errors
        failQueryOnMatch: null,

        getConnection: async function () {
            const self = this;
            let inTransaction = false;
            let stagedOrders = [];
            let stagedLicenses = [];
            let stagedOutbox = [];
            let heldLockReleaseFns = [];

            function releaseAllLocks() {
                for (const fn of heldLockReleaseFns) {
                    try { fn(); } catch (_) {}
                }
                heldLockReleaseFns = [];
            }

            return {
                beginTransaction: async function () {
                    inTransaction = true;
                    stagedOrders = [];
                    stagedLicenses = [];
                    stagedOutbox = [];
                },

                commit: async function () {
                    if (inTransaction) {
                        for (const o of stagedOrders) orders.push(o);
                        for (const l of stagedLicenses) licenses.push(l);
                        for (const m of stagedOutbox) outbox.push(m);
                        stagedOrders = [];
                        stagedLicenses = [];
                        stagedOutbox = [];
                        inTransaction = false;
                    }
                    releaseAllLocks();
                },

                rollback: async function () {
                    stagedOrders = [];
                    stagedLicenses = [];
                    stagedOutbox = [];
                    inTransaction = false;
                    releaseAllLocks();
                },

                release: function () {
                    releaseAllLocks();
                },

                query: async function (sql, params = []) {
                    const normalizedSql = sql.replace(/\s+/g, ' ').trim().toLowerCase();

                    if (self.failQueryOnMatch && normalizedSql.includes(self.failQueryOnMatch.toLowerCase())) {
                        const err = new Error(`Simulated DB failure on: ${self.failQueryOnMatch}`);
                        err.code = 'SIMULATED_DB_ERROR';
                        throw err;
                    }

                    // 1. SELECT marketplace_orders FOR UPDATE
                    if (normalizedSql.includes('from marketplace_orders where sales_channel_id = ? and channel_order_id = ?')) {
                        const [chId, chOrdId] = params;
                        const lockKey = `${chId}:${chOrdId}`;

                        if (normalizedSql.includes('for update')) {
                            const releaseFn = await acquireLock(lockKey);
                            heldLockReleaseFns.push(releaseFn);
                        }

                        const allOrders = [...orders, ...stagedOrders];
                        const found = allOrders.filter(o => o.sales_channel_id === chId && o.channel_order_id === chOrdId);
                        return [found];
                    }

                    // 2. SELECT marketplace_products
                    if (normalizedSql.includes('from marketplace_products where product_id = ?')) {
                        const [pId] = params;
                        const p = self.products.get(pId);
                        return [p ? [p] : []];
                    }

                    // 3. SELECT marketplace_editions
                    if (normalizedSql.includes('from marketplace_editions where sku = ?')) {
                        const [sku] = params;
                        const ed = self.editions.get(sku);
                        return [ed ? [ed] : []];
                    }

                    // 4. SELECT marketplace_sales_channels
                    if (normalizedSql.includes('from marketplace_sales_channels where channel_id = ?')) {
                        const [chId] = params;
                        const ch = self.channels.get(chId);
                        return [ch ? [ch] : []];
                    }

                    // 5. SELECT marketplace_licenses WHERE order_id = ?
                    if (normalizedSql.includes('from marketplace_licenses where order_id = ?')) {
                        const [oId] = params;
                        const allLicenses = [...licenses, ...stagedLicenses];
                        const found = allLicenses.filter(l => l.order_id === oId);
                        return [found];
                    }

                    // 6. INSERT INTO marketplace_orders
                    if (normalizedSql.includes('insert into marketplace_orders')) {
                        const [
                            order_number, sales_channel_id, channel_order_id,
                            buyer_name, buyer_email, buyer_phone,
                            sku, quantity, unit_price, total_price, currency,
                            payment_status, payment_reference, raw_payload
                        ] = params;

                        // Check unique constraint unq_channel_order (sales_channel_id, channel_order_id)
                        const allOrders = [...orders, ...stagedOrders];
                        if (allOrders.some(o => o.sales_channel_id === sales_channel_id && o.channel_order_id === channel_order_id)) {
                            const err = new Error(`ER_DUP_ENTRY: Duplicate entry '${sales_channel_id}-${channel_order_id}' for key 'unq_channel_order'`);
                            err.code = 'ER_DUP_ENTRY';
                            throw err;
                        }

                        const newOrder = {
                            id: orderIdCounter++,
                            order_number, sales_channel_id, channel_order_id,
                            buyer_name, buyer_email, buyer_phone,
                            sku, quantity, unit_price, total_price, currency,
                            payment_status, payment_reference, raw_payload,
                            created_at: new Date()
                        };

                        if (inTransaction) {
                            stagedOrders.push(newOrder);
                        } else {
                            orders.push(newOrder);
                        }

                        return [{ insertId: newOrder.id, affectedRows: 1 }];
                    }

                    // 7. INSERT INTO marketplace_licenses
                    if (normalizedSql.includes('insert into marketplace_licenses')) {
                        const [
                            license_id, order_id, product_id, edition_code, sku,
                            license_key_hash, key_hint, buyer_name, buyer_email, entitlements
                        ] = params;

                        const newLicense = {
                            id: licenseIdCounter++,
                            license_id, order_id, product_id, edition_code, sku,
                            license_key_hash, key_hint, status: 'ISSUED', bound_domain: null,
                            sequence_number: 1, buyer_name, buyer_email, entitlements,
                            created_at: new Date()
                        };

                        if (inTransaction) {
                            stagedLicenses.push(newLicense);
                        } else {
                            licenses.push(newLicense);
                        }

                        return [{ insertId: newLicense.id, affectedRows: 1 }];
                    }

                    // 8. INSERT INTO license_email_outbox
                    if (normalizedSql.includes('insert into license_email_outbox')) {
                        const [
                            order_id, license_id, recipient_email, recipient_name,
                            subject, html_content, status
                        ] = params;

                        const newOutbox = {
                            id: outboxIdCounter++,
                            order_id, license_id, recipient_email, recipient_name,
                            subject, html_content, status: status || 'queued',
                            created_at: new Date()
                        };

                        if (inTransaction) {
                            stagedOutbox.push(newOutbox);
                        } else {
                            outbox.push(newOutbox);
                        }

                        return [{ insertId: newOutbox.id, affectedRows: 1 }];
                    }

                    throw new Error(`Unmocked SQL in test: ${sql}`);
                }
            };
        }
    };
}

// ─── Tests ───

test('11. Quantity 1: Single unit issuance', async () => {
    const db = createMockDatabase();
    const service = new OrderIngestionService({ db, pepper: TEST_PEPPER });

    const result = await service.ingestOrder({
        salesChannelId: 'kiaan_direct',
        channelOrderId: 'ord_unit_1',
        buyerName: 'Alice Smith',
        buyerEmail: 'alice@example.com',
        productId: 'kiaan-hrm',
        editionCode: 'full_source',
        sku: 'KHRM-SRC-LIFETIME',
        quantity: 1,
        currency: 'USD',
        paymentStatus: 'PAID',
        paymentReference: 'ref_111'
    });

    assert.strictEqual(result.isReplay, false);
    assert.strictEqual(result.quantity, 1);
    assert.strictEqual(result.licenses.length, 1);
    assert.strictEqual(result.licenses[0].status, 'ISSUED');
    assert.strictEqual(result.licenses[0].sequenceNumber, 1);
    assert.strictEqual(typeof result.licenses[0].licenseKey, 'string');
    assert.match(result.licenses[0].licenseKey, /^KHRM-[0-9A-HJ-NP-Z]{4}-/);

    // Verify DB records
    assert.strictEqual(db.orders.length, 1);
    assert.strictEqual(db.licenses.length, 1);
    assert.strictEqual(db.outbox.length, 1);
    assert.strictEqual(db.licenses[0].bound_domain, null);
});

test('12. Quantity 3: Exactly 3 unique licenses produced', async () => {
    const db = createMockDatabase();
    const service = new OrderIngestionService({ db, pepper: TEST_PEPPER });

    const result = await service.ingestOrder({
        salesChannelId: 'kiaan_direct',
        channelOrderId: 'ord_unit_3',
        buyerName: 'Bob Corp',
        buyerEmail: 'bob@example.com',
        productId: 'kiaan-hrm',
        editionCode: 'full_source',
        sku: 'KHRM-SRC-LIFETIME',
        quantity: 3,
        currency: 'USD',
        paymentStatus: 'PAID',
        paymentReference: 'ref_333'
    });

    assert.strictEqual(result.quantity, 3);
    assert.strictEqual(result.licenses.length, 3);
    assert.strictEqual(db.orders.length, 1);
    assert.strictEqual(db.licenses.length, 3);
    assert.strictEqual(db.outbox.length, 3);

    // Assert every license is globally unique
    const licenseIds = new Set(result.licenses.map(l => l.licenseId));
    const licenseKeys = new Set(result.licenses.map(l => l.licenseKey));
    const keyHints = new Set(result.licenses.map(l => l.keyHint));

    assert.strictEqual(licenseIds.size, 3);
    assert.strictEqual(licenseKeys.size, 3);
    assert.strictEqual(keyHints.size, 3);
});

test('13. Quantity 10: Exactly 10 unique licenses produced', async () => {
    const db = createMockDatabase();
    const service = new OrderIngestionService({ db, pepper: TEST_PEPPER });

    const result = await service.ingestOrder({
        salesChannelId: 'manual_b2b',
        channelOrderId: 'ord_unit_10',
        buyerName: 'Enterprise Client',
        buyerEmail: 'corp@enterprise.org',
        productId: 'kiaan-hrm',
        editionCode: 'extended',
        sku: 'KHRM-EXT-LIFETIME',
        quantity: 10,
        currency: 'USD',
        paymentStatus: 'PAID',
        paymentReference: 'b2b_inv_9988'
    });

    assert.strictEqual(result.quantity, 10);
    assert.strictEqual(result.licenses.length, 10);
    assert.strictEqual(db.licenses.length, 10);
    assert.strictEqual(db.outbox.length, 10);

    const keys = new Set(result.licenses.map(l => l.licenseKey));
    assert.strictEqual(keys.size, 10);
});

test('14. Correct edition validation succeeds for ui_dist and extended', async () => {
    const db = createMockDatabase();
    const service = new OrderIngestionService({ db, pepper: TEST_PEPPER });

    // UI Dist
    const res1 = await service.ingestOrder({
        salesChannelId: 'codecanyon',
        channelOrderId: 'cc_001',
        buyerEmail: 'dist@example.com',
        productId: 'kiaan-hrm',
        editionCode: 'ui_dist',
        sku: 'KHRM-DIST-LIFETIME',
        quantity: 1,
        paymentStatus: 'PAID',
        paymentReference: 'cc_ref_1'
    });
    assert.strictEqual(res1.licenses[0].editionCode, 'ui_dist');

    // Extended
    const res2 = await service.ingestOrder({
        salesChannelId: 'codecanyon',
        channelOrderId: 'cc_002',
        buyerEmail: 'ext@example.com',
        productId: 'kiaan-hrm',
        editionCode: 'extended',
        sku: 'KHRM-EXT-LIFETIME',
        quantity: 1,
        paymentStatus: 'PAID',
        paymentReference: 'cc_ref_2'
    });
    assert.strictEqual(res2.licenses[0].editionCode, 'extended');
});

test('15. SKU mismatch with edition or product is rejected', async () => {
    const db = createMockDatabase();
    const service = new OrderIngestionService({ db, pepper: TEST_PEPPER });

    // SKU is KHRM-DIST-LIFETIME (ui_dist), but caller passed editionCode: 'full_source'
    await assert.rejects(
        () => service.ingestOrder({
            salesChannelId: 'kiaan_direct',
            channelOrderId: 'mismatch_1',
            buyerEmail: 'test@example.com',
            productId: 'kiaan-hrm',
            editionCode: 'full_source',
            sku: 'KHRM-DIST-LIFETIME',
            quantity: 1,
            paymentStatus: 'PAID',
            paymentReference: 'ref_m1'
        }),
        err => err.code === 'SKU_MISMATCH'
    );
});

test('16. Unknown edition SKU is rejected with EDITION_NOT_FOUND', async () => {
    const db = createMockDatabase();
    const service = new OrderIngestionService({ db, pepper: TEST_PEPPER });

    await assert.rejects(
        () => service.ingestOrder({
            salesChannelId: 'kiaan_direct',
            channelOrderId: 'unknown_ed',
            buyerEmail: 'test@example.com',
            productId: 'kiaan-hrm',
            editionCode: 'non_existent_edition',
            sku: 'NON-EXISTENT-SKU',
            quantity: 1,
            paymentStatus: 'PAID',
            paymentReference: 'ref_u1'
        }),
        err => err.code === 'EDITION_NOT_FOUND'
    );
});

test('17. Unknown product is rejected with PRODUCT_NOT_FOUND', async () => {
    const db = createMockDatabase();
    const service = new OrderIngestionService({ db, pepper: TEST_PEPPER });

    await assert.rejects(
        () => service.ingestOrder({
            salesChannelId: 'kiaan_direct',
            channelOrderId: 'unknown_prod',
            buyerEmail: 'test@example.com',
            productId: 'unknown-product-xyz',
            editionCode: 'full_source',
            sku: 'KHRM-SRC-LIFETIME',
            quantity: 1,
            paymentStatus: 'PAID',
            paymentReference: 'ref_p1'
        }),
        err => err.code === 'PRODUCT_NOT_FOUND'
    );
});

test('18. Unpaid order (PENDING) is rejected with ORDER_NOT_PAID', async () => {
    const db = createMockDatabase();
    const service = new OrderIngestionService({ db, pepper: TEST_PEPPER });

    await assert.rejects(
        () => service.ingestOrder({
            salesChannelId: 'kiaan_direct',
            channelOrderId: 'pending_order',
            buyerEmail: 'test@example.com',
            productId: 'kiaan-hrm',
            editionCode: 'full_source',
            sku: 'KHRM-SRC-LIFETIME',
            quantity: 1,
            paymentStatus: 'PENDING',
            paymentReference: 'ref_pending'
        }),
        err => err.code === 'ORDER_NOT_PAID'
    );

    assert.strictEqual(db.orders.length, 0);
    assert.strictEqual(db.licenses.length, 0);
});

test('19. Refunded order is rejected with ORDER_NOT_PAID', async () => {
    const db = createMockDatabase();
    const service = new OrderIngestionService({ db, pepper: TEST_PEPPER });

    await assert.rejects(
        () => service.ingestOrder({
            salesChannelId: 'kiaan_direct',
            channelOrderId: 'refunded_order',
            buyerEmail: 'test@example.com',
            productId: 'kiaan-hrm',
            editionCode: 'full_source',
            sku: 'KHRM-SRC-LIFETIME',
            quantity: 1,
            paymentStatus: 'REFUNDED',
            paymentReference: 'ref_refund'
        }),
        err => err.code === 'ORDER_NOT_PAID'
    );
});

test('20. Disputed order is rejected with ORDER_NOT_PAID', async () => {
    const db = createMockDatabase();
    const service = new OrderIngestionService({ db, pepper: TEST_PEPPER });

    await assert.rejects(
        () => service.ingestOrder({
            salesChannelId: 'kiaan_direct',
            channelOrderId: 'disputed_order',
            buyerEmail: 'test@example.com',
            productId: 'kiaan-hrm',
            editionCode: 'full_source',
            sku: 'KHRM-SRC-LIFETIME',
            quantity: 1,
            paymentStatus: 'DISPUTED',
            paymentReference: 'ref_dispute'
        }),
        err => err.code === 'ORDER_NOT_PAID'
    );
});

test('21. Plaintext key is NOT stored in marketplace_licenses table', async () => {
    const db = createMockDatabase();
    const service = new OrderIngestionService({ db, pepper: TEST_PEPPER });

    const result = await service.ingestOrder({
        salesChannelId: 'kiaan_direct',
        channelOrderId: 'sec_test_01',
        buyerEmail: 'security@example.com',
        productId: 'kiaan-hrm',
        editionCode: 'full_source',
        sku: 'KHRM-SRC-LIFETIME',
        quantity: 1,
        paymentStatus: 'PAID',
        paymentReference: 'ref_sec'
    });

    const plaintextKey = result.licenses[0].licenseKey;
    assert.ok(plaintextKey);

    // Inspect row in mock database
    const storedLicense = db.licenses[0];
    assert.strictEqual(storedLicense.license_key, undefined);
    assert.strictEqual(storedLicense._key, undefined);
    assert.strictEqual(storedLicense.license_key_hash.length, 64); // 64-char hex HMAC
    assert.strictEqual(storedLicense.license_key_hash.includes(plaintextKey), false);
    assert.strictEqual(storedLicense.key_hint.includes('****'), true);
});

test('22. Duplicate sequential order returns idempotent replay without new keys', async () => {
    const db = createMockDatabase();
    const service = new OrderIngestionService({ db, pepper: TEST_PEPPER });

    const orderPayload = {
        salesChannelId: 'kiaan_direct',
        channelOrderId: 'idemp_seq_01',
        buyerEmail: 'seq@example.com',
        productId: 'kiaan-hrm',
        editionCode: 'full_source',
        sku: 'KHRM-SRC-LIFETIME',
        quantity: 1,
        paymentStatus: 'PAID',
        paymentReference: 'ref_seq_1'
    };

    // First call
    const firstResult = await service.ingestOrder(orderPayload);
    assert.strictEqual(firstResult.isReplay, false);
    assert.ok(firstResult.licenses[0].licenseKey);

    // Second call (replay)
    const secondResult = await service.ingestOrder(orderPayload);
    assert.strictEqual(secondResult.isReplay, true);
    assert.strictEqual(secondResult.orderId, firstResult.orderId);
    assert.strictEqual(secondResult.licenses[0].licenseId, firstResult.licenses[0].licenseId);
    // Plaintext key is NOT returned on replay!
    assert.strictEqual(secondResult.licenses[0].licenseKey, undefined);
    assert.strictEqual(secondResult.licenses[0].keyHint, firstResult.licenses[0].keyHint);

    // Exact counts in database must NOT increase
    assert.strictEqual(db.orders.length, 1);
    assert.strictEqual(db.licenses.length, 1);
    assert.strictEqual(db.outbox.length, 1);
});

test('23. Concurrent duplicate requests: exactly 1 order and intended licenses issued', async () => {
    const db = createMockDatabase();
    const service = new OrderIngestionService({ db, pepper: TEST_PEPPER });

    const orderPayload = {
        salesChannelId: 'codecanyon',
        channelOrderId: 'concurrent_dup_99',
        buyerEmail: 'race@example.com',
        productId: 'kiaan-hrm',
        editionCode: 'full_source',
        sku: 'KHRM-SRC-LIFETIME',
        quantity: 1,
        paymentStatus: 'PAID',
        paymentReference: 'ref_race'
    };

    // Trigger two concurrent invocations
    const [res1, res2] = await Promise.all([
        service.ingestOrder(orderPayload),
        service.ingestOrder(orderPayload)
    ]);

    // Exactly one fresh issuance, one replay
    const replays = [res1, res2].filter(r => r.isReplay);
    const fresh = [res1, res2].filter(r => !r.isReplay);

    assert.strictEqual(fresh.length, 1);
    assert.strictEqual(replays.length, 1);

    // Exactly 1 order in DB
    assert.strictEqual(db.orders.length, 1);
    assert.strictEqual(db.licenses.length, 1);
    assert.strictEqual(db.outbox.length, 1);
});

test('24. Quantity 3 concurrent duplicate requests: exactly 3 licenses total, NOT 6', async () => {
    const db = createMockDatabase();
    const service = new OrderIngestionService({ db, pepper: TEST_PEPPER });

    const orderPayload = {
        salesChannelId: 'appsumo',
        channelOrderId: 'appsumo_tier3_race',
        buyerEmail: 'sumo@example.com',
        productId: 'kiaan-hrm',
        editionCode: 'extended',
        sku: 'KHRM-EXT-LIFETIME',
        quantity: 3,
        paymentStatus: 'PAID',
        paymentReference: 'as_ref_3'
    };

    const [res1, res2] = await Promise.all([
        service.ingestOrder(orderPayload),
        service.ingestOrder(orderPayload)
    ]);

    // Database assertions: Exactly 1 order, exactly 3 licenses, exactly 3 outbox records!
    assert.strictEqual(db.orders.length, 1);
    assert.strictEqual(db.licenses.length, 3);
    assert.strictEqual(db.outbox.length, 3);
});

test('25. Database failure during license insertion triggers complete rollback', async () => {
    const db = createMockDatabase();
    db.failQueryOnMatch = 'insert into marketplace_licenses';

    const service = new OrderIngestionService({ db, pepper: TEST_PEPPER });

    await assert.rejects(
        () => service.ingestOrder({
            salesChannelId: 'kiaan_direct',
            channelOrderId: 'fail_tx_order',
            buyerEmail: 'fail@example.com',
            productId: 'kiaan-hrm',
            editionCode: 'full_source',
            sku: 'KHRM-SRC-LIFETIME',
            quantity: 2,
            paymentStatus: 'PAID',
            paymentReference: 'ref_fail'
        }),
        err => err.code === 'SIMULATED_DB_ERROR'
    );

    // Rollback guarantees zero orphaned rows in any table
    assert.strictEqual(db.orders.length, 0);
    assert.strictEqual(db.licenses.length, 0);
    assert.strictEqual(db.outbox.length, 0);
});

test('26. Database failure during outbox insertion triggers complete rollback', async () => {
    const db = createMockDatabase();
    db.failQueryOnMatch = 'insert into license_email_outbox';

    const service = new OrderIngestionService({ db, pepper: TEST_PEPPER });

    await assert.rejects(
        () => service.ingestOrder({
            salesChannelId: 'kiaan_direct',
            channelOrderId: 'fail_outbox_order',
            buyerEmail: 'fail@example.com',
            productId: 'kiaan-hrm',
            editionCode: 'full_source',
            sku: 'KHRM-SRC-LIFETIME',
            quantity: 1,
            paymentStatus: 'PAID',
            paymentReference: 'ref_fail_outbox'
        }),
        err => err.code === 'SIMULATED_DB_ERROR'
    );

    assert.strictEqual(db.orders.length, 0);
    assert.strictEqual(db.licenses.length, 0);
    assert.strictEqual(db.outbox.length, 0);
});

test('27. License activation table remains untouched during issuance', async () => {
    const db = createMockDatabase();
    const service = new OrderIngestionService({ db, pepper: TEST_PEPPER });

    await service.ingestOrder({
        salesChannelId: 'kiaan_direct',
        channelOrderId: 'act_sep_order',
        buyerEmail: 'act@example.com',
        productId: 'kiaan-hrm',
        editionCode: 'full_source',
        sku: 'KHRM-SRC-LIFETIME',
        quantity: 2,
        paymentStatus: 'PAID',
        paymentReference: 'ref_act'
    });

    // Zero activation records created
    assert.strictEqual(db.activations.length, 0);
    assert.strictEqual(db.licenses[0].bound_domain, null);
    assert.strictEqual(db.licenses[1].bound_domain, null);
});

test('28. Missing pepper fails closed with PEPPER_CONFIGURATION_ERROR', async () => {
    const db = createMockDatabase();
    const serviceWithoutPepper = new OrderIngestionService({ db, pepper: null });

    await assert.rejects(
        () => serviceWithoutPepper.ingestOrder({
            salesChannelId: 'kiaan_direct',
            channelOrderId: 'no_pepper_order',
            buyerEmail: 'test@example.com',
            productId: 'kiaan-hrm',
            editionCode: 'full_source',
            sku: 'KHRM-SRC-LIFETIME',
            quantity: 1,
            paymentStatus: 'PAID',
            paymentReference: 'ref_np'
        }),
        err => err.code === 'PEPPER_CONFIGURATION_ERROR'
    );
});

test('29. Logger safety: plaintext license key and pepper are never passed to logger', async () => {
    const db = createMockDatabase();
    const loggedMessages = [];
    const mockLogger = {
        info: (msg, meta) => loggedMessages.push({ msg, meta }),
        error: (msg, meta) => loggedMessages.push({ msg, meta }),
        log: (msg, meta) => loggedMessages.push({ msg, meta })
    };

    const service = new OrderIngestionService({ db, pepper: TEST_PEPPER, logger: mockLogger });

    const result = await service.ingestOrder({
        salesChannelId: 'kiaan_direct',
        channelOrderId: 'log_safe_order',
        buyerEmail: 'logsafe@example.com',
        productId: 'kiaan-hrm',
        editionCode: 'full_source',
        sku: 'KHRM-SRC-LIFETIME',
        quantity: 1,
        paymentStatus: 'PAID',
        paymentReference: 'ref_ls'
    });

    const plaintextKey = result.licenses[0].licenseKey;
    const allLoggedText = JSON.stringify(loggedMessages);

    assert.strictEqual(allLoggedText.includes(plaintextKey), false);
    assert.strictEqual(allLoggedText.includes(TEST_PEPPER), false);
});

test('30. Raw payload credentials are sanitized before insertion into marketplace_orders', async () => {
    const db = createMockDatabase();
    const service = new OrderIngestionService({ db, pepper: TEST_PEPPER });

    await service.ingestOrder({
        salesChannelId: 'kiaan_direct',
        channelOrderId: 'raw_sanit_order',
        buyerEmail: 'sanit@example.com',
        productId: 'kiaan-hrm',
        editionCode: 'full_source',
        sku: 'KHRM-SRC-LIFETIME',
        quantity: 1,
        paymentStatus: 'PAID',
        paymentReference: 'ref_sanit',
        rawPayload: {
            auth_token: 'secret_token_abc',
            card_number: '4111 2222 3333 4444',
            cvv: '999',
            valid_ref: 'tx_12345678'
        }
    });

    assert.strictEqual(db.orders.length, 1);
    const storedPayload = JSON.parse(db.orders[0].raw_payload);

    assert.strictEqual(storedPayload.auth_token, '[REDACTED]');
    assert.strictEqual(storedPayload.card_number, '[REDACTED_CARD_NUMBER]');
    assert.strictEqual(storedPayload.cvv, '[REDACTED]');
    assert.strictEqual(storedPayload.valid_ref, 'tx_12345678');
});

test('31. Key generator failure triggers transaction rollback', async () => {
    const db = createMockDatabase();
    const failingKeyGen = {
        validatePepper: () => true,
        generateLicenseKey: () => {
            const err = new Error('CSPRNG entropy exhaustion');
            err.code = 'CSPRNG_FAILURE';
            throw err;
        }
    };

    const service = new OrderIngestionService({ db, pepper: TEST_PEPPER, keyGenerator: failingKeyGen });

    await assert.rejects(
        () => service.ingestOrder({
            salesChannelId: 'kiaan_direct',
            channelOrderId: 'keygen_fail_order',
            buyerEmail: 'fail@example.com',
            productId: 'kiaan-hrm',
            editionCode: 'full_source',
            sku: 'KHRM-SRC-LIFETIME',
            quantity: 1,
            paymentStatus: 'PAID',
            paymentReference: 'ref_kg_fail'
        }),
        err => err.code === 'CSPRNG_FAILURE'
    );

    // Rollback guarantees zero records
    assert.strictEqual(db.orders.length, 0);
    assert.strictEqual(db.licenses.length, 0);
    assert.strictEqual(db.outbox.length, 0);
});

test('32. Injected AuthorityConfig instance supplies pepper seamlessly', async () => {
    const db = createMockDatabase();
    const mockConfig = {
        getPepper: () => TEST_PEPPER
    };

    const service = new OrderIngestionService({ db, config: mockConfig });

    const result = await service.ingestOrder({
        salesChannelId: 'kiaan_direct',
        channelOrderId: 'config_pepper_order',
        buyerEmail: 'config@example.com',
        productId: 'kiaan-hrm',
        editionCode: 'full_source',
        sku: 'KHRM-SRC-LIFETIME',
        quantity: 1,
        paymentStatus: 'PAID',
        paymentReference: 'ref_cfg'
    });

    assert.strictEqual(result.licenses.length, 1);
    assert.ok(result.licenses[0].licenseKey);
});

test('33. Unsupported multi-SKU shape is rejected safely with UNSUPPORTED_MULTI_SKU_ORDER', async () => {
    const db = createMockDatabase();
    const service = new OrderIngestionService({ db, pepper: TEST_PEPPER });

    await assert.rejects(
        () => service.ingestOrder({
            salesChannelId: 'kiaan_direct',
            channelOrderId: 'multi_sku_order',
            buyerEmail: 'multi@example.com',
            productId: 'kiaan-hrm',
            editionCode: 'full_source',
            sku: 'KHRM-SRC-LIFETIME',
            items: [{ sku: 'KHRM-DIST-LIFETIME' }, { sku: 'KHRM-SRC-LIFETIME' }],
            quantity: 1,
            paymentStatus: 'PAID',
            paymentReference: 'ref_multi'
        }),
        err => err.code === 'UNSUPPORTED_MULTI_SKU_ORDER'
    );

    assert.strictEqual(db.orders.length, 0);
    assert.strictEqual(db.licenses.length, 0);
});
