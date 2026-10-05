/**
 * Kiaan License Engine — Commercial Entitlement Evaluation Layer
 * Module: backend-hrm/kiaan-license/core/entitlementEvaluator.js
 *
 * Implements Phase 2B.9: Reusable, deterministic entitlement evaluation abstraction.
 *
 * Security Requirements:
 * 1. Zero Trust: Evaluates ONLY cryptographically verified licenseState (from Ed25519 envelope).
 *    Never trusts req.body, query parameters, headers, or localStorage.
 * 2. Fail-Closed: Any unverified, degraded, mismatching, or unrecognized feature/edition fails closed.
 * 3. Strict Edition Hierarchy: Enforces seeded model: ui_dist (1) < full_source (2) < extended (3).
 * 4. Deterministic Feature Aliases: Maps common feature abbreviations canonically without inventing features.
 * 5. Safe Serialization: Never exposes private keys, signatures, peppers, or internal paths.
 */

'use strict';

/**
 * Expected product identifier for the Kiaan HRM commercial license.
 */
const CANONICAL_PRODUCT_ID = 'kiaan-hrm';

/**
 * Approved commercial editions seeded in the Central Authority.
 */
const EDITIONS = Object.freeze({
    UI_DIST: 'ui_dist',
    FULL_SOURCE: 'full_source',
    EXTENDED: 'extended'
});

/**
 * Strict edition hierarchy ranking.
 * Higher rank satisfies lower rank requirements.
 */
const EDITION_RANKS = Object.freeze({
    [EDITIONS.UI_DIST]: 1,
    [EDITIONS.FULL_SOURCE]: 2,
    [EDITIONS.EXTENDED]: 3
});

/**
 * Canonical feature identifiers approved in Central Authority edition seeds.
 */
const FEATURES = Object.freeze({
    EMPLOYEE_PORTAL: 'EMPLOYEE_PORTAL',
    ATTENDANCE_KIOSK_UI: 'ATTENDANCE_KIOSK_UI',
    BASIC_DASHBOARD: 'BASIC_DASHBOARD',
    ATTENDANCE: 'ATTENDANCE',
    PAYROLL: 'PAYROLL',
    LEAVES: 'LEAVES',
    GEO_FENCING: 'GEO_FENCING',
    FULL_BACKEND_API: 'FULL_BACKEND_API',
    OFFLINE_LICENSING: 'OFFLINE_LICENSING',
    MULTI_BRANCH: 'MULTI_BRANCH',
    BIOMETRIC_HARDWARE_SDK: 'BIOMETRIC_HARDWARE_SDK',
    AI_ANALYTICS_ENGINE: 'AI_ANALYTICS_ENGINE',
    WHITE_LABEL_BRANDING: 'WHITE_LABEL_BRANDING'
});

/**
 * Deterministic mapping layer for stable abbreviations and legacy aliases.
 * Unknown features map to themselves and will fail closed if not in the signed feature list.
 */
const FEATURE_ALIASES = Object.freeze({
    'BIOMETRIC_SDK': FEATURES.BIOMETRIC_HARDWARE_SDK,
    'BIOMETRICS': FEATURES.BIOMETRIC_HARDWARE_SDK,
    'AI_ANALYTICS': FEATURES.AI_ANALYTICS_ENGINE,
    'AI_CHATBOT': FEATURES.AI_ANALYTICS_ENGINE,
    'WHITE_LABEL': FEATURES.WHITE_LABEL_BRANDING,
    'GEOFENCING': FEATURES.GEO_FENCING,
    'BRANCHES': FEATURES.MULTI_BRANCH
});

/**
 * Standardized Entitlement Resolution Codes.
 */
