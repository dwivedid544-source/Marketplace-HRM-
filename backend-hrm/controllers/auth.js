const crypto = require('crypto');
const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const notificationsUtil = require('../utils/notifications');
const { sendWelcomeTrialEmail, sendPasswordResetOtpEmail, sendPasswordChangedConfirmationEmail } = require('../utils/emailService');

exports.login = async (req, res) => {
    console.log('Login attempt:', req.body);
    const { email, userId, password } = req.body;
    const identifier = email || userId;

    if (!identifier) {
        return res.status(400).json({ message: 'Email or User ID is required' });
    }

    try {
        console.log('--- LOGIN DEBUG START ---');
        console.log('Identifier received:', identifier);
        
        // Comprehensive search: Check User Email, Employee Email, Custom Employee ID, Machine ID, or Employee Database ID
        let [users] = await db.execute(`
            SELECT u.*, e.name as emp_name, e.photo as emp_photo, e.machine_id, e.custom_id, e.email as emp_email, e.id as employee_db_id 
            FROM users u 
            LEFT JOIN employees e ON u.employee_id = e.id 
            WHERE u.email = ? OR e.email = ? OR e.custom_id = ? OR e.machine_id = ? OR e.id = ?
        `, [identifier, identifier, identifier, identifier, identifier]);
        
        console.log('Database result count:', users.length);
        
        // Auto-healing: If no user found in `users` table, check `employees` table directly
        if (users.length === 0) {
            console.log('No user row found. Checking employees table for auto-healing...');
            const [empRows] = await db.execute(`
                SELECT * FROM employees 
                WHERE email = ? OR custom_id = ? OR machine_id = ? OR id = ?
            `, [identifier, identifier, identifier, identifier]);

            if (empRows.length > 0) {
                const emp = empRows[0];
                console.log('Employee found in employees table without user account. Healing user record for employee ID:', emp.id);
                
                // Check if user record exists for this employee_id under a different email
                const [existingUser] = await db.execute('SELECT * FROM users WHERE employee_id = ?', [emp.id]);
                
                if (existingUser.length > 0) {
                    // Update user's email to match employee email
                    await db.execute('UPDATE users SET email = ? WHERE employee_id = ?', [emp.email || '', emp.id]);
                } else {
                    // Create missing user record with default/hashed password
                    const defaultPasswordHash = await bcrypt.hash('12345678', 10);
                    await db.execute(
                        'INSERT INTO users (employee_id, email, password, role, name, created_by, company_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
                        [emp.id, emp.email || '', defaultPasswordHash, emp.role || 'employee', emp.name || '', emp.created_by || null, emp.company_id || null]
                    );
                }

                // Re-fetch the healed user
                [users] = await db.execute(`
                    SELECT u.*, e.name as emp_name, e.photo as emp_photo, e.machine_id, e.custom_id, e.email as emp_email, e.id as employee_db_id 
                    FROM users u 
                    LEFT JOIN employees e ON u.employee_id = e.id 
                    WHERE u.employee_id = ? OR u.email = ? OR e.email = ?
                `, [emp.id, emp.email || '', emp.email || '']);
            }
        }

        if (users.length === 0) {
            console.log('FAILURE: No user found matching identifier');
            return res.status(401).json({ message: 'Invalid credentials (User not found)' });
        }

        const user = users[0];
        console.log('User found:', { 
            db_id: user.id, 
            email: user.email, 
            emp_id: user.employee_id, 
            machine_id: user.machine_id,
            role: user.role 
        });

        // Password comparison
        console.log('Comparing password for:', user.email || `EMP-${user.employee_db_id}`);
        const isMatch = await bcrypt.compare(password, user.password);
        console.log('Password match result:', isMatch);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials (Password mismatch)' });
        }

        // Strict Role Validation: The role requested in the UI MUST match the DB role
        const dbRole = user.role?.toLowerCase() || '';
        const reqRole = req.body.role?.toLowerCase() || '';
        
        let isValidRole = false;
        if (!reqRole) {
            isValidRole = true; // Auto-detect role from DB if not provided
        } else if (reqRole === 'superadmin' && (dbRole === 'master admin' || dbRole === 'masteradmin' || dbRole === 'superadmin')) {
            isValidRole = true;
        } else if (reqRole === 'admin' && (dbRole === 'admin' || dbRole === 'hr' || dbRole === 'hr admin')) {
            isValidRole = true;
        } else if (reqRole === 'employee' && dbRole === 'employee') {
            isValidRole = true;
        }

        if (!isValidRole) {
            return res.status(403).json({ message: `Access denied. You do not have ${req.body.role} privileges.` });
        }

        // Check Subscription Expiry for non-superadmins
        // (Removed so admins can log in and see the Subscription Blocker UI to renew)
        
            // NEW REAL-TIME SUPERADMIN VERIFICATION
            try {
                const [companies] = await db.execute('SELECT email, status FROM companies WHERE id = ?', [user.company_id]);
                if (companies.length > 0) {
                    const companyStatus = companies[0].status;
                    if (companyStatus && companyStatus.toLowerCase() !== 'active') {
                        return res.status(403).json({ message: 'Your company account has been suspended or is inactive. Please contact the platform administrator.' });
                    }

                    const employerEmail = companies[0].email;
                    const superadminApiUrl = process.env.SUPERADMIN_API_URL;
                    
                    if (superadminApiUrl) {
                        const response = await axios.get(`${superadminApiUrl}/master/verify-subscription?email=${employerEmail}`);
                        if (!response.data || response.data.success === false) {
                            return res.status(403).json({
                                message: response.data.message || 'Subscription verification failed via Superadmin.'
                            });
                        }
                    }
                }
            } catch (superadminErr) {
                console.error('Superadmin Verification Error:', superadminErr.message);
                return res.status(500).json({ 
                    message: 'Login blocked: Unable to verify subscription status with Superadmin.', 
                    error: superadminErr.response?.data?.message || superadminErr.message 
                });
            }

        // Fetch Localization Settings
        let localization = {};
        try {
            const [globalRows] = await db.execute('SELECT timezone, currency, date_format, language, country FROM global_settings LIMIT 1');
            const globalSettings = globalRows[0] || { timezone: 'UTC', currency: 'USD', date_format: 'YYYY-MM-DD', language: 'English', country: 'India' };

            let companySettings = {};
            if (user.company_id) {
                const [companyRows] = await db.execute(
                    'SELECT timezone, currency, date_format, language, country FROM settings WHERE company_id = ? OR (company_id IS NULL AND id = 1) ORDER BY company_id DESC LIMIT 1',
                    [user.company_id]
                );
                companySettings = companyRows[0] || {};
            }

            localization = {
                timezone: companySettings.timezone || globalSettings.timezone,
                currency: companySettings.currency || globalSettings.currency,
                date_format: companySettings.date_format || globalSettings.date_format,
                language: companySettings.language || globalSettings.language,
                country: companySettings.country || globalSettings.country || 'India'
            };
        } catch (setErr) {
            console.error('Error fetching localization settings:', setErr);
        }

        const token = jwt.sign(
            { id: user.id, role: user.role, employee_id: user.employee_id, company_id: user.company_id, localization },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                name: user.emp_name || user.name, // Use latest employee name if available
                email: user.email,
                role: user.role,
                photo: user.emp_photo || user.photo, // Use latest employee photo if available
                employee_id: user.employee_id,
                company_id: user.company_id,
                localization
            }
        });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

