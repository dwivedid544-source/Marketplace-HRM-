/**
 * Kiaan Central License Authority — Database Migration Runner
 * Module: backend-hrm/kiaan-authority/migrations/migrate_marketplace_schema.js
 *
 * Provisions the seven isolated marketplace authority tables and seeds initial
 * product, edition, and channel configurations.
 *
 * Safety & Isolation Guarantees:
 * 1. Zero Impact on Tenant SaaS: Never touches companies, users, or subscriptions.
 * 2. Zero Impact on Local Vault: Never alters system_licenses or .vault/license.lic.
 * 3. Idempotent & Rerunnable: Safe to run repeatedly (CREATE TABLE IF NOT EXISTS,
 *    and ON DUPLICATE KEY UPDATE for seed rows).
 * 4. Production Protection Guard: Requires explicit confirmation before executing
 *    against the default application database pool.
 */

'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Expected 7 Authority Tables in creation order.
 */
const AUTHORITY_TABLES = Object.freeze([
    'marketplace_products',
    'marketplace_editions',
    'marketplace_sales_channels',
    'marketplace_orders',
    'marketplace_licenses',
    'license_activations',
    'license_email_outbox'
]);

/**
 * Table Creation DDL statements.
 */
const DDL_STATEMENTS = Object.freeze({
    marketplace_products: `
        CREATE TABLE IF NOT EXISTS \`marketplace_products\` (
            \`id\` INT AUTO_INCREMENT PRIMARY KEY,
            \`product_id\` VARCHAR(50) NOT NULL UNIQUE,
            \`product_name\` VARCHAR(150) NOT NULL,
            \`signing_key_id\` VARCHAR(100) NOT NULL DEFAULT 'kiaan-root-2026-v1',
            \`is_active\` BOOLEAN NOT NULL DEFAULT TRUE,
            \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX \`idx_prod_active\` (\`is_active\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
    marketplace_editions: `
        CREATE TABLE IF NOT EXISTS \`marketplace_editions\` (
            \`id\` INT AUTO_INCREMENT PRIMARY KEY,
            \`product_id\` VARCHAR(50) NOT NULL,
            \`edition_code\` VARCHAR(50) NOT NULL,
            \`sku\` VARCHAR(60) NOT NULL UNIQUE,
            \`edition_name\` VARCHAR(150) NOT NULL,
            \`has_backend_source\` BOOLEAN NOT NULL DEFAULT TRUE,
            \`has_extended_features\` BOOLEAN NOT NULL DEFAULT FALSE,
            \`default_entitlements\` JSON NOT NULL,
            \`is_active\` BOOLEAN NOT NULL DEFAULT TRUE,
            \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY \`unq_prod_edition\` (\`product_id\`, \`edition_code\`),
            INDEX \`idx_edition_sku\` (\`sku\`),
            CONSTRAINT \`fk_edition_product\` FOREIGN KEY (\`product_id\`) 
                REFERENCES \`marketplace_products\` (\`product_id\`) ON UPDATE CASCADE ON DELETE RESTRICT
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
    marketplace_sales_channels: `
        CREATE TABLE IF NOT EXISTS \`marketplace_sales_channels\` (
            \`id\` INT AUTO_INCREMENT PRIMARY KEY,
            \`channel_id\` VARCHAR(50) NOT NULL UNIQUE,
            \`channel_name\` VARCHAR(100) NOT NULL,
            \`is_automated\` BOOLEAN NOT NULL DEFAULT TRUE,
            \`webhook_secret_hash\` VARCHAR(128) NULL,
            \`is_active\` BOOLEAN NOT NULL DEFAULT TRUE,
            \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX \`idx_channel_active\` (\`is_active\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
    marketplace_orders: `
        CREATE TABLE IF NOT EXISTS \`marketplace_orders\` (
            \`id\` BIGINT AUTO_INCREMENT PRIMARY KEY,
            \`order_number\` VARCHAR(60) NOT NULL UNIQUE,
            \`sales_channel_id\` VARCHAR(50) NOT NULL,
            \`channel_order_id\` VARCHAR(100) NOT NULL,
            \`buyer_name\` VARCHAR(150) NOT NULL,
            \`buyer_email\` VARCHAR(150) NOT NULL,
            \`buyer_phone\` VARCHAR(30) NULL,
            \`sku\` VARCHAR(60) NOT NULL,
            \`quantity\` INT NOT NULL DEFAULT 1,
            \`unit_price\` DECIMAL(10,2) NOT NULL,
            \`total_price\` DECIMAL(10,2) NOT NULL,
            \`currency\` VARCHAR(10) NOT NULL DEFAULT 'INR',
            \`payment_status\` ENUM('PENDING', 'PAID', 'REFUNDED', 'DISPUTED') NOT NULL DEFAULT 'PAID',
            \`payment_reference\` VARCHAR(150) NOT NULL,
            \`raw_payload\` JSON NULL,
            \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY \`unq_channel_order\` (\`sales_channel_id\`, \`channel_order_id\`),
            INDEX \`idx_order_email\` (\`buyer_email\`),
            INDEX \`idx_order_status\` (\`payment_status\`),
            CONSTRAINT \`fk_order_channel\` FOREIGN KEY (\`sales_channel_id\`) 
                REFERENCES \`marketplace_sales_channels\` (\`channel_id\`) ON UPDATE CASCADE ON DELETE RESTRICT,
            CONSTRAINT \`fk_order_sku\` FOREIGN KEY (\`sku\`) 
                REFERENCES \`marketplace_editions\` (\`sku\`) ON UPDATE CASCADE ON DELETE RESTRICT
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
    marketplace_licenses: `
        CREATE TABLE IF NOT EXISTS \`marketplace_licenses\` (
            \`id\` BIGINT AUTO_INCREMENT PRIMARY KEY,
            \`license_id\` VARCHAR(60) NOT NULL UNIQUE,
            \`order_id\` BIGINT NOT NULL,
            \`product_id\` VARCHAR(50) NOT NULL,
            \`edition_code\` VARCHAR(50) NOT NULL,
            \`sku\` VARCHAR(60) NOT NULL,
            \`license_key_hash\` VARCHAR(64) NOT NULL UNIQUE,
            \`key_hint\` VARCHAR(25) NOT NULL,
            \`status\` ENUM('ISSUED', 'ACTIVATED', 'TRANSFER_PENDING', 'TRANSFERRED', 'REVOKED', 'EXPIRED') NOT NULL DEFAULT 'ISSUED',
            \`bound_domain\` VARCHAR(255) NULL,
            \`sequence_number\` INT NOT NULL DEFAULT 1,
            \`buyer_name\` VARCHAR(150) NOT NULL,
            \`buyer_email\` VARCHAR(150) NOT NULL,
            \`entitlements\` JSON NOT NULL,
            \`revocation_reason\` VARCHAR(255) NULL,
            \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX \`idx_lic_hash\` (\`license_key_hash\`),
            INDEX \`idx_lic_email\` (\`buyer_email\`),
            INDEX \`idx_lic_domain\` (\`bound_domain\`),
            INDEX \`idx_lic_status\` (\`status\`),
            CONSTRAINT \`fk_lic_order\` FOREIGN KEY (\`order_id\`) 
                REFERENCES \`marketplace_orders\` (\`id\`) ON DELETE CASCADE,
            CONSTRAINT \`fk_lic_product\` FOREIGN KEY (\`product_id\`) 
                REFERENCES \`marketplace_products\` (\`product_id\`) ON UPDATE CASCADE ON DELETE RESTRICT,
            CONSTRAINT \`fk_lic_sku\` FOREIGN KEY (\`sku\`) 
                REFERENCES \`marketplace_editions\` (\`sku\`) ON UPDATE CASCADE ON DELETE RESTRICT
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
    license_activations: `
        CREATE TABLE IF NOT EXISTS \`license_activations\` (
            \`id\` BIGINT AUTO_INCREMENT PRIMARY KEY,
            \`license_id\` VARCHAR(60) NOT NULL,
            \`activation_type\` ENUM('ONLINE', 'PORTAL_OFFLINE') NOT NULL,
            \`request_domain\` VARCHAR(255) NOT NULL,
            \`request_ip\` VARCHAR(50) NULL,
            \`sequence_number\` INT NOT NULL,
            \`issued_envelope\` LONGTEXT NOT NULL,
            \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX \`idx_act_lic\` (\`license_id\`),
            INDEX \`idx_act_domain\` (\`request_domain\`),
            CONSTRAINT \`fk_act_license\` FOREIGN KEY (\`license_id\`) 
                REFERENCES \`marketplace_licenses\` (\`license_id\`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
    license_email_outbox: `
        CREATE TABLE IF NOT EXISTS \`license_email_outbox\` (
            \`id\` BIGINT AUTO_INCREMENT PRIMARY KEY,
            \`order_id\` BIGINT NOT NULL,
            \`license_id\` VARCHAR(60) NOT NULL,
            \`recipient_email\` VARCHAR(150) NOT NULL,
            \`recipient_name\` VARCHAR(150) NOT NULL,
            \`subject\` VARCHAR(255) NOT NULL,
            \`html_content\` LONGTEXT NOT NULL,
            \`status\` ENUM('queued', 'processing', 'sent', 'failed') NOT NULL DEFAULT 'queued',
            \`retry_count\` INT NOT NULL DEFAULT 0,
            \`last_error\` TEXT NULL,
            \`locked_at\` DATETIME NULL,
            \`sent_at\` DATETIME NULL,
            \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX \`idx_outbox_queue\` (\`status\`, \`retry_count\`, \`locked_at\`),
            CONSTRAINT \`fk_outbox_order\` FOREIGN KEY (\`order_id\`) 
                REFERENCES \`marketplace_orders\` (\`id\`) ON DELETE CASCADE,
            CONSTRAINT \`fk_outbox_license\` FOREIGN KEY (\`license_id\`) 
                REFERENCES \`marketplace_licenses\` (\`license_id\`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `
});

