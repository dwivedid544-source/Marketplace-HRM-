/**
 * Kiaan Central License Authority — Isolated Authority Service Container
 * Module: backend-hrm/kiaan-authority/bootstrap/authorityService.js
 *
 * Implements an isolated, dependency-injected Authority Service Container that
 * coordinates AuthorityConfig, AuthoritySigner, and database readiness checks.
 *
 * Architecture & Security Guarantees:
 * 1. Zero Key Generation: Never generates keys automatically in any environment.
 * 2. Zero DDL Execution: Never runs migrations, CREATE, ALTER, or DROP statements.
 * 3. Secret Isolation: Encapsulates all private keys and pepper in private class
 *    fields (#config, #signer). Never exposes secrets via toJSON, getStatus,
 *    or util.inspect.
 * 4. Fault Domain Isolation: Unconfigured or failing authority components never
 *    affect standard HRM SaaS functionality. Ordinary startup returns UNCONFIGURED.
 * 5. Production Fail-Closed: When authority is explicitly required or running in
 *    production authority mode, missing/invalid keys or weak pepper fail closed.
 * 6. Database Verification: Checks for presence of the 7 isolated marketplace
 *    authority tables. If missing, marks the authority UNAVAILABLE without DDL.
 */

'use strict';

const util = require('util');
const {
    AuthorityConfig,
    loadAuthorityConfig,
    validateAuthorityConfig,
    DEFAULT_KEY_ID,
    SUPPORTED_ALGORITHM
} = require('../config/authorityConfig');
const { AuthoritySigner } = require('../core/authoritySigner');

/**
 * Enumeration of Authority Service Lifecycle States.
 */
const AuthorityStatus = Object.freeze({
    UNINITIALIZED: 'UNINITIALIZED',
    UNCONFIGURED: 'UNCONFIGURED',
    UNAVAILABLE: 'UNAVAILABLE',
    CONFIG_ERROR: 'CONFIG_ERROR',
    READY: 'READY',
    SHUTDOWN: 'SHUTDOWN'
});

/**
 * Expected 7 isolated marketplace authority tables.
 */
const REQUIRED_AUTHORITY_TABLES = Object.freeze([
    'marketplace_products',
    'marketplace_editions',
    'marketplace_sales_channels',
    'marketplace_orders',
    'marketplace_licenses',
    'license_activations',
    'license_email_outbox'
]);

/**
 * Read-only database readiness checker.
 * Checks whether the 7 marketplace authority tables exist in the current database schema.
 * Strictly read-only: NEVER executes CREATE, ALTER, DROP, or write operations.
 *
 * @param {object} db Database connection or pool with query/execute method
 * @param {string[]} [requiredTables=REQUIRED_AUTHORITY_TABLES] Tables to check
 * @returns {Promise<{ ready: boolean, missingTables: string[], existingTables: string[], error: string|null, reason: string|null }>}
 */
async function checkDatabaseReadiness(db, requiredTables = REQUIRED_AUTHORITY_TABLES) {
    if (!db || (typeof db.query !== 'function' && typeof db.execute !== 'function')) {
        return {
            ready: false,
            missingTables: [...requiredTables],
            existingTables: [],
            error: 'NO_DATABASE_CONNECTION',
            reason: 'Database connection or pool was not provided or lacks a query/execute method.'
        };
    }

    const queryFn = typeof db.query === 'function' ? db.query.bind(db) : db.execute.bind(db);

    try {
        const queryResult = await queryFn(
            'SELECT TABLE_NAME FROM information_schema.tables WHERE TABLE_SCHEMA = DATABASE()'
        );

        // Handle both mysql2 [rows, fields] tuple format and direct rows array
        let rawRows = [];
        if (Array.isArray(queryResult)) {
            if (queryResult.length > 0 && Array.isArray(queryResult[0])) {
                rawRows = queryResult[0];
            } else {
                rawRows = queryResult;
            }
        }

        const existingSet = new Set(
            rawRows.map(r => {
                if (!r || typeof r !== 'object') return '';
                const val = r.TABLE_NAME || r.table_name || Object.values(r)[0] || '';
                return String(val).toLowerCase();
            }).filter(Boolean)
        );

        const missing = requiredTables.filter(tbl => !existingSet.has(tbl.toLowerCase()));

        return {
            ready: missing.length === 0,
            missingTables: missing,
            existingTables: Array.from(existingSet).filter(t => 
                requiredTables.some(req => req.toLowerCase() === t)
            ),
            error: null,
            reason: missing.length === 0
                ? null
                : `Missing required authority tables: ${missing.join(', ')}`
        };
    } catch (err) {
        return {
            ready: false,
            missingTables: [...requiredTables],
            existingTables: [],
            error: err.code || 'DB_QUERY_ERROR',
            reason: `Database readiness check failed: ${err.message}`
        };
    }
}

