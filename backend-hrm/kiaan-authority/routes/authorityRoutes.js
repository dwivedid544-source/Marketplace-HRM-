/**
 * Kiaan Central License Authority — Public Authority Express API Routes
 * Module: backend-hrm/kiaan-authority/routes/authorityRoutes.js
 *
 * Implements the minimal public HTTP API endpoints for the Central License Authority:
 * - POST /activate (also mounted under /api/v1/authority/activate)
 *
 * Architecture & Security Guarantees:
 * 1. Minimal Surface: Exposes strictly the activation endpoint; zero unrelated routes.
 * 2. Information Leakage Protection: Sanitizes internal error messages and stack traces;
 *    never leaks signing keys, peppers, or database details.
 * 3. Dependency Injection: Router factory allows injecting mock services and rate limiters.
 * 4. Zero Unrelated Route Modifications: Operates as a self-contained Express router.
 */

'use strict';

const express = require('express');

/**
 * Maps activation service error codes to HTTP status codes.
 */
const ERROR_HTTP_STATUS_MAP = Object.freeze({
    // Bad Request (400)
    'INVALID_INPUT': 400,
    'INVALID_LICENSE_KEY': 400,
    'INVALID_DOMAIN': 400,
    'PRODUCT_MISMATCH': 400,
    'INVALID_ACTIVATION_TYPE': 400,
    'LOCALHOST_ACTIVATION_PROHIBITED': 400,

    // Not Found (404)
    'LICENSE_NOT_FOUND': 404,

    // Forbidden / Conflict (403 / 409)
    'LICENSE_REVOKED': 403,
    'LICENSE_EXPIRED': 403,
    'LICENSE_TRANSFERRED': 403,
    'TRANSFER_PENDING': 403,
    'DOMAIN_ALREADY_BOUND': 409,

    // Server Errors (500 / 503)
    'NO_DATABASE_CONNECTION': 503,
    'PEPPER_CONFIGURATION_ERROR': 500,
    'SIGNER_CONFIGURATION_ERROR': 500
});

/**
 * Creates an Express Router configured for Central Authority public endpoints.
 *
 * @param {object} options Dependencies
 * @param {import('../services/licenseActivationService').LicenseActivationService} options.activationService
 * @param {express.RequestHandler} [options.rateLimiter] Optional rate limiting middleware
 * @returns {express.Router}
 */
function createAuthorityRouter(options = {}) {
    const { activationService, rateLimiter } = options;

    if (!activationService || typeof activationService.activateLicense !== 'function') {
        throw new TypeError('createAuthorityRouter requires an injected activationService instance.');
    }

    const router = express.Router();

    // Middleware: Optional rate limiting
    if (typeof rateLimiter === 'function') {
        router.use(rateLimiter);
    }

    /**
     * POST /activate
     * Request Body: { licenseKey, requestedDomain, productId, activationCredential, activationType }
     */
    router.post('/activate', async (req, res) => {
        try {
            if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
                return res.status(400).json({
                    success: false,
                    code: 'INVALID_REQUEST',
                    message: 'Request body must be a JSON object.'
                });
            }

            const {
                licenseKey,
                license_key,
                activationCredential,
                requestedDomain,
                domain,
                productId,
                product_id,
                activationType
            } = req.body;

            const clientIp = (req.socket && req.socket.remoteAddress) || req.ip || null;

            const result = await activationService.activateLicense({
                licenseKey: licenseKey || license_key,
                activationCredential,
                requestedDomain: requestedDomain || domain,
                productId: productId || product_id,
                activationType,
                clientIp
            });

            return res.status(200).json({
                success: true,
                isReplay: result.isReplay,
                licenseId: result.licenseId,
                productId: result.productId,
                editionCode: result.editionCode,
                sku: result.sku,
                boundDomain: result.boundDomain,
                sequenceNumber: result.sequenceNumber,
                envelope: result.envelope
            });

        } catch (err) {
            const errCode = err.code || 'ACTIVATION_FAILED';
            const statusCode = ERROR_HTTP_STATUS_MAP[errCode] || 500;

            // Scrub internal error details for 500s
            const userMessage = statusCode === 500
                ? 'An internal authority error occurred while processing license activation.'
                : err.message.replace(/^[A-Z_]+:\s*/, '');

            return res.status(statusCode).json({
                success: false,
                code: errCode,
                message: userMessage
            });
        }
    });

    return router;
}

module.exports = {
    createAuthorityRouter,
    ERROR_HTTP_STATUS_MAP
};
