const express = require('express');
const pool = require('../db/pool');
const { authenticate, requireAdmin, checkFormAccess, checkFormOwnership } = require('../middleware/auth');

const ExcelJS = require('exceljs');

const router = express.Router();

// ═══════════════════════════════════════ USER ROUTES ═══════════════════════════════════════

/**
 * GET /api/forms — List all visible forms
 */
router.get('/', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const isAdmin = req.user.role === 'admin';

        const result = await pool.query(
            `SELECT f.*,
                u.username as owner_username,
                u.role as owner_role,
                fv.id as latest_version_id,
                fv.version_number,
                COALESCE(sub_count.count, 0)::int as submission_count,
                CASE
                    WHEN f.user_id = $1::int THEN 'owner'
                    WHEN $2 = true THEN 'admin'
                    WHEN fp.status = 'ignored' THEN 'pending'
                    ELSE COALESCE(fp.status, 'none')
                END as access_status
            FROM forms f
            LEFT JOIN users u ON f.user_id = u.id
            LEFT JOIN form_permissions fp ON f.id = fp.form_id AND fp.user_id = $1::int
            LEFT JOIN LATERAL (
                SELECT id, version_number FROM form_versions
                WHERE form_id = f.id ORDER BY version_number DESC LIMIT 1
            ) fv ON true
            LEFT JOIN LATERAL (
                SELECT COUNT(*)::int as count FROM submissions
                WHERE form_version_id = fv.id
            ) sub_count ON true
            WHERE 
                ($2 = true) -- Admins see everything
                OR (u.role != 'admin') -- Users see all non-admin forms
                OR (f.user_id = $1::int) -- users see their own
                OR (fp.status IS NOT NULL) -- users see forms they have permission for (even if admin-owned)
            ORDER BY u.username ASC, f.created_at DESC`,
            [userId, isAdmin]
        );

        res.json({ forms: result.rows });
    } catch (err) {
        console.error('List forms error:', err);
        res.status(500).json({ error: 'Failed to list forms' });
    }
});

/**
 * POST /api/forms — Create new form + initial version
 */
router.post('/', authenticate, async (req, res) => {
    const client = await pool.connect();
    try {
        const { name } = req.body;
        if (!name || !name.trim()) return res.status(400).json({ error: 'Form name is required' });
        
        await client.query('BEGIN');
        const formResult = await client.query('INSERT INTO forms (name, user_id) VALUES ($1, $2) RETURNING *', [name.trim(), req.user.id]);
        const form = formResult.rows[0];
        await client.query('INSERT INTO form_versions (form_id, version_number) VALUES ($1, 1)', [form.id]);
        await client.query('COMMIT');
        res.status(201).json({ form });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: 'Failed to create form' });
    } finally { client.release(); }
});

/**
 * POST /api/forms/:id/duplicate — Duplicate form
 */
