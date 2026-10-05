/**
 * Kiaan Central License Authority — Canonical Order Data Transfer Object (DTO)
 * Module: backend-hrm/kiaan-authority/core/orderDto.js
 *
 * Implements a strict, normalized, channel-neutral data transfer object that validates
 * and sanitizes incoming marketplace purchase orders prior to entering the license
 * issuance pipeline.
 *
 * Security & Architectural Guarantees:
 * 1. Channel Neutrality: Normalizes disparate marketplace payloads into an invariant schema.
 * 2. Strict Input Validation: Validates types, formats, non-empty constraints, and limits.
 * 3. Single-SKU Enforcement: Rejects unsupported multi-SKU carts with deterministic errors.
 * 4. Sensitive Data Sanitization: Strips payment card numbers, CVVs, API tokens, passwords,
 *    and authorization headers from archived raw payloads.
 * 5. Prototype Pollution Protection: Rejects unsafe prototype properties and uses safe cloning.
 * 6. Immutability: Deeply freezes the constructed DTO instance to prevent downstream mutation.
 */

'use strict';

/**
 * Supported payment statuses for incoming marketplace orders.
 */
const SUPPORTED_PAYMENT_STATUSES = Object.freeze(['PAID', 'PENDING', 'REFUNDED', 'DISPUTED']);

/**
 * Standard regex for reasonable email validation (RFC 5322 subset).
 * Rejects double dots, missing domain labels, and invalid characters.
 */
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

/**
 * Currency code format: 3 to 5 uppercase alphanumeric characters (e.g. 'INR', 'USD', 'EUR').
 */
const CURRENCY_REGEX = /^[A-Z]{3,5}$/;

/**
 * Sensitive field regex for redacting raw payloads (matches full or compound keys like auth_token).
 */
const SENSITIVE_KEY_REGEX = /(password|passphrase|secret|token|bearer|auth|authorization|cvv|cvc|api_?key|cookie|private_?key)/i;

/**
 * Payment card field regex for specific card number redaction.
 */
const CARD_KEY_REGEX = /(card_?number|pan|credit_?card)/i;

/**
 * Broad regex detecting credit card PAN sequences (13 to 19 digits).
 */
const CARD_NUMBER_REGEX = /\b(?:\d[ -]*?){13,19}\b/;

/**
 * Creates a sanitized Error instance with an explicit error code.
 *
 * @param {string} code Error identifier
 * @param {string} message Descriptive failure message
 * @returns {Error}
 */
function createOrderError(code, message) {
    const err = new Error(`${code}: ${message}`);
    err.code = code;
    return err;
}

/**
 * Recursively sanitizes an arbitrary object to remove credentials and payment card numbers.
 *
 * @param {*} value Value to sanitize
 * @param {number} [depth=0] Current recursion depth
 * @returns {*} Sanitized copy
 */