/**
 * Isolated Central Authority Service Container.
 *
 * Coordinates AuthorityConfig, AuthoritySigner, and read-only DB readiness
 * while guaranteeing strict secret encapsulation.
 */
class AuthorityService {
    /** @type {AuthorityConfig|null} */
    #config;

    /** @type {AuthoritySigner|null} */
    #signer;

    /** @type {object|null} */
    #db;

    /** @type {string} */
    #status;

    /** @type {string|null} */
    #statusReason;

    /** @type {string[]} */
    #missingTables;

    /** @type {boolean} */
    #initialized;

    /** @type {{ code: string, message: string }|null} */
    #lastError;

    /** @type {object} */
    #options;

    constructor() {
        this.#config = null;
        this.#signer = null;
        this.#db = null;
        this.#status = AuthorityStatus.UNINITIALIZED;
        this.#statusReason = 'Authority service has not been initialized.';
        this.#missingTables = [];
        this.#initialized = false;
        this.#lastError = null;
        this.#options = {};
    }

    /**
     * Initializes the Authority Service Container.
     *
     * @param {object} [options={}] Initialization options and injected dependencies
     * @param {object} [options.env=process.env] Environment dictionary
     * @param {string} [options.nodeEnv] Runtime environment ('development', 'production', 'test')
     * @param {boolean} [options.requireAuthority] Enforce fail-closed if authority cannot be initialized
     * @param {boolean} [options.requireSigning] Force fail-closed if signing private key is missing
     * @param {boolean} [options.requirePepper] Force fail-closed if license pepper is missing
     * @param {object} [options.config] Injected AuthorityConfig instance (for testing)
     * @param {object} [options.signer] Injected AuthoritySigner instance (for testing)
     * @param {object} [options.db] Injected database connection or pool
     * @param {Function} [options.dbChecker] Injected database readiness checker
     * @param {boolean} [options.requireDb] Enforce fail-closed if database tables are missing
     * @param {object} [options.fs] Injected filesystem implementation
     * @returns {Promise<AuthorityService>} Initialized service instance
     */
    async init(options = {}) {
        const env = options.env || process.env;
        const rawNodeEnv = options.nodeEnv || env.NODE_ENV || 'development';
        const nodeEnv = String(rawNodeEnv).trim().toLowerCase();
        const isProduction = nodeEnv === 'production';

        const requireAuthority = options.requireAuthority !== undefined
            ? Boolean(options.requireAuthority)
            : Boolean(env.REQUIRE_AUTHORITY === 'true' || env.AUTHORITY_MODE === 'standalone');

        const requireSigning = options.requireSigning !== undefined
            ? Boolean(options.requireSigning)
            : (requireAuthority || isProduction);

        const requirePepper = options.requirePepper !== undefined
            ? Boolean(options.requirePepper)
            : (requireAuthority || isProduction);

        this.#options = {
            nodeEnv,
            requireAuthority,
            requireSigning,
            requirePepper
        };

        this.#lastError = null;
        this.#missingTables = [];

        // 1. Resolve AuthorityConfig
        let resolvedConfig = null;
        try {
            if (options.config) {
                if (!(options.config instanceof AuthorityConfig)) {
                    const err = new Error('CONFIG_INVALID_INSTANCE: Injected config must be an instance of AuthorityConfig.');
                    err.code = 'CONFIG_INVALID_INSTANCE';
                    throw err;
                }
                validateAuthorityConfig(options.config);
                resolvedConfig = options.config;
            } else {
                resolvedConfig = loadAuthorityConfig({
                    env,
                    nodeEnv,
                    requireSigning,
                    requirePepper,
                    fs: options.fs
                });
            }
        } catch (cfgErr) {
            this.#status = AuthorityStatus.CONFIG_ERROR;
            this.#statusReason = `Configuration error: ${cfgErr.message}`;
            this.#lastError = {
                code: cfgErr.code || 'CONFIG_ERROR',
                message: cfgErr.message
            };
            this.#initialized = true;