router.post('/:id/duplicate', authenticate, async (req, res) => {
    console.log(`\n[DEBUG DUPLICATE] Request for ID: ${req.params.id} by ${req.user.username}`);
    const client = await pool.connect();
    try {
        const access = await checkFormAccess(req.params.id, req.user.id, req.user.role);
        
        if (!access.exists) return res.status(404).json({ error: 'Form not found' });
        if (!access.hasAccess) return res.status(403).json({ error: 'Permission denied' });

        await client.query('BEGIN');
        const originalForm = access.form;
        
        console.log(`[DEBUG DUPLICATE] Inserting new form...`);
        const newFormResult = await client.query('INSERT INTO forms (name, user_id) VALUES ($1, $2) RETURNING *', [`Copy of ${originalForm.name}`, req.user.id]);
        const newForm = newFormResult.rows[0];
        console.log(`[DEBUG DUPLICATE] New Form ID: ${newForm.id}`);

        const versionResult = await client.query('SELECT * FROM form_versions WHERE form_id = $1 ORDER BY version_number DESC LIMIT 1', [originalForm.id]);
        if (versionResult.rows.length > 0) {
            const originalVersion = versionResult.rows[0];
            console.log(`[DEBUG DUPLICATE] Original Version ID: ${originalVersion.id}`);
            
            const newVersionResult = await client.query('INSERT INTO form_versions (form_id, version_number) VALUES ($1, 1) RETURNING *', [newForm.id]);
            const newVersion = newVersionResult.rows[0];
            console.log(`[DEBUG DUPLICATE] New Version ID: ${newVersion.id}`);

            const fieldsResult = await client.query('SELECT label, type, options_json, field_order, validation_rules FROM form_fields WHERE form_version_id = $1', [originalVersion.id]);
            console.log(`[DEBUG DUPLICATE] Found ${fieldsResult.rows.length} fields to copy`);
            
            for (const field of fieldsResult.rows) {
                await client.query(
                    'INSERT INTO form_fields (form_version_id, label, type, options_json, field_order, validation_rules) VALUES ($1, $2, $3, $4, $5, $6)',
                    [newVersion.id, field.label, field.type, JSON.stringify(field.options_json), field.field_order, JSON.stringify(field.validation_rules)]
                );
            }
        }
        await client.query('COMMIT');
        console.log(`[DEBUG DUPLICATE] Success!`);

        // Fetch the full form details including the version info we just created
        const finalResult = await client.query(
            `SELECT f.*, fv.id as latest_version_id, fv.version_number
             FROM forms f
             LEFT JOIN LATERAL (SELECT id, version_number FROM form_versions WHERE form_id = f.id ORDER BY version_number DESC LIMIT 1) fv ON true
             WHERE f.id = $1`, [newForm.id]
        );

        res.status(201).json({ form: finalResult.rows[0] });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[DEBUG DUPLICATE] ERROR:', err);
        res.status(500).json({ error: 'Failed to duplicate' });
    } finally { client.release(); }
});

/**
 * POST /api/forms/:id/lock — Lock form
 */
router.post('/:id/lock', authenticate, async (req, res) => {
    try {
        const ownership = await checkFormOwnership(req.params.id, req.user.id, req.user.role);
        if (!ownership.hasAccess) return res.status(403).json({ error: 'Permission denied' });
        await pool.query('UPDATE forms SET is_locked = true WHERE id = $1', [req.params.id]);
        res.json({ message: 'Locked' });
    } catch (err) { res.status(500).json({ error: 'Lock failed' }); }
});

/**
 * GET /api/forms/:id — Get details
 */
router.get('/:id', authenticate, async (req, res) => {
    try {
        const access = await checkFormAccess(req.params.id, req.user.id, req.user.role);
        if (!access.exists) return res.status(404).json({ error: 'Not found' });
        if (!access.hasAccess) return res.status(403).json({ error: 'Denied' });

        const result = await pool.query(
            `SELECT f.*, u.username as owner_username, fv.id as latest_version_id, fv.version_number
             FROM forms f
             LEFT JOIN users u ON f.user_id = u.id
             LEFT JOIN LATERAL (SELECT id, version_number FROM form_versions WHERE form_id = f.id ORDER BY version_number DESC LIMIT 1) fv ON true
             WHERE f.id = $1`, [req.params.id]
        );
        res.json({ form: result.rows[0] });
    } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

/**
 * PUT /api/forms/:id — Rename
 */
router.put('/:id', authenticate, async (req, res) => {
    try {
        const { name } = req.body;
        const ownership = await checkFormOwnership(req.params.id, req.user.id, req.user.role);
        if (!ownership.hasAccess) return res.status(403).json({ error: 'Denied' });
        const result = await pool.query('UPDATE forms SET name = $1 WHERE id = $2 RETURNING *', [name.trim(), req.params.id]);
        res.json({ form: result.rows[0] });
    } catch (err) { res.status(500).json({ error: 'Rename failed' }); }
});

/**
 * DELETE /api/forms/:id — Delete
 */
router.delete('/:id', authenticate, async (req, res) => {
    try {
        const ownership = await checkFormOwnership(req.params.id, req.user.id, req.user.role);
        if (!ownership.hasAccess) return res.status(403).json({ error: 'Denied' });
        await pool.query('DELETE FROM forms WHERE id = $1', [req.params.id]);
        res.json({ message: 'Deleted' });
    } catch (err) { res.status(500).json({ error: 'Delete failed' }); }
});

// ═══════════════════════════════════════ ADMIN ROUTES ═══════════════════════════════════════

/**
 * GET /api/forms/admin/all — Admin view all forms
 * - Admin only
 * - See all forms with owner information
 */
router.get('/admin/all', authenticate, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const result = await pool.query(`
            SELECT f.*,
              u.username as owner_username,
              fv.id as latest_version_id,
              fv.version_number,
              COALESCE(sub_count.count, 0)::int as submission_count
            FROM forms f
            LEFT JOIN users u ON f.user_id = u.id
            LEFT JOIN LATERAL (
              SELECT id, version_number FROM form_versions
              WHERE form_id = f.id ORDER BY version_number DESC LIMIT 1
            ) fv ON true
            LEFT JOIN LATERAL (
              SELECT COUNT(*)::int as count FROM submissions
              WHERE form_version_id = fv.id
            ) sub_count ON true
            ORDER BY f.created_at DESC
        `);

        res.json({ forms: result.rows });
    } catch (err) {
        console.error('Admin list forms error:', err);
        res.status(500).json({ error: 'Failed to list forms' });
    }
});

