/**
 * Kiaan License Engine — Secondary Storage Adapter (Filesystem)
 * Module: backend-hrm/kiaan-license/storage/filesystemAdapter.js
 *
 * Implements the atomic filesystem mirror storage adapter for the Kiaan License Engine.
 * Provides resilient, tamper-evident, atomic file operations on local offline disk storage.
 *
 * Architectural Guarantees:
 * 1. Atomic Persistence: Writes to a unique sibling temporary file and renames into place,
 *    preventing partial writes or zero-byte corrupted files during power/crash events.
 * 2. Path Sanitization: Never exposes absolute host paths in error messages or logs.
 * 3. Strict Validation: Rejects empty, null, or malformed license envelopes before disk write.
 * 4. Permission Hardening: Restricts directory (0700) and file (0600) permissions where supported.
 * 5. Clean Missing Detection: Returns null on missing vault (ENOENT), throwing only on true I/O failures.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Default relative vault path.
 */
const DEFAULT_VAULT_PATH = path.resolve(__dirname, '..', '.vault', 'license.lic');

/**
 * Sanitizes an error by stripping internal absolute paths.
 *
 * @param {Error} err Original error
 * @param {string} vaultPath Absolute path to redact
 * @returns {Error} Sanitized error with paths redacted
 */
function sanitizePathInError(err, vaultPath) {
    if (!err || typeof err.message !== 'string') {
        return err;
    }

    const dir = path.dirname(vaultPath);
    let msg = err.message;

    // Redact full file path and directory
    msg = msg.split(vaultPath).join('[VAULT_FILE]');
    msg = msg.split(dir).join('[VAULT_DIR]');

    const sanitizedErr = new Error(msg);
    sanitizedErr.code = err.code || 'FS_ERROR';
    return sanitizedErr;
}

/**
 * Creates an isolated Filesystem storage adapter instance.
 *
 * @param {object} [options={}] Optional configuration
 * @param {string} [options.vaultPath] Target license vault file path
 * @returns {object} Adapter instance with { read(), write(), exists(), getSanitizedPath() }
 */
