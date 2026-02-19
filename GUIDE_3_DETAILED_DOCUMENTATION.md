# Guide 3: Detailed File-by-File Documentation

This guide documents **every single file** in the project, what it does, and the functions/components it contains.

---

## Project Root

### `.env` / `.env.example`
**Purpose:** Environment configuration file. `.env.example` is the template; `.env` is the actual config (git-ignored).

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Port the backend server listens on | `5000` |
| `DB_HOST` | PostgreSQL host address | `127.0.0.1` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_NAME` | Database name | `formbuilder` |
| `DB_USER` | Database username | `postgres` |
| `DB_PASSWORD` | Database password | `postgres` |
| `JWT_SECRET` | Secret key for signing JWT tokens | any random string |

### `ecosystem.config.js`
**Purpose:** PM2 process manager configuration for production deployment.

```js
apps: [{
  name: 'form-dashboard-api',  // Process name in PM2
  cwd: './server',              // Working directory
  script: 'index.js',          // Entry point
  instances: 1,                // Single instance
  autorestart: true,           // Auto-restart on crash
  env: { NODE_ENV: 'production', PORT: 5000 }
}]
```

### `Final_list_Collges.xlsx`
**Purpose:** Excel file containing 1,385+ university records. Used by the import script to populate the `universities` database table.

| Column | Content |
|--------|---------|
| A | University Name |
| B | State |
| C | District |

---

## `server/` — Backend

### `server/index.js` — Application Entry Point

**Purpose:** Creates and configures the Express.js HTTP server. This is the file that starts when you run `node index.js`.

**What it does, line by line:**

1. **Loads environment variables** from `.env` via `dotenv`
2. **Imports all route modules** (auth, forms, fields, submissions, autocomplete, export, public, universities)
3. **Creates Express app** and sets port from `PORT` env var (default 5000)
4. **Applies middleware stack:**
   - `helmet()` — sets security headers (CSP disabled for serving frontend)
   - `cors()` — allows cross-origin requests (needed for Vite dev proxy)
   - `express.json({ limit: '10mb' })` — parses JSON request bodies
   - `morgan('dev')` — logs HTTP requests to console
5. **Mounts route handlers:**
   - `/api/public` → public.js (no authentication)
   - `/api/auth` → auth.js (login/register)
   - `/api/forms` → forms.js, fields.js, submissions.js, export.js
   - `/api/autocomplete` → autocomplete.js
   - `/api/universities` → universities.js
6. **Serves static files** from `client/dist/` (production frontend build)
7. **Catch-all route** — any non-API route serves `index.html` (SPA routing)
8. **Global error handler** — catches unhandled errors, returns 500
9. **Starts listening** on `0.0.0.0:PORT` (accessible from all network interfaces)

### `server/package.json`

**Purpose:** Defines backend dependencies and npm scripts.

| Script | Command | Purpose |
|--------|---------|---------|
| `start` | `node index.js` | Production start |
| `dev` | `node --watch index.js` | Development with auto-restart |
| `migrate` | `node db/migrate.js` | Create database tables |
| `seed` | `node db/seed.js` | Import pincode data |

| Dependency | Version | Purpose |
|-----------|---------|---------|
| `express` | ^4.21.0 | Web framework |
| `pg` | ^8.13.0 | PostgreSQL client |
| `bcryptjs` | ^2.4.3 | Password hashing |
| `jsonwebtoken` | ^9.0.2 | JWT token creation/verification |
| `joi` | ^17.13.0 | Request body validation |
| `cors` | ^2.8.5 | Cross-origin resource sharing |
| `helmet` | ^7.1.0 | Security headers |
| `morgan` | ^1.10.0 | HTTP request logger |
| `dotenv` | ^16.4.5 | Environment variable loader |
| `exceljs` | ^4.4.0 | Excel file read/write |
| `csv-parser` | ^3.0.0 | CSV file parser (for seeding) |

---

### `server/db/` — Database Layer

#### `pool.js` — Connection Pool

**Purpose:** Creates a shared PostgreSQL connection pool used by every route.

- Reads DB credentials from `.env`
- Creates a pool with max 20 connections
- 30s idle timeout, 5s connection timeout
- Logs unexpected errors
- **Exported as:** `module.exports = pool` — every route imports this

#### `migrate.js` — Schema Migration

**Purpose:** Creates all 8 database tables and indexes. Run once on setup: `node db/migrate.js`

**Tables created:**
1. `users` — admin/user accounts (id, username, password_hash, role, created_at)
2. `forms` — form definitions (id, name, is_locked, created_by, created_at)
3. `form_versions` — version tracking (id, form_id, version_number, created_at)
4. `form_fields` — field definitions (id, form_version_id, label, type, options_json, field_order, required)
5. `submissions` — form submissions (id, form_version_id, submitted_by, submitted_at)
6. `submission_values` — individual field values (id, submission_id, field_id, value)
7. `pincodes` — pincode lookup data (pincode, district, state)
8. `colleges` — college lookup data (id, name, state, district)

**Indexes created:**
- `idx_pincodes_pincode` — fast pincode lookup
- `idx_colleges_name_trgm` — trigram index for fuzzy college search
- `idx_form_versions_form_id` — fast version lookup by form
- `idx_form_fields_version_id` — fast field lookup by version
- `idx_submissions_version_id` — fast submission lookup by version
- `idx_submission_values_submission_id` — fast value lookup by submission

**Also enables:** `pg_trgm` extension for trigram-based fuzzy text search.

#### `seed.js` — Pincode Data Seeder

**Purpose:** Reads pincode CSV files from `server/data/` directory and bulk-inserts them into the `pincodes` table.

- Reads all `.csv` files in `data/` folder
- Expected CSV format: pincode, district, state
- Inserts in batches for performance
- Skips duplicates

#### `import-universities.js` — University Data Importer

**Purpose:** Reads the Excel file (`Final_list_Collges.xlsx`) and imports university data into PostgreSQL.

**Functions:**

| Function | Purpose |
|----------|---------|
| `properCase(str)` | Converts text to Title Case (e.g., "DELHI UNIVERSITY" → "Delhi University") |
| `importUniversities()` | Main function: reads Excel, deduplicates, batch-inserts, creates trigram index |

**Process:**
1. Opens Excel file using `exceljs`
2. Reads every row (skips header row 1)
3. Trims whitespace, converts to proper case
4. Deduplicates by lowercase name
5. Truncates existing `universities` table
6. Batch-inserts 100 records at a time
7. Creates trigram indexes (`idx_universities_name_trgm`, `idx_universities_name_lower`)

---

### `server/middleware/` — Middleware

#### `auth.js` — Authentication Middleware

**Purpose:** Provides two middleware functions for route protection.

| Function | Purpose |
|----------|---------|
| `authenticate(req, res, next)` | Extracts JWT from `Authorization: Bearer <token>` header, verifies it, attaches decoded payload to `req.user`. Returns 401 if missing/invalid. |
| `requireAdmin(req, res, next)` | Checks `req.user.role === 'admin'`. Returns 403 if not admin. Must be used after `authenticate`. |

**Usage in routes:**
```js
router.get('/protected', authenticate, handler);              // Any logged-in user
router.post('/admin-only', authenticate, requireAdmin, handler); // Admin only
```

---

### `server/routes/` — API Route Handlers

#### `auth.js` — Authentication Routes

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/auth/register` | POST | No | Register new user. First user becomes admin automatically. |
| `/api/auth/login` | POST | No | Login with username/password. Returns JWT token + user object. |
| `/api/auth/me` | GET | Yes | Get current user info from JWT token. |

