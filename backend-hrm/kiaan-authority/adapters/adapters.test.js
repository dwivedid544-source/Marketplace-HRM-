/**
 * Kiaan Central License Authority — Sales Channel Adapters Test Suite
 * Module: backend-hrm/kiaan-authority/adapters/adapters.test.js
 *
 * Comprehensive unit and boundary test suite for Phase 2B.8D.2 Sales Channel Adapters.
 *
 * Test Groups:
 * A. Adapter Contract & Interface Uniformity
 * B. Kiaan Direct Adapter
 * C. CodeCanyon / Envato Adapter
 * D. AppSumo Adapter
 * E. Manual B2B Adapter
 * F. Security & Input Sanitization (Prototype Pollution, Redaction, Payloads)
 * G. Multi-SKU & Cart Splitting Determinism
 * H. Fail-Closed Payment Normalization
 * I. Integration Boundary (Adapter -> CanonicalOrderDTO -> OrderIngestionService mock)
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    getAdapter,
    registerAdapter,
    normalizeChannelOrder,
    normalizeChannelOrderUnits,
    BaseSalesChannelAdapter,
    KiaanDirectAdapter,
    CodeCanyonAdapter,
    AppSumoAdapter,
    ManualB2bAdapter,
    SkuResolver,
    defaultSkuResolver,
    normalizePaymentStatus,
    validatePayloadSecurity
} = require('./index');

const { CanonicalOrderDTO } = require('../core/orderDto');

// ==============================================================================
// GROUP A: ADAPTER CONTRACT & INTERFACE UNIFORMITY
// ==============================================================================

test('A1. getAdapter returns registered adapter instances with correct channel IDs', () => {
    const direct = getAdapter('kiaan_direct');
    assert.ok(direct instanceof KiaanDirectAdapter);
    assert.strictEqual(direct.getChannelId(), 'kiaan_direct');

    const codecanyon = getAdapter('codecanyon');
    assert.ok(codecanyon instanceof CodeCanyonAdapter);
    assert.strictEqual(codecanyon.getChannelId(), 'codecanyon');

    const appsumo = getAdapter('appsumo');
    assert.ok(appsumo instanceof AppSumoAdapter);
    assert.strictEqual(appsumo.getChannelId(), 'appsumo');

    const manualB2b = getAdapter('manual_b2b');
    assert.ok(manualB2b instanceof ManualB2bAdapter);
    assert.strictEqual(manualB2b.getChannelId(), 'manual_b2b');
});

test('A2. Unregistered or empty sales channels throw UNKNOWN_SALES_CHANNEL or INVALID_SALES_CHANNEL', () => {
    assert.throws(
        () => getAdapter('unknown_channel'),
        err => err.code === 'UNKNOWN_SALES_CHANNEL'
    );

    assert.throws(
        () => getAdapter(''),
        err => err.code === 'INVALID_SALES_CHANNEL'
    );

    assert.throws(
        () => getAdapter(null),
        err => err.code === 'INVALID_SALES_CHANNEL'
    );
});

test('A3. All adapters expose required public contract methods', () => {
    const channelIds = ['kiaan_direct', 'codecanyon', 'appsumo', 'manual_b2b'];

    for (const channelId of channelIds) {
        const adapter = getAdapter(channelId);
        assert.strictEqual(typeof adapter.getChannelId, 'function');
        assert.strictEqual(typeof adapter.getChannelName, 'function');
        assert.strictEqual(typeof adapter.validatePayload, 'function');
        assert.strictEqual(typeof adapter.normalizeOrder, 'function');
        assert.strictEqual(typeof adapter.normalizeOrderUnits, 'function');
        assert.strictEqual(typeof adapter.normalizePaymentStatus, 'function');
        assert.strictEqual(typeof adapter.createCanonicalOrder, 'function');
    }
});

test('A4. BaseSalesChannelAdapter abstract methods throw if not implemented', () => {
    const base = new BaseSalesChannelAdapter();
    assert.throws(() => base.getChannelId(), /must be implemented/);
    assert.throws(() => base.mapOrderIdentifier({}), /must be implemented/);
    assert.throws(() => base.mapEdition({}), /must be implemented/);
    assert.throws(() => base.mapBuyer({}), /must be implemented/);
    assert.throws(() => base.mapPaymentStatus({}), /must be implemented/);
    assert.throws(() => base.mapPaymentReference({}), /must be implemented/);
});

// ==============================================================================
// GROUP B: KIAAN DIRECT ADAPTER
// ==============================================================================

test('B1. Kiaan Direct: Valid direct checkout payload normalizes into CanonicalOrderDTO', () => {
    const rawPayload = {
        orderId: 'dir_ord_2026_001',
        buyerName: 'Alice Johnson',
        buyerEmail: 'alice@example.com',
        buyerPhone: '+919876543210',
        productId: 'kiaan-hrm',
        editionCode: 'full_source',
        quantity: 2,
        unitPrice: 299.00,
        totalPrice: 598.00,
        currency: 'USD',
        paymentStatus: 'captured',
        paymentReference: 'pay_razorpay_123456',
        purchasedAt: '2026-03-15T12:00:00Z',
        metadata: { source: 'checkout_modal' }
    };

    const dto = normalizeChannelOrder('kiaan_direct', rawPayload);

    assert.ok(dto instanceof CanonicalOrderDTO);
    assert.strictEqual(dto.salesChannelId, 'kiaan_direct');
    assert.strictEqual(dto.channelOrderId, 'dir_ord_2026_001');
    assert.strictEqual(dto.buyerName, 'Alice Johnson');
    assert.strictEqual(dto.buyerEmail, 'alice@example.com');
    assert.strictEqual(dto.buyerPhone, '+919876543210');
    assert.strictEqual(dto.productId, 'kiaan-hrm');
    assert.strictEqual(dto.editionCode, 'full_source');
    assert.strictEqual(dto.sku, 'KHRM-SRC-LIFETIME');
    assert.strictEqual(dto.quantity, 2);
    assert.strictEqual(dto.unitPrice, 299.00);
    assert.strictEqual(dto.totalPrice, 598.00);
    assert.strictEqual(dto.currency, 'USD');
    assert.strictEqual(dto.paymentStatus, 'PAID');
    assert.strictEqual(dto.paymentReference, 'pay_razorpay_123456');
    assert.strictEqual(dto.purchasedAt, '2026-03-15T12:00:00.000Z');
});

test('B2. Kiaan Direct: Missing buyer email throws MISSING_REQUIRED_FIELD', () => {
    const rawPayload = {
        orderId: 'dir_ord_2026_002',
        editionCode: 'full_source',
        paymentStatus: 'paid',
        paymentReference: 'pay_ref_1'
    };

    assert.throws(
        () => normalizeChannelOrder('kiaan_direct', rawPayload),
        err => err.code === 'MISSING_REQUIRED_FIELD' && /buyerEmail/.test(err.message)
    );
});

test('B3. Kiaan Direct: Missing orderId throws MISSING_REQUIRED_FIELD', () => {
    const rawPayload = {
        buyerEmail: 'test@example.com',
        editionCode: 'full_source',
        paymentStatus: 'paid',
        paymentReference: 'pay_ref_1'
    };

    assert.throws(
        () => normalizeChannelOrder('kiaan_direct', rawPayload),
        err => err.code === 'MISSING_REQUIRED_FIELD' && /orderId/.test(err.message)
    );
});

test('B4. Kiaan Direct: Invalid quantity throws INVALID_QUANTITY', () => {
    const rawPayload = {
        orderId: 'dir_ord_2026_003',
        buyerEmail: 'test@example.com',
        editionCode: 'full_source',
        quantity: 0,
        paymentStatus: 'paid',
        paymentReference: 'pay_ref_1'
    };

    assert.throws(
        () => normalizeChannelOrder('kiaan_direct', rawPayload),
        err => err.code === 'INVALID_QUANTITY'
    );
});

test('B5. Kiaan Direct: Unknown SKU throws UNKNOWN_SKU', () => {
    const rawPayload = {
        orderId: 'dir_ord_2026_004',
        buyerEmail: 'test@example.com',
        sku: 'UNKNOWN-SKU-999',
        paymentStatus: 'paid',
        paymentReference: 'pay_ref_1'
    };

    assert.throws(
        () => normalizeChannelOrder('kiaan_direct', rawPayload),
        err => err.code === 'UNKNOWN_SKU'
    );
});

test('B6. Kiaan Direct: Unpaid order (pending) normalizes to paymentStatus PENDING', () => {
    const rawPayload = {
        orderId: 'dir_ord_2026_005',
        buyerEmail: 'pending@example.com',
        editionCode: 'ui_dist',
        paymentStatus: 'pending',
        paymentReference: 'pay_pending_1'
    };

    const dto = normalizeChannelOrder('kiaan_direct', rawPayload);
    assert.strictEqual(dto.paymentStatus, 'PENDING');
});

test('B7. Kiaan Direct: Refunded order normalizes to paymentStatus REFUNDED', () => {
    const rawPayload = {
        orderId: 'dir_ord_2026_006',
        buyerEmail: 'refund@example.com',
        editionCode: 'ui_dist',
        paymentStatus: 'refunded',
        paymentReference: 'pay_ref_refund'
    };

    const dto = normalizeChannelOrder('kiaan_direct', rawPayload);
    assert.strictEqual(dto.paymentStatus, 'REFUNDED');
});

test('B8. Kiaan Direct: Disputed order normalizes to paymentStatus DISPUTED', () => {
    const rawPayload = {
        orderId: 'dir_ord_2026_007',
        buyerEmail: 'dispute@example.com',
        editionCode: 'ui_dist',
        paymentStatus: 'chargeback',
        paymentReference: 'pay_ref_dispute'
    };

    const dto = normalizeChannelOrder('kiaan_direct', rawPayload);
    assert.strictEqual(dto.paymentStatus, 'DISPUTED');
});

// ==============================================================================
// GROUP C: CODECANYON / ENVATO ADAPTER
// ==============================================================================

test('C1. CodeCanyon: Valid Envato purchase code fixture for Regular License normalizes to full_source', () => {
    const envatoFixture = {
        purchase_code: '3b2e59d4-1a2b-4c3d-9e8f-0123456789ab',
        item: {
            id: 123456,
            name: 'Kiaan HRM Pro - Human Resource Management'
        },
        buyer: 'envato_buyer_01',
        buyer_email: 'buyer01@envato.example',
        licence: 'Regular License',
        amount: '49.00',
        currency: 'USD',
        sold_at: '2026-03-10T14:30:00Z'
    };

    const dto = normalizeChannelOrder('codecanyon', envatoFixture);

    assert.ok(dto instanceof CanonicalOrderDTO);
    assert.strictEqual(dto.salesChannelId, 'codecanyon');
    assert.strictEqual(dto.channelOrderId, '3b2e59d4-1a2b-4c3d-9e8f-0123456789ab');
    assert.strictEqual(dto.paymentReference, '3b2e59d4-1a2b-4c3d-9e8f-0123456789ab');
    assert.strictEqual(dto.buyerName, 'envato_buyer_01');
    assert.strictEqual(dto.buyerEmail, 'buyer01@envato.example');
    assert.strictEqual(dto.productId, 'kiaan-hrm');
    assert.strictEqual(dto.editionCode, 'full_source');
    assert.strictEqual(dto.sku, 'KHRM-SRC-LIFETIME');
    assert.strictEqual(dto.quantity, 1);
    assert.strictEqual(dto.paymentStatus, 'PAID');
    assert.strictEqual(dto.currency, 'USD');
    assert.strictEqual(dto.unitPrice, 49.00);
});

test('C2. CodeCanyon: Extended License normalizes to extended edition', () => {
    const envatoFixture = {
        purchase_code: '4c3d2e1a-5b6c-7d8e-9f0a-1234567890cd',
        item: {
            id: 123456,
            name: 'Kiaan HRM Pro - Human Resource Management'
        },
        buyer_email: 'extended_buyer@example.com',
        licence: 'Extended License',
        amount: '199.00',
        currency: 'USD'
    };

    const dto = normalizeChannelOrder('codecanyon', envatoFixture);
    assert.strictEqual(dto.editionCode, 'extended');
    assert.strictEqual(dto.sku, 'KHRM-EXT-LIFETIME');
    assert.strictEqual(dto.paymentStatus, 'PAID');
});

test('C3. CodeCanyon: Unsupported product name throws UNSUPPORTED_PRODUCT', () => {
    const envatoFixture = {
        purchase_code: 'fake_code_12345',
        item: {
            id: 999999,
            name: 'WordPress WooCommerce Custom Slider'
        },
        buyer_email: 'buyer@example.com',
        licence: 'Regular License'
    };

    assert.throws(
        () => normalizeChannelOrder('codecanyon', envatoFixture),
        err => err.code === 'UNSUPPORTED_PRODUCT'
    );
});

test('C4. CodeCanyon: Ambiguous or unsupported licence type throws UNSUPPORTED_EDITION', () => {
    const envatoFixture = {
        purchase_code: 'code_custom_lic',
        item: {
            name: 'Kiaan HRM Pro'
        },
        buyer_email: 'buyer@example.com',
        licence: 'Developer Multi-Site License' // Ambiguous! Never guess.
    };

    assert.throws(
        () => normalizeChannelOrder('codecanyon', envatoFixture),
        err => err.code === 'UNSUPPORTED_EDITION'
    );
});

test('C5. CodeCanyon: Missing purchase code throws MISSING_REQUIRED_FIELD', () => {
    const envatoFixture = {
        item: { name: 'Kiaan HRM Pro' },
        buyer_email: 'buyer@example.com',
        licence: 'Regular License'
    };

    assert.throws(
        () => normalizeChannelOrder('codecanyon', envatoFixture),
        err => err.code === 'MISSING_REQUIRED_FIELD' && /purchase_code/.test(err.message)
    );
});

test('C6. CodeCanyon: Explicit refunded status normalizes to REFUNDED', () => {
    const envatoFixture = {
        purchase_code: 'code_refunded_123',
        item: { name: 'Kiaan HRM Pro' },
        buyer_email: 'buyer@example.com',
        licence: 'Regular License',
        payment_status: 'refunded'
    };

    const dto = normalizeChannelOrder('codecanyon', envatoFixture);
    assert.strictEqual(dto.paymentStatus, 'REFUNDED');
});

test('C7. CodeCanyon: Quantity greater than 1 is rejected (1 Code = 1 Unit)', () => {
    const envatoFixture = {
        purchase_code: 'code_multi_unit_attempt',
        item: { name: 'Kiaan HRM Pro' },
        buyer_email: 'buyer@example.com',
        licence: 'Regular License',
        quantity: 2
    };

    assert.throws(
        () => normalizeChannelOrder('codecanyon', envatoFixture),
        err => err.code === 'INVALID_QUANTITY'
    );
});

// ==============================================================================
// GROUP D: APPSUMO ADAPTER
// ==============================================================================

test('D1. AppSumo: Valid tier1 redemption fixture normalizes to ui_dist edition', () => {
    const appSumoFixture = {
        action: 'activate',
        plan_id: 'tier1',
        uuid: 'as-uuid-11223344',
        invoice_item_uuid: 'as-inv-item-556677',
        email: 'sumoling1@appsumo.example',
        buyer_name: 'Sumo Ling One',
        amount: 0,
        currency: 'USD',
        timestamp: '2026-03-12T09:00:00Z'
    };

    const dto = normalizeChannelOrder('appsumo', appSumoFixture);

    assert.ok(dto instanceof CanonicalOrderDTO);
    assert.strictEqual(dto.salesChannelId, 'appsumo');
    assert.strictEqual(dto.channelOrderId, 'as-inv-item-556677');
    assert.strictEqual(dto.paymentReference, 'as-uuid-11223344');
    assert.strictEqual(dto.buyerName, 'Sumo Ling One');
    assert.strictEqual(dto.buyerEmail, 'sumoling1@appsumo.example');
    assert.strictEqual(dto.productId, 'kiaan-hrm');
    assert.strictEqual(dto.editionCode, 'ui_dist');
    assert.strictEqual(dto.sku, 'KHRM-DIST-LIFETIME');
    assert.strictEqual(dto.paymentStatus, 'PAID');
    assert.strictEqual(dto.quantity, 1);
});

test('D2. AppSumo: Tier2 and Tier3 map to full_source and extended editions', () => {
    const tier2Payload = {
        action: 'activate',
        plan_id: 'tier2',
        uuid: 'as-uuid-tier2',
        email: 'tier2@example.com'
    };
    const dto2 = normalizeChannelOrder('appsumo', tier2Payload);
    assert.strictEqual(dto2.editionCode, 'full_source');
    assert.strictEqual(dto2.sku, 'KHRM-SRC-LIFETIME');

    const tier3Payload = {
        action: 'activate',
        plan_id: 'tier3',
        uuid: 'as-uuid-tier3',
        email: 'tier3@example.com'
    };
    const dto3 = normalizeChannelOrder('appsumo', tier3Payload);
    assert.strictEqual(dto3.editionCode, 'extended');
    assert.strictEqual(dto3.sku, 'KHRM-EXT-LIFETIME');
});

test('D3. AppSumo: Unsupported tier throws UNSUPPORTED_EDITION', () => {
    const invalidTier = {
        action: 'activate',
        plan_id: 'tier99', // Unknown tier!
        uuid: 'as-uuid-invalid',
        email: 'test@example.com'
    };

    assert.throws(
        () => normalizeChannelOrder('appsumo', invalidTier),
        err => err.code === 'UNSUPPORTED_EDITION'
    );
});

test('D4. AppSumo: Action refund maps to REFUNDED paymentStatus', () => {
    const refundPayload = {
        action: 'refund',
        plan_id: 'tier1',
        uuid: 'as-uuid-refund',
        email: 'refund@example.com'
    };

    const dto = normalizeChannelOrder('appsumo', refundPayload);
    assert.strictEqual(dto.paymentStatus, 'REFUNDED');
});

test('D5. AppSumo: Unknown action fails closed with INVALID_PAYMENT_STATUS', () => {
    const unknownAction = {
        action: 'some_unknown_action',
        plan_id: 'tier1',
        uuid: 'as-uuid-unknown',
        email: 'unknown@example.com'
    };

    assert.throws(
        () => normalizeChannelOrder('appsumo', unknownAction),
        err => err.code === 'INVALID_PAYMENT_STATUS'
    );
});

test('D6. AppSumo: Missing uuid or invoice_item_uuid throws MISSING_REQUIRED_FIELD', () => {
    const missingId = {
        action: 'activate',
        plan_id: 'tier1',
        email: 'test@example.com'
    };

    assert.throws(
        () => normalizeChannelOrder('appsumo', missingId),
        err => err.code === 'MISSING_REQUIRED_FIELD'
    );
});

// ==============================================================================
// GROUP E: MANUAL B2B ADAPTER
// ==============================================================================

test('E1. Manual B2B: Valid paid corporate order normalizes into CanonicalOrderDTO', () => {
    const b2bPayload = {
        orderId: 'INV-B2B-2026-0042',
        buyerName: 'Global Enterprise Corp',
        buyerEmail: 'procurement@globalent.example',
        buyerPhone: '+14155550199',
        productId: 'kiaan-hrm',
        editionCode: 'extended',
        sku: 'KHRM-EXT-LIFETIME',
        quantity: 5,
        unitPrice: 1200.00,
        totalPrice: 6000.00,
        currency: 'USD',
        paymentStatus: 'PAID',
        paymentReference: 'WIRE-UTR-20260315-998877',
        purchasedAt: '2026-03-15T12:00:00Z',
        notes: 'Enterprise 5-location multi-license contract'
    };

    const dto = normalizeChannelOrder('manual_b2b', b2bPayload);

    assert.ok(dto instanceof CanonicalOrderDTO);
    assert.strictEqual(dto.salesChannelId, 'manual_b2b');
    assert.strictEqual(dto.channelOrderId, 'INV-B2B-2026-0042');
    assert.strictEqual(dto.buyerName, 'Global Enterprise Corp');
    assert.strictEqual(dto.buyerEmail, 'procurement@globalent.example');
    assert.strictEqual(dto.productId, 'kiaan-hrm');
    assert.strictEqual(dto.editionCode, 'extended');
    assert.strictEqual(dto.sku, 'KHRM-EXT-LIFETIME');
    assert.strictEqual(dto.quantity, 5);
    assert.strictEqual(dto.paymentStatus, 'PAID');
    assert.strictEqual(dto.paymentReference, 'WIRE-UTR-20260315-998877');
});

test('E2. Manual B2B: Missing paymentReference throws MISSING_REQUIRED_FIELD', () => {
    const missingRef = {
        orderId: 'INV-B2B-2026-0043',
        buyerName: 'Acme Corp',
        buyerEmail: 'acme@example.com',
        editionCode: 'extended',
        paymentStatus: 'PAID'
        // Missing paymentReference
    };

    assert.throws(
        () => normalizeChannelOrder('manual_b2b', missingRef),
        err => err.code === 'MISSING_REQUIRED_FIELD' && /paymentReference/.test(err.message)
    );
});

test('E3. Manual B2B: Zero admin bypass — Unpaid order preserves PENDING status without bypass', () => {
    const unpaidOrder = {
        orderId: 'INV-B2B-2026-0044',
        buyerName: 'Acme Corp',
        buyerEmail: 'acme@example.com',
        editionCode: 'full_source',
        paymentStatus: 'PENDING',
        paymentReference: 'PO-998811'
    };

    const dto = normalizeChannelOrder('manual_b2b', unpaidOrder);
    assert.strictEqual(dto.paymentStatus, 'PENDING');
});

test('E4. Manual B2B: Unknown SKU throws UNKNOWN_SKU', () => {
    const unknownSku = {
        orderId: 'INV-B2B-2026-0045',
        buyerName: 'Acme Corp',
        buyerEmail: 'acme@example.com',
        sku: 'KHRM-CUSTOM-ENTERPRISE-UNLISTED',
        paymentStatus: 'PAID',
        paymentReference: 'WIRE-123'
    };

    assert.throws(
        () => normalizeChannelOrder('manual_b2b', unknownSku),
        err => err.code === 'UNKNOWN_SKU'
    );
});

test('E5. Manual B2B: Missing or invalid buyer email throws error', () => {
    const missingEmail = {
        orderId: 'INV-B2B-2026-0046',
        buyerName: 'Acme Corp',
        editionCode: 'full_source',
        paymentStatus: 'PAID',
        paymentReference: 'WIRE-123'
    };

    assert.throws(
        () => normalizeChannelOrder('manual_b2b', missingEmail),
        err => err.code === 'MISSING_REQUIRED_FIELD' && /buyerEmail/.test(err.message)
    );
});

// ==============================================================================
// GROUP F: SECURITY CONTROLS & INPUT SANITIZATION
// ==============================================================================

test('F1. Security: Prototype pollution vectors (__proto__, constructor) are strictly detected and rejected', () => {
    const maliciousPayload = JSON.parse(`{
        "orderId": "hacked_ord",
        "buyerEmail": "attacker@example.com",
        "editionCode": "full_source",
        "paymentStatus": "paid",
        "paymentReference": "ref1",
        "__proto__": { "polluted": true }
    }`);

    assert.throws(
        () => normalizeChannelOrder('kiaan_direct', maliciousPayload),
        err => err.code === 'PROTOTYPE_POLLUTION_DETECTED'
    );
});

test('F2. Security: Raw payload credential redaction (passwords, tokens, CVVs, card numbers)', () => {
    const rawWithCredentials = {
        orderId: 'ord_with_creds',
        buyerEmail: 'clean@example.com',
        editionCode: 'full_source',
        paymentStatus: 'paid',
        paymentReference: 'ref_clean',
        rawPayload: {
            auth_token: 'secret_bearer_token_xyz',
            api_key: 'sk_live_1234567890',
            cvv: '123',
            card_number: '4111 1111 1111 1111',
            client_ip: '192.168.1.1'
        }
    };

    const dto = normalizeChannelOrder('kiaan_direct', rawWithCredentials);
    assert.strictEqual(dto.rawPayload.client_ip, '192.168.1.1');
    assert.strictEqual(dto.rawPayload.auth_token, '[REDACTED]');
    assert.strictEqual(dto.rawPayload.api_key, '[REDACTED]');
    assert.strictEqual(dto.rawPayload.cvv, '[REDACTED]');
    assert.strictEqual(dto.rawPayload.card_number, '[REDACTED_CARD_NUMBER]');
});

test('F3. Security: Oversized payload (> 256 KB) is rejected with PAYLOAD_TOO_LARGE', () => {
    const hugeString = 'A'.repeat(300 * 1024);
    const oversizedPayload = {
        orderId: 'ord_huge',
        buyerEmail: 'huge@example.com',
        editionCode: 'full_source',
        paymentStatus: 'paid',
        paymentReference: 'ref1',
        hugeField: hugeString
    };

    assert.throws(
        () => normalizeChannelOrder('kiaan_direct', oversizedPayload),
        err => err.code === 'PAYLOAD_TOO_LARGE'
    );
});

test('F4. Security: Excessive object nesting depth (> 10 levels) is rejected', () => {
    let deep = { leaf: 'value' };
    for (let i = 0; i < 15; i++) {
        deep = { nested: deep };
    }

    const deeplyNestedPayload = {
        orderId: 'ord_deep',
        buyerEmail: 'deep@example.com',
        editionCode: 'full_source',
        paymentStatus: 'paid',
        paymentReference: 'ref1',
        deepData: deep
    };

    assert.throws(
        () => normalizeChannelOrder('kiaan_direct', deeplyNestedPayload),
        err => err.code === 'PAYLOAD_NESTING_EXCEEDED'
    );
});

test('F5. Security: Plaintext license keys are NEVER generated or leaked by adapters', () => {
    const rawPayload = {
        orderId: 'clean_direct_1',
        buyerEmail: 'user@example.com',
        editionCode: 'full_source',
        paymentStatus: 'paid',
        paymentReference: 'ref1'
    };

    const dto = normalizeChannelOrder('kiaan_direct', rawPayload);
    const serialized = JSON.stringify(dto);

    // Assert that no Crockford 160-bit license key pattern exists in DTO
    const CROCKFORD_KEY_REGEX = /KHRM-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}/i;
    assert.ok(!CROCKFORD_KEY_REGEX.test(serialized));
    assert.strictEqual(dto.licenseKey, undefined);
    assert.strictEqual(dto.license_key, undefined);
    assert.strictEqual(dto.hash, undefined);
    assert.strictEqual(dto.pepper, undefined);
});

// ==============================================================================
// GROUP G: MULTI-SKU & CART SPLITTING DETERMINISM
// ==============================================================================

test('G1. Multi-SKU: Calling normalizeOrder on multi-item cart throws UNSUPPORTED_MULTI_SKU_ORDER', () => {
    const multiItemPayload = {
        orderId: 'CART-1001',
        buyerEmail: 'cart@example.com',
        paymentStatus: 'paid',
        paymentReference: 'pay_cart_1',
        items: [
            { editionCode: 'full_source', quantity: 1 },
            { editionCode: 'extended', quantity: 2 }
        ]
    };

    assert.throws(
        () => normalizeChannelOrder('kiaan_direct', multiItemPayload),
        err => err.code === 'UNSUPPORTED_MULTI_SKU_ORDER'
    );
});

test('G2. Multi-SKU: normalizeOrderUnits succeeds when stable line_item_id is present', () => {
    const multiItemPayload = {
        orderId: 'CART-1002',
        buyerEmail: 'cart2@example.com',
        paymentStatus: 'paid',
        paymentReference: 'pay_cart_2',
        items: [
            { line_item_id: 'item_src_01', editionCode: 'full_source', quantity: 1, unitPrice: 299 },
            { line_item_id: 'item_ext_02', editionCode: 'extended', quantity: 1, unitPrice: 599 }
        ]
    };

    const units = normalizeChannelOrderUnits('kiaan_direct', multiItemPayload);
    assert.strictEqual(units.length, 2);

    assert.strictEqual(units[0].channelOrderId, 'CART-1002#item_src_01');
    assert.strictEqual(units[0].sku, 'KHRM-SRC-LIFETIME');

    assert.strictEqual(units[1].channelOrderId, 'CART-1002#item_ext_02');
    assert.strictEqual(units[1].sku, 'KHRM-EXT-LIFETIME');
});

test('G3. Multi-SKU: normalizeOrderUnits rejects cart if ANY line item lacks stable line_item_id', () => {
    const ambiguousCart = {
        orderId: 'CART-1003',
        buyerEmail: 'cart3@example.com',
        paymentStatus: 'paid',
        paymentReference: 'pay_cart_3',
        items: [
            { line_item_id: 'item_01', editionCode: 'full_source' },
            { editionCode: 'extended' } // Missing line item ID! Mutating ID is prohibited.
        ]
    };

    assert.throws(
        () => normalizeChannelOrderUnits('kiaan_direct', ambiguousCart),
        err => err.code === 'UNSUPPORTED_MULTI_SKU_ORDER' && /mutating external order ID is prohibited/.test(err.message)
    );
});

// ==============================================================================
// GROUP H: PAYMENT FAIL-CLOSED NORMALIZATION
// ==============================================================================

test('H1. Payment Fail-Closed: Unknown payment status is strictly rejected (never defaults to PAID)', () => {
    const unknownStatuses = [
        'unknown',
        'maybe_paid',
        'partially_paid',
        'failed',
        'error',
        'requires_action',
        'unverified',
        'draft',
        'flagged',
        '1',
        'true'
    ];

    for (const status of unknownStatuses) {
        assert.throws(
            () => normalizePaymentStatus(status),
            err => err.code === 'INVALID_PAYMENT_STATUS',
            `Expected status '${status}' to be rejected, but it was accepted!`
        );
    }
});

test('H2. Payment Fail-Closed: Empty or null payment status throws INVALID_PAYMENT_STATUS', () => {
    assert.throws(() => normalizePaymentStatus(''), err => err.code === 'INVALID_PAYMENT_STATUS');
    assert.throws(() => normalizePaymentStatus('   '), err => err.code === 'INVALID_PAYMENT_STATUS');
    assert.throws(() => normalizePaymentStatus(null), err => err.code === 'INVALID_PAYMENT_STATUS');
    assert.throws(() => normalizePaymentStatus(undefined), err => err.code === 'INVALID_PAYMENT_STATUS');
});

test('H3. Payment Status Map: Canonical states are deterministically mapped', () => {
    assert.strictEqual(normalizePaymentStatus('paid'), 'PAID');
    assert.strictEqual(normalizePaymentStatus('captured'), 'PAID');
    assert.strictEqual(normalizePaymentStatus('success'), 'PAID');
    assert.strictEqual(normalizePaymentStatus('complete'), 'PAID');

    assert.strictEqual(normalizePaymentStatus('pending'), 'PENDING');
    assert.strictEqual(normalizePaymentStatus('awaiting'), 'PENDING');
    assert.strictEqual(normalizePaymentStatus('created'), 'PENDING');

    assert.strictEqual(normalizePaymentStatus('refunded'), 'REFUNDED');
    assert.strictEqual(normalizePaymentStatus('refund'), 'REFUNDED');

    assert.strictEqual(normalizePaymentStatus('dispute'), 'DISPUTED');
    assert.strictEqual(normalizePaymentStatus('chargeback'), 'DISPUTED');
});

// ==============================================================================
// GROUP I: INTEGRATION BOUNDARY (Adapter -> CanonicalOrderDTO -> OrderIngestionService)
// ==============================================================================

test('I1. Integration Boundary: Provider payload -> Adapter -> CanonicalOrderDTO -> Ingestion Service mock', async () => {
    // 1. Raw provider payload (CodeCanyon purchase code verification)
    const rawProviderPayload = {
        purchase_code: 'codecanyon-prod-test-998877',
        item: {
            id: 123456,
            name: 'Kiaan HRM Pro'
        },
        buyer: 'corporate_partner',
        buyer_email: 'partner@example.com',
        licence: 'Regular License',
        amount: '49.00',
        currency: 'USD'
    };

    // 2. Adapter Normalization
    const canonicalOrder = normalizeChannelOrder('codecanyon', rawProviderPayload);
    assert.ok(canonicalOrder instanceof CanonicalOrderDTO);

    // 3. Mock OrderIngestionService verifying contract compatibility
    const mockIngestionService = {
        async ingestOrder(dto) {
            // Strictly verifies that the adapter produces an object compatible with ingestOrder
            assert.strictEqual(dto.salesChannelId, 'codecanyon');
            assert.strictEqual(dto.channelOrderId, 'codecanyon-prod-test-998877');
            assert.strictEqual(dto.productId, 'kiaan-hrm');
            assert.strictEqual(dto.editionCode, 'full_source');
            assert.strictEqual(dto.sku, 'KHRM-SRC-LIFETIME');
            assert.strictEqual(dto.paymentStatus, 'PAID');
            assert.strictEqual(dto.quantity, 1);
            assert.strictEqual(dto.buyerEmail, 'partner@example.com');

            return {
                isReplay: false,
                orderId: 101,
                orderNumber: 'ORD-2026-TEST101',
                salesChannelId: dto.salesChannelId,
                channelOrderId: dto.channelOrderId,
                sku: dto.sku,
                quantity: dto.quantity,
                paymentStatus: dto.paymentStatus,
                licenses: [
                    {
                        licenseId: 'LIC-2026-FULL_SOURCE-TEST1',
                        productId: dto.productId,
                        editionCode: dto.editionCode,
                        sku: dto.sku,
                        status: 'ISSUED',
                        sequenceNumber: 1
                    }
                ]
            };
        }
    };

    // 4. Pass canonical order to ingestion service boundary
    const result = await mockIngestionService.ingestOrder(canonicalOrder);

    assert.strictEqual(result.orderNumber, 'ORD-2026-TEST101');
    assert.strictEqual(result.licenses.length, 1);
    assert.strictEqual(result.licenses[0].sku, 'KHRM-SRC-LIFETIME');
});
