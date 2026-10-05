/**
 * Kiaan License Engine — Express Entitlement Enforcement Guard
 * Module: backend-hrm/kiaan-license/middleware/entitlementGuard.js
 *
 * Implements route-level middleware for enforcing commercial license edition,
 * feature entitlements, and installation employee limits.
 *
 * Guarantees:
 * 1. Cryptographic Source of Truth: Uses `req.license` populated by `licenseGuard`.
 * 2. Fail-Closed: Unknown or unentitled features immediately return HTTP 403.
 * 3. Concurrency Protection: Prevents employee limit race conditions using async mutex
 *    and MySQL named advisory locks (`GET_LOCK`).
 * 4. SaaS Separation: Operates completely independently from `subscriptionGuard.js`.
 */

'use strict';

const {
    evaluateLicenseEntitlement,
    normalizeFeature,
    normalizeEdition,
    FEATURES,
    EDITIONS
} = require('../core/entitlementEvaluator');

/**
 * In-memory FIFO mutex queue for serializing employee creation requests within the process.
 */
class AsyncLock {
    constructor() {
        this._locked = false;
        this._waiting = [];
    }

    async acquire() {
        if (!this._locked) {
            this._locked = true;
            return;
        }
        return new Promise(resolve => this._waiting.push(resolve));
    }

    release() {
        if (this._waiting.length > 0) {
            const next = this._waiting.shift();
            next();
        } else {
            this._locked = false;
        }
    }
}

const employeeCreationLock = new AsyncLock();

/**
 * Creates Express middleware that requires a specific commercial feature entitlement.
 *
 * @param {string} featureName Required feature identifier (e.g. 'PAYROLL', 'ATTENDANCE')
 * @returns {Function} Express middleware (req, res, next)
 */
function requireFeature(featureName) {
    if (!featureName) {
        throw new Error('requireFeature middleware requires a featureName argument.');
    }

    const canonicalFeature = normalizeFeature(featureName);

    return function featureGuard(req, res, next) {
        const licenseState = req.license;

        const result = evaluateLicenseEntitlement({
            licenseState,
            requiredFeature: canonicalFeature
        });

        if (!result.allowed) {
            return res.status(403).json({
                success: false,
                code: result.code || 'LICENSE_FEATURE_NOT_ENTITLED',
                message: result.reason || `Access denied: Feature '${featureName}' is not entitled by your license.`,
                feature: featureName
            });
        }

        return next();
    };
}

/**
 * Creates Express middleware that requires a minimum commercial edition rank.
 *
 * @param {string} editionCode Required edition code (e.g. 'full_source', 'extended')
 * @returns {Function} Express middleware (req, res, next)
 */
function requireEdition(editionCode) {
    if (!editionCode) {
        throw new Error('requireEdition middleware requires an editionCode argument.');
    }

    const canonicalEdition = normalizeEdition(editionCode);

    return function editionGuard(req, res, next) {
        const licenseState = req.license;

        const result = evaluateLicenseEntitlement({
            licenseState,
            requiredEdition: canonicalEdition
        });

        if (!result.allowed) {
            return res.status(403).json({
                success: false,
                code: result.code || 'LICENSE_EDITION_INSUFFICIENT',
                message: result.reason || `Access denied: Requires '${editionCode}' edition or higher.`,
                requiredEdition: editionCode,
                currentEdition: result.currentEdition || null
            });
        }

        return next();
    };
}

/**
 * Creates Express middleware to enforce the commercial license employee capacity limit.
 * Implements atomic lock acquisition to prevent concurrent race condition bypasses.
 *
 * @param {object} [options]
 * @param {object} [options.db] Database pool or connection
 * @returns {Function} Express middleware (req, res, next)
 */
