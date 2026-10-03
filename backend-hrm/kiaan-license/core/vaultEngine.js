/**
 * Kiaan License Engine — Dual-Vault Storage Engine & Monotonic Sequence Reconciler
 * Module: backend-hrm/kiaan-license/core/vaultEngine.js
 *
 * Implements local dual-vault license synchronization, monotonic versioning,
 * self-healing, and conflict resolution across primary (e.g. MySQL) and
 * mirror (e.g. Filesystem) storage adapters.
 *
 * Architectural Guarantees:
 * 1. Adapter Abstraction: Zero direct database or filesystem imports. Interacts exclusively
 *    via injected adapter interfaces ({ read(): Promise, write(envelope): Promise }).
 * 2. Cryptographic Precedence: A vault record is NEVER trusted merely because it is valid JSON.
 *    Every record must pass PureEd25519 verification before influencing state.
 * 3. Monotonic Sequence Authority:
 *    - Equal sequences + identical signatures => STATUS_HEALTHY
 *    - Higher sequence number takes authority over lower sequence number (protects against stale DB restores)
 *    - Equal sequence + differing signatures => STATUS_DEGRADED_CONFLICT (no silent merge)
 *    - One vault missing or corrupted => Auto-heal/recover from surviving valid vault
 *    - Both vaults missing or corrupted => Fail closed (STATUS_UNLICENSED / STATUS_CORRUPTED)
 * 4. Write Protection: Sequence rollback is strictly rejected. Partial persistence failures
 *    are explicitly reported.
 */

'use strict';

const { verifyEnvelope, VerificationCodes } = require('./cryptoEngine');

/**
 * Reconciliation status outcomes.
 */
const VaultStatus = Object.freeze({
    HEALTHY: 'STATUS_HEALTHY',
    RECONCILED: 'STATUS_RECONCILED',
    SELF_HEALED: 'STATUS_SELF_HEALED',
    RECOVERED: 'STATUS_RECOVERED',
    DEGRADED_CONFLICT: 'STATUS_DEGRADED_CONFLICT',
    UNLICENSED: 'STATUS_UNLICENSED',
    CORRUPTED: 'STATUS_CORRUPTED'
});

/**
 * Persistence / write status outcomes.
 */
const WriteStatus = Object.freeze({
    SUCCESS: 'PERSISTENCE_SUCCESS',
    PARTIAL_FAILURE: 'PARTIAL_PERSISTENCE_FAILURE',
    FAILURE: 'PERSISTENCE_FAILURE',
    ROLLBACK_REJECTED: 'SEQUENCE_ROLLBACK_REJECTED',
    VERIFICATION_FAILED: 'VERIFICATION_FAILED',
    CONFLICT_REJECTED: 'CONFLICT_REJECTED',
    INVALID_ADAPTER: 'INVALID_ADAPTER'
});

/**
 * Internal helper to read and verify an envelope from an adapter.
 *
 * @param {object} adapter Storage adapter with read() and write() methods
 * @param {string} adapterName 'primary' or 'mirror'
 * @param {object} keystore Trusted public key store
 * @returns {Promise<object>} Inspection result
 */
async function inspectVault(adapter, adapterName, keystore) {
    if (!adapter || typeof adapter.read !== 'function') {
        return {
            name: adapterName,
            status: 'MISSING',
            envelope: null,
            payload: null,
            sequenceNumber: null,
            error: 'Adapter missing read method'
        };
    }

    let readResult;
    try {
        readResult = await adapter.read();
    } catch (err) {
        return {
            name: adapterName,
            status: 'INVALID',
            envelope: null,
            payload: null,
            sequenceNumber: null,
            error: `Read failed: ${err.message}`
        };
    }

    if (!readResult) {
        return {
            name: adapterName,
            status: 'MISSING',
            envelope: null,
            payload: null,
            sequenceNumber: null,
            error: null
        };
    }

    // Support either direct envelope or { envelope } container
    const envelope = readResult.envelope !== undefined ? readResult.envelope : readResult;

    if (!envelope || typeof envelope !== 'object') {
        return {
            name: adapterName,
            status: 'INVALID',
            envelope: null,
            payload: null,
            sequenceNumber: null,
            error: 'Read content is not a valid object'
        };
    }

    // Verify cryptographic integrity using cryptoEngine
    const verifyRes = verifyEnvelope(envelope, keystore);
    if (!verifyRes.valid) {
        return {
            name: adapterName,
            status: 'INVALID',
            envelope: envelope,
            payload: null,
            sequenceNumber: null,
            error: verifyRes.code || 'Verification failed'
        };
    }

    const payload = verifyRes.payload;
    const sequenceNumber = (payload && typeof payload.sequence_number === 'number')
        ? payload.sequence_number
        : 1;

    return {
        name: adapterName,
        status: 'VALID',
        envelope: envelope,
        payload: payload,
        sequenceNumber: sequenceNumber,
        error: null
    };
}

