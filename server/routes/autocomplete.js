const express = require('express');
const pool = require('../db/pool');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const fs = require('fs');
const path = require('path');

// Cache for locations data
let locationsDataCache = null;
let lastCacheUpdate = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const getBaseLocations = () => {
    try {
        const filePath = path.join(__dirname, '..', 'data', 'india_states_districts.json');
        if (fs.existsSync(filePath)) {
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
    } catch (err) {
        console.error('Error loading base locations data:', err);
    }
    return {};
};

// GET /api/autocomplete/locations
router.get('/locations', authenticate, async (req, res) => {
    try {
        const now = Date.now();
        if (locationsDataCache && (now - lastCacheUpdate < CACHE_TTL)) {
            return res.json(locationsDataCache);
        }

        // Deep copy static data
        const data = JSON.parse(JSON.stringify(getBaseLocations()));
        
        // Fetch all learned locations from the universities table
        // Optimized query to only get unique pairs
        const customResult = await pool.query(`
            SELECT DISTINCT state, district 
            FROM universities 
            WHERE state IS NOT NULL AND district IS NOT NULL
              AND state != '__other__' AND district != '__other__'
        `);
        
        for (const row of customResult.rows) {
            const state = row.state.trim();
            const district = row.district.trim();
            
            if (!state || !district) continue;
            
            if (!data[state]) {
                data[state] = [];
            }
            if (!data[state].includes(district)) {
                data[state].push(district);
            }
        }
        
        // Sort districts alphabetically and build sorted object
        const sortedData = {};
        Object.keys(data).sort().forEach(state => {
            sortedData[state] = data[state].sort();
        });

        // Update cache
        locationsDataCache = sortedData;
        lastCacheUpdate = now;

        res.json(sortedData);
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

        // Optimized fuzzy pattern: only extract alphanumeric characters
        const fuzzyPattern = q.split('').filter(c => /[a-zA-Z0-9]/.test(c)).join('.*');

        const result = await pool.query(
            `SELECT name, state, district, is_custom, acronym
             FROM universities
             WHERE name ILIKE $1 
                OR acronym ILIKE $1 
                OR name ~* $2
                OR acronym ~* $2
             ORDER BY 
                (CASE 
                    WHEN name ILIKE $1 THEN 0 
                    WHEN acronym ILIKE $1 THEN 1
                    ELSE 2 
                 END),
                similarity(name, $3) DESC
             LIMIT 15`,
            [`%${q}%`, fuzzyPattern, q]
        );

        res.json({ results: result.rows });
    } catch (err) {
        console.error('University autocomplete error:', err);
        res.status(500).json({ error: 'Failed to fetch universities' });
    }
});

module.exports = router;
