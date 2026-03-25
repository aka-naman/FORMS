# Multi-User Implementation Guide

This guide explains how to implement user isolation where:
- Each user can create their own forms
- Users can only see/edit their own forms
- Admin users can see all forms from all users
- Each user's form submissions are isolated

---

## Current State vs. Desired State

### Current Architecture

| Feature | Current | Desired |
|---------|---------|---------|
| Form Creation | Requires admin role | Any authenticated user |
| Form Visibility | All users see all forms | Users see only their own |
| Form Ownership | No ownership tracking | Each form has owner (user_id) |
| Admin Capability | Can create forms | Can view all forms globally |
| User Isolation | None | Complete isolation |

---

## Implementation Steps

### Step 1: Database Migration

Add `user_id` to `forms` table:

**File: `server/db/migrate.js`**

Update the forms table creation:

```javascript
// Forms table
await client.query(`
  CREATE TABLE IF NOT EXISTS forms (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    is_locked BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
  );
`);
// Add index for faster queries
await client.query(`
  CREATE INDEX IF NOT EXISTS idx_forms_user_id
  ON forms(user_id);
`);
```

**If using existing database (add column to existing table):**

Run manually in PostgreSQL:

```sql
-- Add user_id column to forms table
ALTER TABLE forms ADD COLUMN user_id INTEGER;

-- Add foreign key constraint
ALTER TABLE forms ADD CONSTRAINT fk_forms_user_id 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Create index for performance
CREATE INDEX idx_forms_user_id ON forms(user_id);

-- Update existing forms to user 1 (temporary, change as needed)
UPDATE forms SET user_id = 1 WHERE user_id IS NULL;

-- Make user_id NOT NULL
ALTER TABLE forms ALTER COLUMN user_id SET NOT NULL;
```

Or via Node script:

**File: `server/db/add-user-isolation.js`** (create new file)

```javascript
const pool = require('./pool');

const addUserIsolation = async () => {
  const client = await pool.connect();
  try {
    console.log('Adding user isolation to forms...');

    // Add user_id column if not exists
    await client.query(`
      ALTER TABLE forms 
      ADD COLUMN IF NOT EXISTS user_id INTEGER;
    `);
    console.log('  ✓ Added user_id column');

    // Add foreign key if not exists
    await client.query(`
      ALTER TABLE forms 
      ADD CONSTRAINT fk_forms_user_id 
      FOREIGN KEY (user_id) REFERENCES users(id) 
      ON DELETE CASCADE;
    `);
    console.log('  ✓ Added foreign key constraint');

    // Create index for performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_forms_user_id
      ON forms(user_id);
    `);
    console.log('  ✓ Created index');

    console.log('\n✅ User isolation setup completed!');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
};