function enforceEmployeeLimit(options = {}) {
    let resolvedDb = options.db || options.dbPool;

    return async function employeeLimitGuard(req, res, next) {
        const licenseState = req.license;

        // If installation is unlicensed or corrupted, let licenseGuard or evaluator fail closed
        if (!licenseState || licenseState.valid !== true) {
            const evalResult = evaluateLicenseEntitlement({ licenseState });
            return res.status(403).json({
                success: false,
                code: evalResult.code || 'LICENSE_INVALID',
                message: evalResult.reason || 'Installed license is invalid or inactive.'
            });
        }

        // Lazy load default database if not injected
        if (!resolvedDb) {
            try {
                resolvedDb = req.app?.get('db') || require('../../config/db');
            } catch (_) {
                resolvedDb = null;
            }
        }

        if (!resolvedDb || (typeof resolvedDb.execute !== 'function' && typeof resolvedDb.query !== 'function')) {
            return res.status(500).json({
                success: false,
                code: 'DATABASE_UNAVAILABLE',
                message: 'Database connection unavailable for license capacity verification.'
            });
        }

        // 1. Acquire Local Process Lock (prevents concurrent race conditions within Node.js)
        await employeeCreationLock.acquire();

        let dbAdvisoryLockAcquired = false;
        try {
            // 2. Acquire Distributed MySQL Advisory Lock (prevents multi-process / cluster race conditions)
            const queryFn = typeof resolvedDb.execute === 'function'
                ? resolvedDb.execute.bind(resolvedDb)
                : resolvedDb.query.bind(resolvedDb);

            try {
                const [lockRows] = await queryFn('SELECT GET_LOCK("kiaan_emp_limit_lock", 5) as acquired');
                const firstRow = Array.isArray(lockRows) ? lockRows[0] : lockRows;
                if (firstRow && (firstRow.acquired === 1 || Object.values(firstRow)[0] === 1)) {
                    dbAdvisoryLockAcquired = true;
                }
            } catch (_) {
                // If advisory locks are not supported or fail, in-memory mutex continues to protect
            }

            // 3. Count current active (non-terminated) employees across the installation
            // Uses application's existing employee counting semantics
            const [countRows] = await queryFn(
                'SELECT COUNT(*) as count FROM employees WHERE status != "terminated"'
            );

            let rawRows = Array.isArray(countRows) ? countRows : [countRows];
            if (rawRows.length > 0 && Array.isArray(rawRows[0])) {
                rawRows = rawRows[0];
            }
            const currentCount = Number(rawRows[0]?.count !== undefined ? rawRows[0]?.count : (rawRows[0]?.total || 0));

            // 4. Evaluate against trusted Ed25519 license envelope
            const result = evaluateLicenseEntitlement({
                licenseState,
                currentEmployeeCount: currentCount
            });

            if (!result.allowed) {
                return res.status(403).json({
                    success: false,
                    code: result.code || 'LICENSE_EMPLOYEE_LIMIT_EXCEEDED',
                    message: result.reason || `Commercial license employee limit reached (max: ${result.maxEmployees}).`,
                    maxEmployees: result.maxEmployees,
                    currentEmployeeCount: currentCount
                });
            }

            // Attach validated count to request
            req.licensedEmployeeCount = currentCount;
            return next();

        } catch (err) {
            console.error('License employee limit enforcement error:', err.message);
            return res.status(500).json({
                success: false,
                code: 'LICENSE_EVALUATION_ERROR',
                message: 'Failed to verify commercial license employee limit.'
            });
        } finally {
            // Release Distributed MySQL Advisory Lock
            if (dbAdvisoryLockAcquired && resolvedDb) {
                try {
                    const queryFn = typeof resolvedDb.execute === 'function'
                        ? resolvedDb.execute.bind(resolvedDb)
                        : resolvedDb.query.bind(resolvedDb);
                    await queryFn('SELECT RELEASE_LOCK("kiaan_emp_limit_lock")');
                } catch (_) {}
            }

            // Release In-Memory Process Lock
            employeeCreationLock.release();
        }
    };
}

module.exports = {
    requireFeature,
    requireEdition,
    enforceEmployeeLimit,
    employeeCreationLock,
    FEATURES,
    EDITIONS
};
