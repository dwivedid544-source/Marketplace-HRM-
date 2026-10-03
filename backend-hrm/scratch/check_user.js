const db = require('../config/db');

async function check() {
    const [comps] = await db.execute('SELECT * FROM companies');
    const [users] = await db.execute('SELECT id, company_id, name, email, role FROM users');
    const [subs] = await db.execute('SELECT id, company_id, plan_name, billing_cycle, amount, payment_status, start_date, end_date FROM subscriptions');
    console.log("=== COMPANIES ===", JSON.stringify(comps, null, 2));
    console.log("=== USERS ===", JSON.stringify(users, null, 2));
    console.log("=== SUBSCRIPTIONS ===", JSON.stringify(subs, null, 2));
    process.exit(0);
}

check().catch(console.error);