exports.forgotPasswordRequest = async (req, res) => {
    try {
        const { userId, email } = req.body; // Can be email or employee custom_id
        const identifier = (email || userId || '').trim();

        if (!identifier) {
            return res.status(400).json({ message: 'Please provide your registered Email or User ID' });
        }

        // Find user by email, or check if it matches an employee custom_id
        const [users] = await db.execute(`
            SELECT u.id, u.name, u.role, u.company_id, u.email, e.email as emp_email, e.name as emp_name
            FROM users u
            LEFT JOIN employees e ON u.employee_id = e.id
            WHERE LOWER(u.email) = ? OR LOWER(e.email) = ? OR e.custom_id = ?
            LIMIT 1
        `, [identifier.toLowerCase(), identifier.toLowerCase(), identifier]);

        if (users.length === 0) {
            return res.status(404).json({ message: 'No registered account found matching this Email or User ID.' });
        }

        const user = users[0];
        const targetEmail = (user.email || user.emp_email || '').trim();

        if (!targetEmail) {
            return res.status(400).json({ message: 'No valid email address found associated with this account.' });
        }

        // Generate 6-digit numeric OTP and 48-char secure token
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const token = crypto.randomBytes(24).toString('hex');
        
        // 15 minutes validity
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

        // Invalidate older unused reset requests for this email
        await db.execute('UPDATE password_resets SET used = 1 WHERE email = ?', [targetEmail]);

        // Insert new reset record
        await db.execute(
            'INSERT INTO password_resets (email, otp, token, expires_at, used) VALUES (?, ?, ?, ?, 0)',
            [targetEmail, otp, token, expiresAt]
        );

        // Send Password Reset Code Email via Brevo API
        const emailSent = await sendPasswordResetOtpEmail({
            to: targetEmail,
            name: user.name || user.emp_name || 'User',
            otp
        });

        if (!emailSent) {
            return res.status(500).json({ message: 'Failed to dispatch reset email via Brevo. Please verify server SMTP/API configuration.' });
        }

        res.json({
            success: true,
            email: targetEmail,
            message: `A 6-digit password reset code and direct link have been sent to ${targetEmail}.`
        });
    } catch (err) {
        console.error('Error in forgot password request:', err);
        res.status(500).json({ message: 'Server error processing password reset', error: err.message });
    }
};

