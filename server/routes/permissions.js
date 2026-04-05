const express = require('express');
const pool = require('../db/pool');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Helper to create notifications
async function createNotification(client, userId, actorId, formId, type, permissionId, message) {
    await client.query(
        `INSERT INTO notifications (user_id, actor_id, form_id, type, permission_id, message) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, actorId, formId, type, permissionId, message]
    );
}

// Helper to log permission actions
async function logPermissionAction(client, permissionId, formId, userId, action, performedBy) {
    await client.query(
        `INSERT INTO permission_logs (permission_id, form_id, user_id, action, performed_by) 
         VALUES ($1, $2, $3, $4, $5)`,
        [permissionId, formId, userId, action, performedBy]
    );
}

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
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Get form owner
        const formOwnerRes = await client.query('SELECT user_id, name FROM forms WHERE id = $1', [req.params.formId]);
        if (formOwnerRes.rows.length === 0) return res.status(404).json({ error: 'Form not found' });
        const formOwnerId = formOwnerRes.rows[0].user_id;
        const formName = formOwnerRes.rows[0].name;

        const result = await client.query(
            'INSERT INTO form_permissions (form_id, user_id, status) VALUES ($1, $2, $3) ON CONFLICT (form_id, user_id) DO UPDATE SET status = $3 RETURNING id',
            [req.params.formId, req.user.id, 'pending']
        );
        
        const permissionId = result.rows[0].id;
        await logPermissionAction(client, permissionId, req.params.formId, req.user.id, 'requested', req.user.id);
        
        // Notify form owner
        await createNotification(
            client, 
            formOwnerId, 
            req.user.id, 
            req.params.formId, 
            'access_request', 
            permissionId, 
            `${req.user.username} requested access to "${formName}"`
        );

        // Also notify all other admins (excluding owner if they are admin, or the requester if they are admin)
        const adminsRes = await client.query("SELECT id FROM users WHERE role = 'admin' AND id != $1 AND id != $2", [formOwnerId, req.user.id]);
        for (const adminRow of adminsRes.rows) {
            await createNotification(
                client,
                adminRow.id,
                req.user.id,
                req.params.formId,
                'access_request',
                permissionId,
                `${req.user.username} requested access to "${formName}"`
            );
        }
        
        await client.query('COMMIT');
        res.json({ message: 'Request sent' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Failed to send request' });
    } finally {
        client.release();
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

// POST /api/permissions/:action/:permissionId (Approve, Reject, Ignore)
router.post('/:action/:permissionId', authenticate, async (req, res) => {
    const { action, permissionId } = req.params;
    const validActions = ['approve', 'reject', 'ignore'];
    
    if (!validActions.includes(action)) {
        return res.status(400).json({ error: 'Invalid action' });
    }

    const statusMap = {
        approve: 'approved',
        reject: 'rejected',
        ignore: 'ignored'
    };

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Only owner or admin can decide
        const permResult = await client.query(
            `SELECT p.form_id, p.user_id as requester_id, f.name as form_name 
             FROM form_permissions p 
             JOIN forms f ON p.form_id = f.id 
             WHERE p.id = $1`, [permissionId]);
             
        if (permResult.rows.length === 0) return res.status(404).json({ error: 'Not found' });
        
        const { form_id, requester_id, form_name } = permResult.rows[0];
        const formResult = await client.query('SELECT user_id FROM forms WHERE id = $1', [form_id]);
        
        if (req.user.role !== 'admin' && formResult.rows[0].user_id !== req.user.id) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        await client.query('UPDATE form_permissions SET status = $1 WHERE id = $2', [statusMap[action], permissionId]);
        
        await logPermissionAction(client, permissionId, form_id, requester_id, action, req.user.id);
        
        // Notify requester (except for 'ignore')
        if (action !== 'ignore') {
            const typeMap = {
                approve: 'request_approved',
                reject: 'request_rejected'
            };

            await createNotification(
                client,
                requester_id,
                req.user.id,
                form_id,
                typeMap[action],
                permissionId,
                `Access to "${form_name}" was ${statusMap[action]}`
            );
        }

        // Also mark the original 'access_request' notification as read/cleared for the recipient
        // (Either the owner or an admin who might have seen it)
        await client.query(
            "UPDATE notifications SET status = 'read' WHERE form_id = $1 AND actor_id = $2 AND type = 'access_request'",
            [form_id, requester_id]
        );
        
        await client.query('COMMIT');
        res.json({ message: `Successfully ${statusMap[action]}` });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: `${action} failed` });
    } finally {
        client.release();
    }
});


// GET /api/permissions/logs (Admin only or Owner for their forms)
router.get('/logs', authenticate, async (req, res) => {
    try {
        const isAdmin = req.user.role === 'admin';
        const result = await pool.query(
            `SELECT l.*, f.name as form_name, u.username as requester, p.username as performer
             FROM permission_logs l
             JOIN forms f ON l.form_id = f.id
             JOIN users u ON l.user_id = u.id
             LEFT JOIN users p ON l.performed_by = p.id
             ${isAdmin ? '' : 'WHERE f.user_id = $1'}
             ORDER BY l.timestamp DESC LIMIT 100`,
            isAdmin ? [] : [req.user.id]
        );
        res.json({ logs: result.rows });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
});

module.exports = router;
