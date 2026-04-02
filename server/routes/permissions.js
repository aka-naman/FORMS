const express = require('express');
const pool = require('../db/pool');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/permissions/status/:formId
router.get('/status/:formId', authenticate, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT status FROM form_permissions WHERE form_id = $1 AND user_id = $2',
            [req.params.formId, req.user.id]
        );
        res.json({ status: result.rows[0]?.status || 'none' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to get permission status' });
    }
});

// POST /api/permissions/request/:formId
router.post('/request/:formId', authenticate, async (req, res) => {
    try {
        await pool.query(
            'INSERT INTO form_permissions (form_id, user_id, status) VALUES ($1, $2, $3) ON CONFLICT (form_id, user_id) DO UPDATE SET status = $3',
            [req.params.formId, req.user.id, 'pending']
        );
        res.json({ message: 'Request sent' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to send request' });
    }
});

// GET /api/permissions/pending (For owners/admins)
router.get('/pending', authenticate, async (req, res) => {
    try {
        const isAdmin = req.user.role === 'admin';
        const result = await pool.query(
            `SELECT p.*, f.name as form_name, u.username as requester_username
             FROM form_permissions p
             JOIN forms f ON p.form_id = f.id
             JOIN users u ON p.user_id = u.id
             WHERE p.status = 'pending' ${isAdmin ? '' : 'AND f.user_id = $1'}`,
            isAdmin ? [] : [req.user.id]
        );
        res.json({ requests: result.rows });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch requests' });
    }
});

// POST /api/permissions/approve/:permissionId
router.post('/approve/:permissionId', authenticate, async (req, res) => {
    try {
        // Only owner or admin can approve
        const permResult = await pool.query('SELECT form_id FROM form_permissions WHERE id = $1', [req.params.permissionId]);
        if (permResult.rows.length === 0) return res.status(404).json({ error: 'Not found' });
        
        const formId = permResult.rows[0].form_id;
        const formResult = await pool.query('SELECT user_id FROM forms WHERE id = $1', [formId]);
        
        if (req.user.role !== 'admin' && formResult.rows[0].user_id !== req.user.id) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        await pool.query('UPDATE form_permissions SET status = $1 WHERE id = $2', ['approved', req.params.permissionId]);
        res.json({ message: 'Approved' });
    } catch (err) {
        res.status(500).json({ error: 'Approval failed' });
    }
});

module.exports = router;
