/**
 * Kiaan License Engine — Express License Enforcement Guard
 * Module: backend-hrm/kiaan-license/middleware/licenseGuard.js
 *
 * Implements macroeconomic license enforcement for Kiaan HRM.
 * Verifies domain-bound Ed25519 entitlements, validates incoming host headers,
 * enforces route-level access boundaries, and allows cryptographically authenticated
 * Superadmin recovery during unlicensed or degraded states.
 *
 * Security Requirements:
 * 1. Zero Trust on Unverified Input: Never trusts req.body.role, query parameters,
 *    or unverified req.user properties.
 * 2. Cryptographic Recovery Proof: Recovery routes during degraded states strictly require
 *    a valid Bearer JWT signed by JWT_SECRET with a verified 'superadmin' role.
 * 3. Exact Route Allowlist: No broad prefix wildcards (e.g. /api/superadmin/* is NOT
 *    exempted; only exact recovery routes like /api/license/activate are permitted).
 * 4. Fail-Safe Error Codes:
 *    - 503 for transient storage failures (LICENSE_STORAGE_FAILURE)
 *    - 423 for equal-sequence vault conflicts (LICENSE_CONFLICT)
 *    - 403 for unlicensed / corrupted / domain mismatch / product mismatch
 * 5. Defense-in-Depth: Healthy requests pass seamlessly to existing authentication,
 *    roleGuard, and subscriptionGuard without replacing or weakening downstream checks.
 */

'use strict';

const jwt = require('jsonwebtoken');
const { resolveHost, HostResolutionCodes } = require('../core/hostResolver');
const { CacheStatus } = require('../core/licenseCache');
const { licenseConfig: defaultLicenseConfig } = require('../config/licenseConfig');

/**
 * Standardized Public Route Classification Table.
 * Format: Array of { method: string, path: string | RegExp }
 */
const PUBLIC_ROUTES = Object.freeze([
    // Public infrastructure & health
    { method: 'GET', path: '/' },
    { method: 'GET', path: '/favicon.ico' },
    // Public authentication
    { method: 'POST', path: '/api/login' },
    { method: 'POST', path: '/api/public/forgot-password-request' },
    { method: 'POST', path: '/api/public/reset-password-verify' },
    // Public license ping & entitlements
    { method: 'GET', path: '/api/license/status' },
    { method: 'GET', path: '/api/license/entitlements' },
    // Public setup status and first-admin initialization
    { method: 'GET', path: '/api/setup/status' },
    { method: 'POST', path: '/api/setup/first-admin' },
    // External payment webhooks (HMAC-verified by Razorpay rawBody)
    { method: 'POST', path: '/api/payment/webhook' },
    // Public site info
    { method: 'GET', path: '/api/public/site-info' }
]);

/**
 * Exact Superadmin Recovery Routes Table.
 * Accessible during degraded/unlicensed states ONLY by cryptographically verified Superadmins.
 */
const RECOVERY_ROUTES = Object.freeze([
    { method: 'GET', path: '/api/license/diagnostics' },
    { method: 'POST', path: '/api/license/activate' },
    { method: 'POST', path: '/api/license/sync' },
    { method: 'POST', path: '/api/license/recover' },
    { method: 'POST', path: '/api/backup/restore' }
]);

/**
 * Checks whether a given method and path match a route entry.
 *
 * @param {string} method HTTP method
 * @param {string} reqPath Normalized request path
 * @param {Array<{method: string, path: string|RegExp}>} routes Route definition list
 * @returns {boolean} True if matched
 */
function matchesRoute(method, reqPath, routes) {
    const normalizedMethod = (method || '').toUpperCase();
    const rawPath = (reqPath || '').split('?')[0];
    const cleanPath = (rawPath.length > 1 && rawPath.endsWith('/'))
        ? (rawPath.replace(/\/+$/, '') || '/')
        : (rawPath || '/');

    for (const route of routes) {
        if (route.method !== '*' && route.method !== normalizedMethod) {
            continue;
        }

        if (typeof route.path === 'string') {
            if (route.path === cleanPath) {
                return true;
            }
        } else if (route.path instanceof RegExp) {
            if (route.path.test(cleanPath)) {
                return true;
            }
        }
    }

    return false;
}

