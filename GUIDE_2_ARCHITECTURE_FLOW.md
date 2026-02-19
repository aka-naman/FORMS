# Guide 2: Architecture & Flow

This guide explains how the Form Dashboard system is structured, how data flows between components, and how each file communicates with others.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────┐
│                    BROWSER (Client)                 │
│   React App (Vite + TailwindCSS)                    │
│   ┌────────────┐ ┌──────────────┐ ┌──────────────┐  │
│   │  Admin UI   │ │ Public Forms │ │ Universities │  │
│   │ (Dashboard, │ │  (No Login)  │ │  Management  │  │
│   │  Builder)   │ │              │ │              │  │
│   └──────┬─────┘ └──────┬───────┘ └──────┬───────┘  │
│          │              │                │           │
│          └──────────┬───┴────────────────┘           │
│                     │ HTTP (axios)                   │
└─────────────────────┼───────────────────────────────┘
                      │  API calls (JSON)
                      ▼
┌─────────────────────────────────────────────────────┐
│                  EXPRESS SERVER (Backend)            │
│   Port 5000                                         │
│   ┌──────────┐ ┌──────────┐ ┌────────────────────┐  │
│   │  Public   │ │  Auth    │ │ Protected Routes   │  │
│   │  Routes   │ │ Middleware│ │ (forms, fields,    │  │
│   │ (no auth) │ │  (JWT)   │ │  submissions,      │  │
│   │          │ │          │ │  export, univ)     │  │
│   └────┬─────┘ └────┬─────┘ └────────┬───────────┘  │
│        │            │                │               │
│        └────────────┴────────────────┘               │
│                     │  SQL queries (pg)              │
└─────────────────────┼───────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────┐
│                  POSTGRESQL (Database)               │
│   Database: formbuilder                              │
│   ┌──────┐ ┌───────┐ ┌──────────┐ ┌──────────────┐  │
│   │users │ │forms  │ │submissions│ │universities  │  │
│   │      │ │fields │ │values     │ │pincodes      │  │
│   └──────┘ └───────┘ └──────────┘ └──────────────┘  │
└─────────────────────────────────────────────────────┘
```

---

## Request Flow: How a User Interaction Travels

### Example: Admin Creates a Form

```
1. Admin clicks "Create Form" on DashboardPage.jsx
   ↓
2. DashboardPage calls: api.post('/forms', { name: 'My Survey' })
   ↓
3. client.js (axios) adds JWT token to Authorization header
   ↓
