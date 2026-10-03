const db = require('../config/db');
const nodemailer = require('nodemailer');
const { decrypt } = require('../utils/cryptoUtils');
const { sendSystemEmail } = require('../utils/emailService');
const whatsappService = require('../services/whatsappService');
const { logAction } = require('../utils/audit');

/**
 * Helper to get company custom SMTP transporter if active
 */
async function getCompanyEmailTransporter(companyId) {
    try {
        const [rows] = await db.execute('SELECT * FROM company_email_settings WHERE company_id = ? AND is_active = 1 LIMIT 1', [companyId]);
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
            return {
                transporter,
                senderEmail: s.sender_email,
                senderName: s.sender_name || 'Company HR'
            };
        }
    } catch (e) {
        console.warn(`[Messaging] Could not build company ${companyId} SMTP transporter:`, e.message);
    }
    return null;
}

/**
 * Get recipients metadata: active employees, departments, and active channel status
 */
exports.getRecipientsData = async (req, res) => {
    try {
        const companyId = req.user.company_id;

        // Fetch active employees
        const [employees] = await db.execute(
            `SELECT id, custom_id, name, email, phone, department, role, status 
             FROM employees 
             WHERE company_id = ? AND status = 'active'
             ORDER BY name ASC`,
            [companyId]
        );

        // Fetch distinct departments
        const departments = [...new Set(employees.map(e => e.department).filter(Boolean))];

        // Fetch WhatsApp status
        const waStatus = await whatsappService.getStatus(companyId);

        // Fetch Email settings status
        const [emailSettings] = await db.execute(
            `SELECT is_active, sender_email, sender_name FROM company_email_settings WHERE company_id = ? LIMIT 1`,
            [companyId]
        );

        res.json({
            success: true,
            employees,
            departments,
            channels: {
                whatsapp: {
                    connected: waStatus.status === 'CONNECTED' || !!waStatus.connected,
                    phoneNumber: waStatus.phone_number || waStatus.phoneNumber,
                    status: waStatus.status
                },
                email: {
                    configured: emailSettings.length > 0 && !!emailSettings[0].is_active,
                    senderEmail: emailSettings[0]?.sender_email || 'System Default',
                    senderName: emailSettings[0]?.sender_name || 'HRM Software'
                }
            }
        });
    } catch (err) {
        console.error('[Messaging] getRecipientsData error:', err);
        res.status(500).json({ error: err.message });
    }
};

/**
 * Send Announcement or Direct Personal Message
 */
