const fs = require('fs');
const path = require('path');
const db = require('../config/db');
const mysqldump = require('mysqldump');
const nodemailer = require('nodemailer');
const { decrypt } = require('../utils/cryptoUtils');
const { sendSystemEmail } = require('../utils/emailService');

const backupsDir = path.join(__dirname, '..', 'backups');
if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
}

/**
 * Get Basic Backup Info & Admin Details
 */
exports.getBackupStats = async (req, res) => {
    try {
        const [userRows] = await db.execute('SELECT id, name, email, role FROM users WHERE id = ?', [req.user.id]);
        const adminUser = userRows[0] || {};

        let lastBackupDate = null;
        if (fs.existsSync(backupsDir)) {
            const files = fs.readdirSync(backupsDir);
            if (files.length > 0) {
                const latestFile = files
                    .map(f => ({ name: f, time: fs.statSync(path.join(backupsDir, f)).mtime }))
                    .sort((a, b) => new Date(b.time) - new Date(a.time))[0];
                lastBackupDate = latestFile ? latestFile.time : null;
            }
        }

        res.json({
            success: true,
            admin: {
                name: adminUser.name || 'Admin',
                email: adminUser.email || req.user.email || '',
                role: adminUser.role || 'admin'
            },
            lastBackup: lastBackupDate
        });
    } catch (err) {
        console.error('Error in getBackupStats:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch backup info', error: err.message });
    }
};

/**
 * Helper to export database to .sql (Supports full or custom date range)
 */
async function exportDatabaseSql({ startDate, endDate, tempFilePath }) {
    if (!startDate && !endDate) {
        try {
            await mysqldump({
                connection: {
                    host: process.env.DB_HOST || 'localhost',
                    user: process.env.DB_USER || 'root',
                    password: process.env.DB_PASSWORD || '',
                    database: process.env.DB_NAME || 'hrm-saas-kiaan',
                    port: parseInt(process.env.DB_PORT) || 3306
                },
                dumpToFile: tempFilePath,
            });
            return;
        } catch (e) {
            console.warn('mysqldump failed, using JS SQL dump generator...', e.message);
        }
    }

    const tables = [
        'companies', 'users', 'employees', 'settings', 'global_settings', 
        'geofences', 'kpis', 'public_holidays', 'company_email_settings', 
        'company_backup_schedules', 'attendance', 'payroll', 'leaves', 'claims'
    ];

    let sqlOutput = `-- Nexus HRM Pro Database Backup\n`;
    if (startDate && endDate) {
        sqlOutput += `-- Filter: Custom Date Range (${startDate} to ${endDate})\n`;
    } else {
        sqlOutput += `-- Scope: Full Historical Database Snapshot\n`;
    }
    sqlOutput += `-- Generated on: ${new Date().toISOString()}\n\n`;

    for (const table of tables) {
        try {
            let query = `SELECT * FROM \`${table}\``;
            let params = [];

            if (startDate && endDate) {
                if (table === 'attendance') {
                    query = `SELECT * FROM \`attendance\` WHERE (date BETWEEN ? AND ?) OR (created_at BETWEEN ? AND ?)`;
                    params = [startDate, endDate, `${startDate} 00:00:00`, `${endDate} 23:59:59`];
                } else if (table === 'payroll') {
                    query = `SELECT * FROM \`payroll\` WHERE (cycle_start <= ? AND cycle_end >= ?) OR (created_at BETWEEN ? AND ?)`;
                    params = [endDate, startDate, `${startDate} 00:00:00`, `${endDate} 23:59:59`];
                } else if (table === 'leaves') {
                    query = `SELECT * FROM \`leaves\` WHERE (start_date <= ? AND end_date >= ?) OR (created_at BETWEEN ? AND ?)`;
                    params = [endDate, startDate, `${startDate} 00:00:00`, `${endDate} 23:59:59`];
                } else if (table === 'claims') {
                    query = `SELECT * FROM \`claims\` WHERE (expense_date BETWEEN ? AND ?) OR (created_at BETWEEN ? AND ?)`;
                    params = [startDate, endDate, `${startDate} 00:00:00`, `${endDate} 23:59:59`];
                }
            }

            const [rows] = await db.execute(query, params);
            if (rows.length > 0) {
                sqlOutput += `-- Table: ${table} (${rows.length} rows)\n`;
                const keys = Object.keys(rows[0]);
                const colsList = keys.map(k => `\`${k}\``).join(', ');
                for (const row of rows) {
                    const vals = keys.map(k => {
                        const val = row[k];
                        if (val === null || val === undefined) return 'NULL';
                        if (typeof val === 'number') return val;
                        if (typeof val === 'boolean') return val ? 1 : 0;
                        if (val instanceof Date) return `'${val.toISOString().slice(0, 19).replace('T', ' ')}'`;
                        return `'${String(val).replace(/'/g, "''").replace(/\\/g, '\\\\')}'`;
                    }).join(', ');
                    sqlOutput += `INSERT INTO \`${table}\` (${colsList}) VALUES (${vals});\n`;
                }
                sqlOutput += '\n';
            }
        } catch (tErr) {}
    }

    fs.writeFileSync(tempFilePath, sqlOutput, 'utf8');
}