const EntitlementCodes = Object.freeze({
    ENTITLED: 'ENTITLED',
    LICENSE_REQUIRED: 'LICENSE_REQUIRED',
    LICENSE_CORRUPTED: 'LICENSE_CORRUPTED',
    LICENSE_CONFLICT: 'LICENSE_CONFLICT',
    LICENSE_STORAGE_UNAVAILABLE: 'LICENSE_STORAGE_UNAVAILABLE',
    PRODUCT_MISMATCH: 'LICENSE_PRODUCT_MISMATCH',
    DOMAIN_MISMATCH: 'LICENSE_DOMAIN_MISMATCH',
    EDITION_INSUFFICIENT: 'LICENSE_EDITION_INSUFFICIENT',
    FEATURE_NOT_ENTITLED: 'LICENSE_FEATURE_NOT_ENTITLED',
    EMPLOYEE_LIMIT_EXCEEDED: 'LICENSE_EMPLOYEE_LIMIT_EXCEEDED'
});

/**
 * Normalizes a feature identifier string to its canonical uppercase representation.
 *
 * @param {string} rawFeature Feature name or alias
 * @returns {string} Normalized canonical feature name
 */
function normalizeFeature(rawFeature) {
    if (typeof rawFeature !== 'string') return '';
    const upper = rawFeature.trim().toUpperCase().replace(/[-\s]/g, '_');
    return FEATURE_ALIASES[upper] || upper;
}

/**
 * Normalizes an edition code string to lowercase.
 *
 * @param {string} rawEdition Edition identifier
 * @returns {string} Normalized edition code
 */
function normalizeEdition(rawEdition) {
    if (typeof rawEdition !== 'string') return '';
    return rawEdition.trim().toLowerCase();
}

/**
 * Extracts and normalizes the feature list from a trusted envelope payload.
 *
 * @param {object} payload Trusted envelope payload
 * @returns {Set<string>} Set of normalized canonical feature strings
 */
function extractFeatures(payload) {
    const featureSet = new Set();
    if (!payload || typeof payload !== 'object') {
        return featureSet;
    }

    const rawList = payload.features || payload.entitlements?.features || [];
    if (Array.isArray(rawList)) {
        for (const item of rawList) {
            const normalized = normalizeFeature(item);
            if (normalized) {
                featureSet.add(normalized);
            }
        }
    }

    return featureSet;
}

/**
 * Single Authoritative Entitlement Evaluation Layer.
 * Evaluates the trusted in-memory license state against requested feature, edition, or employee limit.
 *
 * @param {object} params Evaluation parameters
 * @param {object} params.licenseState Verified license state (from req.license or licenseCache)
 * @param {string} [params.requiredFeature] Optional feature identifier required for access
 * @param {string} [params.requiredEdition] Optional minimum edition code required for access
 * @param {number} [params.currentEmployeeCount] Optional current count of active non-terminated employees
 * @returns {object} Evaluation result { allowed: boolean, code: string, reason?: string, license?: object }
 */
