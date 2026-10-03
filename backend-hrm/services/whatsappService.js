const path = require('path');
const fs = require('fs');
const qrcode = require('qrcode');
const pino = require('pino');
const db = require('../config/db');

// Baileys imports
const {
    default: makeWASocket,
    DisconnectReason,
    useMultiFileAuthState,
    makeCacheableSignalKeyStore,
    fetchLatestBaileysVersion,
    Browsers
} = require('@whiskeysockets/baileys');

class WhatsAppService {
    constructor() {
        this.sessions = new Map(); // companyId -> { socket, qr, pairingCode, status, phoneNumber, reconnectTimer, isReconnecting }
        this.io = null;
        this.baseSessionsDir = path.join(__dirname, '../sessions');
        
        // Ensure base sessions directory exists
        if (!fs.existsSync(this.baseSessionsDir)) {
            try {
                fs.mkdirSync(this.baseSessionsDir, { recursive: true });
            } catch (e) {
                console.error('Failed to create sessions dir:', e.message);
            }
        }
    }

    setIO(io) {
        this.io = io;
    }

    emitToCompany(companyId, event, data) {
        if (this.io) {
            this.io.to(`company_${companyId}`).emit(event, data);
            this.io.emit(`${event}_${companyId}`, data);
            this.io.emit(event, { ...data, company_id: companyId });
        }
    }

    normalizePhoneNumber(phone) {
        if (!phone) return null;
        let cleaned = String(phone).replace(/[^0-9]/g, '');
        if (cleaned.length === 10 && /^[6-9]/.test(cleaned)) {
            cleaned = '91' + cleaned;
        }
        if (cleaned.length < 7 || cleaned.length > 15) return null;
        return cleaned;
    }

    formatJID(phone) {
        const cleaned = this.normalizePhoneNumber(phone);
        if (!cleaned) return null;
        return `${cleaned}@s.whatsapp.net`;
    }

    getSessionDir(companyId) {
        return path.join(this.baseSessionsDir, `company_${companyId}`);
    }

    async getCompanySettings(companyId) {
        const [rows] = await db.execute(
            'SELECT * FROM company_whatsapp_settings WHERE company_id = ? LIMIT 1',
            [companyId]
        );
        return rows[0] || null;
    }

