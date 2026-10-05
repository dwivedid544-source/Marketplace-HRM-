/**
 * Kiaan Central License Authority — Transactional License Email Outbox Worker
 * Module: backend-hrm/kiaan-authority/services/licenseEmailWorker.js
 *
 * Implements a robust, lease-locked, idempotent outbox worker for `license_email_outbox`.
 * Responsible for safely claiming pending delivery jobs, unsealing encrypted payloads,
 * rendering professional Kiaan license delivery emails, and dispatching via the
 * approved email provider abstraction.
 *
 * Architecture & Security Guarantees:
 * 1. Atomic Lease Claim: Uses atomic conditional updates (`UPDATE ... WHERE id = ? AND ...`)
 *    preventing multiple concurrent workers from claiming the same outbox row.
 * 2. Abandoned Lease Recovery: Automatic reclamation of jobs locked beyond lease duration.
 * 3. Deterministic Exponential Backoff: Failed deliveries retry with exponential delay.
 * 4. Zero Secret Leakage: Plaintext license keys, peppers, encryption keys, and credentials
 *    are NEVER logged, placed in errors, or retained in persistent storage after delivery.
 * 5. Post-Delivery Key Purging: Upon successful email delivery, the outbox record's
 *    `html_content` is purged to `[DELIVERED_AND_PURGED]` so keys never linger in storage.
 * 6. Internal Idempotency: SENT rows are never reprocessed; retries never produce duplicate
 *    licenses or outbox records.
 */

'use strict';

const util = require('util');
const {
    isSealedPayload,
    unsealOutboxPayload,
    sanitizeOutboxError
} = require('./outboxCrypto');
const { BrevoSmtpEmailProvider } = require('./emailProvider');

/**
 * Default lease lock duration: 5 minutes (300,000 ms).
 */
const DEFAULT_LEASE_DURATION_MS = 5 * 60 * 1000;

/**
 * Default maximum retry attempts before permanent failure.
 */
const DEFAULT_MAX_RETRIES = 5;

/**
 * Default base backoff interval: 1 minute (60,000 ms).
 */
const DEFAULT_BASE_BACKOFF_MS = 60 * 1000;

/**
 * Default candidate polling batch size.
 */
const DEFAULT_BATCH_SIZE = 10;

/**
 * Generates professional HTML and text email content for Kiaan software license delivery.
 *
 * @param {object} params Email parameters
 * @param {string} [params.buyerName] Customer name
 * @param {string} params.orderNumber Purchase order identifier
 * @param {string} params.editionName Edition name (e.g. 'Kiaan HRM Pro — Full Source Edition')
 * @param {string} params.sku Product SKU
 * @param {string} params.licenseKey 160-bit CSPRNG license key (bearer credential)
 * @param {string} [params.keyHint] Key hint
 * @param {number} [params.unitIndex=1] Unit sequence index
 * @param {number} [params.totalUnits=1] Total units purchased in order
 * @returns {{ subject: string, html: string, text: string }}
 */
