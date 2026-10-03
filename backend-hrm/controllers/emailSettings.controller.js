const db = require('../config/db');
const { encrypt, decrypt } = require('../utils/cryptoUtils');
const nodemailer = require('nodemailer');

exports.getEmailSettings = async (req, res) => {
    try {
        const companyId = req.user.company_id;
        const [rows] = await db.execute('SELECT * FROM company_email_settings WHERE company_id = ?', [companyId]);
        if (rows.length === 0) {
            return res.json({});
        }
        
        const settings = rows[0];
        // Don't send the real decrypted password to frontend for security
        // Just send a flag indicating it exists
        settings.smtp_pass = settings.smtp_pass ? '********' : '';
        
        res.json(settings);
    } catch (err) {
        console.error('Error fetching email settings:', err);
        res.status(500).json({ error: err.message });
    }
};

exports.saveEmailSettings = async (req, res) => {
    try {
        const companyId = req.user.company_id;
        const { smtp_host, smtp_port, smtp_user, smtp_pass, sender_email, sender_name, is_active } = req.body;
        
        // Validation
        if (!smtp_host || !smtp_port || !smtp_user || !sender_email || !sender_name) {
            return res.status(400).json({ error: 'All fields are required.' });
        }

        const [existing] = await db.execute('SELECT * FROM company_email_settings WHERE company_id = ?', [companyId]);
        
        let encryptedPass;
        if (smtp_pass && smtp_pass !== '********') {
            encryptedPass = encrypt(smtp_pass);
        } else if (existing.length > 0) {
            encryptedPass = existing[0].smtp_pass;
        } else {
            return res.status(400).json({ error: 'Password is required for new settings.' });
        }

        if (existing.length > 0) {
            await db.execute(
                `UPDATE company_email_settings 
                 SET smtp_host=?, smtp_port=?, smtp_user=?, smtp_pass=?, sender_email=?, sender_name=?, is_active=?, updated_at=NOW()
                 WHERE company_id=?`,
                [smtp_host, smtp_port, smtp_user, encryptedPass, sender_email, sender_name, is_active, companyId]
            );
        } else {
            await db.execute(
                `INSERT INTO company_email_settings 
                 (company_id, smtp_host, smtp_port, smtp_user, smtp_pass, sender_email, sender_name, is_active)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [companyId, smtp_host, smtp_port, smtp_user, encryptedPass, sender_email, sender_name, is_active]
            );
        }

        res.json({ success: true, message: 'Email settings saved successfully.' });
    } catch (err) {
        console.error('Error saving email settings:', err);
        res.status(500).json({ error: err.message });
    }
};

const https = require('https');

exports.testEmailConnection = async (req, res) => {
    try {
        const companyId = req.user.company_id;
        const [rows] = await db.execute('SELECT * FROM company_email_settings WHERE company_id = ?', [companyId]);
        
        if (rows.length === 0) {
            return res.status(400).json({ error: 'Save settings first before testing.' });
        }

        const settings = rows[0];
        const password = decrypt(settings.smtp_pass);
        const recipient = settings.sender_email || req.user.email;

        // If password is a Brevo REST API Key (starts with xkeysib-)
        if (password && password.startsWith('xkeysib-')) {
            const payload = JSON.stringify({
                sender: { name: settings.sender_name || 'HRM Software', email: settings.sender_email },
                to: [{ email: recipient }],
                subject: 'Test Email from HRM Software',
                htmlContent: '<p>Your Brevo API Key is working perfectly! You are now ready to send e-payslips and automated messages.</p>'
            });

            await new Promise((resolve, reject) => {
                const reqApi = https.request({
                    hostname: 'api.brevo.com',
                    port: 443,
                    path: '/v3/smtp/email',
                    method: 'POST',
                    headers: {
                        'accept': 'application/json',
                        'api-key': password,
                        'content-type': 'application/json',
                        'content-length': Buffer.byteLength(payload)
                    }
                }, (resApi) => {
                    let resBody = '';
                    resApi.on('data', d => resBody += d);
                    resApi.on('end', () => {
                        if (resApi.statusCode >= 200 && resApi.statusCode < 300) {
                            resolve(resBody);
                        } else {
                            try {
                                const parsed = JSON.parse(resBody);
                                reject(new Error(parsed.message || resBody));
                            } catch (e) {
                                reject(new Error(`Brevo API Error (${resApi.statusCode}): ${resBody}`));
                            }
                        }
                    });
                });
                reqApi.on('error', reject);
                reqApi.write(payload);
                reqApi.end();
            });

            return res.json({ success: true, message: `Brevo Connection successful! Test email sent to ${recipient}` });
        }

        // Standard SMTP Transporter (Gmail App Password, Brevo SMTP Key xsmtpib-, Resend re_...)
        const transporter = nodemailer.createTransport({
            host: settings.smtp_host,
            port: parseInt(settings.smtp_port),
            secure: parseInt(settings.smtp_port) === 465,
            auth: {
                user: settings.smtp_user,
                pass: password,
            }
        });

        await transporter.verify(); // Test connection
        
        await transporter.sendMail({
            from: `"${settings.sender_name || 'HRM Software'}" <${settings.sender_email}>`,
            to: recipient,
            subject: 'Test Email from HRM Software',
            text: 'Your SMTP settings are working perfectly! You are now ready to send e-payslips and notifications.'
        });

        res.json({ success: true, message: `SMTP Connection successful! Test email sent to ${recipient}` });
    } catch (err) {
        console.error('Test email failed:', err);
        res.status(400).json({ error: 'Connection failed: ' + err.message });
    }
};

exports.deleteEmailSettings = async (req, res) => {
    try {
        const companyId = req.user.company_id;
        await db.execute('DELETE FROM company_email_settings WHERE company_id = ?', [companyId]);
        res.json({ success: true, message: 'SMTP settings removed successfully.' });
    } catch (err) {
        console.error('Error deleting email settings:', err);
        res.status(500).json({ error: err.message });
    }
};

exports.toggleEmailStatus = async (req, res) => {
    try {
        const companyId = req.user.company_id;
        const { is_active } = req.body;
        await db.execute('UPDATE company_email_settings SET is_active = ?, updated_at = NOW() WHERE company_id = ?', [is_active ? 1 : 0, companyId]);
        res.json({ success: true, message: `SMTP settings marked as ${is_active ? 'Active' : 'Inactive'}.` });
    } catch (err) {
        console.error('Error toggling email settings:', err);
        res.status(500).json({ error: err.message });
    }
};