**Key functions:**
- `POST /register` — validates input with Joi, hashes password with `bcryptjs`, inserts user. If no users exist yet, role = `'admin'`, otherwise role = `'user'`.
- `POST /login` — finds user by username, compares password hash, signs JWT with `jsonwebtoken` (24h expiry), returns `{ token, user }`.
- `GET /me` — returns user data from the JWT payload (no database query).

#### `forms.js` — Form CRUD Routes

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/forms` | GET | Yes | List all forms with version/submission counts |
| `/api/forms/:id` | GET | Yes | Get single form with latest version and fields |
| `/api/forms` | POST | Admin | Create new form (auto-creates version 1) |
| `/api/forms/:id` | PUT | Admin | Rename a form |
| `/api/forms/:id` | DELETE | Admin | Delete a form (cascades to versions, fields, submissions) |
| `/api/forms/:id/duplicate` | POST | Admin | Duplicate a form with all its fields |
| `/api/forms/:id/lock` | POST | Admin | Lock a form (prevents further field edits) |

**Key logic:**
- `GET /` uses sub-queries to count versions and submissions per form
- `POST /` creates form + version 1 in a transaction
- `POST /:id/duplicate` copies form, creates new version, copies all fields in a transaction

#### `fields.js` — Form Field Routes

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/forms/:formId/versions/:versionId/fields` | PUT | Admin | Bulk update/replace all fields for a form version |