/**
 * Generate Full Database Backup (.sql) (Supports Custom Date Range)
 * Option to download directly or send to entered email
 */
exports.generateBackup = async (req, res) => {
    const { email, sendToEmail, startDate, endDate } = req.body || {};
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const hasDateRange = startDate && endDate;
    const filename = hasDateRange 
        ? `nexus_hrm_backup_${startDate}_to_${endDate}_${timestamp}.sql` 
        : `nexus_hrm_backup_${timestamp}.sql`;
    const tempFilePath = path.join(backupsDir, filename);

    try {
        console.log(`📦 Generating Database Backup (${hasDateRange ? `${startDate} to ${endDate}` : 'Full'}): ${filename}...`);
        await exportDatabaseSql({ startDate, endDate, tempFilePath });

        // If email delivery is requested
        const targetEmail = email || req.user.email;
        if (sendToEmail && targetEmail) {
            try {
                const fileContent = fs.readFileSync(tempFilePath);
                const companyId = req.user.company_id || req.user.id;
                const [smtpRows] = await db.execute(
                    'SELECT * FROM company_email_settings WHERE company_id = ? AND is_active = 1 LIMIT 1',
                    [companyId]
                );

                const backupHtml = `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background: #ffffff;">
                        <div style="background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 24px; border-radius: 12px; text-align: center; color: white;">
                            <h2 style="margin: 0; font-size: 20px; font-weight: 800; letter-spacing: 0.5px;">📦 HRM Software Pro System Backup</h2>
                            <p style="margin: 6px 0 0 0; opacity: 0.9; font-size: 13px;">${hasDateRange ? `Date Range: ${startDate} to ${endDate}` : 'Full Database Snapshot'}</p>
                        </div>
                        <div style="padding: 24px 8px 8px 8px; color: #334155; font-size: 14px; line-height: 1.6;">
                            <p>Hello <strong>${req.user.name || 'Admin'}</strong>,</p>
                            <p>Your requested database backup file has been generated and is attached to this email.</p>
                            <table style="width: 100%; border-collapse: collapse; margin: 18px 0; background: #f8fafc; border-radius: 10px; font-size: 13px;">
                                <tr><td style="padding: 12px; font-weight: bold; border-bottom: 1px solid #e2e8f0; color: #64748b;">File:</td><td style="padding: 12px; border-bottom: 1px solid #e2e8f0; font-family: monospace; color: #4f46e5; font-weight: bold;">${filename}</td></tr>
                                <tr><td style="padding: 12px; font-weight: bold; border-bottom: 1px solid #e2e8f0; color: #64748b;">Scope:</td><td style="padding: 12px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">${hasDateRange ? `${startDate} to ${endDate}` : 'All Time (Full Database)'}</td></tr>
                                <tr><td style="padding: 12px; font-weight: bold; color: #64748b;">Generated At:</td><td style="padding: 12px; font-weight: bold; color: #0f172a;">${new Date().toLocaleString()}</td></tr>
                            </table>
                            <p style="color: #64748b; font-size: 12px;">🛡️ Please keep this backup secure for disaster recovery purposes.</p>
                        </div>
                    </div>
                `;

                if (smtpRows.length > 0) {
                    const s = smtpRows[0];
                    const password = decrypt(s.smtp_pass);
                    const transporter = nodemailer.createTransport({
                        host: s.smtp_host,
                        port: parseInt(s.smtp_port),
                        secure: parseInt(s.smtp_port) === 465,
                        auth: {
                            user: s.smtp_user,
                            pass: password,
                        }
                    });

                    await transporter.sendMail({
                        from: `"${s.sender_name || 'HR Department'}" <${s.sender_email || s.smtp_user}>`,
                        to: targetEmail,
                        subject: `📦 HRM Software Pro - Database Backup (${new Date().toLocaleDateString()})`,
                        html: backupHtml,
                        attachments: [
                            {
                                filename,
                                content: fileContent
                            }
                        ]
                    });
                    console.log(`📧 [Company SMTP] Backup copy sent to: ${targetEmail}`);
                } else {
                    await sendSystemEmail({
                        to: targetEmail,
                        toName: req.user.name || 'Admin',
                        subject: `📦 HRM Software Pro - Database Backup (${new Date().toLocaleDateString()})`,
                        htmlContent: backupHtml,
                        attachments: [
                            {
                                filename,
                                content: fileContent
                            }
                        ]
                    });
                    console.log(`📧 [System SMTP] Backup copy sent to: ${targetEmail}`);
                }
            } catch (mailErr) {
                console.warn('Could not send backup email (download will still work):', mailErr.message);
            }
        }

        res.download(tempFilePath, filename, (err) => {
            if (err) console.error('Download stream error:', err);
        });
    } catch (err) {
        console.error('❌ Backup generation failed:', err);
        res.status(500).json({ success: false, message: 'Database backup failed', error: err.message });
    }
};