exports.sendMessage = async (req, res) => {
    try {
        const companyId = req.user.company_id;
        const senderId = req.user.id;
        const senderName = req.user.name || 'Company Admin';

        const {
            message_type = 'broadcast', // 'broadcast' | 'personal'
            channels = 'both',          // 'whatsapp' | 'email' | 'both'
            target_audience = 'all',    // 'all' | 'department' | 'selected' | 'individual'
            target_department = null,
            target_employee_ids = [],   // Array of employee IDs
            subject,
            message_text,
            priority = 'normal'        // 'normal' | 'important' | 'urgent'
        } = req.body;

        if (!subject || !subject.trim()) {
            return res.status(400).json({ error: 'Message title/subject is required.' });
        }
        if (!message_text || !message_text.trim()) {
            return res.status(400).json({ error: 'Message content is required.' });
        }

        // 1. Fetch Company Name
        const [companies] = await db.execute('SELECT company_name FROM companies WHERE id = ? LIMIT 1', [companyId]);
        const companyName = companies[0]?.company_name || 'Our Company';

        // 2. Fetch Targeted Employees
        let targetEmployees = [];
        if (target_audience === 'all') {
            const [rows] = await db.execute(
                `SELECT id, name, email, phone, department, role FROM employees WHERE company_id = ? AND status = 'active'`,
                [companyId]
            );
            targetEmployees = rows;
        } else if (target_audience === 'department' && target_department) {
            const [rows] = await db.execute(
                `SELECT id, name, email, phone, department, role FROM employees WHERE company_id = ? AND department = ? AND status = 'active'`,
                [companyId, target_department]
            );
            targetEmployees = rows;
        } else if ((target_audience === 'selected' || target_audience === 'individual') && Array.isArray(target_employee_ids) && target_employee_ids.length > 0) {
            const placeholders = target_employee_ids.map(() => '?').join(',');
            const [rows] = await db.execute(
                `SELECT id, name, email, phone, department, role FROM employees WHERE company_id = ? AND id IN (${placeholders}) AND status = 'active'`,
                [companyId, ...target_employee_ids]
            );
            targetEmployees = rows;
        }

        if (targetEmployees.length === 0) {
            return res.status(400).json({ error: 'No active employees match the selected criteria.' });
        }

        // 3. Prepare Email Transporter
        const shouldSendEmail = channels === 'email' || channels === 'both';
        const shouldSendWhatsApp = channels === 'whatsapp' || channels === 'both';

        let emailTransporterConfig = null;
        if (shouldSendEmail) {
            emailTransporterConfig = await getCompanyEmailTransporter(companyId);
        }

        let emailSentCount = 0;
        let emailFailedCount = 0;
        let whatsappSentCount = 0;
        let whatsappFailedCount = 0;

        const priorityEmoji = priority === 'urgent' ? '🚨' : (priority === 'important' ? '⚠️' : '📢');
        const priorityColor = priority === 'urgent' ? '#ef4444' : (priority === 'important' ? '#f59e0b' : '#3b82f6');
        const priorityBg = priority === 'urgent' ? '#fee2e2' : (priority === 'important' ? '#fef3c7' : '#dbeafe');
        const priorityBadgeText = priority === 'urgent' ? 'URGENT' : (priority === 'important' ? 'IMPORTANT' : 'NOTICE');

        // 4. Dispatch Messages to Each Target
        for (const emp of targetEmployees) {
            // Personalize template tags
            const personalizedBody = message_text
                .replace(/{name}/g, emp.name)
                .replace(/{company}/g, companyName)
                .replace(/{department}/g, emp.department || '');

            // --- A. EMAIL CHANNEL ---
            if (shouldSendEmail) {
                if (emp.email && emp.email.includes('@')) {
                    try {
                        const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${subject}</title>
    <style>
        body { margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; }
        .wrapper { max-width: 600px; margin: 24px auto; background: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px rgba(0,0,0,0.05); }
        .header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 32px 28px; text-align: left; }
        .logo-title { font-size: 20px; font-weight: 900; color: #ffffff; margin: 0; letter-spacing: -0.5px; }
        .company-subtitle { font-size: 12px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-top: 4px; }
        .badge { display: inline-block; padding: 4px 12px; background: ${priorityBg}; color: ${priorityColor}; font-size: 10px; font-weight: 900; border-radius: 20px; text-transform: uppercase; letter-spacing: 1px; margin-top: 14px; }
        .content { padding: 32px 28px; }
        .greeting { font-size: 16px; font-weight: 800; color: #0f172a; margin-top: 0; margin-bottom: 16px; }
        .message-box { background: #f8fafc; border-left: 4px solid ${priorityColor}; border-radius: 12px; padding: 20px; margin: 20px 0; font-size: 14px; line-height: 1.7; color: #334155; white-space: pre-line; }
        .footer { background: #f8fafc; padding: 20px 28px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
    </style>
</head>
<body>
    <div class="wrapper">
        <div class="header">
            <div class="logo-title">${priorityEmoji} ${companyName}</div>
            <div class="company-subtitle">${message_type === 'broadcast' ? 'Official Company Announcement' : 'Direct Message'}</div>
            <div class="badge">${priorityBadgeText}</div>
        </div>
        <div class="content">
            <h2 class="greeting">Hello ${emp.name},</h2>
            <h3 style="font-size: 17px; font-weight: 800; color: #0f172a; margin: 0 0 8px 0;">${subject}</h3>
            <div class="message-box">${personalizedBody}</div>
            <p style="font-size: 12px; color: #64748b; margin-top: 24px;">Sent by ${senderName} • ${companyName}</p>
        </div>
        <div class="footer">
            &copy; ${new Date().getFullYear()} ${companyName}. HRM Software Automated Communication.
        </div>
    </div>
</body>
</html>
                        `;

                        if (emailTransporterConfig) {
                            await emailTransporterConfig.transporter.sendMail({
                                from: `"${emailTransporterConfig.senderName}" <${emailTransporterConfig.senderEmail}>`,
                                to: emp.email,
                                subject: `${priorityEmoji} ${subject} - ${companyName}`,
                                html: emailHtml,
                                text: personalizedBody
                            });
                            emailSentCount++;
                        } else {
                            const sent = await sendSystemEmail({
                                to: emp.email,
                                toName: emp.name,
                                subject: `${priorityEmoji} ${subject} - ${companyName}`,
                                htmlContent: emailHtml,
                                textContent: personalizedBody
                            });
                            if (sent) emailSentCount++;
                            else emailFailedCount++;
                        }
                    } catch (mailErr) {
                        console.error(`[Messaging] Email failed for ${emp.email}:`, mailErr.message);
                        emailFailedCount++;
                    }
                } else {
                    emailFailedCount++;
                }
            }

            // --- B. WHATSAPP CHANNEL ---
            if (shouldSendWhatsApp) {
                if (emp.phone) {
                    const waText = 
`${priorityEmoji} *${companyName}*
*${subject}*
📌 Priority: *${priorityBadgeText}*

Hello *${emp.name}*,

${personalizedBody}

──────────────────
_Sent by ${senderName} • ${companyName}_`;

                    const waRes = await whatsappService.sendMessage(companyId, emp.phone, waText, {
                        recipientName: emp.name,
                        recipientRole: 'employee',
                        eventType: message_type === 'broadcast' ? 'ANNOUNCEMENT' : 'DIRECT_MESSAGE'
                    });

                    if (waRes.success) {
                        whatsappSentCount++;
                    } else {
                        whatsappFailedCount++;
                    }
                } else {
                    whatsappFailedCount++;
                }
            }
        }

        // 5. Store in broadcast_messages table
        const targetEmployeeName = targetEmployees.length === 1 ? targetEmployees[0].name : `${targetEmployees.length} Employees`;
        const targetEmployeeId = targetEmployees.length === 1 ? targetEmployees[0].id : null;

        await db.execute(
            `INSERT INTO broadcast_messages 
             (company_id, sender_id, sender_name, message_type, channels, target_audience, target_department, target_employee_id, target_employee_name, subject, message_text, priority, total_recipients, email_sent_count, email_failed_count, whatsapp_sent_count, whatsapp_failed_count, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED')`,
            [
                companyId,
                senderId,
                senderName,
                message_type,
                channels,
                target_audience,
                target_department || null,
                targetEmployeeId,
                targetEmployeeName,
                subject,
                message_text,
                priority,
                targetEmployees.length,
                emailSentCount,
                emailFailedCount,
                whatsappSentCount,
                whatsappFailedCount
            ]
        );

        // 6. Record in Audit Logs
        await logAction(
            senderId,
            message_type === 'broadcast' ? 'DISPATCH_ANNOUNCEMENT' : 'SEND_DIRECT_MESSAGE',
            targetEmployeeId,
            {
                subject,
                channels,
                target_audience,
                target_department,
                recipients: targetEmployees.length,
                email_sent: emailSentCount,
                whatsapp_sent: whatsappSentCount
            },
            companyId
        );

        res.json({
            success: true,
            message: 'Messages dispatched successfully!',
            stats: {
                totalRecipients: targetEmployees.length,
                emailSent: emailSentCount,
                emailFailed: emailFailedCount,
                whatsappSent: whatsappSentCount,
                whatsappFailed: whatsappFailedCount
            }
        });
    } catch (err) {
        console.error('[Messaging] sendMessage error:', err);
        res.status(500).json({ error: err.message });
    }
};

/**
 * Get past announcements and messages history
 */
exports.getHistory = async (req, res) => {
    try {
        const companyId = req.user.company_id;
        const [rows] = await db.execute(
            `SELECT * FROM broadcast_messages 
             WHERE company_id = ? 
             ORDER BY created_at DESC 
             LIMIT 50`,
            [companyId]
        );
        res.json({ success: true, history: rows });
    } catch (err) {
        console.error('[Messaging] getHistory error:', err);
        res.status(500).json({ error: err.message });
    }
};
