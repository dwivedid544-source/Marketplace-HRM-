/**
 * Kiaan Central License Authority — Email Provider Abstraction
 * Module: backend-hrm/kiaan-authority/services/emailProvider.js
 *
 * Provides a decoupled email delivery abstraction for the Central License Authority.
 * Reuses existing project email infrastructure (Brevo REST API / Nodemailer SMTP)
 * while providing a clean MockEmailProvider for 100% offline, leak-free testing.
 *
 * Guarantees:
 * 1. Interface Consistency: Standard `send({ to, toName, subject, html, text })` contract.
 * 2. Production Reusability: Wraps `backend-hrm/utils/emailService.js` when available.
 * 3. Testing Isolation: MockEmailProvider intercepts all dispatches in memory.
 * 4. Zero Production Email Leakage: Tests never hit real network or mail relays.
 */

'use strict';

/**
 * Base abstract Email Provider.
 */
class BaseEmailProvider {
    /**
     * Sends a transactional email.
     *
     * @param {object} params Email delivery parameters
     * @param {string} params.to Recipient email address
     * @param {string} [params.toName] Recipient full name
     * @param {string} params.subject Email subject line
     * @param {string} params.html Full HTML content
     * @param {string} [params.text] Optional plain text fallback
     * @returns {Promise<{ success: boolean, messageId?: string, provider?: string }>}
     */
    async send(params) {
        throw new Error('BaseEmailProvider.send() must be implemented by subclass.');
    }
}

/**
 * Brevo / SMTP Email Provider.
 * Wraps existing HRM infrastructure in `backend-hrm/utils/emailService.js`.
 */
class BrevoSmtpEmailProvider extends BaseEmailProvider {
    /**
     * @param {object} [options] Provider options
     * @param {Function} [options.systemEmailSender] Injected email sender (defaults to emailService.sendSystemEmail)
     * @param {object} [options.logger] Optional logger
     */
    constructor(options = {}) {
        super();
        this.logger = options.logger || console;

        if (typeof options.systemEmailSender === 'function') {
            this.sendFn = options.systemEmailSender;
        } else {
            try {
                const { sendSystemEmail } = require('../../utils/emailService');
                this.sendFn = sendSystemEmail;
            } catch (err) {
                this.sendFn = null;
            }
        }
    }

    /**
     * Dispatches transactional email via Brevo REST API or Nodemailer SMTP fallback.
     *
     * @param {object} params
     * @returns {Promise<{ success: boolean, messageId?: string, provider: string }>}
     */
    async send({ to, toName, subject, html, text }) {
        if (!to) {
            const err = new Error('INVALID_RECIPIENT: Recipient email is required.');
            err.code = 'INVALID_RECIPIENT';
            throw err;
        }

        if (!this.sendFn) {
            const err = new Error('EMAIL_SERVICE_UNAVAILABLE: System email service could not be loaded.');
            err.code = 'EMAIL_SERVICE_UNAVAILABLE';
            throw err;
        }

        const result = await this.sendFn({
            to,
            toName: toName || to,
            subject,
            htmlContent: html,
            textContent: text
        });

        if (!result) {
            const err = new Error('EMAIL_DISPATCH_FAILED: Email service returned failure status.');
            err.code = 'EMAIL_DISPATCH_FAILED';
            throw err;
        }

        return {
            success: true,
            messageId: result.messageId || `msg_${Date.now()}`,
            provider: result.provider || 'system-email'
        };
    }
}

/**
 * In-Memory Mock Email Provider for testing and offline environments.
 * Strictly guarantees that ZERO real emails or network packets are sent.
 */
class MockEmailProvider extends BaseEmailProvider {
    constructor() {
        super();
        this.sentEmails = [];
        this.failNextError = null;
        this.alwaysFail = false;
        this.messageIdCounter = 1000;
    }

    /**
     * Configures the next send() call to reject with the specified error.
     *
     * @param {Error|string} err Error to throw on next invocation
     */
    failNext(err) {
        this.failNextError = typeof err === 'string' ? new Error(err) : err;
    }

    /**
     * Configures the provider to fail all subsequent calls.
     *
     * @param {boolean} [fail=true]
     */
    setAlwaysFail(fail = true) {
        this.alwaysFail = Boolean(fail);
    }

    /**
     * Resets recorded history and failure triggers.
     */
    reset() {
        this.sentEmails = [];
        this.failNextError = null;
        this.alwaysFail = false;
    }

    /**
     * Mock send recording payload in memory.
     */
    async send({ to, toName, subject, html, text }) {
        if (this.alwaysFail) {
            const err = new Error('MOCK_ALWAYS_FAIL: Email provider configured to fail.');
            err.code = 'MOCK_ALWAYS_FAIL';
            throw err;
        }

        if (this.failNextError) {
            const err = this.failNextError;
            this.failNextError = null;
            throw err;
        }

        if (!to) {
            const err = new Error('INVALID_RECIPIENT: Recipient email is required.');
            err.code = 'INVALID_RECIPIENT';
            throw err;
        }

        const messageId = `mock-msg-${this.messageIdCounter++}`;
        const record = {
            messageId,
            to,
            toName: toName || to,
            subject,
            html,
            text,
            dispatchedAt: new Date().toISOString()
        };

        this.sentEmails.push(record);

        return {
            success: true,
            messageId,
            provider: 'mock'
        };
    }
}

module.exports = {
    BaseEmailProvider,
    BrevoSmtpEmailProvider,
    MockEmailProvider
};
