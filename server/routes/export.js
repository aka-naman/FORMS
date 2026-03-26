const express = require('express');
const ExcelJS = require('exceljs');
const pool = require('../db/pool');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

// GET /api/forms/:formId/export — Generate and stream Excel
router.get('/:formId/export', authenticate, async (req, res) => {
    try {
        const formId = req.params.formId;
        const userId = req.user.id;
        const isAdmin = req.user.role === 'admin';

        // Get form and check ownership
        const formResult = await pool.query('SELECT * FROM forms WHERE id = $1', [formId]);
        if (formResult.rows.length === 0) {
            return res.status(404).json({ error: 'Form not found' });
        }
        const form = formResult.rows[0];

        // Authorization check: User must own the form or be an admin
        if (!isAdmin && form.user_id !== userId) {
            return res.status(403).json({ error: 'You do not have permission to export this form' });
        }

        // Get latest version
        const versionResult = await pool.query(
            'SELECT id FROM form_versions WHERE form_id = $1 ORDER BY version_number DESC LIMIT 1',
            [form.id]
        );
        if (versionResult.rows.length === 0) {
            return res.status(404).json({ error: 'No version found' });
        }
        const versionId = versionResult.rows[0].id;

        // Get fields
        const fieldsResult = await pool.query(
            'SELECT * FROM form_fields WHERE form_version_id = $1 ORDER BY field_order',
            [versionId]
        );
        const fields = fieldsResult.rows;

        // Get submissions with values
        const subsResult = await pool.query(
            `SELECT s.id, s.submitted_at,
        json_agg(
          json_build_object('field_id', sv.field_id, 'value', sv.value)
          ORDER BY sv.field_id
        ) as values
      FROM submissions s
      LEFT JOIN submission_values sv ON sv.submission_id = s.id
      WHERE s.form_version_id = $1
      GROUP BY s.id, s.submitted_at
      ORDER BY s.submitted_at ASC`,
            [versionId]
        );

        // Build Excel workbook
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Form Dashboard';
        workbook.created = new Date();

        const worksheet = workbook.addWorksheet(form.name || 'Submissions');

        // Header row
        const columns = [
            { header: 'S.No', key: 'sno', width: 8 },
            { header: 'Submitted At', key: 'submitted_at', width: 22 },
        ];

        for (const field of fields) {
            columns.push({
                header: field.label,
                key: `field_${field.id}`,
                width: 25,
            });
        }
        worksheet.columns = columns;

        // Style header
        worksheet.getRow(1).font = { bold: true, size: 12 };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4472C4' },
        };
        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };

        // Data rows
        subsResult.rows.forEach((sub, index) => {
            const row = {
                sno: index + 1,
                submitted_at: new Date(sub.submitted_at).toLocaleString(),
            };

            if (sub.values) {
                for (const val of sub.values) {
                    row[`field_${val.field_id}`] = val.value || '';
                }
            }

            worksheet.addRow(row);
        });

        // Set response headers
        const filename = `${form.name.replace(/[^a-zA-Z0-9]/g, '_')}_submissions.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error('Export error:', err);
        res.status(500).json({ error: 'Export failed' });
    }
});

module.exports = router;
