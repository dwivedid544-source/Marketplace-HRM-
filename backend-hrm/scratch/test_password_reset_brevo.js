const axios = require('axios');
const db = require('../config/db');
const bcrypt = require('bcryptjs');

async function testPasswordReset() {
    console.log("==================================================");
    console.log("🧪 TESTING FORGOT PASSWORD & RESET VIA GMAIL / BREVO");
    console.log("==================================================");

    // 1. Test SuperAdmin Forgot Password
    const superAdminEmail = 'lightlabcreation@gmail.com';
    console.log(`\n1. Requesting password reset for SuperAdmin: ${superAdminEmail}...`);

    try {
        const reqRes = await axios.post('http://localhost:3000/api/public/forgot-password-request', {
            userId: superAdminEmail
        });
        console.log("✅ Request Success:", reqRes.data);

        // Fetch OTP from database
        const [resets] = await db.execute(
            'SELECT * FROM password_resets WHERE email = ? AND used = 0 ORDER BY id DESC LIMIT 1',
            [superAdminEmail]
        );
        console.log("📋 Generated OTP in DB:", resets[0]?.otp, "Token:", resets[0]?.token?.slice(0, 10) + '...');

        const testOtp = resets[0]?.otp;
        const newPasswordToSet = '123456';

        // 2. Test Reset Password with OTP
        console.log(`\n2. Verifying OTP and updating password for ${superAdminEmail}...`);
        const verifyRes = await axios.post('http://localhost:3000/api/public/reset-password-verify', {
            email: superAdminEmail,
            otp: testOtp,
            newPassword: newPasswordToSet
        });
        console.log("✅ Reset Success:", verifyRes.data);

        // 3. Test Login with the new password
        console.log(`\n3. Testing SuperAdmin Login with new password...`);
        const loginRes = await axios.post('http://localhost:3000/api/login', {
            userId: superAdminEmail,
            password: newPasswordToSet,
            role: 'superadmin'
        });
        console.log("🎉 SuperAdmin Login Successful! Role:", loginRes.data.user.role, "Token generated:", Boolean(loginRes.data.token));

    } catch (err) {
        console.error("❌ Test Failed:", err.response?.data || err.message);
    }

    // 4. Test Company Admin (demogmail01@gmail.com)
    const companyAdminEmail = 'demogmail01@gmail.com';
    console.log(`\n4. Requesting password reset for Company Admin: ${companyAdminEmail}...`);
    try {
        const compReqRes = await axios.post('http://localhost:3000/api/public/forgot-password-request', {
            userId: companyAdminEmail
        });
        console.log("✅ Company Admin Request Success:", compReqRes.data);
    } catch (err) {
        console.error("❌ Company Admin Request Failed:", err.response?.data || err.message);
    }

    console.log("\n==================================================");
    console.log("🎉 ALL PASSWORD RESET TESTS COMPLETE!");
    console.log("==================================================");
    process.exit(0);
}

testPasswordReset().catch(console.error);
