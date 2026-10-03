const db = require('../config/db');

/**
 * Log an action to the audit_logs table
 * @param {number} adminId - ID of the user performing the action
 * @param {string} action - Short string describing the action (e.g. 'ADD_MANUAL_ATTENDANCE', 'UPDATE_EMPLOYEE')
 * @param {number} targetId - Optional ID of the entity affected
 * @param {string|object} details - Detailed string or JSON representation
 * @param {number} companyId - Optional company ID (auto-resolved from adminId if not provided)
 */
exports.logAction = async (adminId, action, targetId = null, details = '', companyId = null) => {
    try {
        let resolvedCompanyId = companyId;
        if (!resolvedCompanyId && adminId) {
            const [u] = await db.execute('SELECT company_id FROM users WHERE id = ? LIMIT 1', [adminId]);
            if (u.length > 0) resolvedCompanyId = u[0].company_id;
        }

        const detailsStr = typeof details === 'object' ? JSON.stringify(details) : (details || '');

        await db.execute(
            'INSERT INTO audit_logs (admin_id, company_id, action, target_id, details, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
            [adminId || null, resolvedCompanyId || null, action, targetId, detailsStr]
        );
    } catch (err) {
        console.error('Failed to log audit action:', err.message);
    }
};
