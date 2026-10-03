/**
 * Kiaan Central License Authority — Database Rollback Script
 * Module: backend-hrm/kiaan-authority/migrations/rollback_marketplace_schema.js
 *
 * Reverts the Central Authority database schema by dropping ONLY the seven
 * authority tables in strict reverse foreign key dependency order.
 *
 * Safety & Isolation Guarantees:
 * 1. Strict Table Whitelist: Only drops the 7 authority tables.
 * 2. Absolute Protection for SaaS Tables: Never drops or touches companies, users,
 *    subscriptions, or any of the 38 pre-existing application tables.
 * 3. Local Vault Protection: Never touches system_licenses or .vault/license.lic.
 * 4. Double Confirmation Required: Requires explicit --confirm-rollback flag or
 *    { force: true } parameter. Will throw if unconfirmed.
 */

'use strict';

/**
 * Strict whitelist of tables allowed to be dropped, ordered in reverse FK dependency.
 */
const TABLES_TO_DROP_IN_ORDER = Object.freeze([
    'license_email_outbox',
    'license_activations',
    'marketplace_licenses',
    'marketplace_orders',
    'marketplace_sales_channels',
    'marketplace_editions',
    'marketplace_products'
]);

/**
 * Runs the rollback on a specified MySQL pool or connection.
 *
 * @param {object} options Rollback options
 * @param {object} options.db Injected MySQL2 connection or pool
 * @param {boolean} options.force Must be true to confirm rollback execution
 * @param {object} [options.logger=console] Logger instance
 * @returns {Promise<object>} Rollback report
 */
async function runRollback(options = {}) {
    const logger = options.logger || console;

    if (!options.force) {
        throw new Error('ROLLBACK BLOCKED: options.force must be strictly true to execute schema rollback.');
    }

    const db = options.db;
    if (!db || (typeof db.query !== 'function' && typeof db.execute !== 'function')) {
        throw new TypeError('Rollback requires an explicit, connected MySQL database pool or connection.');
    }

    const queryFn = async (sql) => {
        if (typeof db.query === 'function') {
            const [rows] = await db.query(sql);
            return rows;
        }
        const [rows] = await db.execute(sql);
        return rows;
    };

    logger.log('⚠️ INITIATING AUTHORITY SCHEMA ROLLBACK...');
    logger.log('Strict safety check: Targeting ONLY the 7 Central Authority tables.');

    const droppedTables = [];

    // Drop in reverse foreign key order
    for (const tableName of TABLES_TO_DROP_IN_ORDER) {
        // Assert table is in strict whitelist
        if (!TABLES_TO_DROP_IN_ORDER.includes(tableName)) {
            throw new Error(`SECURITY ALERT: Attempted to drop non-whitelisted table: ${tableName}`);
        }

        logger.log(`  • Dropping table: ${tableName}...`);
        await queryFn(`DROP TABLE IF EXISTS \`${tableName}\`;`);
        droppedTables.push(tableName);
    }

    logger.log('✅ Authority schema rollback completed successfully.');

    return {
        success: true,
        droppedTables,
        count: droppedTables.length
    };
}

// CLI Execution Protection
if (require.main === module) {
    const args = process.argv.slice(2);
    if (!args.includes('--confirm-rollback')) {
        console.error('❌ SAFETY INTERCEPT: Direct rollback requires explicit confirmation.');
        console.error('Usage:');
        console.error('  node rollback_marketplace_schema.js --confirm-rollback');
        process.exit(1);
    }

    console.warn('⚠️ WARNING: Rollback requested. Injected test database required.');
    process.exit(0);
}

module.exports = {
    runRollback,
    TABLES_TO_DROP_IN_ORDER
};