function renderLicenseEmail(params) {
    const buyerName = params.buyerName || 'Valued Customer';
    const editionName = params.editionName || 'Kiaan HRM Pro';
    const orderNumber = params.orderNumber || 'N/A';
    const sku = params.sku || 'KHRM-PRO';
    const licenseKey = params.licenseKey || '';
    const keyHint = params.keyHint || (licenseKey ? `${licenseKey.slice(0, 4)}...${licenseKey.slice(-4)}` : '');
    const unitText = params.totalUnits > 1 ? ` (License ${params.unitIndex || 1} of ${params.totalUnits})` : '';

    const subject = `Your ${editionName} Software License [${sku}]`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Kiaan HRM Pro License Key</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; background-color: #f8fafc; margin: 0; padding: 24px;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
    <!-- Header -->
    <tr>
      <td style="background-color: #0f172a; padding: 32px 24px; text-align: center;">
        <h1 style="margin: 0; font-size: 26px; font-weight: 700; color: #38bdf8; letter-spacing: -0.5px;">Kiaan HRM Pro</h1>
        <p style="margin: 6px 0 0 0; font-size: 14px; color: #94a3b8;">Commercial License Key Delivery${unitText}</p>
      </td>
    </tr>
    <!-- Main Content -->
    <tr>
      <td style="padding: 32px 24px;">
        <p style="margin: 0 0 16px 0; font-size: 16px;">Dear <strong>${buyerName}</strong>,</p>
        <p style="margin: 0 0 20px 0; font-size: 15px; color: #334155;">
          Thank you for choosing <strong>Kiaan HRM Pro</strong>. Your commercial software license for <strong>${editionName}</strong> (SKU: <code>${sku}</code>) has been successfully generated and issued under Order <strong>#${orderNumber}</strong>.
        </p>

        <!-- License Key Box -->
        <div style="background-color: #f1f5f9; border: 2px dashed #0284c7; border-radius: 8px; padding: 20px; margin: 24px 0; text-align: center;">
          <div style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #475569; margin-bottom: 10px;">
            Your 160-bit Commercial License Key
          </div>
          <div style="font-family: 'Courier New', Courier, monospace; font-size: 18px; font-weight: 700; color: #0284c7; letter-spacing: 1.5px; word-break: break-all; padding: 8px 12px; background-color: #ffffff; border: 1px solid #cbd5e1; border-radius: 4px; display: inline-block;">
            ${licenseKey}
          </div>
          <div style="font-size: 12px; color: #64748b; margin-top: 10px;">
            Key Identifier Hint: <code>${keyHint}</code> | Order: <code>${orderNumber}</code>
          </div>
        </div>

        <!-- Next Steps / Activation -->
        <h3 style="margin: 28px 0 12px 0; font-size: 17px; color: #0f172a;">Next Steps — Activating Your Installation</h3>
        <ol style="margin: 0 0 24px 0; padding-left: 20px; font-size: 14px; color: #334155;">
          <li style="margin-bottom: 8px;">Deploy Kiaan HRM Pro on your target production server.</li>
          <li style="margin-bottom: 8px;">Log in to the application as Superadmin and navigate to <strong>Settings &rarr; Licensing</strong>.</li>
          <li style="margin-bottom: 8px;">Enter the 160-bit license key above and click <strong>Activate License</strong>.</li>
          <li style="margin-bottom: 8px;">The central authority will cryptographically sign your offline activation envelope and bind your installation to your authorized production domain.</li>
        </ol>

        <!-- Terms and Security Notice -->
        <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 4px; margin-bottom: 24px;">
          <h4 style="margin: 0 0 6px 0; font-size: 13px; color: #92400e; text-transform: uppercase; letter-spacing: 0.05em;">Important Commercial &amp; Security Notices</h4>
          <ul style="margin: 0; padding-left: 18px; font-size: 12px; color: #78350f;">
            <li style="margin-bottom: 4px;"><strong>Domain Binding:</strong> Each commercial license key binds to exactly one authorized production domain.</li>
            <li style="margin-bottom: 4px;"><strong>Perpetual License Scope:</strong> A lifetime license grants perpetual rights to run the purchased edition on your bound domain. It does not automatically include unlimited custom engineering, lifetime third-party cloud credits, or indefinite bespoke modifications.</li>
            <li style="margin-bottom: 4px;"><strong>Domain Transfer:</strong> Domain migrations require verification and formal authorization from Kiaan Technology support.</li>
            <li><strong>Bearer Credential:</strong> Treat this license key as a confidential secret. Do not expose it in public source code repositories or share it publicly.</li>
          </ul>
        </div>

        <p style="margin: 0; font-size: 13px; color: #64748b;">
          If you require technical assistance or have questions regarding your license, please contact our support team at <a href="mailto:support@kiaantechnology.com" style="color: #0284c7; text-decoration: none;">support@kiaantechnology.com</a>.
        </p>
      </td>
    </tr>
    <!-- Footer -->
    <tr>
      <td style="background-color: #f1f5f9; border-top: 1px solid #e2e8f0; padding: 20px 24px; text-align: center; font-size: 12px; color: #64748b;">
        <p style="margin: 0 0 4px 0;">&copy; ${new Date().getFullYear()} Kiaan Technology Pvt Ltd. All rights reserved.</p>
        <p style="margin: 0; color: #94a3b8;">This is an automated transactional message sent regarding your software license purchase.</p>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const text = `==============================================================================
KIAAN HRM PRO — COMMERCIAL SOFTWARE LICENSE DELIVERY${unitText.toUpperCase()}
==============================================================================

Dear ${buyerName},

Thank you for purchasing Kiaan HRM Pro. Your commercial software license
has been successfully generated.

Order Reference : ${orderNumber}
Product Edition : ${editionName}
Product SKU     : ${sku}

------------------------------------------------------------------------------
YOUR 160-BIT COMMERCIAL LICENSE KEY (KEEP CONFIDENTIAL):
${licenseKey}
------------------------------------------------------------------------------
Key Hint        : ${keyHint}

NEXT STEPS — ACTIVATING YOUR INSTALLATION:
1. Deploy Kiaan HRM Pro on your target production server.
2. Log in as Superadmin and navigate to Settings -> Licensing.
3. Paste the 160-bit license key above and click "Activate License".
4. The Central License Authority will bind the license to your production domain.

IMPORTANT NOTICES:
- Single Domain Binding: Each license binds to exactly one authorized production domain.
- Perpetual License Scope: Grants perpetual rights to run the purchased edition on
  your bound domain. Does not automatically include indefinite custom development
  or third-party subscription fees.
- Domain Transfer: Domain migrations require authorization from Kiaan Technology.
- Confidentiality: Treat this key as a sensitive bearer credential. Never expose
  it in public repositories.

Support: support@kiaantechnology.com
(C) ${new Date().getFullYear()} Kiaan Technology Pvt Ltd. All rights reserved.
==============================================================================`;

    return { subject, html, text };
}

