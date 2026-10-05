/**
 * Kiaan Central License Authority — Order Ingestion & License Issuance Service
 * Module: backend-hrm/kiaan-authority/services/orderIngestionService.js
 *
 * Implements the core transactional order ingestion and commercial license issuance pipeline.
 *
 * Architecture & Security Guarantees:
 * 1. Transactional Atomicity: All database mutations (order, licenses, outbox) execute
 *    within a single atomic database transaction. Partial failure triggers a complete rollback.
 * 2. Idempotency & Replay Protection: Unique `(sales_channel_id, channel_order_id)` constraint
 *    and row-level locking (`SELECT ... FOR UPDATE`) guarantee that duplicate webhooks return
 *    existing license metadata without duplicate key generation or duplicate outbox rows.
 * 3. Exact Multi-Unit Issuance: `quantity >= 1` generates exactly one distinct 160-bit license
 *    per purchased unit (1 Unit = 1 Unique License).
 * 4. Zero Plaintext Persistence: Plaintext license keys are NEVER persisted in `marketplace_licenses`.
 *    Only HMAC-SHA256 hashes (`license_key_hash`) and masked hints (`key_hint`) are stored.
 * 5. Secret Containment: Plaintext keys are returned ONLY in the transient issuance result for
 *    the initial buyer delivery. Replay requests never reconstruct or expose plaintext keys.
 * 6. Email Outbox Staging: Stages transactional email in `license_email_outbox` in `queued` state.
 *    Never dispatches emails synchronously inside the order database transaction.
 * 7. Domain Activation Separation: Does NOT bind domains or write to `license_activations` (Phase 2B.8E scope).
 *    Newly issued licenses start strictly with `status = 'ISSUED'`, `bound_domain = NULL`, `sequence_number = 1`.
 */

'use strict';

const crypto = require('crypto');
const { CanonicalOrderDTO } = require('../core/orderDto');
const defaultKeyGenerator = require('../core/keyGenerator');

let sealOutboxPayload;
try {
    const outboxCrypto = require('./outboxCrypto');
    sealOutboxPayload = outboxCrypto.sealOutboxPayload;
} catch (_) {
    sealOutboxPayload = null;
}

/**
 * Creates a sanitized Error instance with an explicit error code.
 *
 * @param {string} code Error identifier
 * @param {string} message Descriptive failure message
 * @returns {Error}
 */
function createServiceError(code, message) {
    const err = new Error(`${code}: ${message}`);
    err.code = code;
    return err;
}

/**
 * Generates an internal Kiaan order reference number.
 * Format: ORD-YYYY-XXXXXXXX (e.g. ORD-2026-A1B2C3D4)
 *
 * @returns {string}
 */
function generateOrderNumber() {
    const year = new Date().getFullYear();
    const randomHex = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `ORD-${year}-${randomHex}`;
}

/**
 * Generates an internal license identifier.
 * Format: LIC-YYYY-EDITION-XXXXXXXX (e.g. LIC-2026-FULL_SOURCE-9E3F8A1B)
 *
 * @param {string} editionCode Edition code
 * @returns {string}
 */
function generateLicenseId(editionCode) {
    const year = new Date().getFullYear();
    const normalizedEdition = String(editionCode || 'HRM').toUpperCase().replace(/[^A-Z0-9]/g, '_');
    const randomHex = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `LIC-${year}-${normalizedEdition}-${randomHex}`;
}

/**
 * Generates a clean HTML email template for the outbox queue.
 *
 * @param {object} params Email parameters
 * @returns {string} HTML content
 */
