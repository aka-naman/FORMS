const express = require('express');
const pool = require('../db/pool');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// ═══════════════════════════════════════ UTILITY FUNCTIONS ═══════════════════════════════════════

/**
 * Check if user owns a form or is admin
 */
const checkFormOwnership = async (formId, userId, userRole) => {
    const result = await pool.query(
        'SELECT user_id FROM forms WHERE id = $1',
        [formId]
    );

    if (result.rows.length === 0) {
        return { exists: false, hasAccess: false };
    }

    const form = result.rows[0];
    const isOwner = form.user_id === userId;
    const isAdmin = userRole === 'admin';
    const hasAccess = isOwner || isAdmin;

    return { exists: true, hasAccess, isOwner, isAdmin, form };
};

// ═══════════════════════════════════════ USER ROUTES ═══════════════════════════════════════

/**
 * GET /api/forms — List forms
 * - Regular users: see only their own forms
 * - Admins: see all forms with owner info
 */
router.get('/', authenticate, async (req, res) => {
    try {
        const isAdmin = req.user.role === 'admin';
        const userId = req.user.id;

        const result = await pool.query(
            isAdmin
                ? `SELECT f.*,
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
                  ORDER BY f.created_at DESC`
                : `SELECT f.*,
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
                  ORDER BY f.created_at DESC`,
            isAdmin ? [] : [userId]
        );

        res.json({ forms: result.rows });
    } catch (err) {
        console.error('List forms error:', err);
        res.status(500).json({ error: 'Failed to list forms' });
    }
});

/**
 * POST /api/forms — Create new form + initial version
 * - Any authenticated user can create (removed admin requirement)
 * - Form is assigned to the current user
 */
router.post('/', authenticate, async (req, res) => {
    const client = await pool.connect();
    try {
        const { name } = req.body;

        // Validation
        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Form name is required' });
        }
        if (name.trim().length > 200) {
            return res.status(400).json({ error: 'Form name must be less than 200 characters' });
        }

        await client.query('BEGIN');

        // Create form with user_id
        const formResult = await client.query(
            'INSERT INTO forms (name, user_id) VALUES ($1, $2) RETURNING *',
            [name.trim(), req.user.id]
        );
        const form = formResult.rows[0];

        // Create initial version
        const versionResult = await client.query(
            'INSERT INTO form_versions (form_id, version_number) VALUES ($1, 1) RETURNING *',
            [form.id]
        );

        await client.query('COMMIT');

        res.status(201).json({
            form,
            version: versionResult.rows[0],
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Create form error:', err);
        res.status(500).json({ error: 'Failed to create form' });
    } finally {
        client.release();
    }
});

/**
 * PUT /api/forms/:id — Rename form
 * - Owner or Admin can edit
 */
router.put('/:id', authenticate, async (req, res) => {
    try {
        const { name } = req.body;

        // Validation
        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Form name is required' });
        }
        if (name.trim().length > 200) {
            return res.status(400).json({ error: 'Form name must be less than 200 characters' });
        }

        // Check ownership
        const ownership = await checkFormOwnership(req.params.id, req.user.id, req.user.role);
        if (!ownership.exists) {
            return res.status(404).json({ error: 'Form not found' });
        }
        if (!ownership.hasAccess) {
            return res.status(403).json({ error: 'You do not have permission to edit this form' });
        }

        // Check if form is locked (only admins can bypass this in the future)
        const lockedCheck = await pool.query('SELECT is_locked FROM forms WHERE id = $1', [req.params.id]);
        if (lockedCheck.rows[0].is_locked && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Form is locked and cannot be edited' });
        }

        const result = await pool.query(
            'UPDATE forms SET name = $1 WHERE id = $2 RETURNING *',
            [name.trim(), req.params.id]
        );

        res.json({ form: result.rows[0] });
    } catch (err) {
        console.error('Rename form error:', err);
        res.status(500).json({ error: 'Failed to rename form' });
    }
});

