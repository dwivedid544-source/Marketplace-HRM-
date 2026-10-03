const db = require('../config/db');

/**
 * Get Audit Logs for Company Admin (Tenant Isolated)
 */
exports.getAuditLogs = async (req, res) => {
    try {
        const companyId = req.user.company_id;
        if (!companyId) {
            return res.status(400).json({ message: 'Company context missing.' });
        }

        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 20;
        const offset = (page - 1) * limit;

        const { search, action, startDate, endDate } = req.query;

        let whereClauses = ['(a.company_id = ? OR (a.company_id IS NULL AND u.company_id = ?))'];
        let queryParams = [companyId, companyId];

        if (action && action !== 'ALL') {
            whereClauses.push('a.action = ?');
            queryParams.push(action);
        }

        if (startDate) {
            whereClauses.push('DATE(a.created_at) >= ?');
            queryParams.push(startDate);
        }

        if (endDate) {
            whereClauses.push('DATE(a.created_at) <= ?');
            queryParams.push(endDate);
        }

        if (search) {
            whereClauses.push('(u.name LIKE ? OR u.email LIKE ? OR a.action LIKE ? OR a.details LIKE ?)');
            const searchWildcard = `%${search}%`;
            queryParams.push(searchWildcard, searchWildcard, searchWildcard, searchWildcard);
        }

        const whereSql = whereClauses.join(' AND ');

        // Count Total
        const countQuery = `
            SELECT COUNT(*) AS total 
            FROM audit_logs a
            LEFT JOIN users u ON a.admin_id = u.id
            WHERE ${whereSql}
        `;
        const [countResult] = await db.execute(countQuery, queryParams);
        const total = countResult[0]?.total || 0;

        // Fetch Paginated Logs
        const dataQuery = `
            SELECT 
                a.id,
                a.admin_id,
                a.action,
                a.target_id,
                a.details,
                a.created_at,
                u.name AS admin_name,
                u.email AS admin_email,
                u.role AS admin_role,
                u.photo AS admin_photo
            FROM audit_logs a
            LEFT JOIN users u ON a.admin_id = u.id
            WHERE ${whereSql}
            ORDER BY a.created_at DESC
            LIMIT ? OFFSET ?
        `;
        const [rows] = await db.execute(dataQuery, [...queryParams, limit, offset]);

        // Parse JSON details if applicable
        const formattedLogs = rows.map(log => {
            let parsedDetails = log.details;
            try {
                if (typeof log.details === 'string' && (log.details.startsWith('{') || log.details.startsWith('['))) {
                    parsedDetails = JSON.parse(log.details);
                }
            } catch (e) {}

            return {
                ...log,
                details: parsedDetails
            };
        });

        // Available distinct action types for filter dropdown
        const [actionRows] = await db.execute(
            `SELECT DISTINCT a.action 
             FROM audit_logs a 
             LEFT JOIN users u ON a.admin_id = u.id
             WHERE (a.company_id = ? OR (a.company_id IS NULL AND u.company_id = ?))
             ORDER BY a.action ASC`,
            [companyId, companyId]
        );
        const availableActions = actionRows.map(r => r.action);

        return res.json({
            success: true,
            logs: formattedLogs,
            availableActions,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (err) {
        console.error('Error fetching audit logs:', err);
        return res.status(500).json({ message: 'Failed to fetch audit logs', error: err.message });
    }
};

/**
 * Get Audit Log Summary Stats
 */
exports.getAuditStats = async (req, res) => {
    try {
        const companyId = req.user.company_id;
        if (!companyId) {
            return res.status(400).json({ message: 'Company context missing.' });
        }

        const [todayCount] = await db.execute(
            `SELECT COUNT(*) as count 
             FROM audit_logs a 
             LEFT JOIN users u ON a.admin_id = u.id
             WHERE (a.company_id = ? OR (a.company_id IS NULL AND u.company_id = ?))
               AND DATE(a.created_at) = CURDATE()`,
            [companyId, companyId]
        );

        const [weekCount] = await db.execute(
            `SELECT COUNT(*) as count 
             FROM audit_logs a 
             LEFT JOIN users u ON a.admin_id = u.id
             WHERE (a.company_id = ? OR (a.company_id IS NULL AND u.company_id = ?))
               AND a.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`,
            [companyId, companyId]
        );

        const [totalCount] = await db.execute(
            `SELECT COUNT(*) as count 
             FROM audit_logs a 
             LEFT JOIN users u ON a.admin_id = u.id
             WHERE (a.company_id = ? OR (a.company_id IS NULL AND u.company_id = ?))`,
            [companyId, companyId]
        );

        const [topActions] = await db.execute(
            `SELECT a.action, COUNT(*) as count 
             FROM audit_logs a 
             LEFT JOIN users u ON a.admin_id = u.id
             WHERE (a.company_id = ? OR (a.company_id IS NULL AND u.company_id = ?))
             GROUP BY a.action 
             ORDER BY count DESC 
             LIMIT 5`,
            [companyId, companyId]
        );

        return res.json({
            today: todayCount[0]?.count || 0,
            thisWeek: weekCount[0]?.count || 0,
            total: totalCount[0]?.count || 0,
            topActions
        });
    } catch (err) {
        console.error('Error fetching audit stats:', err);
        return res.status(500).json({ message: 'Failed to fetch audit statistics', error: err.message });
    }
};