/**
 * GET /api/forms/admin/user/:userId — Admin view specific user's forms
 * - Admin only
 * - See forms created by a specific user
 */
router.get('/admin/user/:userId', authenticate, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        // Validate userId is a number
        const userId = parseInt(req.params.userId);
        if (isNaN(userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }

        // Check user exists
        const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
        if (userCheck.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const result = await pool.query(`
            SELECT f.*,
              fv.id as latest_version_id,
              fv.version_number,
              COALESCE(sub_count.count, 0)::int as submission_count
            FROM forms f
            LEFT JOIN LATERAL (
              SELECT id, version_number FROM form_versions
              WHERE form_id = f.id ORDER BY version_number DESC LIMIT 1
            ) fv ON true
            LEFT JOIN LATERAL (
              SELECT COUNT(*)::int as count FROM submissions
              WHERE form_version_id = fv.id
            ) sub_count ON true
            WHERE f.user_id = $1
            ORDER BY f.created_at DESC
        `, [userId]);

        res.json({ forms: result.rows });
    } catch (err) {
        console.error('Admin list user forms error:', err);
        res.status(500).json({ error: 'Failed to list forms' });
    }
});

/**
 * GET /api/forms/admin/stats — Admin statistics
 * - Admin only
 * - Get global statistics and user activity
 */
router.get('/admin/stats', authenticate, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const totalUsers = await pool.query('SELECT COUNT(*) as count FROM users');
        const totalForms = await pool.query('SELECT COUNT(*) as count FROM forms');
        const totalSubmissions = await pool.query('SELECT COUNT(*) as count FROM submissions');

        const userStats = await pool.query(`
            SELECT u.id, u.username, u.role, u.created_at,
              (SELECT COUNT(*) FROM forms WHERE user_id = u.id) as form_count,
              (SELECT COUNT(*) FROM submissions s
               INNER JOIN form_versions fv ON s.form_version_id = fv.id
               INNER JOIN forms f ON fv.form_id = f.id
               WHERE f.user_id = u.id) as submission_count
            FROM users u
            ORDER BY u.created_at DESC
        `);

        res.json({
            stats: {
                total_users: parseInt(totalUsers.rows[0].count),
                total_forms: parseInt(totalForms.rows[0].count),
                total_submissions: parseInt(totalSubmissions.rows[0].count),
                users: userStats.rows,
            }
        });
    } catch (err) {
        console.error('Admin stats error:', err);
        res.status(500).json({ error: 'Failed to get statistics' });
    }
});

module.exports = router;