/**
 * Restore Database from uploaded Backup file (.sql or .json)
 */
exports.restoreBackup = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No backup file uploaded. Please upload a .sql or .json file.' });
        }

        const filePath = req.file.path;
        const ext = path.extname(req.file.originalname).toLowerCase();
        console.log(`🔄 Processing Database Restore from: ${req.file.originalname} (${ext})`);

        if (ext === '.sql') {
            const sqlContent = fs.readFileSync(filePath, 'utf8');
            // Split SQL queries safely
            const queries = sqlContent
                .replace(/--.*$/gm, '') // Remove single-line comments
                .replace(/\/\*[\s\S]*?\*\//gm, '') // Remove multi-line comments
                .split(/;\s*[\r\n]+/)
                .map(q => q.trim())
                .filter(q => q.length > 0 && !q.startsWith('/*') && !q.startsWith('--'));

            console.log(`Executing ${queries.length} queries for SQL restore...`);

            const totalStatements = queries.length;
            let executedStatements = 0;
            let skippedStatements = 0;

            await db.execute('SET FOREIGN_KEY_CHECKS = 0');
            for (const q of queries) {
                try {
                    await db.execute(q);
                    executedStatements++;
                } catch (qErr) {
                    skippedStatements++;
                    console.warn('Skipped non-fatal statement during restore:', qErr.message.slice(0, 100));
                }
            }
            await db.execute('SET FOREIGN_KEY_CHECKS = 1');

            // 1. Record restore execution statistics
            const restoreStats = {
                totalStatements,
                executedStatements,
                skippedStatements,
                isComplete: skippedStatements === 0
            };

            // 2. Cleanup uploaded file safely
            try { fs.unlinkSync(filePath); } catch (e) {}

            // 3, 4, 5. Invalidate local cache, execute dual-vault reconciliation, classify result
            const license = await reconcileLicenseAfterRestore(req.app);

            // 6. Return response with existing success & message plus restoreStats & license
            return res.json({
                success: true,
                message: constructRestoreMessage(req.file.originalname, restoreStats, license),
                restoreStats,
                license
            });
        } else if (ext === '.json') {
            const jsonContent = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            const data = jsonContent.data || jsonContent;

            let totalStatements = 0;
            let executedStatements = 0;
            let skippedStatements = 0;

            await db.execute('SET FOREIGN_KEY_CHECKS = 0');
            for (const table of Object.keys(data)) {
                const rows = data[table];
                if (Array.isArray(rows) && rows.length > 0) {
                    for (const row of rows) {
                        totalStatements++;
                        const keys = Object.keys(row);
                        const cols = keys.map(k => `\`${k}\``).join(', ');
                        const placeholders = keys.map(() => '?').join(', ');
                        const values = keys.map(k => row[k]);
                        const updateClause = keys.map(k => `\`${k}\`=VALUES(\`${k}\`)`).join(', ');

                        const sql = `INSERT INTO \`${table}\` (${cols}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updateClause}`;
                        try {
                            await db.execute(sql, values);
                            executedStatements++;
                        } catch (rErr) {
                            skippedStatements++;
                        }
                    }
                }
            }
            await db.execute('SET FOREIGN_KEY_CHECKS = 1');

            const restoreStats = {
                totalStatements,
                executedStatements,
                skippedStatements,
                isComplete: skippedStatements === 0
            };

            try { fs.unlinkSync(filePath); } catch (e) {}

            const license = await reconcileLicenseAfterRestore(req.app);

            return res.json({
                success: true,
                message: constructRestoreMessage(req.file.originalname, restoreStats, license),
                restoreStats,
                license
            });
        } else {
            try { fs.unlinkSync(filePath); } catch (e) {}
            return res.status(400).json({ success: false, message: 'Invalid file format. Please upload a .sql or .json file.' });
        }
    } catch (err) {
        console.error('❌ Restore failed:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Database restore failed', 
            error: err.message,
            license: {
                status: 'RESTORE_FAILED',
                valid: false
            }
        });
    }
};

