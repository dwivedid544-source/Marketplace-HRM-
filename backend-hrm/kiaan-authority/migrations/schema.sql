-- ==============================================================================
-- Kiaan Central License Authority — Universal Marketplace & Edition Schema
-- Module: backend-hrm/kiaan-authority/migrations/schema.sql
-- Architecture Blueprint: Phase 2B.8A.1 / Preflight: Phase 2B.8B.0
--
-- Tables:
-- 1. marketplace_products
-- 2. marketplace_editions
-- 3. marketplace_sales_channels
-- 4. marketplace_orders
-- 5. marketplace_licenses
-- 6. license_activations
-- 7. license_email_outbox
--
-- Safety Guarantees:
-- - Zero foreign keys to existing SaaS tenant tables (companies, users, subscriptions).
-- - Zero plaintext license keys stored (HMAC-SHA256 at rest).
-- - Idempotent re-runnable statements (CREATE TABLE IF NOT EXISTS).
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Product Registry
-- Defines the software product families governed by the licensing authority.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `marketplace_products` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `product_id` VARCHAR(50) NOT NULL UNIQUE,          -- Canonical ID: 'kiaan-hrm', 'kiaan-pos'
    `product_name` VARCHAR(150) NOT NULL,              -- Display Name: 'Kiaan HRM Pro'
    `signing_key_id` VARCHAR(100) NOT NULL DEFAULT 'kiaan-root-2026-v1',
    `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_prod_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 2. Commercial Editions & SKUs
-- Maps each product family to its three commercially purchasable editions.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `marketplace_editions` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `product_id` VARCHAR(50) NOT NULL,
    `edition_code` VARCHAR(50) NOT NULL,               -- 'ui_dist', 'full_source', 'extended'
    `sku` VARCHAR(60) NOT NULL UNIQUE,                 -- 'KHRM-DIST-LIFETIME', 'KHRM-SRC-LIFETIME'
    `edition_name` VARCHAR(150) NOT NULL,
    `has_backend_source` BOOLEAN NOT NULL DEFAULT TRUE,
    `has_extended_features` BOOLEAN NOT NULL DEFAULT FALSE,
    `default_entitlements` JSON NOT NULL,              -- { edition_code, max_employees, features }
    `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `unq_prod_edition` (`product_id`, `edition_code`),
    INDEX `idx_edition_sku` (`sku`),
    CONSTRAINT `fk_edition_product` FOREIGN KEY (`product_id`) 
        REFERENCES `marketplace_products` (`product_id`) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 3. Sales Channels Registry