exports.verifyResetPassword = async (req, res) => {
    try {
        const { email, otp, token, newPassword } = req.body;
        const cleanEmail = (email || '').trim().toLowerCase();
        const cleanOtp = (otp || '').trim();
        const cleanToken = (token || '').trim();

        if (!cleanEmail || (!cleanOtp && !cleanToken)) {
            return res.status(400).json({ message: 'Email and verification code (or reset token) are required.' });
        }

        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ message: 'New password must be at least 6 characters long.' });
        }

        // Verify OTP / Token in password_resets table
        const [resets] = await db.execute(`
            SELECT * FROM password_resets 
            WHERE LOWER(email) = ? 
              AND (otp = ? OR token = ?) 
              AND used = 0 
              AND expires_at > NOW() 
            ORDER BY id DESC 
            LIMIT 1
        `, [cleanEmail, cleanOtp || '___', cleanToken || '___']);

        if (resets.length === 0) {
            return res.status(400).json({ message: 'Invalid or expired verification code. Please request a new code.' });
        }

        const resetRecord = resets[0];

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // Update password in users table
        await db.execute('UPDATE users SET password = ? WHERE LOWER(email) = ?', [hashedPassword, cleanEmail]);

        // Mark reset token as used
        await db.execute('UPDATE password_resets SET used = 1 WHERE id = ?', [resetRecord.id]);

        // Send confirmation email asynchronously
        const [userRows] = await db.execute('SELECT name FROM users WHERE LOWER(email) = ? LIMIT 1', [cleanEmail]);
        const userName = userRows[0]?.name || 'User';

        sendPasswordChangedConfirmationEmail({
            to: cleanEmail,
            name: userName
        }).catch(err => console.error('Confirmation email error (non-fatal):', err));

        res.json({
            success: true,
            message: 'Password has been reset successfully! You can now log in with your new password.'
        });
    } catch (err) {
        console.error('Error verifying reset password:', err);
        res.status(500).json({ message: 'Server error resetting password', error: err.message });
    }
};

