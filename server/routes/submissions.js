const express = require('express');
const Joi = require('joi');
const pool = require('../db/pool');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

// POST /api/forms/:formId/submit — Submit form (transaction-safe)
router.post('/:formId/submit', authenticate, async (req, res) => {
    const client = await pool.connect();
    try {
        const { values } = req.body; // { fieldId: value, ... }
        if (!values || typeof values !== 'object') {
            return res.status(400).json({ error: 'values object is required' });
        }

        // Get latest version
        const versionResult = await client.query(
            'SELECT id FROM form_versions WHERE form_id = $1 ORDER BY version_number DESC LIMIT 1',
            [req.params.formId]
        );
        if (versionResult.rows.length === 0) {
            return res.status(404).json({ error: 'Form not found or no version exists' });
        }
        const versionId = versionResult.rows[0].id;

        // Get fields for validation
        const fieldsResult = await client.query(
            'SELECT * FROM form_fields WHERE form_version_id = $1 ORDER BY field_order',
            [versionId]
        );
        const fields = fieldsResult.rows;

        // Validate values
        for (const field of fields) {
            const val = values[field.id];
            const rules = field.validation_rules || {};

            // Integer validation
            if (field.type === 'integer' && val !== undefined && val !== null && val !== '') {
                const numVal = Number(val);
                if (!Number.isInteger(numVal)) {
                    return res.status(400).json({
                        error: `Field "${field.label}" must be a valid integer`,
                    });
                }
                if (rules.min !== undefined && numVal < rules.min) {
                    return res.status(400).json({
                        error: `Field "${field.label}" must be at least ${rules.min}`,
                    });
                }
                if (rules.max !== undefined && numVal > rules.max) {
                    return res.status(400).json({
                        error: `Field "${field.label}" must be at most ${rules.max}`,
                    });
                }
            }
        }

        await client.query('BEGIN');

        // Auto-lock form on first submission
        await client.query('UPDATE forms SET is_locked = true WHERE id = $1 AND is_locked = false', [
            req.params.formId,
        ]);

        // Insert submission
        const subResult = await client.query(
            'INSERT INTO submissions (form_version_id) VALUES ($1) RETURNING *',
            [versionId]
        );
        const submission = subResult.rows[0];

        // Insert values
        for (const field of fields) {
            const val = values[field.id] !== undefined ? String(values[field.id]) : '';
            await client.query(
                'INSERT INTO submission_values (submission_id, field_id, value) VALUES ($1, $2, $3)',
                [submission.id, field.id, val]
            );
        }

        await client.query('COMMIT');

        res.status(201).json({ submission });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Submit error:', err);
        res.status(500).json({ error: 'Submission failed' });
    } finally {
        client.release();
    }
});

// GET /api/forms/:formId/submissions — List submissions (admin)
router.get('/:formId/submissions', authenticate, requireAdmin, async (req, res) => {
    try {
        // Get latest version
        const versionResult = await pool.query(
            'SELECT id FROM form_versions WHERE form_id = $1 ORDER BY version_number DESC LIMIT 1',
            [req.params.formId]
        );
        if (versionResult.rows.length === 0) {
            return res.status(404).json({ error: 'Form not found' });
        }
        const versionId = versionResult.rows[0].id;

        // Get fields
        const fieldsResult = await pool.query(
            'SELECT * FROM form_fields WHERE form_version_id = $1 ORDER BY field_order',
            [versionId]
        );

        // Get submissions with values
        const subsResult = await pool.query(
            `SELECT s.id, s.submitted_at, json_agg(
        json_build_object('field_id', sv.field_id, 'value', sv.value)
        ORDER BY sv.field_id
      ) as values
      FROM submissions s
      LEFT JOIN submission_values sv ON sv.submission_id = s.id
      WHERE s.form_version_id = $1
      GROUP BY s.id, s.submitted_at
      ORDER BY s.submitted_at DESC`,
            [versionId]
        );

        res.json({
            fields: fieldsResult.rows,
            submissions: subsResult.rows,
        });
    } catch (err) {
        console.error('List submissions error:', err);
        res.status(500).json({ error: 'Failed to list submissions' });
    }
});

module.exports = router;