/**
 * Phase 2B.5H.3 — Post-Restore Dual-Vault License Reconciliation & Cache Invalidation
 *
 * Sequence:
 * 1. Retrieves existing cache and adapters from req.app (Express settings).
 * 2. Invalidates the in-process license cache.
 * 3. Invokes vaultEngine.reconcileVaults with autoHeal: true.
 * 4. Classifies result into standardized, sanitized status without leaking sensitive keys/envelopes.
 *
 * Note on Multi-Worker Limitation:
 * In-process invalidation clears the cache for the current worker process immediately.
 * In a multi-worker cluster (e.g. PM2), other worker processes will retain their cached
 * state until their local TTL (30s) expires.
 *
 * @param {import('express').Application} app Express application instance
 * @returns {Promise<object>} Sanitized license reconciliation outcome
 */
async function reconcileLicenseAfterRestore(app) {
    const licenseCache = app?.get('licenseCache');
    const licenseVault = app?.get('licenseVault');

    if (!licenseCache || !licenseVault || !licenseVault.primaryAdapter || !licenseVault.mirrorAdapter) {
        return {
            status: 'RESTORE_COMPLETED_LICENSE_HEALTHY',
            valid: true,
            note: 'Licensing subsystem not attached to application'
        };
    }

    try {
        // Step 1: Invalidate in-process license cache immediately
        licenseCache.invalidate();

        // Step 2: Invoke existing vaultEngine.reconcileVaults with autoHeal: true
        const { reconcileVaults, VaultStatus } = require('../kiaan-license/core/vaultEngine');
        const { licenseConfig } = require('../kiaan-license/config/licenseConfig');

        const reconcResult = await reconcileVaults({
            primaryAdapter: licenseVault.primaryAdapter,
            mirrorAdapter: licenseVault.mirrorAdapter,
            keystore: licenseConfig.keystore,
            options: { autoHeal: true }
        });

        // Step 3: Classify result
        const status = reconcResult.status;
        const seq = reconcResult.authoritative?.payload?.sequence_number || null;

        if (status === VaultStatus.HEALTHY) {
            return {
                status: 'RESTORE_COMPLETED_LICENSE_HEALTHY',
                valid: true,
                sequenceNumber: seq
            };
        }

        if (status === VaultStatus.RECONCILED || status === VaultStatus.SELF_HEALED || status === VaultStatus.RECOVERED) {
            return {
                status: 'RESTORE_COMPLETED_LICENSE_REPAIRED',
                valid: true,
                sequenceNumber: seq,
                action: reconcResult.healTarget ? `HEALED_${reconcResult.healTarget.toUpperCase()}` : 'RECONCILED'
            };
        }

        if (status === VaultStatus.DEGRADED_CONFLICT) {
            return {
                status: 'RESTORE_COMPLETED_LICENSE_CONFLICT',
                valid: false,
                warning: 'License conflict detected across database and filesystem vaults. Superadmin recovery required.'
            };
        }

        if (status === VaultStatus.UNLICENSED) {
            return {
                status: 'RESTORE_COMPLETED_LICENSE_UNLICENSED',
                valid: false,
                warning: 'No license installed. System is unlicensed.'
            };
        }

        // VaultStatus.CORRUPTED
        return {
            status: 'RESTORE_COMPLETED_LICENSE_CORRUPTED',
            valid: false,
            warning: 'License data failed cryptographic verification or is corrupted.'
        };
    } catch (err) {
        console.error('❌ Post-restore license reconciliation failed:', err.message);
        return {
            status: 'RESTORE_COMPLETED_LICENSE_STORAGE_ERROR',
            valid: false,
            error: 'Storage error during post-restore license verification'
        };
    }
}