            // Fail-closed in required/production mode
            if (requireAuthority || requireSigning || requirePepper) {
                throw cfgErr;
            }

            return this;
        }

        this.#config = resolvedConfig;

        // 2. Handle Unconfigured State (Development Mode without credentials)
        if (!this.#config.isConfigured || !this.#config.canSign) {
            this.#status = AuthorityStatus.UNCONFIGURED;
            this.#statusReason = 'Signing credentials not configured. Authority is dormant.';
            this.#signer = null;
            this.#initialized = true;
            return this;
        }

        // 3. Instantiate AuthoritySigner
        try {
            if (options.signer) {
                if (!(options.signer instanceof AuthoritySigner)) {
                    const err = new Error('SIGNER_INVALID_INSTANCE: Injected signer must be an instance of AuthoritySigner.');
                    err.code = 'SIGNER_INVALID_INSTANCE';
                    throw err;
                }
                this.#signer = options.signer;
            } else {
                this.#signer = this.#config.createSigner(AuthoritySigner);
            }
        } catch (signerErr) {
            this.#status = AuthorityStatus.CONFIG_ERROR;
            this.#statusReason = `Failed to create AuthoritySigner: ${signerErr.message}`;
            this.#lastError = {
                code: signerErr.code || 'SIGNER_INITIALIZATION_ERROR',
                message: signerErr.message
            };
            this.#initialized = true;

            if (requireAuthority || requireSigning) {
                throw signerErr;
            }

            return this;
        }

        // 4. Database Readiness Verification
        const db = options.db || null;
        this.#db = db;

        if (db || typeof options.dbChecker === 'function') {
            const checker = typeof options.dbChecker === 'function'
                ? options.dbChecker
                : checkDatabaseReadiness;

            let dbResult;
            try {
                dbResult = await checker(db, REQUIRED_AUTHORITY_TABLES);
            } catch (checkErr) {
                dbResult = {
                    ready: false,
                    missingTables: [...REQUIRED_AUTHORITY_TABLES],
                    error: checkErr.code || 'DB_CHECK_ERROR',
                    reason: `Database readiness check error: ${checkErr.message}`
                };
            }

            if (!dbResult || !dbResult.ready) {
                this.#status = AuthorityStatus.UNAVAILABLE;
                this.#missingTables = Array.isArray(dbResult?.missingTables)
                    ? dbResult.missingTables
                    : [...REQUIRED_AUTHORITY_TABLES];
                this.#statusReason = dbResult?.reason || 'Required authority tables are missing from database.';
                this.#lastError = {
                    code: dbResult?.error || 'MISSING_AUTHORITY_TABLES',
                    message: this.#statusReason
                };
                this.#initialized = true;

                if (requireAuthority && options.requireDb) {
                    const err = new Error(`AUTHORITY_DATABASE_UNAVAILABLE: ${this.#statusReason}`);
                    err.code = 'AUTHORITY_DATABASE_UNAVAILABLE';
                    throw err;
                }

                return this;
            }
        }

        // 5. Authority Service Fully Ready
        this.#status = AuthorityStatus.READY;
        this.#statusReason = 'Authority service is fully operational and ready to sign licenses.';
        this.#missingTables = [];
        this.#initialized = true;

        return this;
    }

    /**
     * Current service lifecycle status.
     * @returns {string} One of AuthorityStatus enums
     */
    get status() {
        return this.#status;
    }

    /**
     * Indicates whether the authority is completely ready (signing configured + DB verified).
     * @returns {boolean}
     */
    get isReady() {
        return this.#status === AuthorityStatus.READY;
    }

    /**
     * Indicates whether the authority has a valid Ed25519 signer instance.
     * @returns {boolean}
     */
    get canSign() {
        return Boolean(this.#signer && this.#config && this.#config.canSign);
    }

    /**
     * Indicates whether a valid HMAC license pepper is configured.
     * @returns {boolean}
     */
    get hasPepper() {
        return Boolean(this.#config && this.#config.hasPepper);
    }

    /**
     * Key identifier associated with the signing key.
     * @returns {string|null}
     */
    get keyId() {
        return this.#config ? this.#config.keyId : null;
    }

    /**
     * Signing algorithm name.
     * @returns {string}
     */
    get algorithm() {
        return this.#config ? this.#config.algorithm : SUPPORTED_ALGORITHM;
    }

    /**
     * Runtime environment.
     * @returns {string}
     */
    get nodeEnv() {
        return this.#config ? this.#config.nodeEnv : (this.#options.nodeEnv || 'development');
    }

    /**
     * List of missing authority tables identified during DB check.
     * @returns {string[]}
     */
    get missingTables() {
        return Object.freeze([...this.#missingTables]);
    }

    /**
     * Last recorded error metadata (sanitized).
     * @returns {{ code: string, message: string }|null}
     */
    get lastError() {
        return this.#lastError ? { ...this.#lastError } : null;
    }

    /**
     * Diagnostic reason string explaining current status.
     * @returns {string|null}
     */
    get statusReason() {
        return this.#statusReason;
    }

    /**
     * Sanitized public config descriptor. Never exposes secrets.
     * @returns {object|null}
     */
    get config() {
        return this.#config ? this.#config.toJSON() : null;
    }

    /**
     * Returns the active AuthoritySigner instance.
     *
     * @returns {AuthoritySigner}
     * @throws {Error} If authority cannot sign or is not ready
     */
    getSigner() {
        if (!this.#signer || !this.canSign) {
            const err = new Error('AUTHORITY_NOT_CONFIGURED: Signing service is not configured or unavailable.');
            err.code = 'AUTHORITY_NOT_CONFIGURED';
            throw err;
        }

        return this.#signer;
    }

    /**
     * Signs an entitlement payload into an immutable signed envelope using the encapsulated AuthoritySigner.
     *
     * @param {object} payload License payload conforming to HRM specification
     * @returns {{ algorithm: string, key_id: string, payload: object, signature: string }}
     */
    signEnvelope(payload) {
        return this.getSigner().signEnvelope(payload);
    }

    /**
     * Alias for signEnvelope.
     *
     * @param {object} payload License payload conforming to HRM specification
     * @returns {{ algorithm: string, key_id: string, payload: object, signature: string }}
     */
    signLicense(payload) {
        return this.signEnvelope(payload);
    }

    /**
     * Returns a safe status summary object suitable for health checks and APIs.
     * Guaranteed to contain zero secret material.
     *
     * @returns {object} Sanitized status descriptor
     */
    getStatus() {
        return {
            status: this.#status,
            isReady: this.isReady,
            canSign: this.canSign,
            hasPepper: this.hasPepper,
            keyId: this.keyId,
            algorithm: this.algorithm,
            nodeEnv: this.nodeEnv,
            missingTables: [...this.#missingTables],
            reason: this.#statusReason,
            lastError: this.lastError
        };
    }

    /**
     * Controlled shutdown for the service container.
     */
    shutdown() {
        this.#status = AuthorityStatus.SHUTDOWN;
        this.#statusReason = 'Authority service has been shut down.';
        this.#signer = null;
        this.#config = null;
        this.#db = null;
        this.#missingTables = [];
        this.#initialized = false;
        this.#lastError = null;
    }

    /**
     * JSON serialization. Guaranteed to contain zero secret material.
     *
     * @returns {object}
     */
    toJSON() {
        return this.getStatus();
    }

    /**
     * Custom inspector for node console and util.inspect. Redacts all secrets.
     *
     * @returns {string}
     */
    [util.inspect.custom]() {
        return `[AuthorityService: status=${this.#status}, ready=${this.isReady}, canSign=${this.canSign}, keyId=${this.keyId}, env=${this.nodeEnv}]`;
    }
}

/**
 * Factory creating an AuthorityService instance.
 *
 * @param {object} [options] Optional configuration options
 * @returns {AuthorityService}
 */
function createAuthorityService(options = {}) {
    return new AuthorityService();
}

/**
 * Convenience helper that instantiates and initializes an AuthorityService.
 *
 * @param {object} [options={}] Initialization options
 * @returns {Promise<AuthorityService>} Initialized AuthorityService instance
 */
async function initAuthority(options = {}) {
    const service = new AuthorityService();
    await service.init(options);
    return service;
}

module.exports = {
    AuthorityService,
    AuthorityStatus,
    REQUIRED_AUTHORITY_TABLES,
    checkDatabaseReadiness,
    createAuthorityService,
    initAuthority
};