addUserIsolation();
```

**Run the migration:**

```bash
node server/db/add-user-isolation.js
```

---

### Step 2: Update Backend Routes

#### File: `server/routes/forms.js`

**Change 1: Update GET /api/forms (list forms)**

Replace:
```javascript
router.get('/', authenticate, async (req, res) => {
    try {
        const result = await pool.query(`
      SELECT f.*,
        fv.id as latest_version_id,
        fv.version_number,
        COALESCE(sub_count.count, 0)::int as submission_count
      FROM forms f
      LEFT JOIN LATERAL (
        SELECT id, version_number FROM form_versions
        WHERE form_id = f.id ORDER BY version_number DESC LIMIT 1
      ) fv ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int as count FROM submissions
        WHERE form_version_id = fv.id
      ) sub_count ON true
      ORDER BY f.created_at DESC
    `);
        res.json({ forms: result.rows });
```

With:
```javascript
router.get('/', authenticate, async (req, res) => {
    try {
        // Regular users see only their forms
        // Admins see all forms
        const query = req.user.role === 'admin'
          ? `SELECT f.*, u.username as owner_username,
               fv.id as latest_version_id,
               fv.version_number,
               COALESCE(sub_count.count, 0)::int as submission_count
             FROM forms f
             LEFT JOIN users u ON f.user_id = u.id
             LEFT JOIN LATERAL (
               SELECT id, version_number FROM form_versions
               WHERE form_id = f.id ORDER BY version_number DESC LIMIT 1
             ) fv ON true
             LEFT JOIN LATERAL (
               SELECT COUNT(*)::int as count FROM submissions
               WHERE form_version_id = fv.id
             ) sub_count ON true
             ORDER BY f.created_at DESC`
          : `SELECT f.*,
               fv.id as latest_version_id,
               fv.version_number,
               COALESCE(sub_count.count, 0)::int as submission_count
             FROM forms f
             LEFT JOIN LATERAL (
               SELECT id, version_number FROM form_versions
               WHERE form_id = f.id ORDER BY version_number DESC LIMIT 1
             ) fv ON true
             LEFT JOIN LATERAL (
               SELECT COUNT(*)::int as count FROM submissions
               WHERE form_version_id = fv.id
             ) sub_count ON true
             WHERE f.user_id = $1
             ORDER BY f.created_at DESC`;

        const result = req.user.role === 'admin'
          ? await pool.query(query)
          : await pool.query(query, [req.user.id]);

        res.json({ forms: result.rows });
```

**Change 2: Update POST /api/forms (create form)**

Replace:
```javascript
router.post('/', authenticate, requireAdmin, async (req, res) => {
```

With:
```javascript
router.post('/', authenticate, async (req, res) => {
```

And inside the function, update INSERT:

Replace:
```javascript
const formResult = await client.query(
    'INSERT INTO forms (name) VALUES ($1) RETURNING *',
    [name.trim()]
);
```

With:
```javascript
const formResult = await client.query(
    'INSERT INTO forms (name, user_id) VALUES ($1, $2) RETURNING *',
    [name.trim(), req.user.id]
);
```

**Change 3: Update PUT /api/forms/:id (rename form)**

Add ownership check:

```javascript
router.put('/:id', authenticate, async (req, res) => {
    try {
        const { name } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Form name is required' });
        }

        // Check ownership
        const checkResult = await pool.query(
            'SELECT user_id FROM forms WHERE id = $1',
            [req.params.id]
        );
        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Form not found' });
        }
        
        // Only owner or admin can edit
        if (req.user.role !== 'admin' && checkResult.rows[0].user_id !== req.user.id) {
            return res.status(403).json({ error: 'You do not have permission to edit this form' });
        }

        const result = await pool.query(
            'UPDATE forms SET name = $1 WHERE id = $2 RETURNING *',
            [name.trim(), req.params.id]
        );

        res.json({ form: result.rows[0] });
    } catch (err) {
        console.error('Rename form error:', err);
        res.status(500).json({ error: 'Failed to rename form' });
    }
});
```

**Change 4: Update DELETE /api/forms/:id (delete form)**

Add ownership check:

```javascript
router.delete('/:id', authenticate, async (req, res) => {
    try {
        // Check ownership
        const checkResult = await pool.query(
            'SELECT user_id FROM forms WHERE id = $1',
            [req.params.id]
        );
        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Form not found' });
        }
        
        // Only owner or admin can delete
        if (req.user.role !== 'admin' && checkResult.rows[0].user_id !== req.user.id) {
            return res.status(403).json({ error: 'You do not have permission to delete this form' });
        }

        const result = await pool.query('DELETE FROM forms WHERE id = $1 RETURNING id', [req.params.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Form not found' });
        }
        res.json({ message: 'Form deleted' });
    } catch (err) {
        console.error('Delete form error:', err);
        res.status(500).json({ error: 'Failed to delete form' });
    }
});
```

**Change 5: Update POST /api/forms/:id/duplicate (duplicate form)**

Add ownership check and copy owner:

```javascript
// Inside the function, when creating new form:
const newFormResult = await client.query(
    'INSERT INTO forms (name, user_id) VALUES ($1, $2) RETURNING *',
    [`Copy of ${originalForm.name}`, req.user.id]
);
```

---

### Step 3: Add Admin Endpoints

**File: `server/routes/forms.js`** (add new routes)

```javascript
// GET /api/forms/admin/all - Admin view all forms
router.get('/admin/all', authenticate, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const result = await pool.query(`
            SELECT f.*,
              u.username as owner_username,
              fv.id as latest_version_id,
              fv.version_number,
              COALESCE(sub_count.count, 0)::int as submission_count
            FROM forms f
            LEFT JOIN users u ON f.user_id = u.id
            LEFT JOIN LATERAL (
              SELECT id, version_number FROM form_versions
              WHERE form_id = f.id ORDER BY version_number DESC LIMIT 1
            ) fv ON true
            LEFT JOIN LATERAL (
              SELECT COUNT(*)::int as count FROM submissions
              WHERE form_version_id = fv.id
            ) sub_count ON true
            ORDER BY f.created_at DESC
        `);

        res.json({ forms: result.rows });
    } catch (err) {
        console.error('Admin list forms error:', err);
        res.status(500).json({ error: 'Failed to list forms' });
    }
});

// GET /api/forms/admin/user/:userId - Admin view specific user's forms
router.get('/admin/user/:userId', authenticate, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const result = await pool.query(`
            SELECT f.*,
              u.username as owner_username,
              fv.id as latest_version_id,
              fv.version_number,
              COALESCE(sub_count.count, 0)::int as submission_count
            FROM forms f
            LEFT JOIN users u ON f.user_id = u.id
            LEFT JOIN LATERAL (
              SELECT id, version_number FROM form_versions
              WHERE form_id = f.id ORDER BY version_number DESC LIMIT 1
            ) fv ON true
            LEFT JOIN LATERAL (
              SELECT COUNT(*)::int as count FROM submissions
              WHERE form_version_id = fv.id
            ) sub_count ON true
            WHERE f.user_id = $1
            ORDER BY f.created_at DESC
        `, [req.params.userId]);

        res.json({ forms: result.rows });
    } catch (err) {
        console.error('Admin list user forms error:', err);
        res.status(500).json({ error: 'Failed to list forms' });
    }
});

// GET /api/forms/admin/stats - Admin statistics
router.get('/admin/stats', authenticate, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const totalUsers = await pool.query('SELECT COUNT(*) as count FROM users');
        const totalForms = await pool.query('SELECT COUNT(*) as count FROM forms');
        const totalSubmissions = await pool.query('SELECT COUNT(*) as count FROM submissions');
        
        const userStats = await pool.query(`
            SELECT u.id, u.username, u.created_at,
              (SELECT COUNT(*) FROM forms WHERE user_id = u.id) as form_count,
              (SELECT COUNT(*) FROM submissions s
               INNER JOIN form_versions fv ON s.form_version_id = fv.id
               INNER JOIN forms f ON fv.form_id = f.id
               WHERE f.user_id = u.id) as submission_count
            FROM users u
            ORDER BY u.created_at DESC
        `);

        res.json({
            stats: {
                total_users: parseInt(totalUsers.rows[0].count),
                total_forms: parseInt(totalForms.rows[0].count),
                total_submissions: parseInt(totalSubmissions.rows[0].count),
                users: userStats.rows,
            }
        });
    } catch (err) {
        console.error('Admin stats error:', err);
        res.status(500).json({ error: 'Failed to get statistics' });
    }
});
```

---

### Step 4: Update Auth Middleware

**File: `server/middleware/auth.js`** (already has requireAdmin, but export it properly)

Ensure exports are correct:

```javascript
module.exports = {
    authenticate,
    requireAdmin,
    JWT_SECRET,
};
```

---

### Step 5: Frontend Changes

#### File: `client/src/pages/FormBuilderPage.jsx`

Update the beginning:

```javascript
// BEFORE: Added requireAdmin check
// const addField = () => {

// AFTER: Remove admin-only restriction
const addField = () => {
    setFields([...fields, emptyField()]);
    setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 100);
};

// The form creation already works for all users via the API
```

#### File: `client/src/pages/DashboardPage.jsx`

Update to show owner info for admins:

```javascript
// Add new column in form list (if using table view)
{user?.role === 'admin' && (
    <th>Owner</th>
)}

// In table rows:
{user?.role === 'admin' && (
    <td>{form.owner_username}</td>
)}

// Add admin button to view all forms:
{user?.role === 'admin' && (
    <button 
        onClick={() => setViewMode(viewMode === 'my-forms' ? 'all-forms' : 'my-forms')}
        className="btn btn-secondary"
    >
        {viewMode === 'my-forms' ? 'View All Forms' : 'View My Forms'}
    </button>
)}
```

#### File: `client/src/components/ProtectedRoute.jsx`

Create an admin-only page route component:

```javascript
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function AdminRoute({ children }) {
    const { user, loading } = useAuth();

    if (loading) return <div>Loading...</div>;
    if (!user) return <Navigate to="/login" />;
    if (user.role !== 'admin') return <Navigate to="/" />;

    return children;
}
```

---

### Step 6: Create Admin Dashboard Page

**File: `client/src/pages/AdminDashboardPage.jsx`** (create new)

```javascript
import { useState, useEffect } from 'react';
import api from '../api/client';
import '../styles/admin.css';

export default function AdminDashboardPage() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState(null);
    const [userForms, setUserForms] = useState([]);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            const res = await api.get('/forms/admin/stats');
            setStats(res.data.stats);
            setLoading(false);
        } catch (err) {
            console.error('Failed to fetch stats:', err);
            setLoading(false);
        }
    };

    const viewUserForms = async (userId) => {
        try {
            const res = await api.get(`/forms/admin/user/${userId}`);
            setUserForms(res.data.forms);
            setSelectedUser(userId);
        } catch (err) {
            console.error('Failed to fetch user forms:', err);
        }
    };

    if (loading) return <div className="loading">Loading...</div>;
    if (!stats) return <div className="error">Failed to load admin stats</div>;

    return (
        <div className="admin-dashboard">
            <h1>Admin Dashboard</h1>

            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-number">{stats.total_users}</div>
                    <div className="stat-label">Total Users</div>
                </div>
                <div className="stat-card">
                    <div className="stat-number">{stats.total_forms}</div>
                    <div className="stat-label">Total Forms</div>
                </div>
                <div className="stat-card">
                    <div className="stat-number">{stats.total_submissions}</div>
                    <div className="stat-label">Total Submissions</div>
                </div>
            </div>

            <h2>Users Activity</h2>
            <table className="admin-table">
                <thead>
                    <tr>
                        <th>Username</th>
                        <th>Joined</th>
                        <th>Forms Created</th>
                        <th>Submissions</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    {stats.users.map(user => (
                        <tr key={user.id}>
                            <td>{user.username}</td>
                            <td>{new Date(user.created_at).toLocaleDateString()}</td>
                            <td>{user.form_count}</td>
                            <td>{user.submission_count}</td>
                            <td>
                                <button
                                    onClick={() => viewUserForms(user.id)}
                                    className="btn btn-sm btn-secondary"
                                >
                                    View Forms
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {selectedUser && (
                <div className="user-forms-modal">
                    <h3>Forms by User</h3>
                    <div className="forms-list">
                        {userForms.map(form => (
                            <div key={form.id} className="form-card">
                                <h4>{form.name}</h4>
                                <p>{form.description}</p>
                                <p>Submissions: {form.submission_count}</p>
                            </div>
                        ))}
                    </div>
                    <button onClick={() => setSelectedUser(null)} className="btn btn-secondary">
                        Close
                    </button>
                </div>
            )}
        </div>
    );
}
```

---

### Step 7: Update App Router

**File: `client/src/App.jsx`**

Add admin route:

```javascript
import { AdminRoute } from './components/ProtectedRoute';
import AdminDashboardPage from './pages/AdminDashboardPage';

// In router configuration:
<Route
    path="/admin/dashboard"
    element={
        <AdminRoute>
            <AdminDashboardPage />
        </AdminRoute>
    }
/>
```

---

## Database Schema After Changes

```sql
-- Users Table (unchanged)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Forms Table (with user_id added)
CREATE TABLE forms (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    is_locked BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Index for user_id lookup
CREATE INDEX idx_forms_user_id ON forms(user_id);
```

---

## API Changes Summary

### Before (Current)
- `POST /api/forms` → Admin only
- `GET /api/forms` → Returns all forms
- `PUT /api/forms/:id` → Admin only
- `DELETE /api/forms/:id` → Admin only

### After (Multi-User)
- `POST /api/forms` → Any authenticated user (creates under their name)
- `GET /api/forms` → Regular users see their forms, admins see all
- `PUT /api/forms/:id` → Owner + Admin can edit
- `DELETE /api/forms/:id` → Owner + Admin can delete
- `GET /api/forms/admin/all` → Admin only, see all forms
- `GET /api/forms/admin/user/:userId` → Admin only, see specific user's forms
- `GET /api/forms/admin/stats` → Admin only, global statistics

---

## User Roles & Permissions

### Regular User
- Create unlimited forms ✓
- View own forms only ✓
- Edit own forms ✓
- Delete own forms ✓
- View own form submissions ✓
- Receive responses/submissions for own forms ✓
- Cannot see other users' forms ✗

### Admin User
- Create forms ✓
- View all forms from all users ✓
- Edit any form ✓
- Delete any form ✓
- View admin dashboard ✓
- See global statistics ✓
- View any user's forms and submissions ✓

---

## Default Admin Setup

The system automatically makes the **first registered user** an admin.

### Setup Flow:
1. System starts (no users)
2. First person registers → becomes **ADMIN** 🔑
3. Subsequent registrations → become **REGULAR USERS** 👤

### To Create Another Admin (if needed):

Manually in PostgreSQL:
```sql
UPDATE users SET role = 'admin' WHERE id = 2;
```

Or add endpoint later:
```javascript
router.post('/admin/promote/:userId', authenticate, requireAdmin, async (req, res) => {
    await pool.query('UPDATE users SET role = $1 WHERE id = $2', ['admin', req.params.userId]);
    res.json({ message: 'User promoted to admin' });
});
```

---

## Testing the Implementation

### Test Scenario 1: User Isolation

1. User A creates "Survey Form"
2. User B logs in
3. User B does NOT see "Survey Form" ✓
4. Admin logs in  
5. Admin SEES "Survey Form" created by User A ✓

### Test Scenario 2: Edit Permissions

1. User A creates "Event Signup"
2. User B tries to edit "Event Signup"
3. Returns 403 Forbidden error ✓
4. User A successfully edits their form ✓

### Test Scenario 3: Admin Panel

1. Admin logs in
2. Navigates to `/admin/dashboard`
3. Sees statistics for all users ✓
4. Can filter forms by user ✓
5. Can view all submissions ✓

---

## Migration Checklist

- [ ] Run database migration to add `user_id` column
- [ ] Update `server/routes/forms.js` with user isolation logic
- [ ] Add admin endpoints for statistics
- [ ] Add middleware checks for ownership
- [ ] Update frontend form creation (remove admin check)
- [ ] Update dashboard to show form owner (for admins)
- [ ] Create admin dashboard page
- [ ] Update App router with admin routes
- [ ] Test with multiple users
- [ ] Test admin permissions
- [ ] Test form isolation
- [ ] Deploy and restart server

---

## Rollback Plan (if needed)

To revert to admin-only form creation:

**server/routes/forms.js:**
```javascript
// Change back to:
router.post('/', authenticate, requireAdmin, async (req, res) => {
    // ... old code
});
```

**Remove user_id from forms:**
```sql
ALTER TABLE forms DROP COLUMN user_id;
```