/**
 * Constructs an informative, backward-compatible restore completion message.
 *
 * @param {string} filename Original backup filename
 * @param {object} restoreStats { totalStatements, executedStatements, skippedStatements, isComplete }
 * @param {object} license Sanitized license reconciliation outcome
 * @returns {string} Human-readable message
 */
function constructRestoreMessage(filename, restoreStats, license) {
    if (!restoreStats.isComplete) {
        return `Database restored with warnings from ${filename} (${restoreStats.executedStatements} of ${restoreStats.totalStatements} statements executed, ${restoreStats.skippedStatements} skipped). Possible incomplete data restoration.`;
    }

    if (license?.status === 'RESTORE_COMPLETED_LICENSE_CONFLICT') {
        return `Database restored successfully from ${filename} (${restoreStats.executedStatements} statements executed), but a license conflict was detected. Superadmin resolution required.`;
    }

    if (license?.status === 'RESTORE_COMPLETED_LICENSE_STORAGE_ERROR') {
        return `Database restored successfully from ${filename} (${restoreStats.executedStatements} statements executed). Storage unavailable during license check.`;
    }

    if (license?.status === 'RESTORE_COMPLETED_LICENSE_REPAIRED') {
        return `Database restored successfully from ${filename} (${restoreStats.executedStatements} statements executed). License reconciled successfully.`;
    }

    if (license?.status === 'RESTORE_COMPLETED_LICENSE_UNLICENSED') {
        return `Database restored successfully from ${filename} (${restoreStats.executedStatements} statements executed). System is unlicensed.`;
    }

    if (license?.status === 'RESTORE_COMPLETED_LICENSE_CORRUPTED') {
        return `Database restored successfully from ${filename} (${restoreStats.executedStatements} statements executed). License data in vault is corrupted.`;
    }

    return `Database restored successfully from ${filename} (${restoreStats.executedStatements} statements executed).`;
}

exports.reconcileLicenseAfterRestore = reconcileLicenseAfterRestore;

/**
 * Send Database Backup directly to a target email (Supports Custom Date Range)
 */
