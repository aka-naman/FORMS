const express = require('express');
const ExcelJS = require('exceljs');
const QueryStream = require('pg-query-stream');
const pool = require('../db/pool');
const { authenticate, checkFormAccess } = require('../middleware/auth');

const router = express.Router();

// GET /api/export/:id
router.get('/:id', authenticate, async (req, res) => {
    console.log(`[EXPORT] Started streaming export for form ID: ${req.params.id} by ${req.user.username}`);
    const client = await pool.connect();
    try {
        const formId = req.params.id;
        const userId = req.user.id;
        const userRole = req.user.role;

        const access = await checkFormAccess(formId, userId, userRole);
        if (!access.exists) {
            client.release();
            return res.status(404).json({ error: 'Form not found' });
        }
        if (!access.hasAccess) {
            client.release();
            return res.status(403).json({ error: 'Access denied' });
        }

        // Get latest version
        const versionResult = await client.query(
            'SELECT id FROM form_versions WHERE form_id = $1 ORDER BY version_number DESC LIMIT 1',
            [formId]
        );
        if (versionResult.rows.length === 0) {
            client.release();
            return res.status(404).json({ error: 'No version found' });
        }
        const versionId = versionResult.rows[0].id;

        // Get fields
        const fieldsResult = await client.query(
            'SELECT * FROM form_fields WHERE form_version_id = $1 ORDER BY field_order',
            [versionId]
        );
        const fields = fieldsResult.rows;

        // Set headers for file download
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="export_${formId}.xlsx"`);

        // Initialize ExcelJS Streaming Workbook
        const options = {
            stream: res,
            useStyles: true,
            useSharedStrings: true
        };
        const workbook = new ExcelJS.stream.xlsx.WorkbookWriter(options);
        const worksheet = workbook.addWorksheet('Submissions');

        // Define headers
        const columns = [
            { header: 'S.No', key: 'sno', width: 8 },
            { header: 'Submitted At', key: 'submitted_at', width: 22 },
            { header: 'Submitted By', key: 'submitted_by', width: 20 },
        ];
        fields.forEach(f => {
            columns.push({ header: f.label, key: `f_${f.id}`, width: 25 });
        });
        worksheet.columns = columns;

        // Use pg-query-stream for memory-efficient data retrieval
        const query = new QueryStream(
            `SELECT s.id, s.submitted_at, u.username as submitted_by,
                (SELECT json_agg(json_build_object('field_id', field_id, 'value', value))
                 FROM submission_values WHERE submission_id = s.id) as values
             FROM submissions s
             LEFT JOIN users u ON s.updated_by = u.id
             WHERE s.form_version_id = $1 AND s.deleted_at IS NULL
             ORDER BY s.submitted_at ASC`,
            [versionId]
        );

        const stream = client.query(query);
        let count = 0;

        stream.on('data', (sub) => {
            count++;
            const row = { 
                sno: count, 
                submitted_at: new Date(sub.submitted_at).toLocaleString(),
                submitted_by: sub.submitted_by || 'Deleted User'
            };
            if (sub.values) {
                sub.values.forEach(v => {
                    let val = v.value || '';
                    // Aggressively replace the internal separator " ||| " with ", "
                    if (typeof val === 'string') {
                        val = val.replace(/ \|\|\| /g, ', ');
                    }
                    row[`f_${v.field_id}`] = val;
                });
            }
            worksheet.addRow(row).commit();
        });

        stream.on('end', async () => {
            console.log(`[EXPORT] Finished streaming ${count} rows.`);
            await worksheet.commit();
            await workbook.commit();
            client.release();
        });

        stream.on('error', (err) => {
            console.error('[EXPORT] Stream error:', err);
            client.release();
            if (!res.headersSent) {
                res.status(500).json({ error: 'Streaming export failed' });
            }
        });

    } catch (err) {
        console.error('Export error:', err);
        if (client) client.release();
        if (!res.headersSent) {
            res.status(500).json({ error: 'Export failed internally' });
        }
    }
});

module.exports = router;
