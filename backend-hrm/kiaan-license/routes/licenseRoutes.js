/**
 * Kiaan License Engine — Express License Routes
 * Module: backend-hrm/kiaan-license/routes/licenseRoutes.js
 *
 * Mounts the endpoints for license status, activation, synchronization,
 * conflict recovery, and administrative diagnostics.
 *
 * Defense-in-Depth Security:
 * In addition to the macro-layer licenseGuard, all sensitive management endpoints
 * (/activate, /sync, /recover, /diagnostics) enforce route-level Superadmin authentication.
 */

'use strict';

const express = require('express');
const jwt = require('jsonwebtoken');
const { createLicenseController } = require('../controllers/licenseController');

/**
 * Creates defense-in-depth Superadmin authentication middleware.
 *
 * @param {object} options
 * @param {string} [options.jwtSecret] JWT secret key
 * @param {Function} [options.jwtVerifier] Custom JWT verifier (for isolated testing)
 * @returns {Function} Express middleware (req, res, next)
 */
function createRequireSuperAdmin(options = {}) {
    const jwtSecret = options.jwtSecret || process.env.JWT_SECRET;
    const jwtVerifier = options.jwtVerifier || ((token, secret) => jwt.verify(token, secret));

    return function requireSuperAdmin(req, res, next) {
        // If already cryptographically verified by licenseGuard, verify role and pass through
        if (req.user && typeof req.user === 'object') {
            const role = String(req.user.role || '').toLowerCase();
            if (role === 'superadmin' || role === 'master admin' || role === 'masteradmin') {
                return next();
            }
            return res.status(403).json({
                success: false,
                code: 'SUPERADMIN_REQUIRED',
                message: 'Access denied: SuperAdmin privileges required.'
            });
        }

        // Otherwise, inspect and verify the Authorization header
        const authHeader = req.headers ? req.headers.authorization : undefined;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                code: 'UNAUTHORIZED',
                message: 'Authentication required: Missing or malformed Bearer token.'
            });
        }

        const token = authHeader.split(' ')[1];
        if (!token || !token.trim()) {
            return res.status(401).json({
                success: false,
                code: 'UNAUTHORIZED',
                message: 'Malformed Bearer token.'
            });
        }

        if (!jwtSecret) {
            console.error('❌ CRITICAL: JWT_SECRET environment variable is not configured');
            return res.status(500).json({
                success: false,
                code: 'SERVER_CONFIGURATION_ERROR',
                message: 'Authentication service configuration error'
            });
        }

        let decoded;
        try {
            decoded = jwtVerifier(token, jwtSecret);
        } catch (jwtErr) {
            if (jwtErr.name === 'TokenExpiredError') {
                return res.status(401).json({
                    success: false,
                    code: 'TOKEN_EXPIRED',
                    message: 'Authentication token has expired. Please login again.'
                });
            }
            return res.status(401).json({
                success: false,
                code: 'INVALID_TOKEN',
                message: 'Invalid authentication token.'
            });
        }

        const role = String(decoded && decoded.role ? decoded.role : '').toLowerCase();
        const isSuperadmin = (role === 'superadmin' || role === 'master admin' || role === 'masteradmin');

        if (!isSuperadmin) {
            return res.status(403).json({
                success: false,
                code: 'SUPERADMIN_REQUIRED',
                message: 'Access denied: SuperAdmin privileges required.'
            });
        }

        req.user = decoded;
        return next();
    };
}

/**
 * Creates the isolated Express Router for License endpoints.
 *
 * @param {object} options Controller and authentication options
 * @returns {express.Router} Configured Express router
 */
function createLicenseRouter(options = {}) {
    const router = express.Router();
    const controller = options.controller || createLicenseController(options);
    const requireSuperAdmin = createRequireSuperAdmin(options);

    const licenseCache = options.licenseCache;

    // Middleware: Require SuperAdmin UNLESS initial activation on genuinely unlicensed vault with envelope
    const requireSuperAdminUnlessInitial = async (req, res, next) => {
        const authHeader = req.headers ? req.headers.authorization : undefined;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            return requireSuperAdmin(req, res, next);
        }

        if (req.body && (req.body.envelope || req.body.licenseKey) && licenseCache && typeof licenseCache.getState === 'function') {
            try {
                const state = await licenseCache.getState(req.licenseHost || null);
                if (state && state.status === 'STATUS_UNLICENSED') {
                    return next();
                }
            } catch (_) {}
        }

        return requireSuperAdmin(req, res, next);
    };

    // 1. Minimal Public Status & Entitlements (Public, Unauthenticated)
    router.get('/status', controller.getStatus);
    router.get('/entitlements', controller.getEntitlements);

    // 2. License Activation (Initial activation unauthenticated; re-activation SuperAdmin only)
    router.post('/activate', requireSuperAdminUnlessInitial, controller.activate);

    // 3. Vault Monotonic Sync (SuperAdmin only)
    router.post('/sync', requireSuperAdmin, controller.sync);

    // 4. Safe Vault Conflict Recovery (SuperAdmin only)
    router.post('/recover', requireSuperAdmin, controller.recover);

    // 5. Read-Only Diagnostics (SuperAdmin only)
    router.get('/diagnostics', requireSuperAdmin, controller.getDiagnostics);

    return router;
}

module.exports = {
    createLicenseRouter,
    createRequireSuperAdmin
};
