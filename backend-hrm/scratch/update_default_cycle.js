const db = require('../config/db');

async function updateDefaults() {
    await db.execute('UPDATE settings SET salary_cycle = ?, salary_cycle_start_date = ?', ['Monthly (1st to 30th)', 1]);
    const [rows] = await db.execute('SELECT id, company_id, salary_cycle, salary_cycle_start_date FROM settings');
    console.log('Settings updated:', JSON.stringify(rows, null, 2));
    process.exit(0);
}

updateDefaults().catch(console.error);