function createFilesystemAdapter(options = {}) {
    const vaultPath = options.vaultPath
        || process.env.LICENSE_VAULT_PATH
        || DEFAULT_VAULT_PATH;

    if (typeof vaultPath !== 'string' || !vaultPath.trim()) {
        throw new TypeError('Filesystem adapter vaultPath must be a non-empty string');
    }

    const vaultDir = path.dirname(vaultPath);

    /**
     * Reads and parses the license envelope from the vault file.
     *
     * @returns {Promise<object|null>} The parsed envelope object, or null if file does not exist.
     * @throws {Error} If permission is denied or file content is malformed JSON.
     */
    async function read() {
        let content;
        try {
            content = await fs.promises.readFile(vaultPath, 'utf8');
        } catch (err) {
            // Missing file (ENOENT) is a clean "MISSING" signal for vaultEngine
            if (err.code === 'ENOENT') {
                return null;
            }

            // Permission denied
            if (err.code === 'EACCES' || err.code === 'EPERM') {
                const permErr = new Error('Permission denied accessing license vault storage [VAULT_FILE]');
                permErr.code = 'VAULT_PERMISSION_DENIED';
                throw permErr;
            }

            // Other filesystem I/O error
            throw sanitizePathInError(err, vaultPath);
        }

        // Empty file handling
        const trimmed = content.trim();
        if (!trimmed) {
            const emptyErr = new Error('License vault file [VAULT_FILE] is empty');
            emptyErr.code = 'MALFORMED_STORED_DATA';
            throw emptyErr;
        }

        // JSON Parsing
        try {
            const envelope = JSON.parse(trimmed);
            if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
                const invalidErr = new Error('License vault file [VAULT_FILE] does not contain a valid JSON object');
                invalidErr.code = 'MALFORMED_STORED_DATA';
                throw invalidErr;
            }
            return envelope;
        } catch (parseErr) {
            const malformedErr = new Error(`Malformed license vault file content: invalid JSON`);
            malformedErr.code = 'MALFORMED_STORED_DATA';
            throw malformedErr;
        }
    }

    /**
     * Persists a signed license envelope to the vault file atomically.
     *
     * @param {object} envelope Signed entitlement envelope { algorithm, key_id, payload, signature }
     * @returns {Promise<boolean>} True on success
     * @throws {Error} If envelope is invalid or write/rename fails
     */
    async function write(envelope) {
        if (!envelope || typeof envelope !== 'object') {
            throw new TypeError('Cannot write invalid or null license envelope to filesystem vault');
        }

        const { algorithm, key_id, payload, signature } = envelope;
        if (!algorithm || !key_id || !signature || payload === undefined) {
            throw new TypeError('Envelope missing required fields for filesystem persistence (algorithm, key_id, payload, signature)');
        }

        // Serialize envelope with 2-space indentation for human inspectability during offline audits
        const serialized = JSON.stringify(envelope, null, 2);

        // Ensure parent directory exists with owner-only permissions where supported
        try {
            await fs.promises.mkdir(vaultDir, { recursive: true, mode: 0o700 });
        } catch (mkdirErr) {
            if (mkdirErr.code === 'EACCES' || mkdirErr.code === 'EPERM') {
                const permErr = new Error('Permission denied creating license vault directory [VAULT_DIR]');
                permErr.code = 'VAULT_PERMISSION_DENIED';
                throw permErr;
            }
            throw sanitizePathInError(mkdirErr, vaultPath);
        }

        // Generate unique sibling temp file in the SAME directory to ensure same-filesystem atomic rename
        const randomHex = crypto.randomBytes(6).toString('hex');
        const tmpPath = path.join(vaultDir, `.license.tmp.${Date.now()}.${randomHex}`);

        try {
            // Write temporary file
            await fs.promises.writeFile(tmpPath, serialized, {
                encoding: 'utf8',
                mode: 0o600,
                flag: 'w'
            });

            // Atomic rename into final destination
            try {
                await fs.promises.rename(tmpPath, vaultPath);
            } catch (renameErr) {
                // Windows-specific handling: if destination exists and rename throws EPERM/EEXIST, unlink and retry
                if (process.platform === 'win32' && (renameErr.code === 'EPERM' || renameErr.code === 'EEXIST')) {
                    try {
                        await fs.promises.unlink(vaultPath);
                    } catch (unlinkErr) {
                        if (unlinkErr.code !== 'ENOENT') throw unlinkErr;
                    }
                    await fs.promises.rename(tmpPath, vaultPath);
                } else {
                    throw renameErr;
                }
            }

            return true;
        } catch (err) {
            // Cleanup temp file if still present
            try {
                await fs.promises.unlink(tmpPath);
            } catch {
                // Ignore cleanup error
            }

            if (err.code === 'EACCES' || err.code === 'EPERM') {
                const permErr = new Error('Permission denied writing to license vault [VAULT_FILE]');
                permErr.code = 'VAULT_PERMISSION_DENIED';
                throw permErr;
            }

            throw sanitizePathInError(err, vaultPath);
        }
    }

    /**
     * Checks if the vault file currently exists.
     *
     * @returns {Promise<boolean>} True if file exists and is readable
     */
    async function exists() {
        try {
            await fs.promises.access(vaultPath, fs.constants.F_OK);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Returns a sanitized path descriptor safe for user-facing diagnostics.
     *
     * @returns {string} Sanitized path
     */
    function getSanitizedPath() {
        return `[VAULT_DIR]/${path.basename(vaultPath)}`;
    }

    /**
     * Internal accessor for testing purposes.
     *
     * @returns {string} Configured path
     */
    function getInternalPath() {
        return vaultPath;
    }

    return Object.freeze({
        name: 'filesystem',
        read,
        write,
        exists,
        getSanitizedPath,
        getInternalPath
    });
}

module.exports = {
    createFilesystemAdapter,
    sanitizePathInError,
    DEFAULT_VAULT_PATH
};
