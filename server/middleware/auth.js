const jwt = require('jsonwebtoken');
const pool = require('../db/pool');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        // Ensure ID is a number to match DB integer type
        if (decoded.id) decoded.id = Number(decoded.id);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}

function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
}

/**
 * Check if user has access to a form (owner, admin, or approved collaborator)
 */
const checkFormAccess = async (formId, userId, userRole) => {
    const formResult = await pool.query(
        `SELECT f.*, u.role as owner_role 
         FROM forms f 
         JOIN users u ON f.user_id = u.id 
         WHERE f.id = $1`, 
        [formId]
    );
    if (formResult.rows.length === 0) return { exists: false, hasAccess: false };
    
    const form = formResult.rows[0];
    const isOwner = Number(form.user_id) === Number(userId);
    const isAdmin = userRole === 'admin';

    if (isAdmin || isOwner) {
        return { exists: true, hasAccess: true, isOwner, isAdmin, form };
    }

    // Check collaborator approval (now allowed even for admin-owned forms)
    const permResult = await pool.query(
        'SELECT status FROM form_permissions WHERE form_id = $1 AND user_id = $2 AND status = $3',
        [formId, Number(userId), 'approved']
    );
    
    if (permResult.rows.length > 0) {
        return { exists: true, hasAccess: true, isOwner: false, isAdmin: false, form };
    }

    // STRICT RULE: If form is owned by an admin, only admins (or approved collaborators) can access it
    if (form.owner_role === 'admin' && !isAdmin) {
        return { exists: true, hasAccess: false, isOwner: false, isAdmin: false, form };
    }

    return { 
        exists: true, 
        hasAccess: false, 
        isOwner: false,
        isAdmin: false,
        form
    };
};

/**
 * Check if user strictly owns a form (or is admin) - used for Rename, Delete, Lock
 */
const checkFormOwnership = async (formId, userId, userRole) => {
    const result = await pool.query(
        `SELECT f.*, u.role as owner_role 
         FROM forms f 
         JOIN users u ON f.user_id = u.id 
         WHERE f.id = $1`, 
        [formId]
    );
    if (result.rows.length === 0) {
        return { exists: false, hasAccess: false };
    }
    const form = result.rows[0];
    const isOwner = Number(form.user_id) === Number(userId);
    const isAdmin = userRole === 'admin';

    // STRICT RULE: If form is owned by an admin, only admins can access it
    if (form.owner_role === 'admin' && !isAdmin) {
        return { exists: true, hasAccess: false, isOwner: false, isAdmin: false, form };
    }

    return { exists: true, hasAccess: isOwner || isAdmin, isOwner, isAdmin, form };
};

module.exports = { authenticate, requireAdmin, checkFormAccess, checkFormOwnership, JWT_SECRET };
