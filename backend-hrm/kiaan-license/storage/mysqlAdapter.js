/**
 * Kiaan License Engine — Primary Storage Adapter (MySQL)
 * Module: backend-hrm/kiaan-license/storage/mysqlAdapter.js
 *
 * Implements the isolated database storage adapter for the Kiaan License Engine.
 * Integrates with the existing MySQL2 connection pool without creating separate connections
 * or mutating business schemas.
 *
 * Expected Schema Contract (Informational / Documentation Only):
 * -------------------------------------------------------------
 * CREATE TABLE IF NOT EXISTS system_licenses (
 *     id INT PRIMARY KEY AUTO_INCREMENT,
 *     envelope_json LONGTEXT NOT NULL,
 *     key_id VARCHAR(100) NOT NULL,
 *     algorithm VARCHAR(50) NOT NULL DEFAULT 'Ed25519',
 *     sequence_number INT NOT NULL DEFAULT 1,
 *     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 *     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 *     INDEX idx_license_seq (sequence_number)
 * );
 *
 * Backward-Compatible Column Fallback:
 * If an installation uses separate columns:
 * (id, license_data, signature, key_id, algorithm, sequence_number)
 * this adapter transparently handles reconstruction of the canonical envelope.
 *
 * Architectural Guarantees:
 * 1. Dependency Injection: Uses the application's existing database pool. Zero new connections.
 * 2. Parameterized SQL: Identifiers escaped via validated whitelist and `??`; values via `?`.
 * 3. Isolation: Operates exclusively on the isolated license table; zero interaction with tenant tables.
 * 4. Error Transparency: Distinguishes between missing table (returns null/missing) and DB connection
 *    outage (throws DB_UNAVAILABLE to avoid falsely treating DB downtime as unlicensed).
 * 5. Zero DDL/Migrations: Never creates or alters database tables at runtime.
 */

'use strict';

/**
 * Known database connection failure codes that indicate temporary unavailability.
 */
const DB_CONNECTION_ERROR_CODES = new Set([
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ENOTFOUND',
    'PROTOCOL_CONNECTION_LOST',
    'ER_ACCESS_DENIED_ERROR',
    'EHOSTUNREACH',
    'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR',
    'ER_CON_COUNT_ERROR',
    'POOL_CLOSED'
]);

/**
 * Strict regex for SQL table identifiers to prevent SQL injection in table names.
 */
const TABLE_NAME_REGEX = /^[a-zA-Z0-9_]+$/;

/**
 * Creates an isolated MySQL storage adapter instance using an injected database pool.
 *
 * @param {object} pool An existing MySQL2 pool or connection object (with .query or .execute)
 * @param {object} [options={}] Optional adapter configuration
 * @param {string} [options.tableName='system_licenses'] Name of the license table
 * @returns {object} Adapter instance with { read(), write(), isAvailable(), hasTable() }
 */
