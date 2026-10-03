const db = require('../config/db');

async function migrate() {
    try {
        const [colsG] = await db.execute("SHOW COLUMNS FROM global_settings LIKE 'country'");
        if (colsG.length === 0) {
            await db.execute("ALTER TABLE global_settings ADD COLUMN country VARCHAR(100) DEFAULT 'India'");
            console.log('✅ Added country column to global_settings');
        } else {
            console.log('ℹ️ country column already exists in global_settings');
        }

        const [colsS] = await db.execute("SHOW COLUMNS FROM settings LIKE 'country'");
        if (colsS.length === 0) {
            await db.execute("ALTER TABLE settings ADD COLUMN country VARCHAR(100) DEFAULT 'India'");
            console.log('✅ Added country column to settings');
        } else {
            console.log('ℹ️ country column already exists in settings');
        }

        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    }
}

migrate();