/**
 * Reconciles the primary and mirror vaults according to the approved monotonic authority policy.
 *
 * @param {object} params
 * @param {object} params.primaryAdapter Primary database adapter (e.g. MySQL)
 * @param {object} params.mirrorAdapter Mirror storage adapter (e.g. Filesystem)
 * @param {object} params.keystore Trusted public key store for Ed25519 verification
 * @param {object} [params.options] Optional flags (e.g. { autoHeal: true })
 * @returns {Promise<object>} Structured reconciliation result
 */
async function reconcileVaults({
    primaryAdapter,
    mirrorAdapter,
    keystore,
    options = {}
} = {}) {
    const autoHeal = options.autoHeal !== false;

    // Inspect both vaults concurrently
    const [primary, mirror] = await Promise.all([
        inspectVault(primaryAdapter, 'primary', keystore),
        inspectVault(mirrorAdapter, 'mirror', keystore)
    ]);

    let status;
    let authoritative = null;
    let healTarget = null; // 'primary' | 'mirror' | null
    let reason = null;

    // -----------------------------------------------------------------------
    // Case A, B, C: Both Vaults Valid
    // -----------------------------------------------------------------------
    if (primary.status === 'VALID' && mirror.status === 'VALID') {
        // Case A: Identical envelopes (both valid and signatures match)
        if (primary.envelope.signature === mirror.envelope.signature) {
            status = VaultStatus.HEALTHY;
            authoritative = primary.envelope;
            reason = 'Both vaults valid and identical';
        }
        // Different license IDs across vaults: unresolvable conflict
        else if (primary.payload.license_id !== mirror.payload.license_id) {
            status = VaultStatus.DEGRADED_CONFLICT;
            authoritative = null;
            reason = 'Differing license IDs detected across vaults; automatic merge refused';
        }
        // Case C: Equal sequence numbers, but differing payloads
        else if (primary.sequenceNumber === mirror.sequenceNumber) {
            status = VaultStatus.DEGRADED_CONFLICT;
            authoritative = null;
            reason = `Forked version conflict: equal sequence number (${primary.sequenceNumber}) with differing signatures`;
        }
        // Case B: Different sequence numbers (same license ID)
        else if (mirror.sequenceNumber > primary.sequenceNumber) {
            // Mirror has newer sequence (e.g. DB was restored from older backup)
            status = VaultStatus.RECONCILED;
            authoritative = mirror.envelope;
            healTarget = 'primary';
            reason = `Mirror vault sequence (${mirror.sequenceNumber}) is newer than primary (${primary.sequenceNumber}); primary reconciled`;
        } else {
            // Primary has newer sequence (e.g. Container rebuilt with older filesystem image)
            status = VaultStatus.RECONCILED;
            authoritative = primary.envelope;
            healTarget = 'mirror';
            reason = `Primary vault sequence (${primary.sequenceNumber}) is newer than mirror (${mirror.sequenceNumber}); mirror reconciled`;
        }
    }
    // -----------------------------------------------------------------------
    // Case D: One Vault Missing
    // -----------------------------------------------------------------------
    else if (primary.status === 'VALID' && mirror.status === 'MISSING') {
        status = VaultStatus.SELF_HEALED;
        authoritative = primary.envelope;
        healTarget = 'mirror';
        reason = 'Mirror vault missing; self-healed from primary vault';
    } else if (mirror.status === 'VALID' && primary.status === 'MISSING') {
        status = VaultStatus.SELF_HEALED;
        authoritative = mirror.envelope;
        healTarget = 'primary';
        reason = 'Primary vault missing; self-healed from mirror vault';
    }
    // -----------------------------------------------------------------------
    // Case E: One Vault Corrupted / Invalid Signature
    // -----------------------------------------------------------------------
    else if (primary.status === 'VALID' && mirror.status === 'INVALID') {
        status = VaultStatus.RECOVERED;
        authoritative = primary.envelope;
        healTarget = 'mirror';
        reason = `Mirror vault invalid (${mirror.error}); recovered from valid primary vault`;
    } else if (mirror.status === 'VALID' && primary.status === 'INVALID') {
        status = VaultStatus.RECOVERED;
        authoritative = mirror.envelope;
        healTarget = 'primary';
        reason = `Primary vault invalid (${primary.error}); recovered from valid mirror vault`;
    }
    // -----------------------------------------------------------------------
    // Case F: Both Vaults Missing or Invalid
    // -----------------------------------------------------------------------
    else if (primary.status === 'MISSING' && mirror.status === 'MISSING') {
        status = VaultStatus.UNLICENSED;
        authoritative = null;
        reason = 'No license envelopes found in storage';
    } else {
        // Both invalid, or one invalid and one missing
        status = VaultStatus.CORRUPTED;
        authoritative = null;
        reason = 'All available license envelopes failed cryptographic verification';
    }

    // Execute auto-healing if applicable and requested
    let healResult = null;
    if (healTarget && autoHeal && authoritative) {
        try {
            if (healTarget === 'primary' && primaryAdapter && typeof primaryAdapter.write === 'function') {
                const ok = await primaryAdapter.write(authoritative);
                healResult = { target: 'primary', success: Boolean(ok) };
            } else if (healTarget === 'mirror' && mirrorAdapter && typeof mirrorAdapter.write === 'function') {
                const ok = await mirrorAdapter.write(authoritative);
                healResult = { target: 'mirror', success: Boolean(ok) };
            }
        } catch (err) {
            healResult = { target: healTarget, success: false, error: err.message };
        }
    }

    return {
        status: status,
        authoritative: authoritative,
        reason: reason,
        healTarget: healTarget,
        healResult: healResult,
        vaults: {
            primary: { status: primary.status, sequenceNumber: primary.sequenceNumber, error: primary.error },
            mirror: { status: mirror.status, sequenceNumber: mirror.sequenceNumber, error: mirror.error }
        }
    };
}

