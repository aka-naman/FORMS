require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.example') });
try {
    require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), override: true });
} catch (_) { }

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const authRoutes = require('./routes/auth');
const formRoutes = require('./routes/forms');
const fieldRoutes = require('./routes/fields');
const submissionRoutes = require('./routes/submissions');
const autocompleteRoutes = require('./routes/autocomplete');
const exportRoutes = require('./routes/export');
const adminUserRoutes = require('./routes/admin-users');

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 5000;

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/forms', formRoutes);
app.use('/api/forms', fieldRoutes);
app.use('/api/forms', submissionRoutes);
app.use('/api/forms', exportRoutes);
app.use('/api/admin/users', adminUserRoutes);
app.use('/api/autocomplete', autocompleteRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static frontend in production
const clientBuildPath = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientBuildPath));
app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(clientBuildPath, 'index.html'));
    }
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

const os = require('os');
const getLocalIP = () => {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '0.0.0.0';
};

app.listen(PORT, '0.0.0.0', () => {
    const localIP = getLocalIP();
    console.log(`\n🚀 Form Dashboard API running at:`);
    console.log(`   Local:   http://localhost:${PORT}`);
    console.log(`   Network: http://${localIP}:${PORT}`);
});

module.exports = app;