**Key logic:**
- Validates each field with Joi (label, type, options_json, field_order, required)
- Accepted field types: `text`, `textarea`, `dropdown`, `pincode`, `college_autocomplete`, `university_autocomplete`
- Deletes all existing fields for the version, then re-inserts the new set (full replacement)
- Runs in a transaction for atomicity

#### `submissions.js` — Submission Routes

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/forms/:formId/submit` | POST | Yes | Submit form values (authenticated user) |
| `/api/forms/:formId/versions/:versionId/submissions` | GET | Admin | List all submissions for a form version |

**Key logic:**
- `POST /submit` validates required fields, auto-locks form on first submission, inserts submission + values in a transaction
- `GET /submissions` returns submissions with user info, values pivoted by field

#### `export.js` — Excel Export Route

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/forms/:formId/export` | GET | Admin | Download all submissions as Excel file |

**Key logic:**
- Fetches form, latest version, fields, all submissions, all values
- Creates Excel workbook with `exceljs`
- Columns: S.No + one column per form field (auto-width)
- Header row: bold text, centered
- Enables auto-filter
- Streams file as download attachment

#### `public.js` — Public Routes (No Authentication)

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/public/forms/:formId` | GET | No | Get form schema for public display |
| `/api/public/forms/:formId/submit` | POST | No | Submit form values without login |
| `/api/public/autocomplete/pincode?q=` | GET | No | Search pincodes by code/city/state |
| `/api/public/autocomplete/college?q=` | GET | No | Search colleges by name/district/state |
| `/api/public/autocomplete/university?q=` | GET | No | Search universities by name |

**Key logic:**
- `GET /forms/:formId` returns form + latest version + fields (same as authenticated version but without auth)
- `POST /forms/:formId/submit` validates required fields, auto-locks form, inserts submission with `submitted_by = NULL`
- Autocomplete endpoints use `ILIKE '%query%'` for broad substring matching
- University search: `WHERE name ILIKE '%q%'`, returns `{ id, name, state, district }`, ordered by prefix match priority
- Pincode search: matches by pincode prefix OR district/state substring
- All autocomplete endpoints return max 10 results

#### `autocomplete.js` — Authenticated Autocomplete Routes

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/autocomplete/pincode?q=` | GET | Yes | Pincode search (for authenticated users) |
| `/api/autocomplete/college?q=` | GET | Yes | College search (for authenticated users) |

These are the original authenticated versions; the public versions in `public.js` supersede these for form respondents.