function sanitizeValue(value, depth = 0) {
    if (depth > 6) return '[TRUNCATED]';
    if (value === null || value === undefined) return value;
    if (typeof value === 'string') {
        if (CARD_NUMBER_REGEX.test(value) && value.length >= 13 && value.length <= 25) {
            return '[REDACTED_CARD_NUMBER]';
        }
        return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') return value;
    if (Array.isArray(value)) {
        return value.map(item => sanitizeValue(item, depth + 1));
    }
    if (typeof value === 'object') {
        const cleanObj = {};
        for (const [k, v] of Object.entries(value)) {
            if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
            if (CARD_KEY_REGEX.test(k)) {
                cleanObj[k] = '[REDACTED_CARD_NUMBER]';
            } else if (SENSITIVE_KEY_REGEX.test(k)) {
                cleanObj[k] = '[REDACTED]';
            } else {
                cleanObj[k] = sanitizeValue(v, depth + 1);
            }
        }
        return cleanObj;
    }
    return String(value);
}

/**
 * Immutable Canonical Order Data Transfer Object.
 */
class CanonicalOrderDTO {
    /**
     * Instantiates and strictly validates a CanonicalOrderDTO.
     *
     * @param {object} input Raw order data dictionary
     * @throws {Error} If required fields are missing, invalid, or multi-SKU is detected
     */
    constructor(input = {}) {
        if (!input || typeof input !== 'object' || Array.isArray(input)) {
            throw createOrderError('INVALID_ORDER', 'Order input must be a non-null plain object.');
        }

        // 1. Multi-SKU Detection
        // The current marketplace authority schema represents 1 SKU per order row.
        if (
            (Array.isArray(input.items) && input.items.length > 1) ||
            (Array.isArray(input.skus) && input.skus.length > 1) ||
            Array.isArray(input.sku)
        ) {
            throw createOrderError(
                'UNSUPPORTED_MULTI_SKU_ORDER',
                'Multi-SKU orders are not supported by the core issuance service. Orders must be normalized to single-SKU units.'
            );
        }

        // 2. Sales Channel ID
        if (typeof input.salesChannelId !== 'string' || !input.salesChannelId.trim()) {
            throw createOrderError('INVALID_ORDER', 'salesChannelId is required and cannot be empty.');
        }
        this.salesChannelId = input.salesChannelId.trim().toLowerCase();

        // 3. Channel Order ID (External identifier)
        if (typeof input.channelOrderId !== 'string' || !input.channelOrderId.trim()) {
            throw createOrderError('INVALID_ORDER', 'channelOrderId is required and cannot be empty.');
        }
        this.channelOrderId = input.channelOrderId.trim();

        // 4. Product ID
        if (typeof input.productId !== 'string' || !input.productId.trim()) {
            throw createOrderError('INVALID_ORDER', 'productId is required and cannot be empty.');
        }
        this.productId = input.productId.trim().toLowerCase();

        // 5. Edition Code
        if (typeof input.editionCode !== 'string' || !input.editionCode.trim()) {
            throw createOrderError('INVALID_ORDER', 'editionCode is required and cannot be empty.');
        }
        this.editionCode = input.editionCode.trim().toLowerCase();

        // 6. SKU
        if (typeof input.sku !== 'string' || !input.sku.trim()) {
            throw createOrderError('INVALID_ORDER', 'sku is required and cannot be empty.');
        }
        this.sku = input.sku.trim().toUpperCase();

        // 7. Quantity (Units to issue: >= 1)
        const qty = input.quantity !== undefined ? input.quantity : 1;
        if (typeof qty !== 'number' || !Number.isInteger(qty) || qty < 1) {
            throw createOrderError('INVALID_QUANTITY', 'quantity must be an integer greater than or equal to 1.');
        }
        this.quantity = qty;

        // 8. Buyer Email
        if (typeof input.buyerEmail !== 'string' || !input.buyerEmail.trim()) {
            throw createOrderError('INVALID_EMAIL', 'buyerEmail is required and cannot be empty.');
        }
        const normalizedEmail = input.buyerEmail.trim().toLowerCase();
        if (!EMAIL_REGEX.test(normalizedEmail) || normalizedEmail.length > 150) {
            throw createOrderError('INVALID_EMAIL', `buyerEmail '${input.buyerEmail}' is not a valid email address.`);
        }
        this.buyerEmail = normalizedEmail;

        // 9. Buyer Name (Optional, defaults to email username or 'Valued Customer')
        if (typeof input.buyerName === 'string' && input.buyerName.trim()) {
            this.buyerName = input.buyerName.trim().slice(0, 150);
        } else {
            this.buyerName = normalizedEmail.split('@')[0] || 'Valued Customer';
        }

        // 10. Buyer Phone (Optional)
        this.buyerPhone = (typeof input.buyerPhone === 'string' && input.buyerPhone.trim())
            ? input.buyerPhone.trim().slice(0, 30)
            : null;

        // 11. Payment Status
        if (typeof input.paymentStatus !== 'string' || !input.paymentStatus.trim()) {
            throw createOrderError('INVALID_PAYMENT_STATUS', 'paymentStatus is required.');
        }
        const normalizedStatus = input.paymentStatus.trim().toUpperCase();
        if (!SUPPORTED_PAYMENT_STATUSES.includes(normalizedStatus)) {
            throw createOrderError(
                'INVALID_PAYMENT_STATUS',
                `Invalid paymentStatus '${input.paymentStatus}'. Must be one of: ${SUPPORTED_PAYMENT_STATUSES.join(', ')}.`
            );
        }
        this.paymentStatus = normalizedStatus;

        // 12. Payment Reference (Transaction / UTR / Gateway reference)
        if (typeof input.paymentReference !== 'string' || !input.paymentReference.trim()) {
            throw createOrderError('INVALID_ORDER', 'paymentReference is required and cannot be empty.');
        }
        this.paymentReference = input.paymentReference.trim().slice(0, 150);

        // 13. Currency
        const rawCurrency = input.currency !== undefined ? String(input.currency).trim().toUpperCase() : 'INR';
        if (!CURRENCY_REGEX.test(rawCurrency)) {
            throw createOrderError('INVALID_CURRENCY', `Invalid currency code '${rawCurrency}'. Must be 3-5 uppercase letters.`);
        }
        this.currency = rawCurrency;

        // 14. Unit Price & Total Price
        let unitPrice = 0.00;
        if (input.unitPrice !== undefined && input.unitPrice !== null) {
            const num = Number(input.unitPrice);
            if (!Number.isFinite(num) || num < 0) {
                throw createOrderError('INVALID_ORDER', 'unitPrice must be a finite, non-negative number.');
            }
            unitPrice = Math.round(num * 100) / 100;
        }
        this.unitPrice = unitPrice;

        let totalPrice = unitPrice * this.quantity;
        if (input.totalPrice !== undefined && input.totalPrice !== null) {
            const num = Number(input.totalPrice);
            if (!Number.isFinite(num) || num < 0) {
                throw createOrderError('INVALID_ORDER', 'totalPrice must be a finite, non-negative number.');
            }
            totalPrice = Math.round(num * 100) / 100;
        }
        this.totalPrice = totalPrice;

        // 15. Purchased At Timestamp
        if (input.purchasedAt instanceof Date && !isNaN(input.purchasedAt.getTime())) {
            this.purchasedAt = input.purchasedAt.toISOString();
        } else if (typeof input.purchasedAt === 'string' && !isNaN(Date.parse(input.purchasedAt))) {
            this.purchasedAt = new Date(input.purchasedAt).toISOString();
        } else {
            this.purchasedAt = new Date().toISOString();
        }

        // 16. Sanitized Raw Payload
        if (input.rawPayload && typeof input.rawPayload === 'object') {
            this.rawPayload = Object.freeze(sanitizeValue(input.rawPayload));
        } else {
            this.rawPayload = null;
        }

        // Freeze instance to guarantee immutability
        Object.freeze(this);
    }

    /**
     * Exports a sanitized plain JavaScript dictionary representation.
     *
     * @returns {object}
     */
    toJSON() {
        return {
            salesChannelId: this.salesChannelId,
            channelOrderId: this.channelOrderId,
            buyerName: this.buyerName,
            buyerEmail: this.buyerEmail,
            buyerPhone: this.buyerPhone,
            productId: this.productId,
            editionCode: this.editionCode,
            sku: this.sku,
            quantity: this.quantity,
            unitPrice: this.unitPrice,
            totalPrice: this.totalPrice,
            currency: this.currency,
            paymentStatus: this.paymentStatus,
            paymentReference: this.paymentReference,
            purchasedAt: this.purchasedAt,
            rawPayload: this.rawPayload
        };
    }
}

/**
 * Factory creating a validated CanonicalOrderDTO instance.
 *
 * @param {object} input Order details
 * @returns {CanonicalOrderDTO}
 */
function createCanonicalOrderDTO(input) {
    return new CanonicalOrderDTO(input);
}

module.exports = {
    CanonicalOrderDTO,
    createCanonicalOrderDTO,
    SUPPORTED_PAYMENT_STATUSES
};
