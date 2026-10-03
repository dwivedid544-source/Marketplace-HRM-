const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const https = require('https');
const db = require('../config/db');
const { decrypt } = require('./cryptoUtils');

/**
 * Direct Brevo HTTP REST API Dispatcher (v3)
 */
function sendBrevoApiEmail({ to, toName, subject, htmlContent, textContent, attachments = [] }) {
    return new Promise((resolve, reject) => {
        const apiKey = process.env.BREVO_API_KEY || process.env.SMTP_PASS;
        if (!apiKey) {
            return reject(new Error('BREVO_API_KEY is not defined'));
        }

        const senderName = process.env.MAIL_FROM_NAME || process.env.SMTP_SENDER_NAME || 'Kiaan Technology Pvt Ltd';
        const senderEmail = process.env.MAIL_FROM_EMAIL || process.env.SMTP_SENDER_EMAIL || 'info@kiaantechnology.com';

        const payloadObj = {
            sender: { name: senderName, email: senderEmail },
            to: [{ email: to, name: toName || to }],
            subject: subject,
            htmlContent: htmlContent
        };

        if (textContent) {
            payloadObj.textContent = textContent;
        }

        // Attachments if any (Brevo REST expects base64 content)
        if (attachments && attachments.length > 0) {
            payloadObj.attachment = attachments.map(att => {
                if (att.content) {
                    return {
                        name: att.filename,
                        content: typeof att.content === 'string' ? att.content : att.content.toString('base64')
                    };
                } else if (att.path && fs.existsSync(att.path)) {
                    const fileData = fs.readFileSync(att.path);
                    return {
                        name: att.filename || path.basename(att.path),
                        content: fileData.toString('base64')
                    };
                }
                return null;
            }).filter(Boolean);
        }

        const data = JSON.stringify(payloadObj);

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

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        const parsed = JSON.parse(body);
                        resolve({ success: true, messageId: parsed.messageId, provider: 'brevo-api' });
                    } catch (e) {
                        resolve({ success: true, messageId: body, provider: 'brevo-api' });
                    }
                } else {
                    reject(new Error(`Brevo API Error (${res.statusCode}): ${body}`));
                }
            });
        });

        req.on('error', (e) => reject(e));
        req.write(data);
        req.end();
    });
}

/**
 * System Transporter (Nodemailer SMTP Fallback)
 */
async function getSystemTransporter() {
    const envHost = process.env.SMTP_HOST || 'smtp-relay.brevo.com';
    const envPort = parseInt(process.env.SMTP_PORT || '587');
    const envUser = process.env.SMTP_USER || process.env.MAIL_FROM_EMAIL;
    const envPass = process.env.SMTP_PASS || process.env.BREVO_API_KEY;
    const envSenderEmail = process.env.MAIL_FROM_EMAIL || process.env.SMTP_SENDER_EMAIL || envUser;
    const envSenderName = process.env.MAIL_FROM_NAME || process.env.SMTP_SENDER_NAME || 'Kiaan Technology Pvt Ltd';

    if (envUser && envPass) {
        const transporter = nodemailer.createTransport({
            host: envHost,
            port: envPort,
            secure: envPort === 465,
            auth: {
                user: envUser,
                pass: envPass
            }
        });
        return { transporter, senderEmail: envSenderEmail, senderName: envSenderName };
    }

    try {
        const [rows] = await db.execute('SELECT * FROM company_email_settings WHERE is_active = 1 ORDER BY id ASC LIMIT 1');
        if (rows.length > 0) {
            const s = rows[0];
            const password = decrypt(s.smtp_pass);
            const transporter = nodemailer.createTransport({
                host: s.smtp_host,
                port: parseInt(s.smtp_port),
                secure: parseInt(s.smtp_port) === 465,
                auth: {
                    user: s.smtp_user,
                    pass: password
                }
            });
            return { transporter, senderEmail: s.sender_email, senderName: s.sender_name || 'Kiaan Technology Pvt Ltd' };
        }
    } catch (e) {
        console.warn('Could not fetch DB email settings:', e.message);
    }

    return null;
}

