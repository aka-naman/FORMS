const express = require('express');
const pool = require('../db/pool');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/autocomplete/university?q=
router.get('/university', authenticate, async (req, res) => {
    try {
        const q = (req.query.q || '').trim();
        if (q.length < 2) {
            return res.json({ results: [] });
        }

        const result = await pool.query(
            `SELECT name, state, district
       FROM universities
       WHERE name ILIKE $1
       ORDER BY similarity(name, $2) DESC
       LIMIT 10`,
            [`%${q}%`, q]
        );

        res.json({ results: result.rows });
    } catch (err) {
        console.error('Autocomplete error:', err);
        res.status(500).json({ error: 'Autocomplete search failed' });
    }
});

module.exports = router;
