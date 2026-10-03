const db = require('../config/db');

async function check() {
    const [rows] = await db.execute('SELECT id, name, email, role, company_id FROM users WHERE role = "superadmin"');
    console.log("Superadmin user:", JSON.stringify(rows, null, 2));
    process.exit(0);
}

check().catch(console.error);
