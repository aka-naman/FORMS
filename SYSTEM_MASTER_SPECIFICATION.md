# 🏛️ Multi-User Dynamic Form Builder: Master Technical Specification

Welcome to the **Master Technical Specification** for the Multi-User Dynamic Form Builder. This document is a monolithic, hyperlinked guide designed to cover every file, function, and workflow within the system.

---

## 📑 Table of Contents

1.  [**Core System Overview**](#1-core-system-overview)
2.  [**Technical Stack & Infrastructure**](#2-technical-stack--infrastructure)
3.  [**Detailed Directory & File Breakdown**](#3-detailed-directory--file-breakdown)
    *   [Root Level](#root-level)
    *   [Backend (server/)](#backend-server)
    *   [Frontend (client/)](#frontend-client)
4.  [**Database Schema & Integrity**](#4-database-schema--data-integrity)
5.  [**Backend Logic & API Workflows**](#5-backend-logic--api-workflows)
    *   [Authentication & RBAC](#auth-rbac)
    *   [Form Versioning Engine](#form-versioning)
    *   [High-Performance Export Streaming](#export-streaming)
6.  [**Frontend Component Architecture**](#6-frontend-component-architecture)
    *   [The Split Context Pattern](#split-context)
    *   [Virtualized Data Tables](#virtualized-tables)
7.  [**Special Features & Advanced Logic**](#7-special-features--advanced-logic)
    *   [Intelligent Learning Autocomplete](#intelligent-learning)
    *   [Audit History Snapshots](#audit-history)
8.  [**Environment & Deployment**](#8-environment--deployment)

---

<a name="1-core-system-overview"></a>
## 1. Core System Overview
The **Multi-User Dynamic Form Builder** is a self-hosted platform for institutional and enterprise data collection. It solves the problem of "schema drift" (changing form structures breaking old data) by implementing a robust versioning engine and provides a high-performance interface for managing thousands of submissions.

---

<a name="2-technical-stack--infrastructure"></a>
## 2. Technical Stack & Infrastructure
*   **React 19 (Vite):** Frontend engine. Optimized with HMR and modular components.
*   **Node.js (Express):** RESTful API layer.
*   **PostgreSQL:** Relational database with GIN Trigram index support.
*   **PM2:** Process manager for production stability.
*   **Docker:** Containerization for database and application isolation.

---

<a name="3-detailed-directory--file-breakdown"></a>
## 3. Detailed Directory & File Breakdown

<a name="root-level"></a>
### 📂 Root Level
*   **`.env`**: Stores environment-specific secrets (DB URL, JWT Secret).
*   **`ecosystem.config.js`**: PM2 configuration for launching the server as a managed service.
*   **`docker-compose.yml`**: Defines the services (app, db) for containerized deployment.
*   **`GEMINI.md`**: Project context and mandate for AI agents.
*   **`memory.md`**: High-level chronological changelog.
*   **`memory_reference.md`**: Deep-dive technical changelog for feature history.
*   **`TECHNICAL_SPECIFICATION.tex`**: LaTeX source for formal documentation.

<a name="backend-server"></a>
### 📂 Backend (`server/`)
*   **`index.js`**: The main bootstrap. Configures middleware (Helmet, CORS, Morgan) and mounts routes.
*   **`db/pool.js`**: PostgreSQL connection pool singleton.
*   **`db/migrate.js`**: Base schema creator.
*   **`middleware/auth.js`**: Implements JWT verification and RBAC checks (`checkFormAccess`).
*   **`routes/auth.js`**: Registration (with First-User-Admin logic) and Login.
*   **`routes/forms.js`**: Form lifecycle management and cloning.
*   **`routes/submissions.js`**: Data ingestion and Audit Snapshot generation.
*   **`routes/export.js`**: Memory-efficient Excel generation via streams.
*   **`routes/autocomplete.js`**: Logic for fuzzy-searching universities and organizational groups.
*   **`routes/permissions.js`**: Collaborative access request and approval workflow.

<a name="frontend-client"></a>
### 📂 Frontend (`client/`)
*   **`vite.config.js`**: Configures the dev server and API proxy.
*   **`src/main.jsx`**: React entry point with hydration.
*   **`src/App.jsx`**: Global routing table (`Dashboard`, `Builder`, `Submit`, `Submissions`).
*   **`src/contexts/AuthContext.js` / `AuthProvider.jsx`**: Split context for user state.
*   **`src/components/AutocompleteInput.jsx`**: Fuzzy-search input with internal debouncing.
*   **`src/pages/FormBuilderPage.jsx`**: Drag-and-drop builder with sticky UI headers.
*   **`src/pages/FormSubmitPage.jsx`**: Renders dynamic fields from the versioned schema.
*   **`src/pages/SubmissionsPage.jsx`**: Uses `react-window` for infinite scrolling high-performance tables.

---

<a name="4-database-schema--data-integrity"></a>
## 4. Database Schema & Integrity
The system uses a strict relational model:
*   **`users`**: RBAC credentials.
*   **`forms`**: High-level form metadata.
*   **`form_versions`**: Immutable snapshots of form structure.
*   **`form_fields`**: Individual field definitions (MCQ, Text, Address).
*   **`submissions`**: Linkage between a user entry and a specific form version.
*   **`submission_values`**: EAV (Entity-Attribute-Value) storage for answers.

**Indexing:**
- **B-Tree:** Foreign keys for join performance.
- **GIN Trigram:** Powers the acronym-agnostic university search using `pg_trgm`.

---

<a name="5-backend-logic--api-workflows"></a>
## 5. Backend Logic & API Workflows

<a name="auth-rbac"></a>
### Authentication & RBAC
1.  **Registration:** The first user in the database is automatically granted the `admin` role.
2.  **Verification:** Every protected route uses `auth.js` middleware to parse the Bearer token.
3.  **Ownership:** `checkFormAccess` ensures that users cannot see or modify forms they don't own unless explicit `form_permissions` have been granted.

<a name="form-versioning"></a>
### Form Versioning Engine
When a form is saved:
1.  The existing fields are **never modified**.
2.  A new `form_versions` record is created.
3.  The new fields are linked to this new version.
4.  Historical submissions remain safely linked to their original version, preventing data corruption.

<a name="export-streaming"></a>
### High-Performance Export Streaming
To export 100,000+ rows without crashing Node.js:
1.  `pg-query-stream` opens a cursor in the database.
2.  Rows are fetched one-by-one.
3.  `ExcelJS.stream.xlsx.WorkbookWriter` pipes the rows directly to the HTTP response.
4.  Memory usage stays constant at ~50MB regardless of file size.

---

<a name="6-frontend-component-architecture"></a>
## 6. Frontend Component Architecture

<a name="split-context"></a>
### The Split Context Pattern
Vite/Fast Refresh requires a split between the context definition and the provider.
*   `AuthContext.js` only exports the context object.
*   `AuthProvider.jsx` exports the component with state.
This ensures that UI changes don't trigger a full page reload, maintaining builder state during development.

<a name="virtualized-tables"></a>
### Virtualized Data Tables
Standard HTML tables fail at ~100 rows.
*   `SubmissionsPage.jsx` uses `react-window`.
*   It only renders the ~15 rows visible on screen.
*   As the user scrolls, rows are recycled in the DOM, allowing for "infinite" smooth scrolling.

---

<a name="7-special-features--advanced-logic"></a>
## 7. Special Features & Advanced Logic

<a name="intelligent-learning"></a>
### Intelligent Learning Autocomplete
If a user selects "Other" in a university or group field and types a new name:
1.  The backend catches this during submission.
2.  It executes an `UPSERT` into the master lookup tables.
3.  The value becomes immediately available to all other users in the system for future autocompletion.

<a name="audit-history"></a>
### Audit History Snapshots
Every submission edit is non-destructive.
1.  Before an update, the current state is serialized into JSON.
2.  This JSON is pushed into a `snapshots` array in the database.
3.  The frontend "History" modal renders these snapshots chronologically.

---

<a name="8-environment--deployment"></a>
## 8. Environment & Deployment
1.  **Production Ready:** Serve `dist` from the Express backend (`index.js`).
2.  **Process Management:** Start with `pm2 start ecosystem.config.js`.
3.  **Migration:** Run `node server/db/migrate.js` to initialize or upgrade schema.

---
*End of Master Technical Specification.*