function createMysqlAdapter(pool, options = {}) {
    if (!pool || (typeof pool.query !== 'function' && typeof pool.execute !== 'function')) {
        throw new TypeError('MySQL adapter requires an injected database pool with a .query() or .execute() method');
    }

    const tableName = options.tableName || 'system_licenses';
    if (!TABLE_NAME_REGEX.test(tableName)) {
        throw new Error(`Invalid table name identifier: '${tableName}'. Only alphanumeric characters and underscores are allowed.`);
    }

    // Helper to execute query using pool.query or pool.execute
    async function execQuery(sql, params) {
        if (typeof pool.execute === 'function') {
            const [rows] = await pool.execute(sql, params);
            return rows;
        }
        const [rows] = await pool.query(sql, params);
        return rows;
    }

    /**
     * Reads the active license envelope from the database.
     *
     * @returns {Promise<object|null>} The parsed envelope object, or null if table is empty / does not exist.
     * @throws {Error} If database is unavailable or stored content is malformed.
     */
    async function read() {
        const sql = `SELECT * FROM ?? ORDER BY sequence_number DESC, id DESC LIMIT 1`;

        let rows;
        try {
            rows = await execQuery(sql, [tableName]);
        } catch (err) {
            // Check if table does not exist (MySQL error 1146 / ER_NO_SUCH_TABLE)
            if (err.code === 'ER_NO_SUCH_TABLE' || err.errno === 1146) {
                // Table is missing — return null so vaultEngine treats it as MISSING
                return null;
            }

            // Check if database is unavailable (connection error)
            if (DB_CONNECTION_ERROR_CODES.has(err.code)) {
                const dbError = new Error(`Database unavailable during license read: ${err.code}`);
                dbError.code = 'DB_UNAVAILABLE';
                dbError.originalError = err;
                throw dbError;
            }

            // Other unexpected SQL failure
            const genericError = new Error(`Database error reading license from ${tableName}: ${err.message}`);
            genericError.code = err.code || 'DB_ERROR';
            throw genericError;
        }

        if (!rows || rows.length === 0) {
            return null;
        }

        const row = rows[0];

        // Format A: JSON-serialized envelope in single column (preferred)
        if (row.envelope_json) {
            try {
                const envelope = typeof row.envelope_json === 'string'
                    ? JSON.parse(row.envelope_json)
                    : row.envelope_json;
                return envelope;
            } catch (parseErr) {
                const malformedError = new Error(`Database license record contains malformed JSON: ${parseErr.message}`);
                malformedError.code = 'MALFORMED_STORED_DATA';
                throw malformedError;
            }
        }

        // Format B: Legacy separate columns (license_data, signature, key_id, algorithm)
        if (row.license_data && row.signature) {
            try {
                const payload = typeof row.license_data === 'string'
                    ? JSON.parse(row.license_data)
                    : row.license_data;

                return {
                    algorithm: row.algorithm || 'Ed25519',
                    key_id: row.key_id,
                    payload: payload,
                    signature: row.signature
                };
            } catch (parseErr) {
                const malformedError = new Error(`Database license payload contains malformed JSON: ${parseErr.message}`);
                malformedError.code = 'MALFORMED_STORED_DATA';
                throw malformedError;
            }
        }

        // Row exists but contains neither format
        const invalidRowErr = new Error('Database license record lacks required envelope or payload columns');
        invalidRowErr.code = 'MALFORMED_STORED_DATA';
        throw invalidRowErr;
    }

    /**
     * Persists a signed license envelope to the database.
     *
     * @param {object} envelope Signed entitlement envelope { algorithm, key_id, payload, signature }
     * @returns {Promise<boolean>} True on success
     * @throws {Error} If envelope is invalid or database fails
     */
    async function write(envelope) {
        if (!envelope || typeof envelope !== 'object') {
            throw new TypeError('Cannot write invalid or null license envelope to database');
        }

        const { algorithm, key_id, payload, signature } = envelope;
        if (!algorithm || !key_id || !signature || payload === undefined) {
            throw new TypeError('Envelope missing required fields for database persistence (algorithm, key_id, payload, signature)');
        }

        const sequenceNumber = (payload && typeof payload.sequence_number === 'number')
            ? payload.sequence_number
            : 1;

        const envelopeJson = JSON.stringify(envelope);

        try {
            // Check if any license row already exists
            const existingRows = await execQuery(`SELECT id FROM ?? ORDER BY sequence_number DESC, id DESC LIMIT 1`, [tableName]);

            if (existingRows && existingRows.length > 0) {
                const activeId = existingRows[0].id;
                // Update active row
                await execQuery(
                    `UPDATE ?? SET envelope_json = ?, key_id = ?, algorithm = ?, sequence_number = ? WHERE id = ?`,
                    [tableName, envelopeJson, key_id, algorithm, sequenceNumber, activeId]
                );
            } else {
                // Insert new row
                await execQuery(
                    `INSERT INTO ?? (envelope_json, key_id, algorithm, sequence_number) VALUES (?, ?, ?, ?)`,
                    [tableName, envelopeJson, key_id, algorithm, sequenceNumber]
                );
            }

            return true;
        } catch (err) {
            if (err.code === 'ER_NO_SUCH_TABLE' || err.errno === 1146) {
                const tableErr = new Error(`Cannot persist license: Table '${tableName}' does not exist`);
                tableErr.code = 'TABLE_NOT_FOUND';
                throw tableErr;
            }

            if (DB_CONNECTION_ERROR_CODES.has(err.code)) {
                const dbError = new Error(`Database unavailable during license write: ${err.code}`);
                dbError.code = 'DB_UNAVAILABLE';
                dbError.originalError = err;
                throw dbError;
            }

            const writeErr = new Error(`Failed to persist license to ${tableName}: ${err.message}`);
            writeErr.code = err.code || 'DB_WRITE_ERROR';
            throw writeErr;
        }
    }

    /**
     * Diagnostic helper to verify whether the database pool is healthy.
     *
     * @returns {Promise<boolean>} True if database responds to ping
     */
    async function isAvailable() {
        try {
            await execQuery('SELECT 1 as ping', []);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Diagnostic helper to verify whether the license table exists.
     *
     * @returns {Promise<boolean>} True if table exists
     */
    async function hasTable() {
        try {
            await execQuery(`SELECT 1 FROM ?? LIMIT 1`, [tableName]);
            return true;
        } catch (err) {
            if (err.code === 'ER_NO_SUCH_TABLE' || err.errno === 1146) {
                return false;
            }
            throw err;
        }
    }

    return Object.freeze({
        name: 'mysql',
        tableName,
        read,
        write,
        isAvailable,
        hasTable
    });
}

module.exports = {
    createMysqlAdapter,
    DB_CONNECTION_ERROR_CODES
};
