# Form Builder Application - Complete Project Context

**Last Updated:** March 26, 2026  
**Status:** Multi-user system fully implemented and deployed  
**Port Setup:** Client on 5174, Server on 5000  

---

## 📋 Project Overview

A modern, multi-user form builder application with role-based access control, allowing users to create, manage, and submit forms. Features include:

- **Multi-user architecture** with user isolation
- **Admin dashboard** for global statistics and user management
- **JWT authentication** with role-based access (admin/user)
- **Form versioning** and field management
- **Submission tracking** with value storage
- **Autocomplete fields** with university database support
- **LAN network access** capability

---

## 🏗️ Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Frontend** | React | 19.2.0 |
| **Build Tool** | Vite | 7.3.1 |
| **Routing** | React Router | 7.13.0 |
| **HTTP Client** | Axios | 1.13.5 |
| **Backend** | Express.js | Latest |
| **Runtime** | Node.js | 14+ |
| **Database** | PostgreSQL | 12+ |
| **Auth** | JWT Tokens | 24h expiration |
| **Password Hash** | bcrypt | 12 salt rounds |

---

## 📂 Project Structure

```
22-2-FORMS/
├── client/                          # React frontend (Vite)
│   ├── src/
│   │   ├── App.jsx                 # Main app with routes (UPDATED)
│   │   ├── main.jsx
│   │   ├── index.css               # Global styles (UPDATED)
│   │   ├── api/
│   │   │   └── client.js           # Axios instance
│   │   ├── components/
│   │   │   ├── ProtectedRoute.jsx  # Auth guard component
│   │   │   ├── AdminRoute.jsx      # Admin-only guard (NEW)
│   │   │   └── AutocompleteInput.jsx
│   │   ├── contexts/
│   │   │   ├── AuthContext.jsx     # Auth state management
│   │   │   └── ThemeContext.jsx    # Theme management
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx
│   │   │   ├── RegisterPage.jsx
│   │   │   ├── DashboardPage.jsx   # User forms list (UPDATED)
│   │   │   ├── FormBuilderPage.jsx # Form editor
│   │   │   ├── FormSubmitPage.jsx  # Form submission UI
│   │   │   ├── SubmissionsPage.jsx # Submission history
│   │   │   └── AdminDashboardPage.jsx # Admin stats (NEW)
│   │   └── styles/
│   │       └── admin-dashboard.css # Admin styling (NEW)
│   ├── .env.local                  # API URL config
│   ├── vite.config.js
│   ├── package.json
│   └── index.html
│
├── server/                          # Express backend
│   ├── index.js                     # Server entry point
│   ├── package.json
│   ├── db/
│   │   ├── pool.js                 # PostgreSQL connection pool
│   │   ├── migrate.js              # Database init script
│   │   ├── seed.js                 # Sample data loader
│   │   └── add-user-isolation.js   # User_id migration (NEW)
│   ├── middleware/
│   │   └── auth.js                 # JWT & role verification
│   └── routes/
│       ├── auth.js                 # Register/login endpoints
│       ├── forms.js                # Form CRUD (COMPLETELY REPLACED)
│       ├── fields.js               # Form fields (UPDATED)
│       ├── submissions.js          # Submission tracking
│       ├── export.js               # Data export
│       └── autocomplete.js         # University autocomplete
│
├── docker-compose.yml              # Docker orchestration
├── ecosystem.config.js             # PM2 config
├── Setup.md                        # Non-Docker deployment guide
├── README.md                       # Project overview
├── To_run.txt                      # Quick start commands
├── HOST.md                         # LAN hosting setup
├── MULTIUSER.md                    # Multi-user architecture
├── FIELD_TYPES_GUIDE.md           # Field type implementation
└── claude.md                       # This file
```

---

## 🔐 Authentication Flow

### User Registration
```
1. User enters username & password on RegisterPage
2. POST /api/auth/register with credentials
3. Backend bcrypt hashes password (12 rounds)
4. First user auto-assigned role: 'admin'
5. Subsequent users get role: 'user'
6. JWT token returned (24h expiration)
7. Token + user stored in localStorage
8. User redirected to dashboard
```

### User Login
```
1. User enters credentials on LoginPage
2. POST /api/auth/login
3. Password verified with bcrypt
4. JWT token generated if match
5. Token stored in localStorage
6. AuthContext updates user state
7. All subsequent API calls include token in Authorization header
```

### Token Verification
```
1. Each request includes token in Authorization: Bearer <token>
2. authenticate middleware verifies token signature
3. User ID and role extracted and attached to req.user
4. Expired tokens trigger localStorage wipe and login redirect
```

