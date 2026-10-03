const db = require('../config/db');

async function fixExpiry() {
    const targetEnd = '2026-09-24';
    console.log("Fixing subscription expiry for company 25 to 30 days from purchase (2026-09-24)...");
    
    await db.execute('UPDATE companies SET subscription_end = ? WHERE id = 25', [targetEnd]);
    await db.execute('UPDATE subscriptions SET end_date = ? WHERE id = 34', [targetEnd]);
    
    const [comps] = await db.execute('SELECT id, company_name, email, plan, subscription_start, subscription_end FROM companies WHERE id = 25');
    const [subs] = await db.execute('SELECT id, company_id, plan_name, amount, start_date, end_date FROM subscriptions WHERE company_id = 25');
    
    console.log("Updated Company:", JSON.stringify(comps, null, 2));
    console.log("Updated Subscriptions:", JSON.stringify(subs, null, 2));
    process.exit(0);
}

fixExpiry().catch(console.error);