function generateLicenseEmailHtml(params) {
    const unitText = params.totalUnits > 1 ? ` (License ${params.unitIndex} of ${params.totalUnits})` : '';
    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Your Kiaan HRM Pro License</title></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #0f172a; padding: 24px; border-radius: 8px; color: #fff; text-align: center;">
    <h1 style="margin: 0; font-size: 24px; color: #38bdf8;">Kiaan HRM Pro</h1>
    <p style="margin: 4px 0 0 0; color: #94a3b8;">Commercial License Key Delivery${unitText}</p>
  </div>
  <div style="padding: 24px 0;">
    <p>Dear <strong>${params.buyerName || 'Valued Customer'}</strong>,</p>
    <p>Thank you for purchasing <strong>${params.editionName}</strong> (SKU: <code>${params.sku}</code>). Your commercial software license has been successfully generated.</p>
    <div style="background-color: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; padding: 16px; margin: 20px 0; text-align: center;">
      <div style="font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">Your 160-bit Commercial License Key</div>
      <div style="font-family: monospace; font-size: 18px; font-weight: bold; color: #0284c7; letter-spacing: 1px; word-break: break-all;">${params.licenseKey}</div>
      <div style="font-size: 12px; color: #64748b; margin-top: 8px;">Key Hint: ${params.keyHint} | Order: ${params.orderNumber}</div>
    </div>
    <h3>Next Steps — Activating Your Installation:</h3>
    <ol>
      <li>Deploy Kiaan HRM Pro on your target domain or server environment.</li>
      <li>Log in to your installation as Superadmin and navigate to <strong>Settings &rarr; Licensing</strong>.</li>
      <li>Paste the license key above to bind the installation to your authorized production domain.</li>
    </ol>
    <p style="font-size: 12px; color: #64748b;">Please store this license key in a secure location. Each license key can only be activated on one authorized production domain at a time.</p>
  </div>
  <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 12px; color: #94a3b8; text-align: center;">
    &copy; ${new Date().getFullYear()} Kiaan Technology. All rights reserved.
  </div>
</body>
</html>`;
}

/**
 * Isolated Central Authority Order Ingestion & License Issuance Service.
 */
class OrderIngestionService {
    /**
     * Instantiates an OrderIngestionService.
     *
     * @param {object} options Service options
     * @param {object} options.db Database connection or pool (MySQL2 promise interface)
     * @param {string|Buffer} [options.pepper] Secret license pepper (minimum 32 bytes)
     * @param {object} [options.config] Injected AuthorityConfig instance
     * @param {object} [options.keyGenerator] Injected keyGenerator module (for testing)
     * @param {object} [options.logger] Injected logger instance
     */
    constructor(options = {}) {
        this.db = options.db || null;
        this.keyGenerator = options.keyGenerator || defaultKeyGenerator;
        this.logger = options.logger || console;

        // Resolve pepper
        if (options.pepper) {
            this.pepper = options.pepper;
        } else if (options.config && typeof options.config.getPepper === 'function') {
            try {
                this.pepper = options.config.getPepper();
            } catch (_) {
                this.pepper = null;
            }
        } else {
            this.pepper = process.env.CENTRAL_LICENSE_PEPPER || null;
        }

        // Resolve optional outbox encryption key (Phase 2B.8F)
        if (options.outboxEncryptionKey) {
            this.outboxEncryptionKey = options.outboxEncryptionKey;
        } else if (options.config && typeof options.config.getOutboxEncryptionKey === 'function') {
            try {
                this.outboxEncryptionKey = options.config.getOutboxEncryptionKey();
            } catch (_) {
                this.outboxEncryptionKey = null;
            }
        } else {
            this.outboxEncryptionKey = process.env.OUTBOX_ENCRYPTION_KEY || null;
        }
    }

    /**
     * Resolves an existing order and its associated licenses idempotently.
     *
     * @param {object} connection Active database connection
     * @param {string} salesChannelId Channel identifier
     * @param {string} channelOrderId Channel order identifier
     * @returns {Promise<object>} Idempotent replay result
     * @private
     */
    async _resolveExistingOrder(connection, salesChannelId, channelOrderId) {
        const [orderRows] = await connection.query(
            `SELECT id, order_number, sales_channel_id, channel_order_id, sku, quantity, payment_status, created_at
             FROM marketplace_orders
             WHERE sales_channel_id = ? AND channel_order_id = ?
             LIMIT 1`,
            [salesChannelId, channelOrderId]
        );

        if (!orderRows || orderRows.length === 0) {
            throw createServiceError('ORDER_NOT_FOUND', `Existing order not found for channel order '${channelOrderId}'.`);
        }

        const existingOrder = orderRows[0];

        const [licenseRows] = await connection.query(
            `SELECT license_id, product_id, edition_code, sku, key_hint, status, sequence_number, created_at
             FROM marketplace_licenses
             WHERE order_id = ?
             ORDER BY id ASC`,
            [existingOrder.id]
        );

        return {
            isReplay: true,
            orderId: existingOrder.id,
            orderNumber: existingOrder.order_number,
            salesChannelId: existingOrder.sales_channel_id,
            channelOrderId: existingOrder.channel_order_id,
            sku: existingOrder.sku,
            quantity: existingOrder.quantity,
            paymentStatus: existingOrder.payment_status,
            licenses: (licenseRows || []).map(lic => ({
                licenseId: lic.license_id,
                productId: lic.product_id,
                editionCode: lic.edition_code,
                sku: lic.sku,
                keyHint: lic.key_hint,
                status: lic.status,
                sequenceNumber: lic.sequence_number
                // NOTE: Plaintext license key is NEVER reconstructed or returned on replay
            }))
        };
    }

    /**
     * Ingests a canonical purchase order and issues unique commercial software licenses.
     *
     * @param {CanonicalOrderDTO|object} orderInput Normalized order details
     * @returns {Promise<{ isReplay: boolean, orderId: number, orderNumber: string, salesChannelId: string, channelOrderId: string, sku: string, quantity: number, paymentStatus: string, licenses: Array<{ licenseId: string, licenseKey?: string, keyHint: string, productId: string, editionCode: string, sku: string, status: string, sequenceNumber: number }> }>}
     */
    async ingestOrder(orderInput) {
        // 1. DTO Validation
        const dto = (orderInput instanceof CanonicalOrderDTO)
            ? orderInput
            : new CanonicalOrderDTO(orderInput);

        // 2. Strict Payment Status Check: Must be 'PAID' to issue licenses
        if (dto.paymentStatus !== 'PAID') {
            throw createServiceError(
                'ORDER_NOT_PAID',
                `Cannot issue commercial license for order with status '${dto.paymentStatus}'. Must be 'PAID'.`
            );
        }

        // 3. Cryptographic Pepper Validation
        if (!this.pepper) {
            throw createServiceError(
                'PEPPER_CONFIGURATION_ERROR',
                'CENTRAL_LICENSE_PEPPER is required for license issuance but is not configured.'
            );
        }
        this.keyGenerator.validatePepper(this.pepper);

        // 4. Acquire Database Connection
        if (!this.db) {
            throw createServiceError('NO_DATABASE_CONNECTION', 'Database connection or pool was not provided.');
        }

        const connection = typeof this.db.getConnection === 'function'
            ? await this.db.getConnection()
            : this.db;

        let transactionActive = false;

        try {
            // 5. Begin Transaction
            if (typeof connection.beginTransaction === 'function') {
                await connection.beginTransaction();
                transactionActive = true;
            }

            // 6. Idempotency Check & Row Lock (SELECT ... FOR UPDATE)
            const [existingRows] = await connection.query(
                `SELECT id, order_number, sales_channel_id, channel_order_id, sku, quantity, payment_status, created_at
                 FROM marketplace_orders
                 WHERE sales_channel_id = ? AND channel_order_id = ?
                 FOR UPDATE`,
                [dto.salesChannelId, dto.channelOrderId]
            );

            if (existingRows && existingRows.length > 0) {
                // Idempotent Replay: Order already exists
                const existingResult = await this._resolveExistingOrder(
                    connection,
                    dto.salesChannelId,
                    dto.channelOrderId
                );

                if (transactionActive && typeof connection.commit === 'function') {
                    await connection.commit();
                    transactionActive = false;
                }

                return existingResult;
            }

            // 7. Validate Product in Database
            const [productRows] = await connection.query(
                `SELECT product_id, product_name, is_active
                 FROM marketplace_products
                 WHERE product_id = ?
                 LIMIT 1`,
                [dto.productId]
            );

            if (!productRows || productRows.length === 0) {
                throw createServiceError('PRODUCT_NOT_FOUND', `Product '${dto.productId}' does not exist in registry.`);
            }

            const product = productRows[0];
            if (!product.is_active) {
                throw createServiceError('PRODUCT_INACTIVE', `Product '${dto.productId}' is currently inactive.`);
            }

            // 8. Validate Edition & SKU in Database
            const [editionRows] = await connection.query(
                `SELECT product_id, edition_code, sku, edition_name, has_backend_source, has_extended_features, default_entitlements, is_active
                 FROM marketplace_editions
                 WHERE sku = ?
                 LIMIT 1`,
                [dto.sku]
            );

            if (!editionRows || editionRows.length === 0) {
                throw createServiceError('EDITION_NOT_FOUND', `Commercial edition SKU '${dto.sku}' not found.`);
            }

            const edition = editionRows[0];
            if (!edition.is_active) {
                throw createServiceError('EDITION_INACTIVE', `Commercial edition SKU '${dto.sku}' is currently inactive.`);
            }

            if (edition.product_id.toLowerCase() !== dto.productId) {
                throw createServiceError(
                    'SKU_MISMATCH',
                    `SKU '${dto.sku}' belongs to product '${edition.product_id}', not requested '${dto.productId}'.`
                );
            }

            if (edition.edition_code.toLowerCase() !== dto.editionCode) {
                throw createServiceError(
                    'SKU_MISMATCH',
                    `SKU '${dto.sku}' is edition '${edition.edition_code}', not requested '${dto.editionCode}'.`
                );
            }

            // 9. Validate Sales Channel in Database
            const [channelRows] = await connection.query(
                `SELECT channel_id, channel_name, is_active
                 FROM marketplace_sales_channels
                 WHERE channel_id = ?
                 LIMIT 1`,
                [dto.salesChannelId]
            );

            if (!channelRows || channelRows.length === 0) {
                throw createServiceError('SALES_CHANNEL_NOT_FOUND', `Sales channel '${dto.salesChannelId}' not found.`);
            }

            const channel = channelRows[0];
            if (!channel.is_active) {
                throw createServiceError('SALES_CHANNEL_INACTIVE', `Sales channel '${dto.salesChannelId}' is currently inactive.`);
            }

            // 10. Resolve Entitlements
            let entitlements = edition.default_entitlements;
            if (typeof entitlements === 'string') {
                try {
                    entitlements = JSON.parse(entitlements);
                } catch (_) {
                    entitlements = {};
                }
            }

            // 11. Generate Order Number & Insert marketplace_orders
            const orderNumber = generateOrderNumber();
            const rawPayloadJson = dto.rawPayload ? JSON.stringify(dto.rawPayload) : null;

            const [orderInsertResult] = await connection.query(
                `INSERT INTO marketplace_orders
                 (order_number, sales_channel_id, channel_order_id, buyer_name, buyer_email, buyer_phone, sku, quantity, unit_price, total_price, currency, payment_status, payment_reference, raw_payload)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    orderNumber,
                    dto.salesChannelId,
                    dto.channelOrderId,
                    dto.buyerName,
                    dto.buyerEmail,
                    dto.buyerPhone,
                    dto.sku,
                    dto.quantity,
                    dto.unitPrice,
                    dto.totalPrice,
                    dto.currency,
                    dto.paymentStatus,
                    dto.paymentReference,
                    rawPayloadJson
                ]
            );

            const orderId = orderInsertResult.insertId;

            // 12. Multi-Unit License Generation (1 Unit = 1 Unique License)
            const issuedLicenses = [];

            for (let i = 1; i <= dto.quantity; i++) {
                // A. Generate unique 160-bit Crockford Base32 key with CRC16 checksum
                const keyDetails = this.keyGenerator.generateLicenseKey({
                    prefix: 'KHRM',
                    pepper: this.pepper
                });

                // B. Unique internal license ID
                const licenseId = generateLicenseId(dto.editionCode);

                // C. Persist license in marketplace_licenses
                // CRITICAL SECURITY: Plaintext licenseKey is NEVER stored in database
                await connection.query(
                    `INSERT INTO marketplace_licenses
                     (license_id, order_id, product_id, edition_code, sku, license_key_hash, key_hint, status, bound_domain, sequence_number, buyer_name, buyer_email, entitlements)
                     VALUES (?, ?, ?, ?, ?, ?, ?, 'ISSUED', NULL, 1, ?, ?, ?)`,
                    [
                        licenseId,
                        orderId,
                        dto.productId,
                        dto.editionCode,
                        dto.sku,
                        keyDetails.hash,
                        keyDetails.keyHint,
                        dto.buyerName,
                        dto.buyerEmail,
                        JSON.stringify(entitlements)
                    ]
                );

                // D. Prepare Transactional Email Outbox Record
                const emailSubject = `Your ${edition.edition_name || 'Kiaan HRM Pro'} Software License [${dto.sku}]`;
                const emailParams = {
                    buyerName: dto.buyerName,
                    orderNumber,
                    editionName: edition.edition_name || dto.editionCode,
                    sku: dto.sku,
                    licenseKey: keyDetails.licenseKey,
                    keyHint: keyDetails.keyHint,
                    unitIndex: i,
                    totalUnits: dto.quantity
                };

                let outboxContent;
                if (this.outboxEncryptionKey && typeof sealOutboxPayload === 'function') {
                    outboxContent = sealOutboxPayload(emailParams, this.outboxEncryptionKey);
                } else {
                    outboxContent = generateLicenseEmailHtml(emailParams);
                }

                await connection.query(
                    `INSERT INTO license_email_outbox
                     (order_id, license_id, recipient_email, recipient_name, subject, html_content, status)
                     VALUES (?, ?, ?, ?, ?, ?, 'queued')`,
                    [
                        orderId,
                        licenseId,
                        dto.buyerEmail,
                        dto.buyerName,
                        emailSubject,
                        outboxContent
                    ]
                );

                // E. Collect transient issuance result (plaintext key returned ONLY on fresh issuance)
                issuedLicenses.push({
                    licenseId,
                    licenseKey: keyDetails.licenseKey,
                    keyHint: keyDetails.keyHint,
                    productId: dto.productId,
                    editionCode: dto.editionCode,
                    sku: dto.sku,
                    status: 'ISSUED',
                    sequenceNumber: 1
                });
            }

            // 13. Commit Transaction
            if (transactionActive && typeof connection.commit === 'function') {
                await connection.commit();
                transactionActive = false;
            }

            return {
                isReplay: false,
                orderId,
                orderNumber,
                salesChannelId: dto.salesChannelId,
                channelOrderId: dto.channelOrderId,
                sku: dto.sku,
                quantity: dto.quantity,
                paymentStatus: dto.paymentStatus,
                licenses: issuedLicenses
            };

        } catch (err) {
            // Atomic Rollback
            if (transactionActive && typeof connection.rollback === 'function') {
                try {
                    await connection.rollback();
                } catch (_) {}
            }

            // Handle race condition: Duplicate order concurrently inserted
            if (
                err.code === 'ER_DUP_ENTRY' &&
                (String(err.message).includes('unq_channel_order') || String(err.message).includes('channel_order'))
            ) {
                return this._resolveExistingOrder(connection, dto.salesChannelId, dto.channelOrderId);
            }

            throw err;
        } finally {
            // Always release connection back to pool
            if (typeof connection.release === 'function') {
                connection.release();
            }
        }
    }
}

/**
 * Factory creating an OrderIngestionService instance.
 *
 * @param {object} options Service options
 * @returns {OrderIngestionService}
 */
function createOrderIngestionService(options = {}) {
    return new OrderIngestionService(options);
}

module.exports = {
    OrderIngestionService,
    createOrderIngestionService,
    generateOrderNumber,
    generateLicenseId,
    generateLicenseEmailHtml
};