---

## 🗄️ Database Schema

### Tables

**users**
```sql
id SERIAL PRIMARY KEY
username VARCHAR(255) UNIQUE NOT NULL
password_hash VARCHAR(255) NOT NULL
role VARCHAR(50) DEFAULT 'user'  -- 'admin' or 'user'
created_at TIMESTAMP DEFAULT now()
```

**forms**
```sql
id SERIAL PRIMARY KEY
user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE
name VARCHAR(255) NOT NULL
description TEXT
locked BOOLEAN DEFAULT false
created_at TIMESTAMP DEFAULT now()
updated_at TIMESTAMP
-- INDEX ON user_id FOR PERFORMANCE
```

**form_fields**
```sql
id SERIAL PRIMARY KEY
form_id INTEGER NOT NULL REFERENCES forms(id) ON DELETE CASCADE
label VARCHAR(255) NOT NULL
type VARCHAR(50)  -- text, textarea, email, select, autocomplete, etc.
required BOOLEAN DEFAULT false
options JSONB  -- for select/autocomplete field options
position INTEGER
```

**submissions**
```sql
id SERIAL PRIMARY KEY
form_id INTEGER NOT NULL REFERENCES forms(id) ON DELETE CASCADE
submitted_at TIMESTAMP DEFAULT now()
```

**submission_values**
```sql
id SERIAL PRIMARY KEY
submission_id INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE
field_id INTEGER NOT NULL REFERENCES form_fields(id)
value TEXT
```

**universities**
```sql
id SERIAL PRIMARY KEY
name VARCHAR(255)
city VARCHAR(255)
country VARCHAR(255)
-- Used for autocomplete field type
```

---

## 🔑 Key Features Implemented

### 1. Multi-User Form Isolation
- Each form belongs to a user (`forms.user_id`)
- Regular users see only their forms via `GET /api/forms`
- Admins see all forms via `GET /api/forms/admin/all`
- Ownership verified on every mutation (PUT, DELETE, POST duplicate)
- Returns 403 Forbidden if user lacks access

### 2. Admin Features
**Admin Dashboard** (`/admin/dashboard`)
- Displays global statistics (users, forms, submissions)
- Table of all users with activity
- Click user row to see their forms
- Modal popup showing forms by specific user
- Only accessible to users with `role = 'admin'`

**Admin Endpoints**
- `GET /api/forms/admin/all` - All forms across all users
- `GET /api/forms/admin/user/:userId` - Specific user's forms
- `GET /api/forms/admin/stats` - Global statistics

### 3. Ownership Verification
**Utility Function: `checkFormOwnership()`**
```javascript
const checkFormOwnership = async (formId, userId, userRole) => {
  const result = await pool.query('SELECT user_id FROM forms WHERE id = $1', [formId]);
  if (result.rows.length === 0) return { exists: false, hasAccess: false };
  const form = result.rows[0];
  const isOwner = form.user_id === userId;
  const isAdmin = userRole === 'admin';
  return { exists: true, hasAccess: isOwner || isAdmin, isOwner, isAdmin, form };
};
```

Applied to all form mutations:
- PUT /api/forms/:id (edit form)
- DELETE /api/forms/:id (delete form)
- POST /api/forms/:id/duplicate (copy form)
- PUT /api/fields/:fieldId (edit field)

### 4. Route Protection
**ProtectedRoute Component**
- Requires user to be logged in
- Shows loading spinner while auth context initializes
- Redirects to /login if not authenticated

**AdminRoute Component** (NEW)
- Extends ProtectedRoute with admin check
- Shows "Access Denied" for non-admin users
- Used for `/admin/dashboard` route

### 5. Field Types System
Supported field types:
```javascript
FIELD_TYPES = [
  'text',          // Single-line text input
  'textarea',      // Multi-line text
  'email',         // Email validation
  'number',        // Numeric input
  'date',          // Date picker
  'time',          // Time picker
  'select',        // Dropdown select
  'radio',         // Radio buttons
  'checkbox',      // Checkboxes
  'autocomplete'   // Dynamic autocomplete (e.g., universities)
]
```

To add new field type:
1. Add to FIELD_TYPES array in FormBuilderPage.jsx
2. Add render logic in FormSubmitPage.jsx
3. Add validation if needed in submissions.js

---

## 🔄 Recent Changes & Fixes

### Message 1-2: Field Types & Autocomplete UI Bug
**Issue:** University autocomplete dropdown hidden behind next form field
**Solution:** CSS fix - increase z-index and set parent overflow to visible
**Documentation:** Created FIELD_TYPES_GUIDE.md

