const db = require('../config/db');

async function updateSuperAdmin() {
    const newEmail = 'lightlabcreation@gmail.com';
    console.log(`Updating SuperAdmin email to ${newEmail}...`);
    
    await db.execute('UPDATE users SET email = ? WHERE id = 1 OR role = "superadmin"', [newEmail]);
    
    const [rows] = await db.execute('SELECT id, name, email, role, company_id FROM users WHERE role = "superadmin"');
    console.log("Updated SuperAdmin User:", JSON.stringify(rows, null, 2));
    process.exit(0);
}

updateSuperAdmin().catch(console.error);
