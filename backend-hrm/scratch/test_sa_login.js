const axios = require('axios');

async function testLogin() {
    try {
        const res = await axios.post('http://localhost:3000/api/login', {
            userId: 'lightlabcreation@gmail.com',
            password: '123456',
            role: 'superadmin'
        });
        console.log("✅ SuperAdmin Login Successful!");
        console.log("User:", res.data.user);
        console.log("Token Generated:", Boolean(res.data.token));
    } catch (err) {
        console.error("❌ Login failed:", err.response?.data || err.message);
    }
    process.exit(0);
}

testLogin();