/**
 * DELETE /api/forms/:id — Delete form + cascade
 * - Owner or Admin can delete
 */
router.delete('/:id', authenticate, async (req, res) => {
    try {
        // Check ownership
        const ownership = await checkFormOwnership(req.params.id, req.user.id, req.user.role);
        if (!ownership.exists) {
            return res.status(404).json({ error: 'Form not found' });
        }
        if (!ownership.hasAccess) {
            return res.status(403).json({ error: 'You do not have permission to delete this form' });
        }

        // Delete form (cascade handled by DB)
        await pool.query('DELETE FROM forms WHERE id = $1', [req.params.id]);
        res.json({ message: 'Form deleted successfully' });
    } catch (err) {
        console.error('Delete form error:', err);
        res.status(500).json({ error: 'Failed to delete form' });
    }
});

/**
 * POST /api/forms/:id/duplicate — Duplicate form + latest version + fields
 * - Owner or Admin can duplicate
 * - Duplicated form belongs to current user
 */
router.post('/:id/duplicate', authenticate, async (req, res) => {
    const client = await pool.connect();
    try {
        // Check ownership
        const ownership = await checkFormOwnership(req.params.id, req.user.id, req.user.role);
        if (!ownership.exists) {
            await client.release();
            return res.status(404).json({ error: 'Form not found' });
        }
        if (!ownership.hasAccess) {
            await client.release();
            return res.status(403).json({ error: 'You do not have permission to duplicate this form' });
        }

        await client.query('BEGIN');

        const originalForm = ownership.form;

        // Create duplicated form (assigned to current user)
        const newFormResult = await client.query(
            'INSERT INTO forms (name, user_id) VALUES ($1, $2) RETURNING *',
            [`Copy of ${originalForm.name}`, req.user.id]
        );
        const newForm = newFormResult.rows[0];

        // Get latest version of original
        const versionResult = await client.query(
            'SELECT * FROM form_versions WHERE form_id = $1 ORDER BY version_number DESC LIMIT 1',
            [originalForm.id]
        );

        if (versionResult.rows.length > 0) {
            const originalVersion = versionResult.rows[0];

            // Create new version
            const newVersionResult = await client.query(
                'INSERT INTO form_versions (form_id, version_number) VALUES ($1, 1) RETURNING *',
                [newForm.id]
            );
            const newVersion = newVersionResult.rows[0];

            // Copy fields
            const fieldsResult = await client.query(
                'SELECT label, type, options_json, field_order, validation_rules FROM form_fields WHERE form_version_id = $1 ORDER BY field_order',
                [originalVersion.id]
            );

            for (const field of fieldsResult.rows) {
                await client.query(
                    'INSERT INTO form_fields (form_version_id, label, type, options_json, field_order, validation_rules) VALUES ($1, $2, $3, $4, $5, $6)',
                    [newVersion.id, field.label, field.type, JSON.stringify(field.options_json || []), field.field_order, JSON.stringify(field.validation_rules || {})]
                );
            }
        }

        await client.query('COMMIT');

        res.status(201).json({ form: newForm });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Duplicate form error:', err);
        res.status(500).json({ error: 'Failed to duplicate form' });
    } finally {
        client.release();
    }
});

/**
 * POST /api/forms/:id/lock — Lock form schema
 * - Owner or Admin can lock
 */
router.post('/:id/lock', authenticate, async (req, res) => {
    try {
        // Check ownership
        const ownership = await checkFormOwnership(req.params.id, req.user.id, req.user.role);
        if (!ownership.exists) {
            return res.status(404).json({ error: 'Form not found' });
        }
        if (!ownership.hasAccess) {
            return res.status(403).json({ error: 'You do not have permission to lock this form' });
        }

        const result = await pool.query(
            'UPDATE forms SET is_locked = true WHERE id = $1 RETURNING *',
            [req.params.id]
        );

        res.json({ form: result.rows[0] });
    } catch (err) {
        console.error('Lock form error:', err);
        res.status(500).json({ error: 'Failed to lock form' });
    }
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