#### `universities.js` — University Management Routes

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/universities` | GET | Admin | List universities (paginated, searchable) |
| `/api/universities` | POST | Admin | Add a new university |
| `/api/universities/:id` | DELETE | Admin | Delete a university |

**Key logic:**
- `GET /` supports `?q=search&page=1` — 25 results per page, ILIKE search on name
- `POST /` validates with Joi, checks for duplicate names (case-insensitive), inserts
- `DELETE /:id` removes a single university record

---

## `client/` — Frontend

### `client/vite.config.js`

**Purpose:** Vite build tool configuration.

- Loads `@vitejs/plugin-react` (React JSX support)
- Loads `@tailwindcss/vite` (TailwindCSS integration)
- Configures dev server proxy: `/api/*` → `http://localhost:5000` (so frontend dev server can talk to backend)

### `client/package.json`

| Dependency | Version | Purpose |
|-----------|---------|---------|
| `react` | ^19.2.0 | UI library |
| `react-dom` | ^19.2.0 | React DOM renderer |
| `react-router-dom` | ^7.13.0 | Client-side routing |
| `react-hook-form` | ^7.71.1 | Form state management |
| `axios` | ^1.13.5 | HTTP client for API calls |
| `tailwindcss` (dev) | ^4.2.0 | CSS framework |
| `vite` (dev) | ^7.3.1 | Build tool |

### `client/src/main.jsx`

**Purpose:** React app entry point. Renders `<App />` into the DOM root element.

### `client/src/index.css`

**Purpose:** Global CSS imports. Loads TailwindCSS base styles: `@import "tailwindcss";`

### `client/src/App.jsx` — Router Configuration

**Purpose:** Defines all frontend routes and wraps the app with authentication context.

**Components:**

| Component | Purpose |
|-----------|---------|
| `AppRoutes()` | Defines all routes using React Router |

**Routes:**

| Path | Component | Auth Required | Purpose |
|------|-----------|---------------|---------|
| `/f/:formId` | `PublicFormPage` | No | Public form submission |
| `/login` | `LoginPage` | No | Admin login |
| `/register` | `RegisterPage` | No | Admin registration |
| `/` | `DashboardPage` | Admin | Main dashboard |
| `/forms/:formId/builder` | `FormBuilderPage` | Admin | Edit form fields |
| `/forms/:formId/submissions` | `SubmissionsPage` | Admin | View submissions |
| `/universities` | `UniversitiesPage` | Admin | Manage universities |

---

### `client/src/api/` — API Layer

#### `client.js` — Axios HTTP Client

**Purpose:** Centralized HTTP client for all API calls.

- Creates an axios instance with baseURL `/api`
- **Request interceptor:** Automatically attaches JWT token from `localStorage` to every request's `Authorization` header
- **Response interceptor:** On 401 errors, clears stored token/user and redirects to `/login`

**Usage:** `import api from '../api/client'; api.get('/forms');`

---

### `client/src/contexts/` — React Contexts

#### `AuthContext.jsx` — Authentication State

**Purpose:** Provides global authentication state to the entire app.

**State:**
- `user` — current logged-in user object (or null)
- `loading` — true while checking if user is logged in on page load

**Functions:**

| Function | Purpose |
|----------|---------|
| `login(userData, token)` | Stores user + token in state and localStorage |
| `logout()` | Clears user + token from state and localStorage, redirects to `/login` |

**On mount:** Checks `localStorage` for existing token, calls `GET /api/auth/me` to validate it. If valid, sets user state; if invalid, clears storage.

---

### `client/src/components/` — Reusable Components

#### `ProtectedRoute.jsx` — Route Guard

**Purpose:** Wraps routes that require authentication or admin access.

**Props:**
- `children` — the page component to render if authorized
- `adminOnly` — if true, requires `user.role === 'admin'`

**Behavior:**
- If `loading` → shows spinner
- If no `user` → redirects to `/login`
- If `adminOnly` and `user.role !== 'admin'` → redirects to `/`
- Otherwise → renders `children`

#### `AutocompleteInput.jsx` — Authenticated Autocomplete

**Purpose:** Reusable autocomplete input for authenticated users (used in `FormSubmitPage`).

**Props:**
- `type` — `'pincode'` or `'college'`
- `value` / `onChange` — controlled input value
- `placeholder` — input placeholder text

**Behavior:** Debounces input (300ms), calls `/api/autocomplete/:type?q=`, shows dropdown with results.

#### `PublicAutocompleteInput.jsx` — Public Autocomplete

**Purpose:** Same as `AutocompleteInput` but calls `/api/public/autocomplete/:type` endpoints (no JWT token needed).

---

### `client/src/pages/` — Page Components

#### `LoginPage.jsx`

**Purpose:** Admin login page with username/password form.

- Uses `react-hook-form` for form state
- Calls `POST /api/auth/login` on submit
- On success, calls `authContext.login()` to store token
- Redirects to `/` (dashboard) after login
- Shows link to Register page for first-time setup
- Dark glassmorphic UI design

#### `RegisterPage.jsx`

**Purpose:** User registration page.

- Uses `react-hook-form` with password confirmation
- Calls `POST /api/auth/register`
- On success, auto-logs in and redirects to `/`
- Shows note that first registered user becomes admin
- Dark glassmorphic UI design

#### `DashboardPage.jsx`

**Purpose:** Main admin dashboard — lists all forms with management actions.

**State:**
- `forms` — array of form objects
- `search` — search filter text
- `showCreate` — controls create modal visibility
- `newFormName` — name for new form

**Key functions:**

| Function | Purpose |
|----------|---------|
| `fetchForms()` | Loads all forms from `GET /api/forms` |
| `handleCreate()` | Creates new form via `POST /api/forms` |
| `handleDuplicate(id)` | Duplicates form via `POST /api/forms/:id/duplicate` |
| `handleDelete(id)` | Deletes form via `DELETE /api/forms/:id` |
| `handleRename(id)` | Renames form via `PUT /api/forms/:id` |
| `handleExport(id, name)` | Downloads Excel via `GET /api/forms/:id/export` |

**UI sections:**
- Navbar with search, universities link, user info, sign out
- Create form button + modal
- Form cards showing: name, status (locked/active), submission count, created date
- Per-form actions: copy link, edit, view submissions, export, duplicate, rename, delete

#### `FormBuilderPage.jsx`

**Purpose:** Drag-and-drop-style form builder for defining form fields.

**Field types available:**
| Type | Label | Icon |
|------|-------|------|
| `text` | Text Input | ✏️ |
| `textarea` | Text Area | 📝 |
| `dropdown` | Dropdown | 📋 |
| `pincode` | Pincode Lookup | 📍 |
| `college_autocomplete` | College Search | 🎓 |
| `university_autocomplete` | University Search | 🏛️ |

**Key functions:**

| Function | Purpose |
|----------|---------|
| `addField(type)` | Adds a new field of given type to the list |
| `updateField(index, updates)` | Updates field properties at given index |
| `removeField(index)` | Removes field and reorders remaining |
| `moveField(index, direction)` | Moves field up (-1) or down (+1) |
| `addOption(fieldIndex)` | Adds dropdown option |
| `updateOption(fieldIndex, optIndex, value)` | Updates dropdown option text |
| `removeOption(fieldIndex, optIndex)` | Removes dropdown option |
| `handleSave()` | Saves all fields to server via `PUT /api/forms/:formId/versions/:versionId/fields` |

**UI features:**
- Editable form name in header (auto-saves on blur via `PUT /api/forms/:id`)
- Left sidebar: field type palette (click to add)
- Main area: field cards with label input, required checkbox, options (for dropdowns)
- Reorder buttons (up/down arrows) and delete button per field
- Save button with loading/saved states

#### `PublicFormPage.jsx`

**Purpose:** Public form submission page (no login required). Accessible via `/f/:formId`.

**Components defined within this file:**

| Component | Purpose |
|-----------|---------|
| `UniversityAutocomplete` | Autocomplete input that searches universities and triggers state/district autofill |
| `GenericAutocomplete` | Autocomplete input for pincode and college searches |
| `PublicFormPage` (default export) | Main page component |

**`UniversityAutocomplete` props:**
- `fieldId` — the form field ID
- `value` / `onChange` — controlled text value
- `onSelect(item)` — callback when user selects a suggestion; receives `{ name, state, district }`
- `placeholder` — input placeholder

**`GenericAutocomplete` props:**
- `type` — `'pincode'` or `'college'`
- `value` / `onChange` — controlled text value
- `placeholder` — input placeholder

**State in `PublicFormPage`:**
- `form` — form object from API
- `fields` — array of field definitions
- `autocompleteValues` — object mapping `fieldId → text value` for autocomplete fields
- `autofillState` — object mapping `fieldId → { value, fromSelection }` for auto-filled state/district fields

**Key functions:**

| Function | Purpose |
|----------|---------|
| `getAutofillTargets(universityFieldIndex)` | Scans fields after a university field to find "State" and "District" labeled fields for autofill |
| `onSubmit(data)` | Collects all values (regular + autocomplete + autofilled), submits via `POST /api/public/forms/:id/submit` |
| `renderField(field, index)` | Renders the appropriate input component based on field type |

**Autofill behavior:**
1. When user selects a university from autocomplete, `onSelect` is called
2. `getAutofillTargets()` scans subsequent fields for labels containing "state" or "district"
3. Matching fields get their values set via `setAutofillState()` and `setFormValue()`
4. Autofilled fields show a hint: "Auto-filled from university selection"
5. User can still manually edit autofilled values

#### `SubmissionsPage.jsx`

**Purpose:** Admin page to view all submissions for a specific form.

- Loads form, version, and submissions from API
- Displays submissions in a table (S.No + each field as a column)
- Shows submission count and form name
- Back to dashboard navigation

#### `UniversitiesPage.jsx`

**Purpose:** Admin page to manage the universities database.

**Features:**
- Paginated table (25 per page) with university name, state, district
- Search bar — filters by university name (ILIKE)
- "Add University" button — opens modal with name/state/district inputs
- Delete button per row (with confirmation)
- Pagination controls (prev/next)

**Key functions:**

| Function | Purpose |
|----------|---------|
| `fetchUniversities(page, query)` | Loads universities from `GET /api/universities?page=&q=` |
| `handleSearch()` | Triggers search with current query |
| `handleAdd()` | Submits new university via `POST /api/universities` |
| `handleDelete(id, name)` | Deletes university via `DELETE /api/universities/:id` |

#### `FormSubmitPage.jsx`

**Purpose:** Authenticated form submission page (for logged-in users). Uses `AutocompleteInput` component.

#### `FormSelectPage.jsx`

**Purpose:** Page for users to select which form to fill. Lists available forms.

> Note: This page is largely superseded by the public form link system.

---

## Summary of All API Endpoints

### Public (No Authentication)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/public/forms/:id` | Get form schema |
| POST | `/api/public/forms/:id/submit` | Submit form response |
| GET | `/api/public/autocomplete/pincode?q=` | Search pincodes |
| GET | `/api/public/autocomplete/college?q=` | Search colleges |
| GET | `/api/public/autocomplete/university?q=` | Search universities |

### Authentication
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/auth/register` | Register user |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Get current user |

### Forms (Admin)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/forms` | List all forms |
| GET | `/api/forms/:id` | Get single form |
| POST | `/api/forms` | Create form |
| PUT | `/api/forms/:id` | Rename form |
| DELETE | `/api/forms/:id` | Delete form |
| POST | `/api/forms/:id/duplicate` | Duplicate form |
| POST | `/api/forms/:id/lock` | Lock form |

### Fields (Admin)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| PUT | `/api/forms/:formId/versions/:versionId/fields` | Bulk update fields |

### Submissions
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/forms/:formId/submit` | Submit (authenticated) |
| GET | `/api/forms/:formId/versions/:versionId/submissions` | List submissions |
| GET | `/api/forms/:formId/export` | Export as Excel |

### Universities (Admin)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/universities` | List (paginated/searchable) |
| POST | `/api/universities` | Add new |
| DELETE | `/api/universities/:id` | Delete |