### Message 4-5: Multi-User Planning
**Documentation Created:**
- HOST.md - LAN networking setup
- MULTIUSER.md - Architecture details

### Message 6: Full Multi-User Implementation
**Files Created:**
- `server/db/add-user-isolation.js` - Database migration
- `client/src/components/AdminRoute.jsx` - Admin route guard
- `client/src/pages/AdminDashboardPage.jsx` - Admin dashboard
- `client/src/styles/admin-dashboard.css` - Admin styling

**Files Updated:**
- `server/routes/forms.js` - COMPLETE REPLACEMENT with user isolation
- `server/routes/fields.js` - Added ownership checks
- `client/src/pages/DashboardPage.jsx` - User isolation + owner badges
- `client/src/App.jsx` - Added admin routes
- `client/src/index.css` - Added badge styling

### Message 7: Setup Documentation
- Updated Setup.md for non-Docker deployment
- Comprehensive step-by-step instructions for fresh PC setup

### Message 8-9: Login & Environment Issues
**Issue:** Unable to enter after login / unable to load login page
**Root Cause:** `.env.local` had placeholder value `http://YOUR_LOCAL_IP:5000/api`
**Solution:** Updated to `http://localhost:5000/api` for local development
**Result:** Client running on port 5174, server on port 5000, API calls working

---

## 🚀 Running the Application

### Prerequisites
- Node.js 14+
- npm or yarn
- PostgreSQL 12+
- Internet connection for npm packages

### Local Development Setup

**1. Database Setup**
```bash
cd server
npm install

# Create PostgreSQL user and database
psql -U postgres
CREATE USER formbuilder WITH PASSWORD 'pass123';
CREATE DATABASE formbuilder OWNER formbuilder;

# Run migrations
npm run migrate

# Apply user isolation migration
node db/add-user-isolation.js

# Load sample data
npm run seed
```

**2. Server Setup**
```bash
cd server
npm install

# Create .env file
cat > .env << EOF
DB_USER=formbuilder
DB_PASSWORD=pass123
DB_HOST=localhost
DB_PORT=5432
DB_NAME=formbuilder
JWT_SECRET=form-dashboard-jwt-secret-2026
PORT=5000
NODE_ENV=development
EOF

# Start server (Terminal 1)
npm run dev
# Server runs on http://localhost:5000
```

**3. Client Setup**
```bash
cd client
npm install

# Create .env.local file
cat > .env.local << EOF
VITE_API_URL=http://localhost:5000/api
EOF

# Start client (Terminal 2)
npm run dev
# Client runs on http://localhost:5174
```

**4. Access Application**
```
Browser: http://localhost:5174/
```

### First-Time Setup
1. Navigate to `/register` (or click "Create one" link)
2. Enter username and password
3. First registered user automatically becomes admin
4. Register second user to test user isolation
5. Admin can access `/admin/dashboard` to view all users/forms

---

## 🧪 Testing Scenarios

### Scenario 1: User Isolation
1. Login as User1 → Create Form1
2. Logout, login as User2 → Should see empty dashboard
3. Create Form2 as User2 → Only Form2 appears
4. Logout, login as User1 → Should see only Form1

### Scenario 2: Admin Access
1. Login as User1 (first admin user)
2. Create Form1
3. Logout, login as User2 → Create Form2
4. Logout, login as User1
5. Access `/admin/dashboard` → Should see:
   - Stats showing 2 users, 2 forms
   - Table with User2 listed
   - Click User2 row → Modal shows Form2
6. On DashboardPage, should see both Form1 & Form2
   - Form1 has no badge (owned)
   - Form2 shows "by User2" badge

### Scenario 3: Permission Enforcement
1. User2 tries to direct edit User1's form URL
2. Backend returns 403 Forbidden before deletion/edit
3. User interface shows "Access Denied" if bypass frontend

### Scenario 4: Form Operations
1. Create form with multiple field types
2. Fill out and submit → Submission tracked
3. View submissions with values displayed
4. Edit form → Creates new version
5. Export form → Downloads JSON
6. Duplicate form → Creates copy with same structure

---

## 📝 API Endpoints

### Authentication
```
POST   /api/auth/register      # Register new user
POST   /api/auth/login         # Login and get token
GET    /api/auth/me            # Get current user info
```

### Forms (User Isolated)
```
GET    /api/forms              # Get user's forms (or all if admin)
POST   /api/forms              # Create new form
GET    /api/forms/:id          # Get form details
PUT    /api/forms/:id          # Update form (owner/admin only)
DELETE /api/forms/:id          # Delete form (owner/admin only)
POST   /api/forms/:id/duplicate # Copy form (owner/admin only)
POST   /api/forms/:id/lock     # Lock form (owner/admin only)
POST   /api/forms/:id/export   # Export form as JSON
```