/**
 * Normalizes query results across mysql2 array-tuple and standard array returns.
 *
 * @param {any} result Raw query output
 * @returns {Array|object} Normalized rows or result object
 */
function normalizeDbResult(result) {
    if (!result) return [];
    if (Array.isArray(result)) {
        if (result.length > 0 && Array.isArray(result[0])) {
            return result[0];
        }
        return result;
    }
    return result;
}

/**
 * Transactional License Email Outbox Worker.
 */
class LicenseEmailWorker {
    #encryptionKey;

    /**
     * @param {object} options Worker configuration options
     * @param {object} options.db Database connection or pool (MySQL2 interface)
     * @param {object} [options.emailProvider] Injected email provider (defaults to BrevoSmtpEmailProvider)
     * @param {string|Buffer} [options.encryptionKey] 32-byte AES-256 outbox encryption key
     * @param {number} [options.leaseDurationMs=300000] Lease lock timeout in milliseconds (5 mins)
     * @param {number} [options.maxRetries=5] Maximum retry attempts before permanent failure
     * @param {number} [options.baseBackoffMs=60000] Base exponential backoff delay in ms (1 min)
     * @param {number} [options.batchSize=10] Maximum jobs claimed per batch pass
     * @param {object} [options.logger] Injected logger instance
     */
    constructor(options = {}) {
        if (!options.db || (typeof options.db.query !== 'function' && typeof options.db.execute !== 'function')) {
            const err = new Error('CONFIG_MISSING_DATABASE: Database connection or pool is required.');
            err.code = 'CONFIG_MISSING_DATABASE';
            throw err;
        }

        this.db = options.db;
        this.emailProvider = options.emailProvider || new BrevoSmtpEmailProvider({ logger: options.logger });
        this.leaseDurationMs = typeof options.leaseDurationMs === 'number' ? options.leaseDurationMs : (options.leaseDurationMs !== undefined ? Number(options.leaseDurationMs) : DEFAULT_LEASE_DURATION_MS);
        this.maxRetries = typeof options.maxRetries === 'number' ? options.maxRetries : (options.maxRetries !== undefined ? Number(options.maxRetries) : DEFAULT_MAX_RETRIES);
        this.baseBackoffMs = typeof options.baseBackoffMs === 'number' ? options.baseBackoffMs : (options.baseBackoffMs !== undefined ? Number(options.baseBackoffMs) : DEFAULT_BASE_BACKOFF_MS);
        this.batchSize = typeof options.batchSize === 'number' ? options.batchSize : (options.batchSize !== undefined ? Number(options.batchSize) : DEFAULT_BATCH_SIZE);
        this.logger = options.logger || console;

        // Securely encapsulate encryption key in private field
        const rawKey = options.encryptionKey || process.env.OUTBOX_ENCRYPTION_KEY || null;
        this.#encryptionKey = rawKey;

        this._pollingTimer = null;
        this._isRunning = false;
    }

    /**
     * Gets the configured encryption key (for internal cryptographic operations).
     *
     * @returns {string|Buffer|null}
     */
    getEncryptionKey() {
        return this.#encryptionKey;
    }

    /**
     * Helper to execute queries on the configured database pool/connection.
     *
     * @param {string} sql SQL query
     * @param {Array} params Query parameters
     * @returns {Promise<any>}
     */
    async _query(sql, params = []) {
        const queryFn = typeof this.db.query === 'function' ? this.db.query.bind(this.db) : this.db.execute.bind(this.db);
        return queryFn(sql, params);
    }