/**
 * Universal Unified Email Sender (Brevo API First -> SMTP Fallback)
 */
async function sendSystemEmail({ to, toName, subject, htmlContent, textContent, attachments = [] }) {
    if (!to) {
        console.warn('⚠️ sendSystemEmail skipped: Recipient email is missing.');
        return false;
    }

    // 1. Try Brevo REST API first if BREVO_API_KEY is present
    if (process.env.BREVO_API_KEY || (process.env.SMTP_PASS && process.env.SMTP_PASS.startsWith('xkeysib-'))) {
        try {
            const result = await sendBrevoApiEmail({ to, toName, subject, htmlContent, textContent, attachments });
            console.log(`✅ [Brevo API] Email dispatched to ${to}. MsgId: ${result.messageId}`);
            return result;
        } catch (apiErr) {
            console.warn(`⚠️ Brevo REST API failed (${apiErr.message}), falling back to SMTP...`);
        }
    }

    // 2. Fallback to Nodemailer SMTP
    try {
        const emailConfig = await getSystemTransporter();
        if (!emailConfig) {
            console.warn('⚠️ No email SMTP/API configured. Email not sent.');
            return false;
        }

        const { transporter, senderEmail, senderName } = emailConfig;
        const mailOptions = {
            from: `"${senderName}" <${senderEmail}>`,
            to: to,
            subject: subject,
            html: htmlContent,
            text: textContent,
            attachments: attachments
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`✅ [Nodemailer SMTP] Email sent to ${to}. MsgId: ${info.messageId}`);
        return { success: true, messageId: info.messageId, provider: 'smtp' };
    } catch (smtpErr) {
        console.error(`❌ All email dispatch methods failed for ${to}:`, smtpErr.message);
        return false;
    }
}

async function createTransporter(settings) {
    const password = decrypt(settings.smtp_pass);
    return nodemailer.createTransport({
        host: settings.smtp_host,
        port: parseInt(settings.smtp_port),
        secure: parseInt(settings.smtp_port) === 465,
        auth: {
            user: settings.smtp_user,
            pass: password,
        }
    });
}

/**
 * Send 7-Day Free Trial Welcome Email with Login Credentials
 */
