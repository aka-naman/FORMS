const express = require('express');
const pool = require('../db/pool');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const fs = require('fs');
const path = require('path');

// Cache for locations data
let locationsData = null;

const getLocations = () => {
    if (locationsData) return locationsData;
    try {
        const filePath = path.join(__dirname, '..', 'data', 'india_states_districts.json');
        if (fs.existsSync(filePath)) {
            locationsData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            return locationsData;
        }
    } catch (err) {
        console.error('Error loading locations data:', err);
    }
    return {};
};

// GET /api/autocomplete/locations
router.get('/locations', authenticate, async (req, res) => {
    try {
        const data = getLocations();
        res.json(data);
    } catch (err) {
        console.error('Locations error:', err);
        res.status(500).json({ error: 'Failed to load locations' });
    }
});

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

// GET /api/autocomplete/branches
router.get('/branches', authenticate, async (req, res) => {
    try {
        const result = await pool.query('SELECT name FROM branches ORDER BY name ASC');
        res.json({ results: result.rows.map(r => r.name) });
    } catch (err) {
        console.error('Branches fetch error:', err);
        res.status(500).json({ error: 'Failed to fetch branches' });
    }
});

module.exports = router;