function evaluateLicenseEntitlement({
    licenseState,
    requiredFeature,
    requiredEdition,
    currentEmployeeCount
} = {}) {
    // 1. Validate License State
    if (!licenseState || typeof licenseState !== 'object') {
        return {
            allowed: false,
            code: EntitlementCodes.LICENSE_REQUIRED,
            reason: 'No license state provided for entitlement evaluation.'
        };
    }

    if (licenseState.valid !== true || licenseState.status !== 'STATUS_HEALTHY') {
        let code = EntitlementCodes.LICENSE_REQUIRED;
        if (licenseState.status === 'STATUS_CORRUPTED') {
            code = EntitlementCodes.LICENSE_CORRUPTED;
        } else if (licenseState.status === 'STATUS_DEGRADED_CONFLICT') {
            code = EntitlementCodes.LICENSE_CONFLICT;
        } else if (licenseState.status === 'STATUS_STORAGE_UNAVAILABLE') {
            code = EntitlementCodes.LICENSE_STORAGE_UNAVAILABLE;
        } else if (licenseState.status === 'STATUS_DOMAIN_MISMATCH') {
            code = EntitlementCodes.DOMAIN_MISMATCH;
        } else if (licenseState.status === 'STATUS_PRODUCT_MISMATCH') {
            code = EntitlementCodes.PRODUCT_MISMATCH;
        }

        return {
            allowed: false,
            code,
            reason: licenseState.reason || 'Installed license is not active, healthy, or valid.'
        };
    }

    const payload = licenseState.payload;
    if (!payload || typeof payload !== 'object') {
        return {
            allowed: false,
            code: EntitlementCodes.LICENSE_REQUIRED,
            reason: 'Verified license state lacks a valid entitlement payload.'
        };
    }

    // 2. Validate Product Compatibility
    const productId = String(payload.product_id || '').toLowerCase();
    if (productId !== CANONICAL_PRODUCT_ID) {
        return {
            allowed: false,
            code: EntitlementCodes.PRODUCT_MISMATCH,
            reason: `License product mismatch: expected '${CANONICAL_PRODUCT_ID}', got '${payload.product_id}'.`
        };
    }

    // 3. Extract Authoritative Entitlement Metadata
    const editionCode = normalizeEdition(payload.edition_code || payload.entitlements?.edition_code);
    const entitlementsObj = payload.entitlements || {};
    const maxEmployees = Number(entitlementsObj.max_employees !== undefined ? entitlementsObj.max_employees : (payload.max_employees || 0));
    const grantedFeatures = extractFeatures(payload);

    // 4. Edition Enforcement
    if (requiredEdition !== undefined && requiredEdition !== null) {
        const normRequiredEdition = normalizeEdition(requiredEdition);
        const currentRank = EDITION_RANKS[editionCode] || 0;
        const requiredRank = EDITION_RANKS[normRequiredEdition] || 999;

        if (currentRank < requiredRank) {
            return {
                allowed: false,
                code: EntitlementCodes.EDITION_INSUFFICIENT,
                reason: `Feature requires '${normRequiredEdition}' edition or higher. Current installation edition is '${editionCode}'.`,
                currentEdition: editionCode,
                requiredEdition: normRequiredEdition
            };
        }
    }

    // 5. Feature Enforcement
    if (requiredFeature !== undefined && requiredFeature !== null) {
        const normRequiredFeature = normalizeFeature(requiredFeature);
        if (!normRequiredFeature || !grantedFeatures.has(normRequiredFeature)) {
            return {
                allowed: false,
                code: EntitlementCodes.FEATURE_NOT_ENTITLED,
                reason: `Feature '${requiredFeature}' is not included in the installed license entitlements.`,
                feature: requiredFeature,
                currentEdition: editionCode
            };
        }
    }

    // 6. Employee Limit Enforcement
    if (currentEmployeeCount !== undefined && currentEmployeeCount !== null) {
        const count = Number(currentEmployeeCount);
        if (maxEmployees > 0 && count >= maxEmployees) {
            return {
                allowed: false,
                code: EntitlementCodes.EMPLOYEE_LIMIT_EXCEEDED,
                reason: `Commercial license employee limit reached or exceeded. Licensed maximum: ${maxEmployees}, current count: ${count}.`,
                maxEmployees,
                currentEmployeeCount: count
            };
        }
    }

    // 7. Successful Entitlement Grant
    return {
        allowed: true,
        code: EntitlementCodes.ENTITLED,
        reason: 'Commercial license entitlement verified.',
        license: {
            productId: payload.product_id || CANONICAL_PRODUCT_ID,
            editionCode,
            maxEmployees,
            features: Array.from(grantedFeatures),
            sku: payload.sku || null,
            licensedDomain: payload.licensed_domain || null
        }
    };
}

module.exports = {
    CANONICAL_PRODUCT_ID,
    EDITIONS,
    EDITION_RANKS,
    FEATURES,
    FEATURE_ALIASES,
    EntitlementCodes,
    normalizeFeature,
    normalizeEdition,
    extractFeatures,
    evaluateLicenseEntitlement
};