async function sendWelcomeTrialEmail({ to, name, companyName, email, password, trialDays = 7, expiryDate }) {
    if (!to) {
        console.warn('⚠️ sendWelcomeTrialEmail skipped: recipient email is missing.');
        return false;
    }

    try {
        const formattedExpiry = expiryDate 
            ? new Date(expiryDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
            : `${trialDays} Days from today`;

        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const loginUrl = `${frontendUrl}/login`;
        const senderName = process.env.MAIL_FROM_NAME || 'Kiaan Technology Pvt Ltd';

        const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to HRM Software Pro - 7 Days Free Trial</title>
    <style>
        body { margin: 0; padding: 0; background-color: #0b0f19; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #cbd5e1; }
        .wrapper { width: 100%; max-width: 620px; margin: 0 auto; background-color: #0f172a; border: 1px solid rgba(255,255,255,0.08); border-radius: 24px; overflow: hidden; margin-top: 24px; margin-bottom: 24px; }
        .header { background: linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%); padding: 36px 30px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.1); }
        .logo-text { font-size: 26px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px; margin: 0; }
        .logo-sub { font-size: 11px; font-weight: 800; color: #38bdf8; text-transform: uppercase; letter-spacing: 2px; margin-top: 4px; }
        .badge { display: inline-block; padding: 6px 14px; background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 50px; color: #38bdf8; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; margin-top: 14px; }
        .content { padding: 36px 30px; }
        .greeting { font-size: 20px; font-weight: 800; color: #ffffff; margin-top: 0; margin-bottom: 10px; }
        .lead { font-size: 14px; line-height: 1.6; color: #94a3b8; margin-bottom: 24px; }
        .cred-box { background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 18px; padding: 22px; margin-bottom: 26px; }
        .cred-title { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #38bdf8; margin-top: 0; margin-bottom: 14px; }
        .btn-container { text-align: center; margin: 30px 0 20px; }
        .btn { display: inline-block; background: linear-gradient(135deg, #0284c7 0%, #6366f1 50%, #9333ea 100%); color: #ffffff !important; text-decoration: none; padding: 14px 34px; font-size: 13px; font-weight: 800; border-radius: 12px; text-transform: uppercase; letter-spacing: 1.5px; box-shadow: 0 10px 25px rgba(99, 102, 241, 0.3); }
        .features { background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 16px; padding: 20px; margin-top: 24px; }
        .feature-item { font-size: 12px; color: #cbd5e1; padding: 5px 0; }
        .footer { background-color: #090d16; padding: 24px 30px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid rgba(255,255,255,0.05); }
        .footer a { color: #38bdf8; text-decoration: none; }
    </style>
</head>
<body>
    <div class="wrapper">
        <div class="header">
            <h1 class="logo-text">⚡ HRM SOFTWARE PRO</h1>
            <div class="logo-sub">${senderName}</div>
            <div class="badge">🎉 7-Day Free Trial Activated</div>
        </div>

        <div class="content">
            <h2 class="greeting">Hello ${name}, Welcome Aboard! 🚀</h2>
            <p class="lead">
                Your <strong>7-Day Free Trial</strong> for <strong style="color: #ffffff;">${companyName}</strong> has been successfully activated. You now have full unrestricted access to explore the complete enterprise workforce platform.
            </p>

            <div class="cred-box">
                <div class="cred-title">🔐 Your Admin Login Credentials</div>
                <table width="100%" cellpadding="6" cellspacing="0" style="border-collapse: collapse;">
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                        <td style="color: #94a3b8; font-size: 12px; font-weight: 700;">🏢 Company:</td>
                        <td style="color: #ffffff; font-size: 13px; font-weight: 800; text-align: right;">${companyName}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                        <td style="color: #94a3b8; font-size: 12px; font-weight: 700;">👤 Admin Name:</td>
                        <td style="color: #ffffff; font-size: 13px; font-weight: 800; text-align: right;">${name}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                        <td style="color: #94a3b8; font-size: 12px; font-weight: 700;">📧 Login Email / ID:</td>
                        <td style="color: #38bdf8; font-size: 13px; font-weight: 800; font-family: monospace; text-align: right;">${email}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                        <td style="color: #94a3b8; font-size: 12px; font-weight: 700;">🔑 Portal Password:</td>
                        <td style="color: #c084fc; font-size: 14px; font-weight: 900; font-family: monospace; text-align: right;">${password}</td>
                    </tr>
                    <tr>
                        <td style="color: #94a3b8; font-size: 12px; font-weight: 700;">⏳ Trial Valid Until:</td>
                        <td style="color: #34d399; font-size: 13px; font-weight: 800; text-align: right;">${formattedExpiry} (7 Days)</td>
                    </tr>
                </table>
            </div>

            <div class="btn-container">
                <a href="${loginUrl}" target="_blank" class="btn">🚀 Login To Admin Dashboard</a>
            </div>

            <div class="features">
                <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #94a3b8; letter-spacing: 1px; margin-bottom: 10px;">✨ What you can explore during your trial:</div>
                <div class="feature-item">👥 <strong>Employee Management:</strong> Onboard staff, assign roles, shift timings & salaries.</div>
                <div class="feature-item">🤖 <strong>AI Biometric Face Attendance:</strong> Ultra-fast camera attendance with live liveness verification.</div>
                <div class="feature-item">📍 <strong>GPS Geofencing:</strong> Location-locked mobile punch & tamper-proof clock-in.</div>
                <div class="feature-item">💰 <strong>1-Click Payroll:</strong> Automated salary calculations, tax/PF deductions & PDF payslips.</div>
                <div class="feature-item">📊 <strong>Smart Reports & Analytics:</strong> Export daily logs, KPI goal tracking & attendance summaries.</div>
            </div>

            <p style="font-size: 12px; color: #64748b; margin-top: 24px; line-height: 1.5; text-align: center;">
                🔒 <em>Tip: For security, please keep your login credentials safe. You can change your password anytime from your Profile Settings.</em>
            </p>
        </div>

        <div class="footer">
            <p style="margin: 0 0 6px 0;">Need assistance or have questions? <a href="https://kiaantechnology.com/" target="_blank">Visit Kiaan Technology</a></p>
            <p style="margin: 0; opacity: 0.7;">&copy; ${new Date().getFullYear()} Kiaan Technology Pvt Ltd. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
        `;

        await sendSystemEmail({
            to: to,
            toName: name,
            subject: `🎉 Welcome to HRM Software Pro - Your 7-Day Free Trial is Active!`,
            htmlContent: htmlContent
        });
        return true;
    } catch (err) {
        console.error(`❌ Failed to send Welcome Free Trial Email to ${to}:`, err.message);
        return false;
    }
}

/**
 * Send Paid Subscription Activation & Receipt Email
 */
async function sendSubscriptionSuccessEmail({ to, name, companyName, email, password, planName, amount, billingCycle, expiryDate, invoiceNumber, isNewAccount = false }) {
    if (!to) {
        console.warn('⚠️ sendSubscriptionSuccessEmail skipped: recipient email is missing.');
        return false;
    }

    try {
        const formattedExpiry = expiryDate 
            ? new Date(expiryDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
            : 'Active';

        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const loginUrl = `${frontendUrl}/login`;
        const senderName = process.env.MAIL_FROM_NAME || 'Kiaan Technology Pvt Ltd';

        const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Subscription Activated - HRM Software Pro</title>
    <style>
        body { margin: 0; padding: 0; background-color: #0b0f19; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #cbd5e1; }
        .wrapper { width: 100%; max-width: 620px; margin: 0 auto; background-color: #0f172a; border: 1px solid rgba(255,255,255,0.08); border-radius: 24px; overflow: hidden; margin-top: 24px; margin-bottom: 24px; }
        .header { background: linear-gradient(135deg, #064e3b 0%, #047857 50%, #059669 100%); padding: 36px 30px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.1); }
        .logo-text { font-size: 26px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px; margin: 0; }
        .logo-sub { font-size: 11px; font-weight: 800; color: #a7f3d0; text-transform: uppercase; letter-spacing: 2px; margin-top: 4px; }
        .badge { display: inline-block; padding: 6px 14px; background: rgba(255, 255, 255, 0.2); border: 1px solid rgba(255, 255, 255, 0.4); border-radius: 50px; color: #ffffff; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; margin-top: 14px; }
        .content { padding: 36px 30px; }
        .greeting { font-size: 20px; font-weight: 800; color: #ffffff; margin-top: 0; margin-bottom: 10px; }
        .lead { font-size: 14px; line-height: 1.6; color: #94a3b8; margin-bottom: 24px; }
        .cred-box { background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 18px; padding: 22px; margin-bottom: 26px; }
        .cred-title { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #34d399; margin-top: 0; margin-bottom: 14px; }
        .btn-container { text-align: center; margin: 30px 0 20px; }
        .btn { display: inline-block; background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: #ffffff !important; text-decoration: none; padding: 14px 34px; font-size: 13px; font-weight: 800; border-radius: 12px; text-transform: uppercase; letter-spacing: 1.5px; box-shadow: 0 10px 25px rgba(16, 185, 129, 0.3); }
        .footer { background-color: #090d16; padding: 24px 30px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid rgba(255,255,255,0.05); }
        .footer a { color: #34d399; text-decoration: none; }
    </style>
</head>
<body>
    <div class="wrapper">
        <div class="header">
            <h1 class="logo-text">⚡ HRM SOFTWARE PRO</h1>
            <div class="logo-sub">${senderName}</div>
            <div class="badge">💳 Subscription Payment Confirmed</div>
        </div>

        <div class="content">
            <h2 class="greeting">Thank You ${name}! 🎉</h2>
            <p class="lead">
                Your subscription for <strong style="color: #ffffff;">${companyName}</strong> has been successfully activated. Thank you for partnering with HRM Software Pro for your enterprise workforce management.
            </p>

            <div class="cred-box">
                <div class="cred-title">📋 Subscription & Payment Details</div>
                <table width="100%" cellpadding="6" cellspacing="0" style="border-collapse: collapse;">
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                        <td style="color: #94a3b8; font-size: 12px; font-weight: 700;">🏢 Company Name:</td>
                        <td style="color: #ffffff; font-size: 13px; font-weight: 800; text-align: right;">${companyName}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                        <td style="color: #94a3b8; font-size: 12px; font-weight: 700;">📦 Activated Plan:</td>
                        <td style="color: #38bdf8; font-size: 13px; font-weight: 800; text-align: right;">${planName}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                        <td style="color: #94a3b8; font-size: 12px; font-weight: 700;">💰 Amount Paid:</td>
                        <td style="color: #34d399; font-size: 14px; font-weight: 900; text-align: right;">₹${parseFloat(amount || 0).toLocaleString('en-IN')}</td>
                    </tr>
                    ${invoiceNumber ? `
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                        <td style="color: #94a3b8; font-size: 12px; font-weight: 700;">🧾 Invoice / Receipt No:</td>
                        <td style="color: #cbd5e1; font-size: 12px; font-weight: 800; font-family: monospace; text-align: right;">${invoiceNumber}</td>
                    </tr>` : ''}
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                        <td style="color: #94a3b8; font-size: 12px; font-weight: 700;">🔄 Billing Cycle:</td>
                        <td style="color: #ffffff; font-size: 13px; font-weight: 800; text-align: right; text-transform: capitalize;">${billingCycle || 'Monthly'}</td>
                    </tr>
                    <tr>
                        <td style="color: #94a3b8; font-size: 12px; font-weight: 700;">⏳ Active Until:</td>
                        <td style="color: #34d399; font-size: 13px; font-weight: 800; text-align: right;">${formattedExpiry}</td>
                    </tr>
                </table>
            </div>

            ${(isNewAccount || password) ? `
            <div class="cred-box" style="border-color: rgba(56, 189, 248, 0.2);">
                <div class="cred-title" style="color: #38bdf8;">🔐 Your Admin Login Credentials</div>
                <table width="100%" cellpadding="6" cellspacing="0" style="border-collapse: collapse;">
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                        <td style="color: #94a3b8; font-size: 12px; font-weight: 700;">📧 Login Email / ID:</td>
                        <td style="color: #38bdf8; font-size: 13px; font-weight: 800; font-family: monospace; text-align: right;">${email}</td>
                    </tr>
                    <tr>
                        <td style="color: #94a3b8; font-size: 12px; font-weight: 700;">🔑 Portal Password:</td>
                        <td style="color: #c084fc; font-size: 14px; font-weight: 900; font-family: monospace; text-align: right;">${password || '(Your chosen password)'}</td>
                    </tr>
                </table>
            </div>
            ` : `
            <div class="cred-box">
                <div class="cred-title" style="color: #38bdf8;">🔐 Login Information</div>
                <p style="margin: 0; font-size: 13px; color: #cbd5e1;">Use your registered email <strong>${email}</strong> and existing password to login to your dashboard.</p>
            </div>
            `}

            <div class="btn-container">
                <a href="${loginUrl}" target="_blank" class="btn">🚀 Open Company Dashboard</a>
            </div>
        </div>

        <div class="footer">
            <p style="margin: 0 0 6px 0;">Need enterprise assistance? <a href="https://kiaantechnology.com/" target="_blank">Visit Kiaan Technology</a></p>
            <p style="margin: 0; opacity: 0.7;">&copy; ${new Date().getFullYear()} Kiaan Technology Pvt Ltd. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
        `;

        await sendSystemEmail({
            to: to,
            toName: name,
            subject: `🎉 Payment Successful - ${planName} Activated for ${companyName}`,
            htmlContent: htmlContent
        });
        return true;
    } catch (err) {
        console.error(`❌ Failed to send Subscription Success Email to ${to}:`, err.message);
        return false;
    }
}

/**
 * Send Employee Monthly Payslip Email with PDF Attachment
 */
async function sendPayslipEmail(emailSettings, employeeName, employeeEmail, pdfPath, monthYear) {
    if (!employeeEmail) {
        throw new Error("Employee email is missing.");
    }

    const fullPdfPath = path.join(__dirname, '..', pdfPath);
    if (!fs.existsSync(fullPdfPath)) {
        throw new Error(`PDF file not found at ${fullPdfPath}`);
    }

    const senderName = process.env.MAIL_FROM_NAME || emailSettings?.sender_name || 'Kiaan Technology Pvt Ltd';

    const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
            <h2 style="color: #1e293b; margin-top: 0;">Monthly Payslip - ${monthYear}</h2>
            <p style="color: #475569; font-size: 14px;">Hello <strong>${employeeName}</strong>,</p>
            <p style="color: #475569; font-size: 14px; line-height: 1.5;">
                Your salary for <strong>${monthYear}</strong> has been processed successfully. Please find your detailed payslip attached with this email.
            </p>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin: 18px 0; font-size: 13px; color: #64748b;">
                📄 Attached: <strong>Payslip_${monthYear.replace(' ', '_')}.pdf</strong>
            </div>
            <p style="color: #64748b; font-size: 12px; margin-top: 24px;">If you have any questions regarding your salary computation, please reach out to your HR administrator.</p>
            <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 20px 0;" />
            <p style="color: #94a3b8; font-size: 11px; margin: 0;">&copy; ${new Date().getFullYear()} ${senderName}. All rights reserved.</p>
        </div>
    `;

    return await sendSystemEmail({
        to: employeeEmail,
        toName: employeeName,
        subject: `Your Monthly Payslip - ${monthYear}`,
        htmlContent: htmlContent,
        attachments: [
            {
                filename: `Payslip_${monthYear.replace(' ', '_')}.pdf`,
                path: fullPdfPath,
                contentType: 'application/pdf'
            }
        ]
    });
}

/**
 * Send Password Reset OTP Code Email (Code Only)
 */
async function sendPasswordResetOtpEmail({ to, name, otp }) {
    try {
        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Password Reset Code</title>
    <style>
        body { margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc; }
        .container { max-width: 580px; margin: 30px auto; background: #1e293b; border-radius: 20px; overflow: hidden; border: 1px solid rgba(255,255,255,0.08); box-shadow: 0 20px 40px rgba(0,0,0,0.4); }
        .header { background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); padding: 36px 30px; text-align: center; }
        .logo { font-size: 26px; font-weight: 900; letter-spacing: -0.5px; color: #ffffff; margin-bottom: 6px; }
        .content { padding: 36px 30px; }
        .greeting { font-size: 18px; font-weight: 700; margin-bottom: 12px; color: #ffffff; }
        .otp-box { background: rgba(15, 23, 42, 0.7); border: 2px dashed #38bdf8; border-radius: 16px; padding: 24px; text-align: center; margin: 24px 0; }
        .otp-code { font-family: monospace; font-size: 38px; font-weight: 900; letter-spacing: 10px; color: #38bdf8; margin: 10px 0; }
        .footer { background: #0f172a; padding: 24px 30px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid rgba(255,255,255,0.05); }
        .footer a { color: #38bdf8; text-decoration: none; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🔐 HRM Software Security</div>
            <div style="font-size: 14px; color: rgba(255,255,255,0.85); font-weight: 600;">Password Reset Code</div>
        </div>

        <div class="content">
            <div class="greeting">Hello ${name || 'User'},</div>
            <p style="font-size: 14px; color: #cbd5e1; line-height: 1.6; margin: 0 0 16px 0;">
                We received a request to reset the password for your HRM Software account (<strong>${to}</strong>).
            </p>

            <div class="otp-box">
                <div style="font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 1.5px;">YOUR 6-DIGIT VERIFICATION CODE</div>
                <div class="otp-code">${otp}</div>
                <div style="font-size: 12px; color: #f59e0b; font-weight: 600;">⏱️ Valid for 15 minutes only</div>
            </div>

            <p style="font-size: 13px; color: #cbd5e1; line-height: 1.6; text-align: center; margin: 16px 0;">
                Please enter this 6-digit code on the reset password screen in your portal to set your new password.
            </p>

            <div style="background: rgba(239, 68, 68, 0.08); border-left: 3px solid #ef4444; padding: 12px 16px; border-radius: 8px; margin-top: 24px;">
                <p style="font-size: 12px; color: #fca5a5; margin: 0; line-height: 1.5;">
                    🛡️ If you did not request this password reset, please ignore this email. Your password will remain completely secure.
                </p>
            </div>
        </div>

        <div class="footer">
            <p style="margin: 0 0 6px 0;">Need enterprise assistance? <a href="https://kiaantechnology.com/" target="_blank">Contact Kiaan Technology</a></p>
            <p style="margin: 0; opacity: 0.7;">&copy; ${new Date().getFullYear()} Kiaan Technology Pvt Ltd. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
        `;

        await sendSystemEmail({
            to: to,
            toName: name || to,
            subject: `🔐 Your 6-Digit Password Reset Code: ${otp} - HRM Software`,
            htmlContent: htmlContent
        });
        return true;
    } catch (err) {
        console.error(`❌ Failed to send Password Reset Email to ${to}:`, err.message);
        return false;
    }
}

/**
 * Send Password Changed Confirmation Email
 */
async function sendPasswordChangedConfirmationEmail({ to, name }) {
    try {
        const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Password Changed Successfully</title>
    <style>
        body { margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #f8fafc; }
        .container { max-width: 580px; margin: 30px auto; background: #1e293b; border-radius: 20px; overflow: hidden; border: 1px solid rgba(255,255,255,0.08); box-shadow: 0 20px 40px rgba(0,0,0,0.4); }
        .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 32px 30px; text-align: center; }
        .content { padding: 32px 30px; }
        .footer { background: #0f172a; padding: 20px 30px; text-align: center; font-size: 12px; color: #64748b; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2 style="color: #ffffff; margin: 0; font-size: 22px;">✅ Password Changed Successfully</h2>
        </div>
        <div class="content">
            <p style="font-size: 15px; color: #ffffff; margin-top: 0;">Hello <strong>${name || 'User'}</strong>,</p>
            <p style="font-size: 14px; color: #cbd5e1; line-height: 1.6;">
                The password for your HRM Software account (<strong>${to}</strong>) has been updated successfully.
            </p>
            <p style="font-size: 13px; color: #94a3b8; line-height: 1.5;">
                You can now log in to your dashboard with your new password.
            </p>
            <div style="text-align: center; margin: 28px 0;">
                <a href="${clientUrl}/login" target="_blank" style="display: inline-block; background: #10b981; color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-weight: 700; font-size: 13px;">🚀 Login to Dashboard</a>
            </div>
            <p style="font-size: 12px; color: #ef4444; line-height: 1.5; margin-bottom: 0;">
                🛡️ If you did not perform this change, please contact support immediately to secure your account.
            </p>
        </div>
        <div class="footer">
            &copy; ${new Date().getFullYear()} Kiaan Technology Pvt Ltd. All rights reserved.
        </div>
    </div>
</body>
</html>
        `;

        await sendSystemEmail({
            to: to,
            toName: name || to,
            subject: `✅ Security Alert: Your Password Was Changed - HRM Software`,
            htmlContent: htmlContent
        });
        return true;
    } catch (err) {
        console.error(`❌ Failed to send Password Changed Confirmation to ${to}:`, err.message);
        return false;
    }
}

module.exports = { 
    sendPayslipEmail, 
    createTransporter, 
    sendWelcomeTrialEmail, 
    sendSubscriptionSuccessEmail,
    sendPasswordResetOtpEmail,
    sendPasswordChangedConfirmationEmail,
    sendSystemEmail,
    getSystemTransporter 
};
