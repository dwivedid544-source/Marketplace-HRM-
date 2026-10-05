/**
 * Kiaan Central License Authority — Canonical SKU & Edition Resolver
 * Module: backend-hrm/kiaan-authority/adapters/skuResolver.js
 *
 * Implements a deterministic catalog boundary defining authoritative product IDs,
 * commercial editions, and SKU identifiers matching the central authority database schema.
 *
 * Security & Architectural Guarantees:
 * 1. Authoritative Catalog Boundary: Centralizes all canonical product, edition, and SKU mappings.
 * 2. Deterministic Mapping: Rejects unknown or ambiguous identifiers with explicit errors.
 * 3. Schema Alignment: Strictly mirrors seeded values in `marketplace_products` and `marketplace_editions`.
 * 4. Immutability: Deeply freezes definitions to prevent runtime tampering.
 */

'use strict';

/**
 * Authoritative Central Authority Product Identifier.
 */
const CANONICAL_PRODUCT_ID = 'kiaan-hrm';

/**
 * Authoritative Commercial Editions and SKU Mappings.
 * Aligns strictly with schema.sql seeded rows.
 */
const CANONICAL_EDITIONS = Object.freeze({
    ui_dist: Object.freeze({
        editionCode: 'ui_dist',
        sku: 'KHRM-DIST-LIFETIME',
        editionName: 'Kiaan HRM Pro — UI / Dist Edition',
        maxEmployees: 50,
        hasBackendSource: false,
        hasExtendedFeatures: false,
        defaultSupportTier: 'COMMUNITY'
    }),
    full_source: Object.freeze({
        editionCode: 'full_source',
        sku: 'KHRM-SRC-LIFETIME',
        editionName: 'Kiaan HRM Pro — Full Source Code Edition',
        maxEmployees: 1000,
        hasBackendSource: true,
        hasExtendedFeatures: false,
        defaultSupportTier: 'STANDARD_1YR'
    }),
    extended: Object.freeze({
        editionCode: 'extended',
        sku: 'KHRM-EXT-LIFETIME',
        editionName: 'Kiaan HRM Pro — Extended Edition',
        maxEmployees: 10000,
        hasBackendSource: true,
        hasExtendedFeatures: true,
        defaultSupportTier: 'PRIORITY_LIFETIME'
    })
});

/**
 * Authoritative reverse mapping from SKU to Edition Code.
 */
const SKU_TO_EDITION = Object.freeze({
    'KHRM-DIST-LIFETIME': 'ui_dist',
    'KHRM-SRC-LIFETIME': 'full_source',
    'KHRM-EXT-LIFETIME': 'extended'
});

/**
 * Creates an error instance with an explicit adapter error code.
 *
 * @param {string} code Error identifier
 * @param {string} message Descriptive failure message
 * @returns {Error}
 */
function createResolverError(code, message) {
    const err = new Error(`${code}: ${message}`);
    err.code = code;
    return err;
}

/**
 * Deterministic SKU & Edition Resolver.
 */
class SkuResolver {
    /**
     * Instantiates a SkuResolver with optional custom catalog definitions.
     *
     * @param {object} [options] Custom configuration options
     */
    constructor(options = {}) {
        this.productId = (options.productId || CANONICAL_PRODUCT_ID).toLowerCase().trim();
        this.editions = options.editions || CANONICAL_EDITIONS;
        this.skuMap = options.skuMap || SKU_TO_EDITION;
    }

    /**
     * Checks if a given product ID matches the canonical product.
     *
     * @param {string} productId Product identifier
     * @returns {boolean}
     */
    isValidProduct(productId) {
        if (typeof productId !== 'string') return false;
        return productId.trim().toLowerCase() === this.productId;
    }

    /**
     * Checks if an edition code exists in the catalog.
     *
     * @param {string} editionCode Edition code (e.g. 'full_source')
     * @returns {boolean}
     */
    isValidEdition(editionCode) {
        if (typeof editionCode !== 'string') return false;
        const normalized = editionCode.trim().toLowerCase();
        return Boolean(this.editions[normalized]);
    }

    /**
     * Checks if a SKU exists in the catalog.
     *
     * @param {string} sku SKU identifier (e.g. 'KHRM-SRC-LIFETIME')
     * @returns {boolean}
     */
    isValidSku(sku) {
        if (typeof sku !== 'string') return false;
        const normalized = sku.trim().toUpperCase();
        return Boolean(this.skuMap[normalized]);
    }

    /**
     * Resolves canonical product ID, edition code, and SKU from input parameters.
     * If neither SKU nor editionCode is valid, or if they contradict each other, throws.
     *
     * @param {object} params Lookup parameters
     * @param {string} [params.productId] Optional requested product ID
     * @param {string} [params.editionCode] Optional requested edition code
     * @param {string} [params.sku] Optional requested SKU
     * @returns {{ productId: string, editionCode: string, sku: string, editionName: string }}
     */
    resolveEditionAndSku({ productId, editionCode, sku } = {}) {
        // 1. Product Validation
        const resolvedProduct = productId ? String(productId).trim().toLowerCase() : this.productId;
        if (resolvedProduct !== this.productId) {
            throw createResolverError(
                'UNSUPPORTED_PRODUCT',
                `Product '${productId}' is not supported by this authority. Expected '${this.productId}'.`
            );
        }

        // 2. Resolve via SKU if provided
        if (typeof sku === 'string' && sku.trim()) {
            const normalizedSku = sku.trim().toUpperCase();
            const mappedEditionCode = this.skuMap[normalizedSku];
            if (!mappedEditionCode) {
                throw createResolverError(
                    'UNKNOWN_SKU',
                    `Commercial SKU '${sku}' does not exist in product registry.`
                );
            }

            // Cross-check if editionCode was also provided
            if (typeof editionCode === 'string' && editionCode.trim()) {
                const normalizedEdition = editionCode.trim().toLowerCase();
                if (normalizedEdition !== mappedEditionCode) {
                    throw createResolverError(
                        'SKU_MISMATCH',
                        `SKU '${normalizedSku}' maps to edition '${mappedEditionCode}', but '${editionCode}' was requested.`
                    );
                }
            }

            const edition = this.editions[mappedEditionCode];
            return {
                productId: this.productId,
                editionCode: mappedEditionCode,
                sku: normalizedSku,
                editionName: edition.editionName
            };
        }

        // 3. Resolve via Edition Code if provided
        if (typeof editionCode === 'string' && editionCode.trim()) {
            const normalizedEdition = editionCode.trim().toLowerCase();
            const edition = this.editions[normalizedEdition];
            if (!edition) {
                throw createResolverError(
                    'UNSUPPORTED_EDITION',
                    `Commercial edition code '${editionCode}' is not supported.`
                );
            }

            return {
                productId: this.productId,
                editionCode: normalizedEdition,
                sku: edition.sku,
                editionName: edition.editionName
            };
        }

        throw createResolverError(
            'UNSUPPORTED_EDITION',
            'Neither a valid SKU nor an edition code was provided to resolve the product edition.'
        );
    }
}

const defaultSkuResolver = new SkuResolver();

module.exports = {
    CANONICAL_PRODUCT_ID,
    CANONICAL_EDITIONS,
    SKU_TO_EDITION,
    SkuResolver,
    defaultSkuResolver
};