/**
 * Persists an entitlement envelope across both primary and mirror vaults.
 * Enforces signature validity, sequence monotonicity, and partial persistence reporting.
 *
 * @param {object} params
 * @param {object} params.envelope Signed entitlement envelope to persist
 * @param {object} params.primaryAdapter Primary database adapter
 * @param {object} params.mirrorAdapter Mirror storage adapter
 * @param {object} params.keystore Trusted public key store
 * @param {object} [params.options] Optional persistence settings
 * @returns {Promise<object>} Persistence result
 */
async function persistEntitlement({
    envelope,
    primaryAdapter,
    mirrorAdapter,
    keystore,
    options = {}
} = {}) {
    // 1. Adapter validation
    if (!primaryAdapter || typeof primaryAdapter.write !== 'function' ||
        !mirrorAdapter || typeof mirrorAdapter.write !== 'function') {
        return {
            success: false,
            code: WriteStatus.INVALID_ADAPTER,
            reason: 'Both primary and mirror adapters with write() methods are required'
        };
    }

    // 2. Cryptographic Verification of the New Envelope
    const verifyRes = verifyEnvelope(envelope, keystore);
    if (!verifyRes.valid) {
        return {
            success: false,
            code: WriteStatus.VERIFICATION_FAILED,
            reason: `Envelope failed signature verification: ${verifyRes.code || 'INVALID'}`
        };
    }

    const newPayload = verifyRes.payload;
    const newSeq = (newPayload && typeof newPayload.sequence_number === 'number')
        ? newPayload.sequence_number
        : 1;

    // 3. Inspect Current State & Monotonic Check
    const current = await reconcileVaults({
        primaryAdapter,
        mirrorAdapter,
        keystore,
        options: { autoHeal: false }
    });

    // Check for unresolved degraded conflicts
    if (current.status === VaultStatus.DEGRADED_CONFLICT && options.forceConflictResolution !== true) {
        return {
            success: false,
            code: WriteStatus.CONFLICT_REJECTED,
            reason: 'Storage has an unresolved degraded conflict. Explicit conflict resolution flag required.'
        };
    }

    // Check monotonic sequence if an authoritative entitlement already exists
    if (current.authoritative && current.authoritative.payload) {
        const currentSeq = current.authoritative.payload.sequence_number || 1;

        if (newSeq < currentSeq) {
            return {
                success: false,
                code: WriteStatus.ROLLBACK_REJECTED,
                reason: `Sequence rollback rejected: new sequence (${newSeq}) is older than active (${currentSeq})`
            };
        }

        if (newSeq === currentSeq) {
            // If identical envelope, treat as idempotent success
            if (envelope.signature === current.authoritative.signature) {
                return {
                    success: true,
                    code: WriteStatus.SUCCESS,
                    isIdempotent: true,
                    sequenceNumber: newSeq
                };
            }

            // Same sequence number with different payload is rejected
            return {
                success: false,
                code: WriteStatus.ROLLBACK_REJECTED,
                reason: `Sequence conflict: sequence ${newSeq} already exists with differing payload`
            };
        }
    }

    // 4. Dual Persistence Execution
    let primarySuccess = false;
    let mirrorSuccess = false;
    let primaryError = null;
    let mirrorError = null;

    try {
        primarySuccess = Boolean(await primaryAdapter.write(envelope));
    } catch (err) {
        primaryError = err.message;
    }

    try {
        mirrorSuccess = Boolean(await mirrorAdapter.write(envelope));
    } catch (err) {
        mirrorError = err.message;
    }

    // 5. Evaluate Persistence Outcomes
    if (primarySuccess && mirrorSuccess) {
        return {
            success: true,
            code: WriteStatus.SUCCESS,
            sequenceNumber: newSeq
        };
    }

    if (primarySuccess || mirrorSuccess) {
        return {
            success: false,
            code: WriteStatus.PARTIAL_FAILURE,
            reason: `Partial persistence: primary=${primarySuccess}, mirror=${mirrorSuccess}`,
            details: {
                primary: { success: primarySuccess, error: primaryError },
                mirror: { success: mirrorSuccess, error: mirrorError }
            },
            sequenceNumber: newSeq
        };
    }

    return {
        success: false,
        code: WriteStatus.FAILURE,
        reason: 'Persistence failed across both storage adapters',
        details: {
            primary: { success: false, error: primaryError },
            mirror: { success: false, error: mirrorError }
        }
    };
}

module.exports = {
    reconcileVaults,
    persistEntitlement,
    VaultStatus,
    WriteStatus
};