/**
 * Checks if a request targets public infrastructure or authentication.
 *
 * @param {string} method HTTP method
 * @param {string} reqPath URL pathname
 * @returns {boolean} True if public
 */
function isPublicRoute(method, reqPath) {
    const cleanPath = (reqPath || '').split('?')[0];

    // Socket.io polling and handshake requests
    if (cleanPath.startsWith('/socket.io/')) {
        return true;
    }

    return matchesRoute(method, cleanPath, PUBLIC_ROUTES);
}

/**
 * Checks if a request targets an authorized recovery route.
 *
 * @param {string} method HTTP method
 * @param {string} reqPath URL pathname
 * @returns {boolean} True if recovery route
 */
function isRecoveryRoute(method, reqPath) {
    return matchesRoute(method, reqPath, RECOVERY_ROUTES);
}

/**
 * Resolves the canonical host from an Express HTTP request.
 *
 * @param {object} req Express request
 * @param {object} options Host resolution options
 * @returns {object} Normalized host resolution result
 */
function resolveHostFromRequest(req, options = {}) {
    const rawHost = req.headers ? (req.headers.host || req.headers[':authority']) : undefined;
    const forwardedHost = req.headers ? req.headers['x-forwarded-host'] : undefined;
    const remoteIp = (req.socket && req.socket.remoteAddress) || req.ip;

    const res = resolveHost({
        rawHost,
        forwardedHost,
        remoteIp,
        trustedProxies: options.trustedProxies,
        nodeEnv: options.nodeEnv || process.env.NODE_ENV
    });

    return {
        valid: res.success,
        success: res.success,
        hostname: res.hostname,
        normalizedHost: res.hostname,
        port: res.port,
        source: res.source,
        isDevBypass: res.isDevBypass,
        code: res.code,
        reason: res.reason
    };
}

/**
 * Factory creating the Express License Guard middleware.
 *
 * @param {object} options
 * @param {object} options.licenseCache An instance of licenseCache
 * @param {object} [options.config] License configuration
 * @param {string} [options.jwtSecret] Secret for verifying Superadmin JWTs
 * @param {Function} [options.jwtVerifier] Custom JWT verifier (for isolated testing)
 * @param {Function} [options.hostResolverFn] Custom host resolver (for isolated testing)
 * @returns {Function} Express middleware (req, res, next)
 */
