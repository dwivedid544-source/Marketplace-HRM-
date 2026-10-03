const db = require('../config/db');
const bcrypt = require('bcryptjs');

async function setAndVerify() {
    const email = 'lightlabcreation@gmail.com';
    const password = '123456';
    const hash = await bcrypt.hash(password, 10);

    await db.execute('UPDATE users SET email = ?, password = ? WHERE id = 1 OR role = "superadmin"', [email, hash]);

    const [rows] = await db.execute('SELECT id, name, email, role FROM users WHERE id = 1 OR role = "superadmin"');
    console.log("Updated SuperAdmin in DB:", rows);

    process.exit(0);
}

setAndVerify().catch(console.error);
