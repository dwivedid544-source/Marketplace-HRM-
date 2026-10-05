/**
 * Kiaan Central License Authority — CanonicalOrderDTO Unit Tests
 * Module: backend-hrm/kiaan-authority/core/orderDto.test.js
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { CanonicalOrderDTO, createCanonicalOrderDTO } = require('./orderDto');

const VALID_ORDER_INPUT = Object.freeze({
    salesChannelId: 'kiaan_direct',
    channelOrderId: 'pay_order_2026_001',
    buyerName: 'Jane Doe',
    buyerEmail: 'jane.doe@example.com',
    buyerPhone: '+919876543210',
    productId: 'kiaan-hrm',
    editionCode: 'full_source',
    sku: 'KHRM-SRC-LIFETIME',
    quantity: 1,
    unitPrice: 299.00,
    totalPrice: 299.00,
    currency: 'USD',
    paymentStatus: 'PAID',
    paymentReference: 'txn_razorpay_998877',
    purchasedAt: '2026-03-15T12:00:00.000Z',
    rawPayload: {
        orderId: 'pay_order_2026_001',
        gateway: 'razorpay'
    }
});

test('1. Valid CanonicalOrderDTO instantiation', () => {
    const dto = new CanonicalOrderDTO(VALID_ORDER_INPUT);

    assert.strictEqual(dto.salesChannelId, 'kiaan_direct');
    assert.strictEqual(dto.channelOrderId, 'pay_order_2026_001');
    assert.strictEqual(dto.buyerName, 'Jane Doe');
    assert.strictEqual(dto.buyerEmail, 'jane.doe@example.com');
    assert.strictEqual(dto.buyerPhone, '+919876543210');
    assert.strictEqual(dto.productId, 'kiaan-hrm');
    assert.strictEqual(dto.editionCode, 'full_source');
    assert.strictEqual(dto.sku, 'KHRM-SRC-LIFETIME');
    assert.strictEqual(dto.quantity, 1);
    assert.strictEqual(dto.unitPrice, 299.00);
    assert.strictEqual(dto.totalPrice, 299.00);
    assert.strictEqual(dto.currency, 'USD');
    assert.strictEqual(dto.paymentStatus, 'PAID');
    assert.strictEqual(dto.paymentReference, 'txn_razorpay_998877');
    assert.strictEqual(dto.purchasedAt, '2026-03-15T12:00:00.000Z');
    assert.ok(dto.rawPayload);
    assert.strictEqual(Object.isFrozen(dto), true);

    // Factory helper
    const dtoFromFactory = createCanonicalOrderDTO(VALID_ORDER_INPUT);
    assert.strictEqual(dtoFromFactory.sku, 'KHRM-SRC-LIFETIME');
});

test('2. Missing required fields are rejected with INVALID_ORDER', () => {
    const requiredFields = [
        'salesChannelId',
        'channelOrderId',
        'productId',
        'editionCode',
        'sku',
        'paymentReference'
    ];

    for (const field of requiredFields) {
        const invalidInput = { ...VALID_ORDER_INPUT, [field]: '' };
        assert.throws(
            () => new CanonicalOrderDTO(invalidInput),
            err => err.code === 'INVALID_ORDER',
            `Expected INVALID_ORDER when '${field}' is empty`
        );
    }
});

test('3. Invalid or malformed email is rejected with INVALID_EMAIL', () => {
    const invalidEmails = [
        '',
        '   ',
        'plainaddress',
        '@missingusername.com',
        'username@.com',
        'username@domain..com'
    ];

    for (const email of invalidEmails) {
        assert.throws(
            () => new CanonicalOrderDTO({ ...VALID_ORDER_INPUT, buyerEmail: email }),
            err => err.code === 'INVALID_EMAIL',
            `Expected INVALID_EMAIL for '${email}'`
        );
    }
});

test('4. Quantity 0 is rejected with INVALID_QUANTITY', () => {
    assert.throws(
        () => new CanonicalOrderDTO({ ...VALID_ORDER_INPUT, quantity: 0 }),
        err => err.code === 'INVALID_QUANTITY'
    );
});

test('5. Negative quantity is rejected with INVALID_QUANTITY', () => {
    assert.throws(
        () => new CanonicalOrderDTO({ ...VALID_ORDER_INPUT, quantity: -2 }),
        err => err.code === 'INVALID_QUANTITY'
    );
});

test('6. Fractional quantity is rejected with INVALID_QUANTITY', () => {
    assert.throws(
        () => new CanonicalOrderDTO({ ...VALID_ORDER_INPUT, quantity: 1.5 }),
        err => err.code === 'INVALID_QUANTITY'
    );
});

test('7. Invalid currency is rejected with INVALID_CURRENCY', () => {
    assert.throws(
        () => new CanonicalOrderDTO({ ...VALID_ORDER_INPUT, currency: 'US' }),
        err => err.code === 'INVALID_CURRENCY'
    );
    assert.throws(
        () => new CanonicalOrderDTO({ ...VALID_ORDER_INPUT, currency: 'TOOLONG' }),
        err => err.code === 'INVALID_CURRENCY'
    );
});

test('8. Invalid payment status is rejected with INVALID_PAYMENT_STATUS', () => {
    assert.throws(
        () => new CanonicalOrderDTO({ ...VALID_ORDER_INPUT, paymentStatus: 'AUTHORIZED' }),
        err => err.code === 'INVALID_PAYMENT_STATUS'
    );
    assert.throws(
        () => new CanonicalOrderDTO({ ...VALID_ORDER_INPUT, paymentStatus: '' }),
        err => err.code === 'INVALID_PAYMENT_STATUS'
    );
});

test('9. Malformed or whitespace-only order ID is rejected', () => {
    assert.throws(
        () => new CanonicalOrderDTO({ ...VALID_ORDER_INPUT, channelOrderId: '   ' }),
        err => err.code === 'INVALID_ORDER'
    );
});

test('10. Multi-SKU cart shapes are strictly rejected with UNSUPPORTED_MULTI_SKU_ORDER', () => {
    // Array of items
    assert.throws(
        () => new CanonicalOrderDTO({
            ...VALID_ORDER_INPUT,
            items: [{ sku: 'KHRM-DIST-LIFETIME' }, { sku: 'KHRM-SRC-LIFETIME' }]
        }),
        err => err.code === 'UNSUPPORTED_MULTI_SKU_ORDER'
    );

    // Array of SKUs
    assert.throws(
        () => new CanonicalOrderDTO({
            ...VALID_ORDER_INPUT,
            skus: ['KHRM-DIST-LIFETIME', 'KHRM-SRC-LIFETIME']
        }),
        err => err.code === 'UNSUPPORTED_MULTI_SKU_ORDER'
    );

    // SKU is array
    assert.throws(
        () => new CanonicalOrderDTO({
            ...VALID_ORDER_INPUT,
            sku: ['KHRM-SRC-LIFETIME']
        }),
        err => err.code === 'UNSUPPORTED_MULTI_SKU_ORDER'
    );
});

test('11. Raw payload sanitizes sensitive credentials and card numbers', () => {
    const rawWithCredentials = {
        transaction_id: 'tx_12345',
        password: 'super_secret_buyer_password',
        authorization: 'Bearer secret_jwt_token_here',
        card_number: '4111 2222 3333 4444',
        cvv: '123',
        nested: {
            api_key: 'sk_live_very_secret_api_key',
            credit_card: '5500 0000 0000 0004',
            safe_detail: 'express delivery'
        }
    };

    const dto = new CanonicalOrderDTO({
        ...VALID_ORDER_INPUT,
        rawPayload: rawWithCredentials
    });

    const payload = dto.rawPayload;
    assert.strictEqual(payload.transaction_id, 'tx_12345');
    assert.strictEqual(payload.password, '[REDACTED]');
    assert.strictEqual(payload.authorization, '[REDACTED]');
    assert.strictEqual(payload.cvv, '[REDACTED]');
    assert.strictEqual(payload.card_number, '[REDACTED_CARD_NUMBER]');
    assert.strictEqual(payload.nested.api_key, '[REDACTED]');
    assert.strictEqual(payload.nested.credit_card, '[REDACTED_CARD_NUMBER]');
    assert.strictEqual(payload.nested.safe_detail, 'express delivery');
});

test('12. Prototype pollution attempts are safely rejected or neutralized', () => {
    const maliciousPayload = JSON.parse('{"__proto__": {"polluted": true}, "channelOrderId": "123"}');
    
    assert.throws(
        () => new CanonicalOrderDTO(maliciousPayload),
        err => err.code === 'INVALID_ORDER'
    );

    assert.strictEqual(Object.prototype.polluted, undefined);
});