    async updateCompanyStatus(companyId, status, data = {}) {
        const { qr_code = null, last_error = null, connected_at = null, phone_number = null } = data;
        
        const [existing] = await db.execute(
            'SELECT id FROM company_whatsapp_settings WHERE company_id = ?',
            [companyId]
        );

        if (existing.length > 0) {
            const updates = ['status = ?'];
            const params = [status];

            if (qr_code !== undefined) {
                updates.push('qr_code = ?');
                params.push(qr_code);
            }
            if (last_error !== undefined) {
                updates.push('last_error = ?');
                params.push(last_error);
            }
            if (connected_at !== undefined) {
                updates.push('connected_at = ?');
                params.push(connected_at);
            }
            if (phone_number !== undefined) {
                updates.push('phone_number = ?');
                params.push(phone_number);
            }
            if (status === 'CONNECTED') {
                updates.push('last_seen_at = NOW()');
            }

            params.push(companyId);
            await db.execute(
                `UPDATE company_whatsapp_settings SET ${updates.join(', ')} WHERE company_id = ?`,
                params
            );
        } else {
            await db.execute(
                `INSERT INTO company_whatsapp_settings 
                (company_id, phone_number, status, qr_code, last_error, connected_at, last_seen_at) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    companyId,
                    phone_number || null,
                    status,
                    qr_code || null,
                    last_error || null,
                    connected_at || null,
                    status === 'CONNECTED' ? new Date() : null
                ]
            );
        }

        // Notify frontend via Socket.io
        this.emitToCompany(companyId, 'whatsapp:status', {
            company_id: companyId,
            status,
            qr_code,
            phone_number,
            connected_at,
            last_error
        });
    }

    async connect(companyId, inputPhoneNumber = null, usePairingCode = false) {
        const sessionDir = this.getSessionDir(companyId);
        const normalizedPhone = this.normalizePhoneNumber(inputPhoneNumber);
        let existingSession = this.sessions.get(companyId);

        if (existingSession && existingSession.status === 'CONNECTED' && existingSession.socket) {
            return {
                success: true,
                status: 'CONNECTED',
                message: 'WhatsApp session is already active.'
            };
        }

        // Clean up previous socket if any
        if (existingSession && existingSession.socket) {
            try {
                existingSession.socket.ev.removeAllListeners();
                existingSession.socket.end();
            } catch (e) {
                // Ignore
            }
        }

        // If not authenticated, clean stale unauthenticated credentials so fresh pre-keys match the new QR/Code
        const [currDb] = await db.execute('SELECT status FROM company_whatsapp_settings WHERE company_id = ?', [companyId]);
        if (!currDb[0] || currDb[0].status !== 'CONNECTED') {
            if (fs.existsSync(sessionDir)) {
                try {
                    fs.rmSync(sessionDir, { recursive: true, force: true });
                } catch (e) {}
            }
        }

        if (!fs.existsSync(sessionDir)) {
            fs.mkdirSync(sessionDir, { recursive: true });
        }

        await this.updateCompanyStatus(companyId, 'CONNECTING', {
            phone_number: normalizedPhone,
            last_error: null,
            qr_code: null
        });

        this.sessions.set(companyId, {
            socket: null,
            qr: null,
            pairingCode: null,
            status: 'CONNECTING',
            phoneNumber: normalizedPhone,
            usePairingCode,
            reconnectTimer: null,
            isReconnecting: false
        });

        return this._startSocket(companyId, normalizedPhone, usePairingCode);
    }

    async _startSocket(companyId, inputPhoneNumber, usePairingCode = false) {
        const sessionDir = this.getSessionDir(companyId);
        if (!fs.existsSync(sessionDir)) {
            fs.mkdirSync(sessionDir, { recursive: true });
        }

        try {
            const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
            let version = [2, 3000, 1043857760]; // Latest stable fallback
            try {
                const fetched = await fetchLatestBaileysVersion();
                if (fetched && fetched.version) version = fetched.version;
            } catch (e) {
                // Fallback version
            }

            const sock = makeWASocket({
                version,
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
                },
                logger: pino({ level: 'silent' }),
                printQRInTerminal: false,
                browser: Browsers.ubuntu('Chrome'),
                syncFullHistory: false,
                generateHighQualityLinkPreview: false,
                markOnlineOnConnect: false,
                connectTimeoutMs: 60000,
                defaultQueryTimeoutMs: 60000,
                keepAliveIntervalMs: 25000,
                emitOwnEvents: true,
                getMessage: async () => ({ conversation: 'hello' })
            });

            // Ensure no duplicate sockets or active timers exist for this company
            const existing = this.sessions.get(companyId);
            if (existing) {
                if (existing.reconnectTimer) {
                    clearTimeout(existing.reconnectTimer);
                    existing.reconnectTimer = null;
                }
                if (existing.socket && existing.socket !== sock) {
                    try {
                        existing.socket.ev.removeAllListeners();
                        existing.socket.end();
                    } catch (e) {}
                }
            }

            const currentSession = existing || {};
            currentSession.socket = sock;
            this.sessions.set(companyId, currentSession);

            console.log(`[WA DEBUG][Company ${companyId}] 🔄 Connection state: connecting`);

            // Handle pairing code if requested
            if (usePairingCode && inputPhoneNumber && !sock.authState.creds.registered) {
                setTimeout(async () => {
                    try {
                        const code = await sock.requestPairingCode(inputPhoneNumber);
                        console.log(`📱 WhatsApp Pairing Code for company ${companyId}: ${code}`);
                        const sess = this.sessions.get(companyId);
                        if (sess) {
                            sess.pairingCode = code;
                            sess.status = 'QR_READY';
                        }
                        this.emitToCompany(companyId, 'whatsapp:pairing_code', { code });
                    } catch (pairErr) {
                        console.error(`Pairing code error for company ${companyId}:`, pairErr.message);
                    }
                }, 2000);
            }

            sock.ev.on('creds.update', async (credsUpdate) => {
                console.log(`[WA DEBUG][Company ${companyId}] 🔑 creds.update (registered: ${sock.authState?.creds?.registered}, hasUser: ${!!sock.authState?.creds?.me})`);
                console.log(`[WA DEBUG][Company ${companyId}] Persisting WhatsApp auth credentials...`);
                try {
                    await saveCreds(credsUpdate);
                    console.log(`[WA DEBUG][Company ${companyId}] WhatsApp auth credentials persisted.`);
                } catch (saveErr) {
                    console.error(`[WA DEBUG][Company ${companyId}] ❌ Failed to persist credentials:`, saveErr.message);
                }
            });

            sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr, isNewLogin, receivedPendingNotifications } = update;

                if (connection === 'connecting') {
                    console.log(`[WA DEBUG][Company ${companyId}] 🔄 Connection state: connecting`);
                }

                if (isNewLogin) {
                    console.log(`[WA DEBUG][Company ${companyId}] 🔐 QR scanned by mobile device (isNewLogin: true, auth handshake started)`);
                }

                if (receivedPendingNotifications) {
                    console.log(`[WA DEBUG][Company ${companyId}] 📥 Syncing pending notifications from WhatsApp...`);
                }

                // QR generated
                if (qr && !usePairingCode) {
                    console.log(`[WA DEBUG][Company ${companyId}] 📱 QR received from Baileys. Rendering QR image...`);
                    try {
                        const qrDataUrl = await qrcode.toDataURL(qr, {
                            errorCorrectionLevel: 'M',
                            margin: 2,
                            scale: 8
                        });
                        
                        const sess = this.sessions.get(companyId);
                        if (sess) {
                            sess.qr = qrDataUrl;
                            sess.status = 'QR_READY';
                        }

                        await this.updateCompanyStatus(companyId, 'QR_READY', {
                            qr_code: qrDataUrl,
                            last_error: null
                        });
                        
                        this.emitToCompany(companyId, 'whatsapp:qr', { qr: qrDataUrl });
                        console.log(`[WA DEBUG][Company ${companyId}] 📤 QR emitted to frontend.`);
                    } catch (qrErr) {
                        console.error(`[WA DEBUG][Company ${companyId}] ❌ QR Generation error:`, qrErr.message);
                    }
                }

                // Authentication Success & Connected
                if (connection === 'open') {
                    console.log(`[WA DEBUG][Company ${companyId}] 🟢 Connection OPEN. Authentication successful.`);
                    const sess = this.sessions.get(companyId);
                    if (sess) {
                        sess.status = 'CONNECTED';
                        sess.qr = null;
                        sess.pairingCode = null;
                        sess.isReconnecting = false;
                        if (sess.reconnectTimer) clearTimeout(sess.reconnectTimer);
                    }

                    // Extract connected phone number from Baileys user JID
                    let connectedPhone = inputPhoneNumber;
                    if (sock.user && sock.user.id) {
                        const extracted = sock.user.id.split(':')[0].split('@')[0];
                        if (extracted) connectedPhone = extracted;
                    }

                    await this.updateCompanyStatus(companyId, 'CONNECTED', {
                        phone_number: connectedPhone,
                        qr_code: null,
                        connected_at: new Date(),
                        last_error: null
                    });

                    console.log(`✅ WhatsApp CONNECTED successfully for Company ID: ${companyId} (Number: ${connectedPhone})`);
                }

                // Disconnected or QR Expired
                if (connection === 'close') {
                    const statusCode = lastDisconnect?.error?.output?.statusCode;
                    const isLoggedOut = statusCode === DisconnectReason.loggedOut;
                    const sess = this.sessions.get(companyId);

                    console.log(`[WA DEBUG][Company ${companyId}] 🔴 Connection CLOSED. (statusCode: ${statusCode}, reason: ${lastDisconnect?.error?.message || 'None'}, isLoggedOut: ${isLoggedOut})`);

                    if (isLoggedOut) {
                        // User unlinked device from WhatsApp
                        await this.cleanupSession(companyId);
                        await this.updateCompanyStatus(companyId, 'DISCONNECTED', {
                            qr_code: null,
                            last_error: 'Logged out from WhatsApp. Please connect again.'
                        });
                    } else {
                        // Reconnect socket to keep QR fresh or resume
                        if (sess && !sess.isReconnecting) {
                            sess.isReconnecting = true;
                            sess.reconnectTimer = setTimeout(() => {
                                if (this.sessions.has(companyId)) {
                                    sess.isReconnecting = false;
                                    console.log(`[WA DEBUG][Company ${companyId}] 🔁 Attempting socket reconnect...`);
                                    this._startSocket(companyId, inputPhoneNumber, usePairingCode).catch(e => {
                                        console.log(`[WA DEBUG][Company ${companyId}] Socket reconnect loop error:`, e.message);
                                    });
                                }
                            }, 1500);
                        }
                    }
                }
            });

            return {
                success: true,
                status: 'CONNECTING',
                message: 'WhatsApp connection initiated. Preparing QR Code...'
            };
        } catch (err) {
            console.error(`❌ Failed to create WhatsApp socket for company ${companyId}:`, err);
            await this.updateCompanyStatus(companyId, 'ERROR', {
                last_error: 'Failed to start WhatsApp connection. Please try again.'
            });
            return {
                success: false,
                status: 'ERROR',
                message: 'Failed to start WhatsApp connection.'
            };
        }
    }

    async cleanupSession(companyId) {
        const sess = this.sessions.get(companyId);
        if (sess) {
            if (sess.reconnectTimer) clearTimeout(sess.reconnectTimer);
            if (sess.socket) {
                try {
                    sess.socket.ev.removeAllListeners();
                    sess.socket.end();
                } catch (e) {
                    // Ignore
                }
            }
            this.sessions.delete(companyId);
        }

        const sessionDir = this.getSessionDir(companyId);
        if (fs.existsSync(sessionDir)) {
            try {
                fs.rmSync(sessionDir, { recursive: true, force: true });
            } catch (e) {
                console.error(`Failed to delete session directory for company ${companyId}:`, e.message);
            }
        }
    }

    async disconnect(companyId) {
        const sess = this.sessions.get(companyId);
        if (sess && sess.socket) {
            try {
                await sess.socket.logout();
            } catch (e) {
                // Ignore logout error
            }
        }

        await this.cleanupSession(companyId);
        await this.updateCompanyStatus(companyId, 'DISCONNECTED', {
            phone_number: null,
            qr_code: null,
            last_error: null
        });

        return { success: true, message: 'WhatsApp disconnected successfully.' };
    }

    async getStatus(companyId) {
        const dbSettings = await this.getCompanySettings(companyId);
        const memSession = this.sessions.get(companyId);

        const status = memSession?.status || dbSettings?.status || 'DISCONNECTED';
        const qr = memSession?.qr || dbSettings?.qr_code || null;

        return {
            company_id: companyId,
            status,
            phone_number: dbSettings?.phone_number || null,
            qr_code: qr,
            pairing_code: memSession?.pairingCode || null,
            connected_at: dbSettings?.connected_at || null,
            last_seen_at: dbSettings?.last_seen_at || null,
            last_error: dbSettings?.last_error || null,
            notify_attendance: !!dbSettings?.notify_attendance,
            notify_leaves: !!dbSettings?.notify_leaves,
            notify_claims: !!dbSettings?.notify_claims,
            notify_payroll: !!dbSettings?.notify_payroll,
            notify_admin_alerts: !!dbSettings?.notify_admin_alerts
        };
    }

    async updatePreferences(companyId, preferences) {
        const {
            notify_attendance,
            notify_leaves,
            notify_claims,
            notify_payroll,
            notify_admin_alerts
        } = preferences;

        await db.execute(
            `UPDATE company_whatsapp_settings SET 
            notify_attendance = ?, 
            notify_leaves = ?, 
            notify_claims = ?, 
            notify_payroll = ?, 
            notify_admin_alerts = ? 
            WHERE company_id = ?`,
            [
                notify_attendance !== undefined ? (notify_attendance ? 1 : 0) : 1,
                notify_leaves !== undefined ? (notify_leaves ? 1 : 0) : 1,
                notify_claims !== undefined ? (notify_claims ? 1 : 0) : 1,
                notify_payroll !== undefined ? (notify_payroll ? 1 : 0) : 1,
                notify_admin_alerts !== undefined ? (notify_admin_alerts ? 1 : 0) : 1,
                companyId
            ]
        );

        return { success: true, message: 'WhatsApp notification preferences updated.' };
    }

    async logMessage({ company_id, recipient_phone, recipient_name, recipient_role, event_type, message, status, provider_message_id = null, error_message = null }) {
        try {
            await db.execute(
                `INSERT INTO whatsapp_logs 
                (company_id, recipient_phone, recipient_name, recipient_role, event_type, message, status, provider_message_id, error_message) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    company_id,
                    recipient_phone || 'UNKNOWN',
                    recipient_name || 'Staff Member',
                    recipient_role || 'employee',
                    event_type,
                    message,
                    status,
                    provider_message_id,
                    error_message
                ]
            );
        } catch (err) {
            console.error('Failed to write whatsapp_log:', err.message);
        }
    }

    async getLogs(companyId, limit = 50) {
        try {
            const [rows] = await db.execute(
                `SELECT * FROM whatsapp_logs WHERE company_id = ? ORDER BY created_at DESC LIMIT ?`,
                [companyId, parseInt(limit, 10)]
            );
            return rows;
        } catch (err) {
            console.error('Failed to get whatsapp_logs:', err.message);
            return [];
        }
    }

    async getCompanyName(companyId) {
        try {
            const [settings] = await db.execute('SELECT business_name FROM settings WHERE company_id = ? LIMIT 1', [companyId]);
            if (settings.length > 0 && settings[0].business_name) {
                return settings[0].business_name;
            }
            const [company] = await db.execute('SELECT company_name FROM companies WHERE id = ? LIMIT 1', [companyId]);
            if (company.length > 0 && company[0].company_name) {
                return company[0].company_name;
            }
        } catch (e) {
            // fallback
        }
        return 'HRM Software Pro';
    }

    /**
     * Core Asynchronous Message Sender
     */
    async sendMessage(companyId, recipientPhone, messageText, options = {}) {
        const {
            recipientName = 'Staff Member',
            recipientRole = 'employee',
            eventType = 'GENERAL_ALERT'
        } = options;

        const normalizedPhone = this.normalizePhoneNumber(recipientPhone);
        if (!normalizedPhone) {
            await this.logMessage({
                company_id: companyId,
                recipient_phone: recipientPhone || 'N/A',
                recipient_name: recipientName,
                recipient_role: recipientRole,
                event_type: eventType,
                message: messageText,
                status: 'SKIPPED',
                error_message: 'Recipient phone number is invalid or missing.'
            });
            return { success: false, status: 'SKIPPED', reason: 'Invalid phone number' };
        }

        const sess = this.sessions.get(companyId);
        if (!sess || sess.status !== 'CONNECTED' || !sess.socket) {
            await this.logMessage({
                company_id: companyId,
                recipient_phone: normalizedPhone,
                recipient_name: recipientName,
                recipient_role: recipientRole,
                event_type: eventType,
                message: messageText,
                status: 'SKIPPED',
                error_message: 'WhatsApp sender is not connected for this company.'
            });
            return { success: false, status: 'SKIPPED', reason: 'WhatsApp not connected' };
        }

        const jid = this.formatJID(normalizedPhone);

        try {
            const result = await sess.socket.sendMessage(jid, { text: messageText });
            const messageId = result?.key?.id || null;

            await this.logMessage({
                company_id: companyId,
                recipient_phone: normalizedPhone,
                recipient_name: recipientName,
                recipient_role: recipientRole,
                event_type: eventType,
                message: messageText,
                status: 'SENT',
                provider_message_id: messageId
            });

            return { success: true, status: 'SENT', messageId };
        } catch (sendErr) {
            console.error(`❌ WhatsApp send error for company ${companyId} to ${normalizedPhone}:`, sendErr.message);
            await this.logMessage({
                company_id: companyId,
                recipient_phone: normalizedPhone,
                recipient_name: recipientName,
                recipient_role: recipientRole,
                event_type: eventType,
                message: messageText,
                status: 'FAILED',
                error_message: sendErr.message || 'Failed to send WhatsApp message.'
            });
            return { success: false, status: 'FAILED', error: sendErr.message };
        }
    }

    // Role-Based Notification Handlers (Async)
    async sendAttendanceNotification(companyId, { employeeId, employeeName, employeePhone, date, time, status }) {
        setImmediate(async () => {
            try {
                const settings = await this.getCompanySettings(companyId);
                if (!settings || !settings.notify_attendance || settings.status !== 'CONNECTED') return;

                let phone = employeePhone;
                let name = employeeName;
                if (!phone && employeeId) {
                    const [emp] = await db.execute('SELECT name, phone FROM employees WHERE id = ?', [employeeId]);
                    if (emp.length > 0) {
                        name = emp[0].name;
                        phone = emp[0].phone;
                    }
                }

                if (!phone) return;

                const companyName = await this.getCompanyName(companyId);
                const statusBadge = (status || 'Present').toUpperCase();

                const text = `*${companyName}*\n\nHello *${name}*,\n\nYour attendance punch has been recorded successfully.\n\n📅 *Date:* ${date}\n⏰ *Time:* ${time}\n📊 *Status:* ${statusBadge}\n\n_Thank you._`;

                await this.sendMessage(companyId, phone, text, {
                    recipientName: name,
                    recipientRole: 'employee',
                    eventType: 'ATTENDANCE_PUNCH'
                });
            } catch (err) {
                console.error('sendAttendanceNotification error:', err.message);
            }
        });
    }

    async sendLeaveNotification(companyId, { type, employeeId, employeeName, employeePhone, leaveType, startDate, endDate, reason, status }) {
        setImmediate(async () => {
            try {
                const settings = await this.getCompanySettings(companyId);
                if (!settings || !settings.notify_leaves || settings.status !== 'CONNECTED') return;

                const companyName = await this.getCompanyName(companyId);

                if (type === 'APPLIED') {
                    if (settings.phone_number && settings.notify_admin_alerts) {
                        const adminText = `*${companyName}*\n🔔 *New Leave Application*\n\n👤 *Employee:* ${employeeName}\n🏷️ *Type:* ${leaveType}\n📅 *Dates:* ${startDate} to ${endDate}\n📝 *Reason:* ${reason || 'N/A'}\n\n_Please log in to the portal to review and approve/reject._`;
                        await this.sendMessage(companyId, settings.phone_number, adminText, {
                            recipientName: 'Company Admin',
                            recipientRole: 'admin',
                            eventType: 'LEAVE_APPLICATION_ADMIN'
                        });
                    }
                } else if (type === 'STATUS_UPDATED') {
                    let phone = employeePhone;
                    let name = employeeName;
                    if (!phone && employeeId) {
                        const [emp] = await db.execute('SELECT name, phone FROM employees WHERE id = ?', [employeeId]);
                        if (emp.length > 0) {
                            name = emp[0].name;
                            phone = emp[0].phone;
                        }
                    }

                    if (phone) {
                        const statusUpper = (status || 'UPDATED').toUpperCase();
                        const empText = `*${companyName}*\n\nHello *${name}*,\n\nYour leave application for *${startDate} to ${endDate}* (${leaveType}) has been *${statusUpper}*.\n\n_Thank you._`;
                        await this.sendMessage(companyId, phone, empText, {
                            recipientName: name,
                            recipientRole: 'employee',
                            eventType: 'LEAVE_STATUS_EMPLOYEE'
                        });
                    }
                }
            } catch (err) {
                console.error('sendLeaveNotification error:', err.message);
            }
        });
    }

    async sendClaimNotification(companyId, { type, employeeId, employeeName, employeePhone, claimTitle, amount, currency = 'INR', status }) {
        setImmediate(async () => {
            try {
                const settings = await this.getCompanySettings(companyId);
                if (!settings || !settings.notify_claims || settings.status !== 'CONNECTED') return;

                const companyName = await this.getCompanyName(companyId);

                if (type === 'SUBMITTED') {
                    if (settings.phone_number && settings.notify_admin_alerts) {
                        const adminText = `*${companyName}*\n🔔 *New Expense Claim Submitted*\n\n👤 *Employee:* ${employeeName}\n💰 *Amount:* ${currency} ${amount}\n📄 *Title:* ${claimTitle}\n\n_Please log in to the portal to review._`;
                        await this.sendMessage(companyId, settings.phone_number, adminText, {
                            recipientName: 'Company Admin',
                            recipientRole: 'admin',
                            eventType: 'CLAIM_SUBMITTED_ADMIN'
                        });
                    }
                } else if (type === 'STATUS_UPDATED') {
                    let phone = employeePhone;
                    let name = employeeName;
                    if (!phone && employeeId) {
                        const [emp] = await db.execute('SELECT name, phone FROM employees WHERE id = ?', [employeeId]);
                        if (emp.length > 0) {
                            name = emp[0].name;
                            phone = emp[0].phone;
                        }
                    }

                    if (phone) {
                        const statusUpper = (status || 'UPDATED').toUpperCase();
                        const empText = `*${companyName}*\n\nHello *${name}*,\n\nYour expense claim (*${claimTitle}* - ${currency} ${amount}) has been *${statusUpper}*.\n\n_Thank you._`;
                        await this.sendMessage(companyId, phone, empText, {
                            recipientName: name,
                            recipientRole: 'employee',
                            eventType: 'CLAIM_STATUS_EMPLOYEE'
                        });
                    }
                }
            } catch (err) {
                console.error('sendClaimNotification error:', err.message);
            }
        });
    }

    async sendPayrollNotification(companyId, { employeeId, employeeName, employeePhone, month, netSalary, currency = 'INR' }) {
        setImmediate(async () => {
            try {
                const settings = await this.getCompanySettings(companyId);
                if (!settings || !settings.notify_payroll || settings.status !== 'CONNECTED') return;

                let phone = employeePhone;
                let name = employeeName;
                if (!phone && employeeId) {
                    const [emp] = await db.execute('SELECT name, phone FROM employees WHERE id = ?', [employeeId]);
                    if (emp.length > 0) {
                        name = emp[0].name;
                        phone = emp[0].phone;
                    }
                }

                if (!phone) return;

                const companyName = await this.getCompanyName(companyId);
                const text = `*${companyName}*\n\nHello *${name}*,\n\nYour salary payslip for *${month}* has been processed.\n\n💵 *Net Pay:* ${currency} ${netSalary}\n\n_You can download your detailed payslip from your employee portal._\n\n_Thank you._`;

                await this.sendMessage(companyId, phone, text, {
                    recipientName: name,
                    recipientRole: 'employee',
                    eventType: 'PAYROLL_PAYSLIP'
                });
            } catch (err) {
                console.error('sendPayrollNotification error:', err.message);
            }
        });
    }

    async init(ioInstance) {
        if (ioInstance) {
            this.setIO(ioInstance);
        }

        try {
            const [activeConnections] = await db.execute(
                `SELECT company_id, phone_number FROM company_whatsapp_settings WHERE status = 'CONNECTED'`
            );

            console.log(`📡 WhatsApp Service Init: Found ${activeConnections.length} active sessions to restore.`);

            for (const conn of activeConnections) {
                const sessionDir = this.getSessionDir(conn.company_id);
                if (fs.existsSync(sessionDir)) {
                    this.connect(conn.company_id, conn.phone_number).catch(err => {
                        console.log(`Session restore deferred for company ${conn.company_id}: ${err.message}`);
                    });
                } else {
                    await this.updateCompanyStatus(conn.company_id, 'DISCONNECTED', {
                        last_error: 'Session expired. Please reconnect.'
                    });
                }
            }
        } catch (err) {
            console.error('Error during WhatsApp auto-restore:', err.message);
        }
    }
}

const instance = new WhatsAppService();
module.exports = instance;