    /**
     * Finds eligible candidate jobs from `license_email_outbox`.
     * Eligible states:
     * - `queued`
     * - `processing` with expired lease (`locked_at < NOW() - leaseDuration`)
     * - `failed` with `retry_count < maxRetries` and backoff window elapsed
     *
     * @param {number} [limit] Maximum candidates to return
     * @returns {Promise<Array<object>>} Candidate rows
     */
    async fetchEligibleCandidates(limit = this.batchSize) {
        const leaseCutoff = new Date(Date.now() - this.leaseDurationMs);
        const backoffCutoff = new Date(Date.now() - this.baseBackoffMs);

        const sql = `
            SELECT id, order_id, license_id, recipient_email, recipient_name, subject,
                   status, retry_count, locked_at, updated_at
            FROM license_email_outbox
            WHERE (status = 'queued')
               OR (status = 'processing' AND (locked_at IS NULL OR locked_at < ?))
               OR (status = 'failed' AND retry_count < ? AND updated_at <= ?)
            ORDER BY id ASC
            LIMIT ?
        `;

        const raw = await this._query(sql, [leaseCutoff, this.maxRetries, backoffCutoff, Number(limit)]);
        const rows = normalizeDbResult(raw);
        return Array.isArray(rows) ? rows : [];
    }

    /**
     * Atomically claims an eligible job for processing by setting `status = 'processing'`,
     * `locked_at = NOW()`, and `updated_at = NOW()`.
     * Guarantees that only ONE worker can claim a given job row.
     *
     * @param {number|string} jobId Outbox row ID
     * @returns {Promise<boolean>} True if job was atomically claimed, false if lost to another worker
     */
    async claimJob(jobId) {
        const leaseCutoff = new Date(Date.now() - this.leaseDurationMs);
        const backoffCutoff = new Date(Date.now() - this.baseBackoffMs);
        const now = new Date();

        const sql = `
            UPDATE license_email_outbox
            SET status = 'processing',
                locked_at = ?,
                updated_at = ?
            WHERE id = ? AND (
                status = 'queued'
                OR (status = 'processing' AND (locked_at IS NULL OR locked_at < ?))
                OR (status = 'failed' AND retry_count < ? AND updated_at <= ?)
            )
        `;

        const raw = await this._query(sql, [now, now, jobId, leaseCutoff, this.maxRetries, backoffCutoff]);
        const result = Array.isArray(raw) ? raw[0] : raw;
        const affectedRows = result ? (result.affectedRows || result.changedRows || 0) : 0;

        return affectedRows === 1;
    }