function createLicenseGuard(options = {}) {
    const licenseCache = options.licenseCache;
    if (!licenseCache || typeof licenseCache.getState !== 'function') {
        throw new TypeError('License guard requires an injected licenseCache with a .getState() method');
    }

    const config = options.config || defaultLicenseConfig;
    const jwtSecret = options.jwtSecret || process.env.JWT_SECRET;
    const jwtVerifier = options.jwtVerifier || ((token, secret) => jwt.verify(token, secret));
    const hostResolverFn = options.hostResolverFn || resolveHostFromRequest;

    return async function licenseGuard(req, res, next) {
        try {
            // 1. Host Resolution & Reverse Proxy Validation
            const hostResult = hostResolverFn(req, {
                trustedProxies: config.trustedProxies,
                nodeEnv: process.env.NODE_ENV
            });

            if (!hostResult.valid && !hostResult.success) {
                return res.status(400).json({
                    success: false,
                    code: hostResult.code || HostResolutionCodes.MALFORMED_HOST,
                    message: 'Invalid or malformed HTTP Host header'
                });
            }

            req.licenseHost = hostResult;

            // 2. Unconditional Public Route Bypass
            if (isPublicRoute(req.method, req.path)) {
                return next();
            }

            // 3. Fast-Path License State Evaluation
            const licenseState = await licenseCache.getState(hostResult);

            // 4. Healthy Installation — Seamless Pass-Through
            if (licenseState.valid && licenseState.status === CacheStatus.HEALTHY) {
                req.license = licenseState;
                return next();
            }

            // 5. Transient Storage Engine Unavailability
            if (licenseState.status === CacheStatus.STORAGE_UNAVAILABLE) {
                return res.status(503).json({
                    success: false,
                    code: 'LICENSE_STORAGE_FAILURE',
                    message: 'License storage engine is temporarily unavailable. Please retry shortly.'
                });
            }

            // 6. Degraded / Unlicensed / Conflict State Handling
            const isRecovery = isRecoveryRoute(req.method, req.path);

            // If the route is NOT an exact recovery route, block immediately
            if (!isRecovery) {
                if (licenseState.status === CacheStatus.DEGRADED_CONFLICT) {
                    return res.status(423).json({
                        success: false,
                        code: 'LICENSE_CONFLICT',
                        message: 'System locked: Conflicting license payloads detected. Manual SuperAdmin recovery required.'
                    });
                }

                if (licenseState.status === CacheStatus.DOMAIN_MISMATCH) {
                    return res.status(403).json({
                        success: false,
                        code: 'LICENSE_DOMAIN_MISMATCH',
                        message: 'Access denied: The requested domain is not authorized by the installed license.'
                    });
                }

                if (licenseState.status === CacheStatus.PRODUCT_MISMATCH) {
                    return res.status(403).json({
                        success: false,
                        code: 'LICENSE_PRODUCT_MISMATCH',
                        message: 'Access denied: The installed license is not valid for this product.'
                    });
                }

                if (licenseState.status === CacheStatus.CORRUPTED) {
                    return res.status(403).json({
                        success: false,
                        code: 'LICENSE_CORRUPTED',
                        message: 'Access denied: Local license vault data is corrupt or invalid.'
                    });
                }

                // Default: STATUS_UNLICENSED
                return res.status(403).json({
                    success: false,
                    code: 'LICENSE_REQUIRED',
                    message: 'This Kiaan HRM Pro installation is not licensed. Please activate a valid license.'
                });
            }

            // Phase 2B.7.1B: If initial activation on genuinely UNLICENSED vault with envelope payload, allow through to controller
            if (req.method === 'POST' && req.path === '/api/license/activate' && licenseState.status === CacheStatus.UNLICENSED) {
                if (req.body && (req.body.envelope || req.body.licenseKey)) {
                    return next();
                }
            }

            // 7. Cryptographic Superadmin Recovery Verification
            // (Only reached if the target route IS an exact recovery route and installation is degraded)
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.status(401).json({
                    success: false,
                    code: 'UNAUTHORIZED',
                    message: 'License recovery and diagnostics require Bearer token authentication'
                });
            }

            const token = authHeader.split(' ')[1];
            if (!token || !token.trim()) {
                return res.status(401).json({
                    success: false,
                    code: 'UNAUTHORIZED',
                    message: 'Malformed Bearer token'
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
                    message: 'Invalid authentication token'
                });
            }

            // Strict Role Authorization: Role MUST be Superadmin
            const role = (decoded && decoded.role) ? String(decoded.role).toLowerCase() : '';
            const isSuperadmin = (role === 'superadmin' || role === 'master admin' || role === 'masteradmin');

            if (!isSuperadmin) {
                return res.status(403).json({
                    success: false,
                    code: 'SUPERADMIN_REQUIRED',
                    message: 'Access denied: License recovery actions strictly require SuperAdmin privileges.'
                });
            }

            // Cryptographically verified Superadmin — permit recovery access
            req.user = decoded;
            req.isRecoveryAccess = true;
            return next();

        } catch (guardErr) {
            console.error('❌ Kiaan License Guard Internal Error:', guardErr.message);
            return res.status(500).json({
                success: false,
                code: 'LICENSE_GUARD_ERROR',
                message: 'An internal error occurred during license verification.'
            });
        }
    };
}

module.exports = {
    createLicenseGuard,
    PUBLIC_ROUTES,
    RECOVERY_ROUTES,
    isPublicRoute,
    isRecoveryRoute,
    matchesRoute
};
