require('dotenv').config();
const db = require('./config/db');

async function migrate() {
    try {
        console.log('🚀 Running WhatsApp Database Migration...');

        // 1. Create company_whatsapp_settings table
        await db.execute(`
            CREATE TABLE IF NOT EXISTS company_whatsapp_settings (
                id INT AUTO_INCREMENT PRIMARY KEY,
                company_id BIGINT NOT NULL UNIQUE,
                phone_number VARCHAR(50) DEFAULT NULL,
                status ENUM('DISCONNECTED', 'CONNECTING', 'QR_READY', 'AUTHENTICATING', 'CONNECTED', 'ERROR') DEFAULT 'DISCONNECTED',
                qr_code LONGTEXT DEFAULT NULL,
                connected_at DATETIME DEFAULT NULL,
                last_seen_at DATETIME DEFAULT NULL,
                last_error TEXT DEFAULT NULL,
                notify_attendance TINYINT(1) DEFAULT 1,
                notify_leaves TINYINT(1) DEFAULT 1,
                notify_claims TINYINT(1) DEFAULT 1,
                notify_payroll TINYINT(1) DEFAULT 1,
                notify_admin_alerts TINYINT(1) DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_whatsapp_company (company_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ Table company_whatsapp_settings created / verified.');

        // 2. Create whatsapp_logs table
        await db.execute(`
            CREATE TABLE IF NOT EXISTS whatsapp_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                company_id BIGINT NOT NULL,
                recipient_phone VARCHAR(50) NOT NULL,
                recipient_name VARCHAR(150) DEFAULT NULL,
                recipient_role VARCHAR(50) DEFAULT 'employee',
                event_type VARCHAR(100) NOT NULL,
                message TEXT NOT NULL,
                status ENUM('QUEUED', 'SENDING', 'SENT', 'FAILED', 'SKIPPED') DEFAULT 'QUEUED',
                provider_message_id VARCHAR(255) DEFAULT NULL,
                error_message TEXT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_wlog_company (company_id),
                INDEX idx_wlog_created (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ Table whatsapp_logs created / verified.');

        console.log('🎉 WhatsApp Database Migration completed successfully!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    }
}

migrate();
