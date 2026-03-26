const express = require('express');
const pool = require('../db/pool');
const { authenticate } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

/**
 * Check if user owns this form
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
    return { exists: true, hasAccess: isOwner || isAdmin, form };
};

// GET /api/forms/:formId/versions/:versionId/fields
router.get('/:formId/versions/:versionId/fields', authenticate, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM form_fields WHERE form_version_id = $1 ORDER BY field_order',
            [req.params.versionId]
        );
        res.json({ fields: result.rows });
    } catch (err) {
        console.error('Get fields error:', err);
        res.status(500).json({ error: 'Failed to get fields' });
    }
});

// PUT /api/forms/:formId/versions/:versionId/fields — Bulk save (replace all fields)
router.put('/:formId/versions/:versionId/fields', authenticate, async (req, res) => {
    const client = await pool.connect();
    try {
        const { fields } = req.body;
        if (!Array.isArray(fields)) {
            return res.status(400).json({ error: 'fields must be an array' });
        }

        // Check ownership
        const ownership = await checkFormOwnership(req.params.formId, req.user.id, req.user.role);
        if (!ownership.exists) {
            return res.status(404).json({ error: 'Form not found' });
        }
        if (!ownership.hasAccess) {
            return res.status(403).json({ error: 'You do not have permission to edit this form' });
        }

        // Check if form is locked
        const formResult = await client.query('SELECT is_locked FROM forms WHERE id = $1', [req.params.formId]);
        if (formResult.rows[0].is_locked) {
            return res.status(403).json({ error: 'Form schema is locked and cannot be modified' });
        }

        await client.query('BEGIN');

        // Delete existing fields for this version
        await client.query('DELETE FROM form_fields WHERE form_version_id = $1', [req.params.versionId]);

        // Insert new fields
        const insertedFields = [];
        for (let i = 0; i < fields.length; i++) {
            const f = fields[i];
            const result = await client.query(
                `INSERT INTO form_fields (form_version_id, label, type, options_json, field_order, validation_rules)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
                [
                    req.params.versionId,
                    f.label || '',
                    f.type || 'text',
                    JSON.stringify(f.options_json || []),
                    i,
                    JSON.stringify(f.validation_rules || {}),
                ]
            );
            insertedFields.push(result.rows[0]);
        }

        await client.query('COMMIT');

        res.json({ fields: insertedFields });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Save fields error:', err);
        res.status(500).json({ error: 'Failed to save fields' });
    } finally {
        client.release();
    }
});

module.exports = router;