exports.sendBackupToEmail = async (req, res) => {
    const { email, startDate, endDate } = req.body || {};
    const targetEmail = email || req.user.email;
    if (!targetEmail) {
        return res.status(400).json({ success: false, message: 'Recipient email address is required.' });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const hasDateRange = startDate && endDate;
    const filename = hasDateRange 
        ? `nexus_hrm_backup_${startDate}_to_${endDate}_${timestamp}.sql` 
        : `nexus_hrm_backup_${timestamp}.sql`;
    const tempFilePath = path.join(backupsDir, filename);

    try {
        console.log(`📦 Generating Database Backup for Email Delivery to ${targetEmail}: ${filename}...`);
        await exportDatabaseSql({ startDate, endDate, tempFilePath });

        const fileContent = fs.readFileSync(tempFilePath);
        const companyId = req.user.company_id || req.user.id;
        const [smtpRows] = await db.execute(
            'SELECT * FROM company_email_settings WHERE company_id = ? AND is_active = 1 LIMIT 1',
            [companyId]
        );

        let emailSent = false;
        let errorMessage = '';

        const backupHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background: #ffffff;">
                <div style="background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 24px; border-radius: 12px; text-align: center; color: white;">
                    <h2 style="margin: 0; font-size: 20px; font-weight: 800; letter-spacing: 0.5px;">📦 HRM Software Pro System Backup</h2>
                    <p style="margin: 6px 0 0 0; opacity: 0.9; font-size: 13px;">${hasDateRange ? `Date Range: ${startDate} to ${endDate}` : 'Full Database Snapshot'}</p>
                </div>
                <div style="padding: 24px 8px 8px 8px; color: #334155; font-size: 14px; line-height: 1.6;">
                    <p>Hello <strong>${req.user.name || 'Admin'}</strong>,</p>
                    <p>Your requested database backup file has been generated and is attached to this email.</p>
                    <table style="width: 100%; border-collapse: collapse; margin: 18px 0; background: #f8fafc; border-radius: 10px; font-size: 13px;">
                        <tr><td style="padding: 12px; font-weight: bold; border-bottom: 1px solid #e2e8f0; color: #64748b;">File:</td><td style="padding: 12px; border-bottom: 1px solid #e2e8f0; font-family: monospace; color: #4f46e5; font-weight: bold;">${filename}</td></tr>
                        <tr><td style="padding: 12px; font-weight: bold; border-bottom: 1px solid #e2e8f0; color: #64748b;">Scope:</td><td style="padding: 12px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">${hasDateRange ? `${startDate} to ${endDate}` : 'All Time (Full Database)'}</td></tr>
                        <tr><td style="padding: 12px; font-weight: bold; color: #64748b;">Generated At:</td><td style="padding: 12px; font-weight: bold; color: #0f172a;">${new Date().toLocaleString()}</td></tr>
                    </table>
                    <p style="color: #64748b; font-size: 12px;">🛡️ Please keep this backup secure for disaster recovery purposes.</p>
                </div>
            </div>
        `;

        if (smtpRows.length > 0) {
            const s = smtpRows[0];
            try {
                const password = decrypt(s.smtp_pass);
                const transporter = nodemailer.createTransport({
                    host: s.smtp_host,
                    port: parseInt(s.smtp_port),
                    secure: parseInt(s.smtp_port) === 465,
                    auth: {
                        user: s.smtp_user,
                        pass: password,
                    }
                });

                await transporter.sendMail({
                    from: `"${s.sender_name || 'HR Department'}" <${s.sender_email || s.smtp_user}>`,
                    to: targetEmail,
                    subject: `📦 HRM Software Pro - Database Backup (${new Date().toLocaleDateString()})`,
                    html: backupHtml,
                    attachments: [
                        {
                            filename,
                            content: fileContent
                        }
                    ]
                });
                console.log(`📧 [Company SMTP] Backup email delivered to ${targetEmail} via ${s.smtp_user}`);
                emailSent = true;
            } catch (smtpErr) {
                console.error(`❌ [Company SMTP] Failed to send backup to ${targetEmail}:`, smtpErr.message);
                errorMessage = `SMTP Error (${s.smtp_host}): ${smtpErr.message}`;
            }
        } else {
            // Fallback to system-level sender if no company SMTP is configured
            try {
                const sysRes = await sendSystemEmail({
                    to: targetEmail,
                    toName: req.user.name || 'Administrator',
                    subject: `📦 HRM Software Pro - Database Backup (${new Date().toLocaleDateString()})`,
                    htmlContent: backupHtml,
                    attachments: [
                        {
                            filename,
                            content: fileContent
                        }
                    ]
                });
                emailSent = !!sysRes;
            } catch (sysErr) {
                errorMessage = sysErr.message;
            }
        }

        if (emailSent) {
            return res.json({ success: true, message: `Database backup file (${filename}) has been sent to ${targetEmail} successfully!` });
        } else {
            return res.status(400).json({ 
                success: false, 
                message: errorMessage ? `Backup email delivery failed: ${errorMessage}` : 'Backup file generated, but email delivery failed. Please verify SMTP credentials in Settings > Email SMTP.' 
            });
        }
    } catch (err) {
        console.error('❌ Send backup to email error:', err);
        return res.status(500).json({ success: false, message: 'Failed to send backup via email: ' + err.message });
    }
};

// Ensure company_backup_schedules table exists
(async () => {
    try {
        await db.execute(`
            CREATE TABLE IF NOT EXISTS company_backup_schedules (
                id INT AUTO_INCREMENT PRIMARY KEY,
                company_id INT NOT NULL UNIQUE,
                is_enabled TINYINT(1) DEFAULT 1,
                frequency_days INT DEFAULT 7,
                target_email VARCHAR(255) DEFAULT '',
                last_run_at DATETIME DEFAULT NULL,
                next_run_at DATETIME DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
    } catch (e) {
        console.warn('Could not init company_backup_schedules table:', e.message);
    }
})();

/**
 * Get Automated Backup Schedule
 */
exports.getBackupSchedule = async (req, res) => {
    try {
        const companyId = req.user.company_id || req.user.id;
        const [rows] = await db.execute('SELECT * FROM company_backup_schedules WHERE company_id = ?', [companyId]);
        
        if (rows.length === 0) {
            return res.json({
                success: true,
                schedule: {
                    is_enabled: 1,
                    frequency_days: 7,
                    target_email: req.user.email || '',
                    last_run_at: null,
                    next_run_at: null
                }
            });
        }

        res.json({
            success: true,
            schedule: rows[0]
        });
    } catch (err) {
        console.error('Error in getBackupSchedule:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch backup schedule', error: err.message });
    }
};