exports.register = async (req, res) => {
    const { companyName, adminName, email, phone, password, planId } = req.body;

    if (!companyName || !adminName || !email || !password || !phone || !phone.trim()) {
        return res.status(400).json({ message: 'All fields including Mobile Number are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone.replace(/[^0-9]/g, '');

    if (cleanPhone.length < 10) {
        return res.status(400).json({ message: 'Please enter a valid 10-digit mobile number.' });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Check if email already exists in users or companies
        const [existingUsers] = await connection.execute('SELECT id, company_id FROM users WHERE LOWER(email) = ?', [cleanEmail]);
        if (existingUsers.length > 0) {
            const [company] = await connection.execute('SELECT id FROM companies WHERE id = ?', [existingUsers[0].company_id]);
            if (company.length > 0) {
                await connection.rollback();
                return res.status(400).json({ message: 'You have already taken your Free Trial! Please purchase a paid plan to continue using Nexus HRM.' });
            } else {
                // Orphaned user from deleted company -> clean it up
                await connection.execute('DELETE FROM users WHERE id = ?', [existingUsers[0].id]);
            }
        }

        const [existingCompanyEmail] = await connection.execute('SELECT id, company_name FROM companies WHERE LOWER(email) = ?', [cleanEmail]);
        if (existingCompanyEmail.length > 0) {
            await connection.rollback();
            return res.status(400).json({ message: 'You have already taken your Free Trial! Please purchase a paid plan to continue using Nexus HRM.' });
        }

        // 2. Check if mobile number already claimed a Free Trial / company
        const last10Digits = cleanPhone.slice(-10);
        const [existingCompanyPhone] = await connection.execute(
            'SELECT id, company_name FROM companies WHERE REPLACE(REPLACE(REPLACE(phone, " ", ""), "-", ""), "+", "") LIKE ?',
            [`%${last10Digits}`]
        );
        if (existingCompanyPhone.length > 0) {
            await connection.rollback();
            return res.status(400).json({ message: 'You have already taken your Free Trial with this mobile number! Please purchase a paid plan to continue using Nexus HRM.' });
        }

        const [existingReqPhone] = await connection.execute(
            'SELECT id, company_name FROM company_requests WHERE REPLACE(REPLACE(REPLACE(phone, " ", ""), "-", ""), "+", "") LIKE ?',
            [`%${last10Digits}`]
        );
        if (existingReqPhone.length > 0) {
            await connection.rollback();
            return res.status(400).json({ message: 'You have already taken your Free Trial with this mobile number! Please purchase a paid plan to continue using Nexus HRM.' });
        }

        // 3. Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        const chosenPlan = planId || 'Free Trial';

        // 4. Get plan employee limit
        const [planRows] = await connection.execute('SELECT employee_limit, duration FROM plans WHERE name = ?', [chosenPlan]);
        const empLimit = planRows.length > 0 ? (planRows[0].employee_limit || 10) : 10;
        const planDuration = planRows.length > 0 ? (planRows[0].duration || 'weekly') : 'weekly';

        // 5. Create Company directly (Instant Activation)
        const [companyResult] = await connection.execute(
            'INSERT INTO companies (company_name, owner_name, email, phone, plan, employee_limit, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [companyName.trim(), adminName.trim(), cleanEmail, phone.trim(), chosenPlan, empLimit, 'active']
        );
        const companyId = companyResult.insertId;

        // 6. Create Admin User directly
        const [userResult] = await connection.execute(
            'INSERT INTO users (name, email, password, role, company_id) VALUES (?, ?, ?, ?, ?)',
            [adminName.trim(), cleanEmail, hashedPassword, 'admin', companyId]
        );
        const userId = userResult.insertId;

        // 7. Create Initial Subscription (7 Days for Free Trial or Plan duration)
        let daysToAdd = 7;
        if (planDuration === 'monthly') daysToAdd = 30;
        if (planDuration === 'quarterly') daysToAdd = 90;
        if (planDuration === 'half-yearly') daysToAdd = 180;
        if (planDuration === 'annually') daysToAdd = 365;

        const endDate = new Date();
        endDate.setDate(endDate.getDate() + daysToAdd);

        await connection.execute(
            'INSERT INTO subscriptions (company_id, plan_name, amount, billing_cycle, start_date, end_date, payment_status) VALUES (?, ?, ?, ?, CURDATE(), ?, "paid")',
            [companyId, chosenPlan, 0, planDuration, endDate.toISOString().split('T')[0]]
        );

        // 8. Log in company_requests as accepted for audit history
        await connection.execute(
            'INSERT INTO company_requests (company_name, owner_name, email, password, phone, plan, status) VALUES (?, ?, ?, ?, ?, ?, "accepted")',
            [companyName.trim(), adminName.trim(), cleanEmail, hashedPassword, phone.trim(), chosenPlan]
        );

        // 9. Create Company Settings
        await connection.execute(
            'INSERT INTO settings (company_id, business_name, business_email, business_phone, currency) VALUES (?, ?, ?, ?, ?)',
            [companyId, companyName.trim(), cleanEmail, phone.trim(), 'INR']
        );

        await connection.commit();

        // 9.5 Send 7-Day Free Trial Welcome Email with Login Credentials asynchronously
        sendWelcomeTrialEmail({
            to: cleanEmail,
            name: adminName.trim(),
            companyName: companyName.trim(),
            email: cleanEmail,
            password: password, // Plain text password created by the user
            trialDays: daysToAdd,
            expiryDate: endDate
        }).catch(emailErr => {
            console.error('Welcome email dispatch error (non-fatal):', emailErr);
        });

        // 10. Generate JWT Token for Auto Login
        const token = jwt.sign(
            { id: userId, email: cleanEmail, role: 'admin', company_id: companyId },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '7d' }
        );

        notificationsUtil.checkAndNotify('emailCompanyRequest', {
            company_id: null,
            title: 'New Free Trial Activated',
            message: `${adminName} (${companyName}) has directly started a Free Trial on the ${chosenPlan} plan.`,
            type: 'info'
        });

        res.json({ 
            success: true,
            message: 'Free Trial activated! Welcome aboard.', 
            token: token,
            user: {
                id: userId,
                name: adminName,
                email: cleanEmail,
                role: 'admin',
                company_id: companyId,
                company_name: companyName
            }
        });
    } catch (err) {
        await connection.rollback();
        console.error('Registration Error:', err);
        res.status(500).json({ message: 'Server error during registration', error: err.message });
    } finally {
        connection.release();
    }
};

/**
 * Phase 2B.7.1B — Setup Status Endpoint
 * GET /api/setup/status
 * Returns minimal setup status: isLicensed, superadminExists, setupRequired.
 */
exports.getSetupStatus = async (req, res) => {
    try {
        const licenseCache = req.app.get('licenseCache');
        let isLicensed = false;
        if (licenseCache && typeof licenseCache.getState === 'function') {
            const state = await licenseCache.getState(req.licenseHost || null);
            isLicensed = Boolean(state && state.valid && state.status === 'STATUS_HEALTHY');
        }

        const [superadmins] = await db.query(
            "SELECT id FROM users WHERE role = 'superadmin' LIMIT 1"
        );
        const superadminExists = Boolean(superadmins && superadmins.length > 0);
        const setupRequired = isLicensed && !superadminExists;

        return res.status(200).json({
            success: true,
            isLicensed,
            superadminExists,
            setupRequired
        });
    } catch (err) {
        console.error('getSetupStatus error:', err.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve setup status.'
        });
    }
};

/**
 * Phase 2B.7.1B — First Superadmin Setup Endpoint
 * POST /api/setup/first-admin
 * Provisions the initial Superadmin after successful license activation.
 */
const SETUP_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SETUP_LOCK_NAME = 'kiaan_hrm_superadmin_bootstrap_lock';

exports.createFirstAdmin = async (req, res) => {
    try {
        // 1. License Gate: Must be STATUS_HEALTHY
        const licenseCache = req.app.get('licenseCache');
        let isLicensed = false;
        if (licenseCache && typeof licenseCache.getState === 'function') {
            const state = await licenseCache.getState(req.licenseHost || null);
            isLicensed = Boolean(state && state.valid && state.status === 'STATUS_HEALTHY');
        }

        if (!isLicensed) {
            return res.status(403).json({
                success: false,
                code: 'LICENSE_REQUIRED',
                message: 'A valid active license is required before setting up the Super Administrator.'
            });
        }

        const { name, email, password } = req.body || {};

        // 2. Validate Input
        const trimmedName = typeof name === 'string' ? name.trim() : '';
        const trimmedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
        const rawPassword = typeof password === 'string' ? password : '';

        if (!trimmedName || trimmedName.length > 100) {
            return res.status(400).json({
                success: false,
                code: 'INVALID_INPUT',
                message: 'Name is required and must be 100 characters or fewer.'
            });
        }

        if (!trimmedEmail || !SETUP_EMAIL_REGEX.test(trimmedEmail) || trimmedEmail.length > 150) {
            return res.status(400).json({
                success: false,
                code: 'INVALID_EMAIL',
                message: 'A valid email address is required.'
            });
        }

        if (rawPassword.length < 10) {
            return res.status(400).json({
                success: false,
                code: 'WEAK_PASSWORD',
                message: 'Password must be at least 10 characters long.'
            });
        }

        // 3. Fast-path check: Return 409 immediately if any Superadmin already exists
        const [existingSuperadmins] = await db.query(
            "SELECT id FROM users WHERE role = 'superadmin' LIMIT 1"
        );
        if (existingSuperadmins && existingSuperadmins.length > 0) {
            return res.status(409).json({
                success: false,
                code: 'SUPERADMIN_ALREADY_EXISTS',
                message: 'Initial Super Administrator setup has already been completed.'
            });
        }

        // 4. Concurrency Protection via Dedicated Connection & Named Advisory Lock
        let conn;
        let lockAcquired = false;

        try {
            conn = await db.getConnection();
            const [lockRows] = await conn.query('SELECT GET_LOCK(?, 10) as lock_status', [SETUP_LOCK_NAME]);
            if (!lockRows || lockRows[0].lock_status !== 1) {
                return res.status(503).json({
                    success: false,
                    code: 'LOCK_TIMEOUT',
                    message: 'Could not acquire setup lock. Please retry shortly.'
                });
            }
            lockAcquired = true;

            // 5. Double-Checked Locking inside the lock
            const [lockedCheck] = await conn.query(
                "SELECT id FROM users WHERE role = 'superadmin' LIMIT 1"
            );
            if (lockedCheck && lockedCheck.length > 0) {
                return res.status(409).json({
                    success: false,
                    code: 'SUPERADMIN_ALREADY_EXISTS',
                    message: 'Initial Super Administrator setup has already been completed.'
                });
            }

            // 6. Tenant Collision Check: Prevent hijacking or overwriting existing user
            const [collisionCheck] = await conn.query(
                "SELECT id, role FROM users WHERE email = ? LIMIT 1",
                [trimmedEmail]
            );
            if (collisionCheck && collisionCheck.length > 0) {
                return res.status(409).json({
                    success: false,
                    code: 'EMAIL_COLLISION',
                    message: `An account with email "${trimmedEmail}" already exists.`
                });
            }

            // 7. Secure Password Hashing (bcrypt, 10 rounds)
            const bcrypt = require('bcryptjs');
            const hashedPassword = await bcrypt.hash(rawPassword, 10);

            // 8. Insert Initial Superadmin
            await conn.query(
                "INSERT INTO users (name, email, password, role, company_id) VALUES (?, ?, ?, 'superadmin', NULL)",
                [trimmedName, trimmedEmail, hashedPassword]
            );

            return res.status(201).json({
                success: true,
                message: 'Super Administrator account created successfully. You may now log in.'
            });
        } finally {
            if (conn) {
                try {
                    if (lockAcquired) {
                        await conn.query('SELECT RELEASE_LOCK(?)', [SETUP_LOCK_NAME]);
                    }
                } catch (_) {}
                conn.release();
            }
        }
    } catch (err) {
        console.error('createFirstAdmin error:', err.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to create Super Administrator account.'
        });
    }
};

