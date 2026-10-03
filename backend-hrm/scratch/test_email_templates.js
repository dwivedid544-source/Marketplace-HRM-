require('dotenv').config();
const { sendWelcomeTrialEmail, sendSubscriptionSuccessEmail } = require('../utils/emailService');

async function testTemplates() {
    console.log("--- 1. Testing Welcome Free Trial Email ---");
    const trialRes = await sendWelcomeTrialEmail({
        to: "sonuchendake@gmail.com",
        name: "Rahul Sharma",
        companyName: "Acme Infotech Pvt Ltd",
        email: "rahul@acme.com",
        password: "TempPassword#2026",
        trialDays: 7,
        expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });
    console.log("Free trial email result:", trialRes);

    console.log("\n--- 2. Testing Paid Subscription Success Email ---");
    const subRes = await sendSubscriptionSuccessEmail({
        to: "sonuchendake@gmail.com",
        name: "Rahul Sharma",
        companyName: "Acme Infotech Pvt Ltd",
        email: "rahul@acme.com",
        password: "MySecurePassword123",
        planName: "Standard Business Plan",
        amount: 4999,
        billingCycle: "Monthly",
        expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        invoiceNumber: "INV-2026-00892",
        isNewAccount: true
    });
    console.log("Paid subscription email result:", subRes);
}

testTemplates().catch(console.error);
