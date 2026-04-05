# 📋 Gemini Project Context: Multi-User Dynamic Form Builder

This document provides a comprehensive overview of the Multi-User Dynamic Form Builder project, its architecture, file structure, and core functionalities for the Gemini CLI agent.

---

## 🚀 Project Overview
The **Multi-User Dynamic Form Builder** is a professional, self-hosted web application that allows users to create, manage, and share dynamic forms. It features robust user isolation, version control, Excel exports, and an administrative dashboard for system-wide management. It is designed for both local network (LAN) and production environments.

### Key Use Cases:
- **Dynamic Surveys**: Create forms with various field types (text, rating, linear scale, etc.).
- **Data Collection**: Collect and store submissions with version tracking.
- **Academic/Institutional Use**: Includes specialized features like "University Autocomplete" and "Branch/Stream" selections.
- **Isolated Workspaces**: Multiple users can coexist without seeing each other's data.

---

## 🏗️ System Architecture
The project follows a classic **MERN-like** architecture (PostgreSQL instead of MongoDB):
- **Frontend**: React (Vite) with Context API for state management and Vanilla CSS for styling (Glassmorphism UI).
- **Backend**: Node.js with Express.js, providing a RESTful API.
- **Database**: PostgreSQL for relational data storage, managed via `pg` pool.
- **Authentication**: JWT (JSON Web Tokens) with role-based access control (RBAC).

---

## 📂 Project Structure & File Map

### Root Directory
- `.env`: Environment variables (DB credentials, JWT secret, etc.).
- `docker-compose.yml`: For containerized deployment.
- `ecosystem.config.js`: PM2 configuration for process management.
- `README.md`, `Setup.md`, `MULTIUSER.md`, `HOST.md`, `FIELD_TYPES_GUIDE.md`, `SETUP_OFFLINE.md`: Comprehensive documentation.

### ⚛️ Client (`/client`)
The React frontend built with Vite.
- `src/api/client.js`: Axios instance configured for API communication.
- `src/contexts/`: Split Context pattern (`AuthContext.js` + `AuthProvider.jsx`) for Fast Refresh compatibility.
- `src/components/`:
  - `ProtectedRoute.jsx`: Restricted to logged-in users.
  - `AdminRoute.jsx`: Restricted to users with the `admin` role.
  - `AutocompleteInput.jsx`: Reusable component for university search (Acronym & Dot-agnostic).
  - `NotificationCenter.jsx`: Global alert system for access requests and approvals.
- `src/pages/`:
  - `LoginPage.jsx` / `RegisterPage.jsx`: Authentication views.
  - `DashboardPage.jsx`: Main workspace. Forms are grouped by owner.
  - `FormBuilderPage.jsx`: Core builder interface (Sticky header/footer).
  - `FormSubmitPage.jsx`: Public view with composite fields (CGPA, Address, Zone Group).
  - `SubmissionsPage.jsx`: Dashboard with Server-Side Pagination, Search, and **Audit History Modal**.
  - `AdminDashboardPage.jsx`: **Tabbed Interface** for Stats, User Management, and **Activity History Logs**.

### 🚀 Server (`/server`)
The Express backend.
- `index.js`: Entry point and route registration.
- `db/`:
  - `pool.js`: PostgreSQL connection pool.
  - `migrate.js`, `add-user-isolation.js`, `industry-upgrade.js`, `add-notifications.js`, `migrate-collateral.js`, `add-group-type.js`: Progressive schema migrations.
  - `seed.js`: Initial data (universities, initial group list).
- `middleware/auth.js`: JWT verification and access control logic.
- `routes/`:
  - `auth.js`: User management.
  - `forms.js`: Form CRUD + Duplication.
  - `submissions.js`: Paginated submissions + **Audit History fetching**.
  - `export.js`: Excel generation with **separator cleanup** (`|||` -> `, `).
  - `autocomplete.js`: Dynamic searching for universities and **Zoned Organizational Groups**.
  - `permissions.js`: Access request workflow (Notify Owner + All Admins).
  - `notifications.js`: Alert management.

---

## 🔐 Security & Roles
- **First-User-Admin**: The system automatically assigns the `admin` role to the first user registered.
- **Role-Based Access Control (RBAC)**:
  - `👑 Admin`: Can view all forms, all users, and system-wide statistics. Can approve any request.
  - `👤 User`: Can manage own forms. Can request access to others.
- **Collaborative Access**: Owners and Admins can grant "Approved" status to other users. "Ignored" status is hidden from requesters (shown as Pending).

---

## 📅 Session Update Log: April 5, 2026

### 🛠️ Architecture & UI Refinement
- **Organized Admin Dashboard**:
  - Implemented a **Tabbed Layout** to separate "User Activity" from "Approval History".
  - Added **Scrollable Table Wrappers** with sticky headers for large datasets.
  - Integrated a global **Activity History Log** for Admins to track all permission actions.
- **Context Refactoring**:
  - Refactored `AuthContext` and `ThemeContext` into a split pattern (Logic in `.js`, Provider in `.jsx`) to support **React Fast Refresh** and resolve ESLint errors.
- **Validation Fixes**:
  - Resolved a critical bug where **MCQ and Checkbox** fields failed "Required" validation even when filled.
  - Implemented **strict 6-digit Pincode** enforcement for address fields.

### ✨ New Features & Field Types
- **🏢 Zoned Group Type**:
  - Added a new `zone_group` field type for organizational hierarchy.
  - Features a two-step selection: **Zone** (I-VIII) followed by a filtered **Group** autocomplete.
  - Supports "Other" for both Zone and Group with automatic backend learning.
- **🕒 Audit History Viewer**:
  - Frontend modal in Submissions page allowing owners/admins to view chronological snapshots of every edit made to a submission.
- **🧠 Intelligent Learning & Autocomplete**:
  - Backend now "learns" and saves new States, Districts, Zones, and Groups entered via the "Other" option.
  - These are automatically merged into the autocomplete/dropdown recommendations for all users.

### 📊 Data & Export
- **Clean Excel Exports**:
  - Updated `export.js` to aggressively replace the internal ` ||| ` separator with a professional `, ` for all composite fields.
  - Soft-deleted submissions are now correctly excluded from Excel exports.
- **Privacy Controls**:
  - "Ignore" actions on access requests no longer notify the requester and appear as "Pending" on their dashboard to prevent friction.
---