-- Registry of approved sales channels, webhook secrets, and verification modes.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `marketplace_sales_channels` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `channel_id` VARCHAR(50) NOT NULL UNIQUE,          -- 'kiaan_direct', 'codecanyon', 'appsumo', 'manual_b2b'
    `channel_name` VARCHAR(100) NOT NULL,
    `is_automated` BOOLEAN NOT NULL DEFAULT TRUE,
    `webhook_secret_hash` VARCHAR(128) NULL,           -- Hashed webhook secret
    `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_channel_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 4. Channel Orders (Normalized Ingestion)
-- Ingests normalized orders from all channels. Enforces channel order idempotency.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `marketplace_orders` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `order_number` VARCHAR(60) NOT NULL UNIQUE,        -- Internal Kiaan Order Number: ORD-2026-XXXXX
    `sales_channel_id` VARCHAR(50) NOT NULL,
    `channel_order_id` VARCHAR(100) NOT NULL,          -- Gateway ID, Envato code, or B2B invoice #
    `buyer_name` VARCHAR(150) NOT NULL,
    `buyer_email` VARCHAR(150) NOT NULL,
    `buyer_phone` VARCHAR(30) NULL,
    `sku` VARCHAR(60) NOT NULL,
    `quantity` INT NOT NULL DEFAULT 1,
    `unit_price` DECIMAL(10,2) NOT NULL,
    `total_price` DECIMAL(10,2) NOT NULL,
    `currency` VARCHAR(10) NOT NULL DEFAULT 'INR',
    `payment_status` ENUM('PENDING', 'PAID', 'REFUNDED', 'DISPUTED') NOT NULL DEFAULT 'PAID',
    `payment_reference` VARCHAR(150) NOT NULL,         -- UTR / Gateway payment ID
    `raw_payload` JSON NULL,                           -- Original payload for audit
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `unq_channel_order` (`sales_channel_id`, `channel_order_id`),
    INDEX `idx_order_email` (`buyer_email`),
    INDEX `idx_order_status` (`payment_status`),
    CONSTRAINT `fk_order_channel` FOREIGN KEY (`sales_channel_id`) 
        REFERENCES `marketplace_sales_channels` (`channel_id`) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT `fk_order_sku` FOREIGN KEY (`sku`) 
        REFERENCES `marketplace_editions` (`sku`) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 5. Individual Software Licenses (Multi-Unit Units)
-- Tracks issued software units. Hashed key storage. Zero plaintext key persistence.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `marketplace_licenses` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `license_id` VARCHAR(60) NOT NULL UNIQUE,          -- e.g. LIC-2026-HRM-ABC123
    `order_id` BIGINT NOT NULL,
    `product_id` VARCHAR(50) NOT NULL,
    `edition_code` VARCHAR(50) NOT NULL,
    `sku` VARCHAR(60) NOT NULL,
    `license_key_hash` VARCHAR(64) NOT NULL UNIQUE,    -- HMAC-SHA256(key, CENTRAL_LICENSE_PEPPER)
    `key_hint` VARCHAR(25) NOT NULL,                   -- e.g. KHRM-7A39-...-92MF
    `status` ENUM('ISSUED', 'ACTIVATED', 'TRANSFER_PENDING', 'TRANSFERRED', 'REVOKED', 'EXPIRED') NOT NULL DEFAULT 'ISSUED',
    `bound_domain` VARCHAR(255) NULL,
    `sequence_number` INT NOT NULL DEFAULT 1,
    `buyer_name` VARCHAR(150) NOT NULL,
    `buyer_email` VARCHAR(150) NOT NULL,
    `entitlements` JSON NOT NULL,                      -- { edition, max_employees, features }
    `revocation_reason` VARCHAR(255) NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_lic_hash` (`license_key_hash`),
    INDEX `idx_lic_email` (`buyer_email`),
    INDEX `idx_lic_domain` (`bound_domain`),
    INDEX `idx_lic_status` (`status`),
    CONSTRAINT `fk_lic_order` FOREIGN KEY (`order_id`) 
        REFERENCES `marketplace_orders` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_lic_product` FOREIGN KEY (`product_id`) 
        REFERENCES `marketplace_products` (`product_id`) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT `fk_lic_sku` FOREIGN KEY (`sku`) 
        REFERENCES `marketplace_editions` (`sku`) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 6. Historical Envelope Activations
-- Append-only audit trail of signed Ed25519 envelopes issued for domain binding.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `license_activations` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `license_id` VARCHAR(60) NOT NULL,
    `activation_type` ENUM('ONLINE', 'PORTAL_OFFLINE') NOT NULL,
    `request_domain` VARCHAR(255) NOT NULL,
    `request_ip` VARCHAR(50) NULL,
    `sequence_number` INT NOT NULL,
    `issued_envelope` LONGTEXT NOT NULL,               -- Canonical RFC 8785 signed JSON envelope
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_act_lic` (`license_id`),
    INDEX `idx_act_domain` (`request_domain`),
    CONSTRAINT `fk_act_license` FOREIGN KEY (`license_id`) 
        REFERENCES `marketplace_licenses` (`license_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 7. Transactional Email Outbox Queue
-- Transactional outbox for guaranteed, idempotent Brevo email delivery.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `license_email_outbox` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `order_id` BIGINT NOT NULL,
    `license_id` VARCHAR(60) NOT NULL,
    `recipient_email` VARCHAR(150) NOT NULL,
    `recipient_name` VARCHAR(150) NOT NULL,
    `subject` VARCHAR(255) NOT NULL,
    `html_content` LONGTEXT NOT NULL,
    `status` ENUM('queued', 'processing', 'sent', 'failed') NOT NULL DEFAULT 'queued',
    `retry_count` INT NOT NULL DEFAULT 0,
    `last_error` TEXT NULL,
    `locked_at` DATETIME NULL,
    `sent_at` DATETIME NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_outbox_queue` (`status`, `retry_count`, `locked_at`),
    CONSTRAINT `fk_outbox_order` FOREIGN KEY (`order_id`) 
        REFERENCES `marketplace_orders` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_outbox_license` FOREIGN KEY (`license_id`) 
        REFERENCES `marketplace_licenses` (`license_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- INITIAL SEED DATA (Idempotent: ON DUPLICATE KEY UPDATE)
-- ==============================================================================

-- 1. Seed Product: Kiaan HRM Pro
INSERT INTO `marketplace_products` (`product_id`, `product_name`, `signing_key_id`, `is_active`)
VALUES ('kiaan-hrm', 'Kiaan HRM Pro', 'kiaan-root-2026-v1', TRUE)
ON DUPLICATE KEY UPDATE `product_name` = VALUES(`product_name`), `is_active` = VALUES(`is_active`);

-- 2. Seed Editions: UI/Dist, Full Source, Extended
INSERT INTO `marketplace_editions` (`product_id`, `edition_code`, `sku`, `edition_name`, `has_backend_source`, `has_extended_features`, `default_entitlements`, `is_active`)
VALUES 
('kiaan-hrm', 'ui_dist', 'KHRM-DIST-LIFETIME', 'Kiaan HRM Pro — UI / Dist Edition', FALSE, FALSE, JSON_OBJECT(
    'edition_code', 'ui_dist',
    'has_backend_source', FALSE,
    'has_extended_features', FALSE,
    'max_employees', 50,
    'features', JSON_ARRAY('EMPLOYEE_PORTAL', 'ATTENDANCE_KIOSK_UI', 'BASIC_DASHBOARD'),
    'support_tier', 'COMMUNITY'
), TRUE),
('kiaan-hrm', 'full_source', 'KHRM-SRC-LIFETIME', 'Kiaan HRM Pro — Full Source Code Edition', TRUE, FALSE, JSON_OBJECT(
    'edition_code', 'full_source',
    'has_backend_source', TRUE,
    'has_extended_features', FALSE,
    'max_employees', 1000,
    'features', JSON_ARRAY('ATTENDANCE', 'PAYROLL', 'LEAVES', 'GEO_FENCING', 'FULL_BACKEND_API', 'OFFLINE_LICENSING'),
    'support_tier', 'STANDARD_1YR'
), TRUE),
('kiaan-hrm', 'extended', 'KHRM-EXT-LIFETIME', 'Kiaan HRM Pro — Extended Edition', TRUE, TRUE, JSON_OBJECT(
    'edition_code', 'extended',
    'has_backend_source', TRUE,
    'has_extended_features', TRUE,
    'max_employees', 10000,
    'features', JSON_ARRAY('ATTENDANCE', 'PAYROLL', 'LEAVES', 'GEO_FENCING', 'FULL_BACKEND_API', 'OFFLINE_LICENSING', 'MULTI_BRANCH', 'BIOMETRIC_HARDWARE_SDK', 'AI_ANALYTICS_ENGINE', 'WHITE_LABEL_BRANDING'),
    'support_tier', 'PRIORITY_LIFETIME'
), TRUE)
ON DUPLICATE KEY UPDATE 
    `edition_name` = VALUES(`edition_name`),
    `has_backend_source` = VALUES(`has_backend_source`),
    `has_extended_features` = VALUES(`has_extended_features`),
    `default_entitlements` = VALUES(`default_entitlements`),
    `is_active` = VALUES(`is_active`);

-- 3. Seed Sales Channels: Direct, Envato/CodeCanyon, AppSumo, Manual B2B
INSERT INTO `marketplace_sales_channels` (`channel_id`, `channel_name`, `is_automated`, `is_active`)
VALUES 
('kiaan_direct', 'Kiaan Direct Storefront (Razorpay/Stripe)', TRUE, TRUE),
('codecanyon', 'Envato / CodeCanyon Marketplace', TRUE, TRUE),
('appsumo', 'AppSumo / Deal Platforms', TRUE, TRUE),
('manual_b2b', 'Direct B2B & Verified Corporate Orders', FALSE, TRUE)
ON DUPLICATE KEY UPDATE 
    `channel_name` = VALUES(`channel_name`),
    `is_automated` = VALUES(`is_automated`),
    `is_active` = VALUES(`is_active`);
