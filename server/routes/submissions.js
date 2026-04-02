const express = require('express');
const Joi = require('joi');
const pool = require('../db/pool');
const { authenticate, requireAdmin, checkFormAccess } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

// POST /api/forms/:formId/submit — Submit form (transaction-safe)
router.post('/:formId/submit', authenticate, async (req, res) => {
    const client = await pool.connect();
    try {
        const { values } = req.body; // { fieldId: value, ... }
        if (!values || typeof values !== 'object') {
            return res.status(400).json({ error: 'values object is required' });
        }

        // Check Access (now collaborative)
        const access = await checkFormAccess(req.params.formId, req.user.id, req.user.role);
        if (!access.exists) return res.status(404).json({ error: 'Form not found' });
        if (!access.hasAccess) return res.status(403).json({ error: 'You need approval from the owner to fill this form' });

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

            // Integer/Number validation
            if (field.type === 'integer' && val !== undefined && val !== null && val !== '') {
                const numVal = Number(val);
                if (isNaN(numVal)) {
                    return res.status(400).json({
                        error: `Field "${field.label}" must be a valid number`,
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
            'INSERT INTO submissions (form_version_id, updated_by) VALUES ($1, $2) RETURNING *',
            [versionId, req.user.id]
        );
        const submission = subResult.rows[0];

        // Insert values and check for "Learning"
        for (const field of fields) {
            const rawVal = values[field.id] !== undefined ? String(values[field.id]) : '';
            await client.query(
                'INSERT INTO submission_values (submission_id, field_id, value) VALUES ($1, $2, $3)',
                [submission.id, field.id, rawVal]
            );

            // Dynamic Learning for University
            if (field.type === 'university_autocomplete' && rawVal) {
                // Try to find state/district in same submission (either separate fields or composite address)
                let uState = '';
                let uDist = '';
                for (const f of fields) {
                    const label = f.label.toLowerCase();
                    const val = values[f.id] || '';
                    if (label.includes('state') && !uState) uState = val;
                    if (label.includes('district') && !uDist) uDist = val;
                    
                    // Also check if there's a residential_address field to extract from
                    if (f.type === 'residential_address' && val) {
                        const parts = val.split(' ||| ');
                        if (parts.length >= 3) {
                            if (!uDist) uDist = parts[1];
                            if (!uState) uState = parts[2];
                        }
                    }
                }
                if (uState && uDist) {
                    await client.query(
                        'INSERT INTO universities (name, state, district) SELECT $1, $2, $3 WHERE NOT EXISTS (SELECT 1 FROM universities WHERE name = $1 AND state = $2 AND district = $3)',
                        [rawVal, uState, uDist]
                    );
                }
            }

            // Dynamic Learning for Branch
            if (field.type === 'branch' && rawVal) {
                await client.query(
                    'INSERT INTO branches (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
                    [rawVal]
                );
            }
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

// GET /api/forms/:formId/submissions — List submissions
router.get('/:formId/submissions', authenticate, async (req, res) => {
    try {
        // Check Access
        const access = await checkFormAccess(req.params.formId, req.user.id, req.user.role);
        if (!access.exists) return res.status(404).json({ error: 'Form not found' });
        if (!access.hasAccess) return res.status(403).json({ error: 'Access denied' });

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

        // Get submissions with values and edit info
        const subsResult = await pool.query(
            `SELECT s.id, s.submitted_at, s.updated_at, u.username as updated_by_username,
                json_agg(
                    json_build_object('field_id', sv.field_id, 'value', sv.value)
                    ORDER BY sv.field_id
                ) as values
            FROM submissions s
            LEFT JOIN submission_values sv ON sv.submission_id = s.id
            LEFT JOIN users u ON s.updated_by = u.id
            WHERE s.form_version_id = $1
            GROUP BY s.id, s.submitted_at, s.updated_at, u.username
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

/**
 * PUT /api/forms/:formId/submissions/:submissionId — Edit existing submission
 */
router.put('/:formId/submissions/:submissionId', authenticate, async (req, res) => {
    const client = await pool.connect();
    try {
        const { values } = req.body;
        if (!values || typeof values !== 'object') {
            return res.status(400).json({ error: 'values object is required' });
        }

        // Check Access
        const access = await checkFormAccess(req.params.formId, req.user.id, req.user.role);
        if (!access.exists) return res.status(404).json({ error: 'Form not found' });
        if (!access.hasAccess) return res.status(403).json({ error: 'Access denied' });

        await client.query('BEGIN');

        // Update submission metadata
        await client.query(
            'UPDATE submissions SET updated_at = NOW(), updated_by = $1 WHERE id = $2',
            [req.user.id, req.params.submissionId]
        );

        // Update values (Delete then re-insert for simplicity)
        await client.query('DELETE FROM submission_values WHERE submission_id = $1', [req.params.submissionId]);

        for (const [fieldId, val] of Object.entries(values)) {
            await client.query(
                'INSERT INTO submission_values (submission_id, field_id, value) VALUES ($1, $2, $3)',
                [req.params.submissionId, fieldId, String(val)]
            );
        }

        await client.query('COMMIT');
        res.json({ message: 'Submission updated successfully' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Edit submission error:', err);
        res.status(500).json({ error: 'Failed to update submission' });
    } finally {
        client.release();
    }
});

module.exports = router;