4. Vite proxy forwards /api/* → http://localhost:5000/api/*
   ↓
5. Express receives POST /api/forms
   ↓
6. auth.js middleware verifies JWT → attaches req.user
   ↓
7. requireAdmin middleware checks req.user.role === 'admin'
   ↓
8. routes/forms.js handler runs:
   - Validates body with Joi
   - INSERT INTO forms → returns new form
   - INSERT INTO form_versions → creates version 1
   ↓
9. Response: { form: {...}, version: {...} }
   ↓
10. DashboardPage updates state → new form appears in list
```

### Example: Public User Submits a Form

```
1. User opens http://192.168.1.50:5000/f/3
   ↓
2. React Router matches /f/:formId → renders PublicFormPage.jsx
   ↓
3. PublicFormPage calls: axios.get('/api/public/forms/3')
   (NO JWT token — this is a public endpoint)
   ↓
4. routes/public.js fetches form + fields from DB
   ↓
5. User fills form, types university name
   ↓
6. UniversityAutocomplete component calls:
   axios.get('/api/public/autocomplete/university?q=delhi')
   ↓
7. routes/public.js runs:
   SELECT name, state, district FROM universities
   WHERE name ILIKE '%delhi%' LIMIT 10
   ↓
8. User selects university → State/District auto-fill
   ↓
9. User clicks Submit → axios.post('/api/public/forms/3/submit', { values })
   ↓
10. routes/public.js:
    - Validates required fields
    - Locks the form (first submission)
    - INSERT INTO submissions → INSERT INTO submission_values
    ↓
11. PublicFormPage shows "Thank You!" screen
```

---

## Component Communication Map

### Frontend Layer

```
App.jsx
├── AuthContext.jsx ─── provides { user, login, logout, loading }
│                        Used by: all pages that check auth state
│
├── ProtectedRoute.jsx ─── wraps admin pages
│                           Redirects to /login if no user
│
├── Admin Pages (require login)
│   ├── LoginPage.jsx ─────── POST /api/auth/login
│   ├── RegisterPage.jsx ──── POST /api/auth/register
│   ├── DashboardPage.jsx ─── GET /api/forms (list)
│   │                         POST /api/forms (create)
│   │                         DELETE /api/forms/:id
│   │                         POST /api/forms/:id/duplicate
│   │                         PUT /api/forms/:id (rename)
│   │                         GET /api/forms/:id/export (download xlsx)
│   │
│   ├── FormBuilderPage.jsx ── GET /api/forms/:id (load)
│   │                          PUT /api/forms/:id (rename)
│   │                          PUT /api/forms/:id/versions/:vid/fields (save)
│   │
│   ├── SubmissionsPage.jsx ── GET /api/forms/:id (load)
│   │                          GET /api/forms/:id/versions/:vid/submissions
│   │
│   └── UniversitiesPage.jsx ── GET /api/universities (list/search)
│                                POST /api/universities (add)
│                                DELETE /api/universities/:id
│
└── Public Pages (no login)
    └── PublicFormPage.jsx ─── GET /api/public/forms/:id
                               POST /api/public/forms/:id/submit
                               GET /api/public/autocomplete/university?q=
                               GET /api/public/autocomplete/pincode?q=
                               GET /api/public/autocomplete/college?q=
```

### Backend Layer

```
index.js (entry point)
│
├── Middleware stack (runs on every request):
│   helmet() → cors() → express.json() → morgan()
│
├── Route mounting:
│   /api/public     → routes/public.js      (NO auth)
│   /api/auth       → routes/auth.js        (login/register)
│   /api/forms      → routes/forms.js       (CRUD)
│   /api/forms      → routes/fields.js      (field management)
│   /api/forms      → routes/submissions.js (submission viewing)
│   /api/autocomplete → routes/autocomplete.js (authenticated search)
│   /api/forms      → routes/export.js      (Excel export)
│   /api/universities → routes/universities.js (admin management)
│
├── Static file serving (client/dist/)
│   Serves pre-built React app in production
│
└── Catch-all handler
    Any non-/api route → serves index.html (SPA routing)
```

### Database Layer

```
pool.js ← creates a shared connection pool (max 20 connections)
         Used by ALL route files via: const pool = require('../db/pool')

migrate.js ← creates tables + indexes (run once)
seed.js ← seeds pincode data from CSV
import-universities.js ← imports university data from Excel
```

---

## Database Schema Relationships

```
┌──────────┐     ┌──────────────┐     ┌────────────┐
│  users   │     │    forms     │     │form_versions│
│──────────│     │──────────────│     │────────────│
│ id (PK)  │◄────│ created_by   │     │ id (PK)    │
│ username │     │ id (PK)      │◄────│ form_id    │
│ password │     │ name         │     │ version_no │
│ role     │     │ is_locked    │     └─────┬──────┘
└──────────┘     └──────────────┘           │
                                            │
                          ┌─────────────────┼──────────────┐
                          ▼                                ▼
                 ┌────────────────┐              ┌─────────────┐
                 │  form_fields   │              │ submissions │
                 │────────────────│              │─────────────│
                 │ id (PK)        │              │ id (PK)     │
                 │ form_version_id│              │form_version_id│
                 │ label          │              │ submitted_by│
                 │ type           │              │ submitted_at│
                 │ options_json   │              └──────┬──────┘
                 │ field_order    │                     │
                 │ required       │                     │
                 └───────┬────────┘              ┌──────▼──────────┐
                         │                       │submission_values│
                         │                       │─────────────────│
                         └──────────────────────►│ submission_id   │
                                                 │ field_id        │
                                                 │ value           │
                                                 └─────────────────┘

┌──────────────┐     ┌──────────────┐
│  pincodes    │     │ universities │
│──────────────│     │──────────────│
│ pincode (PK) │     │ id (PK)      │
│ district     │     │ name         │
│ state        │     │ state        │
└──────────────┘     │ district     │
                     └──────────────┘
```

---

## Authentication Flow

```
                    ┌────────────────┐
                    │  LoginPage     │
                    │  POST /auth/   │
                    │  login         │
                    └───────┬────────┘
                            │ { username, password }
                            ▼
                    ┌────────────────┐
                    │ routes/auth.js │
                    │ bcrypt.compare │
                    │ jwt.sign()     │
                    └───────┬────────┘
                            │ { token, user }
                            ▼
                    ┌────────────────┐
                    │ AuthContext    │
                    │ stores token  │
                    │ in localStorage│
                    └───────┬────────┘
                            │
                            ▼
              ┌─────────────────────────────┐
              │  api/client.js interceptor  │
              │  Adds "Bearer <token>" to   │
              │  every subsequent request   │
              └─────────────────────────────┘
                            │
                            ▼
              ┌─────────────────────────────┐
              │  middleware/auth.js          │
              │  Verifies token on server   │
              │  Attaches req.user          │
              └─────────────────────────────┘
```

---

## Data Flow: University Autocomplete with Autofill

```
User types "Delhi" in University field
        │
        ▼ (debounced 300ms)
GET /api/public/autocomplete/university?q=delhi
        │
        ▼
PostgreSQL: SELECT name, state, district
            FROM universities
            WHERE name ILIKE '%delhi%'
            LIMIT 10
        │
        ▼
Returns: [
  { name: "Delhi University", state: "Delhi", district: "Central" },
  { name: "IIT Delhi", state: "Delhi", district: "South" },
  ...
]
        │
        ▼
User selects "Delhi University"
        │
        ▼
PublicFormPage.getAutofillTargets() scans remaining fields
Finds fields labeled "State" and "District"
        │
        ▼
Auto-fills: State → "Delhi", District → "Central"
(Fields remain editable if user wants to change)
```