/**
 * Save / Update Automated Backup Schedule
 */
exports.saveBackupSchedule = async (req, res) => {
    try {
        const companyId = req.user.company_id || req.user.id;
        const { is_enabled, frequency_days, target_email } = req.body;

        const freq = parseInt(frequency_days) || 7;
        const enabled = is_enabled ? 1 : 0;
        const email = target_email || req.user.email || '';

        const [existing] = await db.execute('SELECT * FROM company_backup_schedules WHERE company_id = ?', [companyId]);

        if (existing.length > 0) {
            await db.execute(
                `UPDATE company_backup_schedules 
                 SET is_enabled = ?, frequency_days = ?, target_email = ?, next_run_at = DATE_ADD(IFNULL(last_run_at, NOW()), INTERVAL ? DAY), updated_at = NOW() 
                 WHERE company_id = ?`,
                [enabled, freq, email, freq, companyId]
            );
        } else {
            await db.execute(
                `INSERT INTO company_backup_schedules 
                 (company_id, is_enabled, frequency_days, target_email, next_run_at) 
                 VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? DAY))`,
                [companyId, enabled, freq, email, freq]
            );
        }

        res.json({ 
            success: true, 
            message: `Automatic backup schedule saved! System will automatically create & email complete backups every ${freq} days.` 
        });
    } catch (err) {
        console.error('Error in saveBackupSchedule:', err);
        res.status(500).json({ success: false, message: 'Failed to save backup schedule', error: err.message });
    }
};

/**
 * Background Automatic Backup Runner (Checks every hour)
 */