### Admin Only
```
GET    /api/forms/admin/all          # All forms across all users
GET    /api/forms/admin/user/:userId # Specific user's forms
GET    /api/forms/admin/stats        # Global statistics
```

### Fields
```
GET    /api/fields?form_id=X   # Get form's fields
POST   /api/fields             # Add field to form
PUT    /api/fields/:id         # Update field
DELETE /api/fields/:id         # Delete field
```

### Submissions
```
GET    /api/submissions?form_id=X    # Get form submissions
POST   /api/submissions              # Submit form
GET    /api/submissions/:id          # Get submission details
```

### Autocomplete
```
GET    /api/autocomplete/universities?q=query
```

---

## 🛠️ Current Issues & Solutions

### Login Issue (Fixed)
**Problem:** Unable to enter after login  
**Cause:** `.env.local` had placeholder API URL  
**Solution:** Changed to `http://localhost:5000/api`

### Port Conflicts
**Problem:** Port 5173 in use  
**Solution:** Vite auto-switches to 5174 (check terminal output)

### Database Errors
**Problem:** Column user_id doesn't exist  
**Solution:** Run `node db/add-user-isolation.js` to migrate

### CORS Issues
**Problem:** Frontend blocked by backend CORS  
**Solution:** Already configured in Express server

---

## 📚 Documentation Files

1. **Setup.md** - Complete non-Docker setup guide for fresh PC
2. **HOST.md** - LAN network hosting configuration
3. **MULTIUSER.md** - Multi-user architecture details
4. **FIELD_TYPES_GUIDE.md** - How to add new field types
5. **README.md** - Project overview (from template)
6. **To_run.txt** - Quick start commands
7. **claude.md** - This comprehensive context file

---

## 🔒 Security Considerations

### Current Implementation
- JWT tokens expire after 24 hours
- Passwords hashed with bcrypt (12 salt rounds)
- SQL injection prevention via parameterized queries
- Ownership verified on every mutation server-side
- Role-based access control enforced
- CORS configured appropriately

### Production Improvements Needed
- Change JWT_SECRET from default
- Change database password from 'pass123'
- Enable HTTPS/SSL
- Configure firewall rules
- Setup automated database backups
- Implement rate limiting on auth endpoints
- Add input validation on all endpoints
- Validate file uploads if added

---

## 🎯 Next Steps

### Immediate (Testing)
- [ ] Verify login works on localhost:5174
- [ ] Register two users and test isolation
- [ ] Access admin dashboard as first user
- [ ] Create forms in different user accounts
- [ ] Test form submission and retrieval

### Short-term (Enhancement)
- [ ] Add form sharing with other users
- [ ] Implement form publishing URL
- [ ] Add collaborative form editing
- [ ] Create form templates library
- [ ] Add form analytics/responses chart
- [ ] Implement email notifications

### Long-term (Production)
- [ ] Deploy to production server
- [ ] Configure SSL/HTTPS
- [ ] Setup CI/CD pipeline
- [ ] Add API rate limiting
- [ ] Implement audit logging
- [ ] Create backup strategy
- [ ] Monitor performance metrics
- [ ] Add two-factor authentication

---

## 📞 Quick Reference

**Start Development:**
```bash
# Terminal 1 - Server
cd server && npm run dev

# Terminal 2 - Client
cd client && npm run dev

# Access at http://localhost:5174
```

**Database Connection:**
```bash
psql -U formbuilder -d formbuilder -h localhost
```

**Common Errors:**
| Error | Solution |
|-------|----------|
| Port 5000 in use | Kill process: `lsof -ti:5000 \| xargs kill -9` |
| Port 5174 in use | Vite auto-switches to 5174+ |
| DB connection fails | Check .env file, verify PostgreSQL running |
| API returns 401 | Check token in localStorage, login again |
| Form not found | Verify user owns form or is admin |

---

## 📊 Statistics

- **Total Files Modified:** 10+
- **New Components:** 2 (AdminRoute, AdminDashboardPage)
- **Database Migrations:** 1 (add-user-isolation.js)
- **Documentation Files:** 4 guides
- **API Endpoints:** 20+
- **Supported Field Types:** 10+
- **Authentication Method:** JWT
- **Database:** PostgreSQL 12+

---

**Document Version:** 1.0  
**Last Updated:** March 26, 2026  
**Status:** Production Ready (with security improvements)
