const https = require('https');
require('dotenv').config();

const apiKey = process.env.BREVO_API_KEY || process.env.SMTP_PASS;
const senderName = process.env.MAIL_FROM_NAME || "Kiaan Technology Pvt Ltd";
const senderEmail = process.env.MAIL_FROM_EMAIL || "info@kiaantechnology.com";

console.log("Testing Brevo API with Sender:", `${senderName} <${senderEmail}>`);
console.log("API Key preview:", apiKey ? apiKey.substring(0, 15) + "..." : "MISSING");

async function testBrevo() {
    const data = JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: [{ email: "sonuchendake@gmail.com", name: "Test User" }],
        subject: "⚡ Kiaan Technology - System Integration Test",
        htmlContent: "<h2>Hello from Kiaan Technology!</h2><p>Your Brevo API Key integration is working seamlessly.</p>"
    });

    const options = {
        hostname: 'api.brevo.com',
        port: 443,
        path: '/v3/smtp/email',
        method: 'POST',
        headers: {
            'accept': 'application/json',
            'api-key': apiKey,
            'content-type': 'application/json',
            'content-length': Buffer.byteLength(data)
        }
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                console.log("Brevo API Status Code:", res.statusCode);
                console.log("Brevo API Response:", body);
                resolve({ statusCode: res.statusCode, body });
            });
        });

        req.on('error', (e) => {
            console.error("Brevo API Request Error:", e);
            reject(e);
        });

        req.write(data);
        req.end();
    });
}

testBrevo().catch(console.error);
