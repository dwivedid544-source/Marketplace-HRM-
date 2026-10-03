const bcrypt = require('bcryptjs');
const db = require('../config/db');

async function updateAndVerify() {
    const newPass = "123456666678";
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(newPass, salt);

    console.log("Updating demogmail01@gmail.com with new password:", newPass);
    await db.execute('UPDATE users SET password = ? WHERE email = ?', [hash, 'demogmail01@gmail.com']);

    const [rows] = await db.execute('SELECT id, name, email, password FROM users WHERE email = ?', ['demogmail01@gmail.com']);
    const user = rows[0];

    const matchNew = await bcrypt.compare(newPass, user.password);
    const matchOld = await bcrypt.compare("123456", user.password);

    console.log("Password verification for demogmail01@gmail.com:");
    console.log("Match with new password (123456666678):", matchNew ? "✅ YES" : "❌ NO");
    console.log("Match with old password (123456):", matchOld ? "⚠️ Still matches old" : "✅ Successfully replaced old");

    process.exit(0);
}

updateAndVerify().catch(console.error);