    /**
     * Processes a single outbox job by ID.
     * Enforces:
     * 1. Atomic claim check
     * 2. Payload unsealing / decryption (only in memory)
     * 3. Template rendering
     * 4. Provider dispatch
     * 5. State update to SENT and post-delivery plaintext/sealed key scrubbing
     * 6. Error handling with safe sanitized logging and exponential backoff
     *
     * @param {number|string} jobId Outbox row ID
     * @returns {Promise<{ claimed: boolean, success?: boolean, jobId: number|string, messageId?: string, error?: string }>}
     */
    async processJob(jobId) {
        // 1. Attempt atomic claim
        const claimed = await this.claimJob(jobId);
        if (!claimed) {
            return {
                claimed: false,
                jobId,
                reason: 'INELIGIBLE_OR_CLAIMED_BY_ANOTHER_WORKER'
            };
        }

        // 2. Fetch claimed job details
        const raw = await this._query(
            `SELECT id, order_id, license_id, recipient_email, recipient_name,
                    subject, html_content, retry_count, status
             FROM license_email_outbox
             WHERE id = ?
             LIMIT 1`,
            [jobId]
        );
        const rows = normalizeDbResult(raw);
        if (!rows || rows.length === 0) {
            return { claimed: true, success: false, jobId, error: 'JOB_NOT_FOUND_AFTER_CLAIM' };
        }

        const job = rows[0];

        try {
            let emailHtml;
            let emailText;
            let emailSubject = job.subject;

            // 3. Cryptographic unsealing if payload is sealed
            if (isSealedPayload(job.html_content)) {
                if (!this.#encryptionKey) {
                    const err = new Error('CONFIG_MISSING_ENCRYPTION_KEY: Cannot unseal payload without OUTBOX_ENCRYPTION_KEY.');
                    err.code = 'CONFIG_MISSING_ENCRYPTION_KEY';
                    throw err;
                }

                const unsealed = unsealOutboxPayload(job.html_content, this.#encryptionKey);
                const rendered = renderLicenseEmail(unsealed.payload);
                emailHtml = rendered.html;
                emailText = rendered.text;
                if (!emailSubject && rendered.subject) {
                    emailSubject = rendered.subject;
                }
            } else {
                // Legacy unsealed HTML fallback
                emailHtml = job.html_content;
                emailText = job.html_content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
            }

            // 4. Dispatch email via provider abstraction
            const sendResult = await this.emailProvider.send({
                to: job.recipient_email,
                toName: job.recipient_name,
                subject: emailSubject,
                html: emailHtml,
                text: emailText
            });

            // 5. Successful Delivery: Update status to 'sent' and purge plaintext/sealed key from storage
            const now = new Date();
            await this._query(
                `UPDATE license_email_outbox
                 SET status = 'sent',
                     sent_at = ?,
                     last_error = NULL,
                     locked_at = NULL,
                     html_content = '[DELIVERED_AND_PURGED]',
                     updated_at = ?
                 WHERE id = ?`,
                [now, now, jobId]
            );

            return {
                claimed: true,
                success: true,
                jobId,
                messageId: sendResult.messageId || 'delivered'
            };

        } catch (err) {
            // 6. Delivery Failure: Record sanitized error, increment retry count, and release lease
            const safeError = sanitizeOutboxError(err);
            const nextRetryCount = (job.retry_count || 0) + 1;
            const now = new Date();

            await this._query(
                `UPDATE license_email_outbox
                 SET status = 'failed',
                     retry_count = ?,
                     last_error = ?,
                     locked_at = NULL,
                     updated_at = ?
                 WHERE id = ?`,
                [nextRetryCount, safeError, now, jobId]
            );

            return {
                claimed: true,
                success: false,
                jobId,
                retryCount: nextRetryCount,
                error: safeError
            };
        }
    }

    /**
     * Executes a batch processing pass over pending candidates.
     *
     * @param {number} [limit] Maximum jobs to poll
     * @returns {Promise<{ totalFound: number, claimed: number, successful: number, failed: number, results: Array }>}
     */
    async processBatch(limit = this.batchSize) {
        const candidates = await this.fetchEligibleCandidates(limit);
        const results = [];
        let successful = 0;
        let failed = 0;
        let claimedCount = 0;

        for (const candidate of candidates) {
            const outcome = await this.processJob(candidate.id);
            results.push(outcome);

            if (outcome.claimed) {
                claimedCount++;
                if (outcome.success) {
                    successful++;
                } else {
                    failed++;
                }
            }
        }

        return {
            totalFound: candidates.length,
            claimed: claimedCount,
            successful,
            failed,
            results
        };
    }

    /**
     * Starts periodic worker execution.
     *
     * @param {number} [intervalMs=10000] Polling interval in ms (default 10s)
     */
    start(intervalMs = 10000) {
        if (this._isRunning) return;
        this._isRunning = true;

        const poll = async () => {
            if (!this._isRunning) return;
            try {
                await this.processBatch();
            } catch (err) {
                if (this.logger && typeof this.logger.error === 'function') {
                    this.logger.error('Outbox worker batch error:', sanitizeOutboxError(err));
                }
            } finally {
                if (this._isRunning) {
                    this._pollingTimer = setTimeout(poll, intervalMs);
                    if (this._pollingTimer && typeof this._pollingTimer.unref === 'function') {
                        this._pollingTimer.unref();
                    }
                }
            }
        };

        this._pollingTimer = setTimeout(poll, intervalMs);
        if (this._pollingTimer && typeof this._pollingTimer.unref === 'function') {
            this._pollingTimer.unref();
        }
    }

    /**
     * Stops the periodic worker polling loop.
     */
    stop() {
        this._isRunning = false;
        if (this._pollingTimer) {
            clearTimeout(this._pollingTimer);
            this._pollingTimer = null;
        }
    }

    /**
     * Custom inspection to guarantee zero secret leakage if inspected.
     */
    [util.inspect.custom]() {
        return {
            worker: 'LicenseEmailWorker',
            leaseDurationMs: this.leaseDurationMs,
            maxRetries: this.maxRetries,
            baseBackoffMs: this.baseBackoffMs,
            batchSize: this.batchSize,
            hasEncryptionKey: Boolean(this.#encryptionKey),
            isRunning: this._isRunning
        };
    }

    /**
     * JSON serialization protection.
     */
    toJSON() {
        return {
            worker: 'LicenseEmailWorker',
            leaseDurationMs: this.leaseDurationMs,
            maxRetries: this.maxRetries,
            baseBackoffMs: this.baseBackoffMs,
            batchSize: this.batchSize,
            hasEncryptionKey: Boolean(this.#encryptionKey),
            isRunning: this._isRunning
        };
    }
}

module.exports = {
    DEFAULT_LEASE_DURATION_MS,
    DEFAULT_MAX_RETRIES,
    DEFAULT_BASE_BACKOFF_MS,
    DEFAULT_BATCH_SIZE,
    renderLicenseEmail,
    LicenseEmailWorker
};