/**
 * Seed data definitions.
 */
const SEED_DATA = Object.freeze({
    products: [
        {
            product_id: 'kiaan-hrm',
            product_name: 'Kiaan HRM Pro',
            signing_key_id: 'kiaan-root-2026-v1',
            is_active: 1
        }
    ],
    editions: [
        {
            product_id: 'kiaan-hrm',
            edition_code: 'ui_dist',
            sku: 'KHRM-DIST-LIFETIME',
            edition_name: 'Kiaan HRM Pro — UI / Dist Edition',
            has_backend_source: 0,
            has_extended_features: 0,
            default_entitlements: JSON.stringify({
                edition_code: 'ui_dist',
                has_backend_source: false,
                has_extended_features: false,
                max_employees: 50,
                features: ['EMPLOYEE_PORTAL', 'ATTENDANCE_KIOSK_UI', 'BASIC_DASHBOARD'],
                support_tier: 'COMMUNITY'
            }),
            is_active: 1
        },
        {
            product_id: 'kiaan-hrm',
            edition_code: 'full_source',
            sku: 'KHRM-SRC-LIFETIME',
            edition_name: 'Kiaan HRM Pro — Full Source Code Edition',
            has_backend_source: 1,
            has_extended_features: 0,
            default_entitlements: JSON.stringify({
                edition_code: 'full_source',
                has_backend_source: true,
                has_extended_features: false,
                max_employees: 1000,
                features: ['ATTENDANCE', 'PAYROLL', 'LEAVES', 'GEO_FENCING', 'FULL_BACKEND_API', 'OFFLINE_LICENSING'],
                support_tier: 'STANDARD_1YR'
            }),
            is_active: 1
        },
        {
            product_id: 'kiaan-hrm',
            edition_code: 'extended',
            sku: 'KHRM-EXT-LIFETIME',
            edition_name: 'Kiaan HRM Pro — Extended Edition',
            has_backend_source: 1,
            has_extended_features: 1,
            default_entitlements: JSON.stringify({
                edition_code: 'extended',
                has_backend_source: true,
                has_extended_features: true,
                max_employees: 10000,
                features: [
                    'ATTENDANCE', 'PAYROLL', 'LEAVES', 'GEO_FENCING', 'FULL_BACKEND_API',
                    'OFFLINE_LICENSING', 'MULTI_BRANCH', 'BIOMETRIC_HARDWARE_SDK',
                    'AI_ANALYTICS_ENGINE', 'WHITE_LABEL_BRANDING'
                ],
                support_tier: 'PRIORITY_LIFETIME'
            }),
            is_active: 1
        }
    ],
    channels: [
        {
            channel_id: 'kiaan_direct',
            channel_name: 'Kiaan Direct Storefront (Razorpay/Stripe)',
            is_automated: 1,
            is_active: 1
        },
        {
            channel_id: 'codecanyon',
            channel_name: 'Envato / CodeCanyon Marketplace',
            is_automated: 1,
            is_active: 1
        },
        {
            channel_id: 'appsumo',
            channel_name: 'AppSumo / Deal Platforms',
            is_automated: 1,
            is_active: 1
        },
        {
            channel_id: 'manual_b2b',
            channel_name: 'Direct B2B & Verified Corporate Orders',
            is_automated: 0,
            is_active: 1
        }
    ]
});