async function runScheduledAutoBackups() {
    try {
        const [schedules] = await db.execute(`
            SELECT s.*, u.name as admin_name 
            FROM company_backup_schedules s
            LEFT JOIN users u ON (u.company_id = s.company_id OR u.id = s.company_id) AND u.role IN ('admin', 'MasterAdmin')
            WHERE s.is_enabled = 1 
              AND (s.last_run_at IS NULL OR TIMESTAMPDIFF(DAY, s.last_run_at, NOW()) >= s.frequency_days)
            GROUP BY s.company_id
        `);

        if (!schedules || schedules.length === 0) return;

        for (const sched of schedules) {
            try {
                const targetEmail = sched.target_email;
                if (!targetEmail || !targetEmail.includes('@')) continue;

                console.log(`⏰ [Auto-Backup Scheduler] Creating ${sched.frequency_days}-day automated backup for company ${sched.company_id} to ${targetEmail}...`);

                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const filename = `nexus_hrm_auto_backup_${sched.frequency_days}d_${timestamp}.sql`;
                const tempFilePath = path.join(backupsDir, filename);

                // Dump database
                try {
                    await mysqldump({
                        connection: {
                            host: process.env.DB_HOST || 'localhost',
                            user: process.env.DB_USER || 'root',
                            password: process.env.DB_PASSWORD || '',
                            database: process.env.DB_NAME || 'hrm-saas-kiaan',
                            port: parseInt(process.env.DB_PORT) || 3306
                        },
                        dumpToFile: tempFilePath,
                    });
                } catch (e) {
                    const tables = ['companies', 'users', 'employees', 'attendance', 'payroll', 'leaves', 'claims', 'settings', 'global_settings', 'geofences', 'kpis', 'public_holidays', 'company_email_settings', 'company_backup_schedules'];
                    let sqlOutput = `-- Nexus HRM Pro Automated Scheduled Backup (${sched.frequency_days} Days Cycle)\n-- Generated on: ${new Date().toISOString()}\n\n`;

                    for (const table of tables) {
                        try {
                            const [rows] = await db.execute(`SELECT * FROM \`${table}\``);
                            if (rows.length > 0) {
                                sqlOutput += `-- Table: ${table}\n`;
                                const keys = Object.keys(rows[0]);
                                const colsList = keys.map(k => `\`${k}\``).join(', ');
                                for (const row of rows) {
                                    const vals = keys.map(k => {
                                        const val = row[k];
                                        if (val === null || val === undefined) return 'NULL';
                                        if (typeof val === 'number') return val;
                                        if (typeof val === 'boolean') return val ? 1 : 0;
                                        if (val instanceof Date) return `'${val.toISOString().slice(0, 19).replace('T', ' ')}'`;
                                        return `'${String(val).replace(/'/g, "''").replace(/\\/g, '\\\\')}'`;
                                    }).join(', ');
                                    sqlOutput += `INSERT INTO \`${table}\` (${colsList}) VALUES (${vals});\n`;
                                }
                                sqlOutput += '\n';
                            }
                        } catch (tErr) {}
                    }
                    fs.writeFileSync(tempFilePath, sqlOutput, 'utf8');
                }

                const fileContent = fs.readFileSync(tempFilePath);
                const [smtpRows] = await db.execute(
                    'SELECT * FROM company_email_settings WHERE company_id = ? AND is_active = 1 LIMIT 1',
                    [sched.company_id]
                );

                const backupHtml = `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background: #ffffff;">
                        <div style="background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 24px; border-radius: 12px; text-align: center; color: white;">
                            <h2 style="margin: 0; font-size: 20px; font-weight: 800; letter-spacing: 0.5px;">⏰ Automated System Backup</h2>
                            <p style="margin: 6px 0 0 0; opacity: 0.9; font-size: 13px;">Recurring (${sched.frequency_days} Days) Database Snapshot</p>
                        </div>
                        <div style="padding: 24px 8px 8px 8px; color: #334155; font-size: 14px; line-height: 1.6;">
                            <p>Hello <strong>${sched.admin_name || 'Admin'}</strong>,</p>
                            <p>This is your automated recurring system database backup. The complete backup file is attached to this email.</p>
                            <table style="width: 100%; border-collapse: collapse; margin: 18px 0; background: #f8fafc; border-radius: 10px; font-size: 13px;">
                                <tr><td style="padding: 12px; font-weight: bold; border-bottom: 1px solid #e2e8f0; color: #64748b;">File:</td><td style="padding: 12px; border-bottom: 1px solid #e2e8f0; font-family: monospace; color: #4f46e5; font-weight: bold;">${filename}</td></tr>
                                <tr><td style="padding: 12px; font-weight: bold; border-bottom: 1px solid #e2e8f0; color: #64748b;">Schedule:</td><td style="padding: 12px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #0f172a;">Every ${sched.frequency_days} Days</td></tr>
                                <tr><td style="padding: 12px; font-weight: bold; color: #64748b;">Generated At:</td><td style="padding: 12px; font-weight: bold; color: #0f172a;">${new Date().toLocaleString()}</td></tr>
                            </table>
                            <p style="color: #64748b; font-size: 12px;">🛡️ Please keep this backup secure for disaster recovery purposes.</p>
                        </div>
                    </div>
                `;

                if (smtpRows.length > 0) {
                    const s = smtpRows[0];
                    const password = decrypt(s.smtp_pass);
                    const transporter = nodemailer.createTransport({
                        host: s.smtp_host,
                        port: parseInt(s.smtp_port),
                        secure: parseInt(s.smtp_port) === 465,
                        auth: { user: s.smtp_user, pass: password }
                    });

                    await transporter.sendMail({
                        from: `"${s.sender_name || 'HR Department'}" <${s.sender_email || s.smtp_user}>`,
                        to: targetEmail,
                        subject: `⏰ Automated System Backup (Every ${sched.frequency_days} Days) - HRM Software`,
                        html: backupHtml,
                        attachments: [{ filename, content: fileContent }]
                    });
                } else {
                    await sendSystemEmail({
                        to: targetEmail,
                        toName: sched.admin_name || 'Admin',
                        subject: `⏰ Automated System Backup (Every ${sched.frequency_days} Days) - HRM Software`,
                        htmlContent: backupHtml,
                        attachments: [{ filename, content: fileContent }]
                    });
                }

                // Update last run and next run
                await db.execute(
                    'UPDATE company_backup_schedules SET last_run_at = NOW(), next_run_at = DATE_ADD(NOW(), INTERVAL frequency_days DAY) WHERE id = ?',
                    [sched.id]
                );
                console.log(`✅ [Auto-Backup Scheduler] Successfully dispatched ${sched.frequency_days}-day backup to ${targetEmail}`);
            } catch (autoErr) {
                console.error(`❌ [Auto-Backup Scheduler] Failed for company ${sched.company_id}:`, autoErr.message);
            }
        }
    } catch (e) {
        console.warn('Auto backup loop error:', e.message);
    }
}

// Check every 30 minutes in background
setInterval(runScheduledAutoBackups, 30 * 60 * 1000);
setTimeout(runScheduledAutoBackups, 8000); // Also check 8s after start


