const db = require('../config/db');

async function init() {
    try {
        await db.execute(`
            CREATE TABLE IF NOT EXISTS broadcast_messages (
                id INT AUTO_INCREMENT PRIMARY KEY,
                company_id INT NOT NULL,
                sender_id INT,
                sender_name VARCHAR(255),
                message_type ENUM('broadcast', 'personal') NOT NULL DEFAULT 'broadcast',
                channels VARCHAR(50) NOT NULL DEFAULT 'both',
                target_audience VARCHAR(100) NOT NULL DEFAULT 'all',
                target_department VARCHAR(100) NULL,
                target_employee_id INT NULL,
                target_employee_name VARCHAR(255) NULL,
                subject VARCHAR(255) NOT NULL,
                message_text TEXT NOT NULL,
                priority ENUM('normal', 'important', 'urgent') NOT NULL DEFAULT 'normal',
                total_recipients INT NOT NULL DEFAULT 0,
                email_sent_count INT NOT NULL DEFAULT 0,
                email_failed_count INT NOT NULL DEFAULT 0,
                whatsapp_sent_count INT NOT NULL DEFAULT 0,
                whatsapp_failed_count INT NOT NULL DEFAULT 0,
                status VARCHAR(50) NOT NULL DEFAULT 'COMPLETED',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_msg_company (company_id),
                INDEX idx_msg_created (created_at)
            )
        `);
        console.log('✅ broadcast_messages table initialized successfully!');
        process.exit(0);
    } catch (e) {
        console.error('❌ Failed to init broadcast_messages table:', e.message);
        process.exit(1);
    }
}

init();