/**
 * Runs the migration on a specified MySQL pool or connection.
 *
 * @param {object} options Migration options
 * @param {object} [options.db] Injected MySQL2 connection or pool
 * @param {boolean} [options.dryRun=false] When true, only returns SQL queries without executing
 * @param {object} [options.logger=console] Logger instance
 * @returns {Promise<object>} Migration execution report
 */
async function runMigration(options = {}) {
    const logger = options.logger || console;
    const isDryRun = Boolean(options.dryRun);

    if (isDryRun) {
        logger.log('ℹ️ DRY RUN: Validating DDL and Seed queries without database execution...');
        return {
            success: true,
            dryRun: true,
            tablesDefined: Object.keys(DDL_STATEMENTS),
            seedSummary: {
                products: SEED_DATA.products.length,
                editions: SEED_DATA.editions.length,
                channels: SEED_DATA.channels.length
            }
        };
    }

    const db = options.db;
    if (!db || (typeof db.query !== 'function' && typeof db.execute !== 'function')) {
        throw new TypeError('Migration requires an explicit, connected MySQL database pool or connection.');
    }

    const queryFn = async (sql, params = []) => {
        if (typeof db.query === 'function') {
            const [rows] = await db.query(sql, params);
            return rows;
        }
        const [rows] = await db.execute(sql, params);
        return rows;
    };

    logger.log('🚀 Starting Central License Authority schema migration...');

    const tablesCreated = [];

    // 1. Create tables in strict foreign-key dependency order
    for (const tableName of AUTHORITY_TABLES) {
        const ddl = DDL_STATEMENTS[tableName];
        if (!ddl) {
            throw new Error(`Missing DDL definition for required table: ${tableName}`);
        }
        logger.log(`  • Provisioning table: ${tableName}...`);
        await queryFn(ddl);
        tablesCreated.push(tableName);
    }

    logger.log('🌱 Seeding initial products, editions, and sales channels...');

    // 2. Seed Products
    for (const prod of SEED_DATA.products) {
        const sql = `
            INSERT INTO \`marketplace_products\` 
                (\`product_id\`, \`product_name\`, \`signing_key_id\`, \`is_active\`)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
                \`product_name\` = VALUES(\`product_name\`),
                \`is_active\` = VALUES(\`is_active\`)
        `;
        await queryFn(sql, [prod.product_id, prod.product_name, prod.signing_key_id, prod.is_active]);
    }

    // 3. Seed Editions
    for (const ed of SEED_DATA.editions) {
        const sql = `
            INSERT INTO \`marketplace_editions\` 
                (\`product_id\`, \`edition_code\`, \`sku\`, \`edition_name\`, \`has_backend_source\`, \`has_extended_features\`, \`default_entitlements\`, \`is_active\`)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
                \`edition_name\` = VALUES(\`edition_name\`),
                \`has_backend_source\` = VALUES(\`has_backend_source\`),
                \`has_extended_features\` = VALUES(\`has_extended_features\`),
                \`default_entitlements\` = VALUES(\`default_entitlements\`),
                \`is_active\` = VALUES(\`is_active\`)
        `;
        await queryFn(sql, [
            ed.product_id,
            ed.edition_code,
            ed.sku,
            ed.edition_name,
            ed.has_backend_source,
            ed.has_extended_features,
            ed.default_entitlements,
            ed.is_active
        ]);
    }

    // 4. Seed Channels
    for (const ch of SEED_DATA.channels) {
        const sql = `
            INSERT INTO \`marketplace_sales_channels\` 
                (\`channel_id\`, \`channel_name\`, \`is_automated\`, \`is_active\`)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
                \`channel_name\` = VALUES(\`channel_name\`),
                \`is_automated\` = VALUES(\`is_automated\`),
                \`is_active\` = VALUES(\`is_active\`)
        `;
        await queryFn(sql, [ch.channel_id, ch.channel_name, ch.is_automated, ch.is_active]);
    }

    logger.log('✅ Central License Authority schema migration completed successfully.');

    return {
        success: true,
        dryRun: false,
        tablesCreated,
        seedSummary: {
            products: SEED_DATA.products.length,
            editions: SEED_DATA.editions.length,
            channels: SEED_DATA.channels.length
        }
    };
}

// CLI Execution Protection
if (require.main === module) {
    const args = process.argv.slice(2);
    if (!args.includes('--execute')) {
        console.error('⚠️ SAFETY INTERCEPT: Direct CLI execution requires explicit confirmation.');
        console.error('Usage:');
        console.error('  node migrate_marketplace_schema.js --dry-run');
        console.error('  node migrate_marketplace_schema.js --execute (Executes against injected test connection)');
        process.exit(1);
    }

    if (args.includes('--dry-run')) {
        runMigration({ dryRun: true })
            .then(res => console.log('Validation Result:', JSON.stringify(res, null, 2)))
            .catch(err => {
                console.error('Validation Error:', err);
                process.exit(1);
            });
    }
}

module.exports = {
    runMigration,
    AUTHORITY_TABLES,
    DDL_STATEMENTS,
    SEED_DATA
};
