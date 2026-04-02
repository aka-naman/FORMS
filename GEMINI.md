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
- `README.md`, `Setup.md`, `MULTIUSER.md`, `HOST.md`, `FIELD_TYPES_GUIDE.md`: Comprehensive documentation.

### ⚛️ Client (`/client`)
The React frontend built with Vite.
- `src/api/client.js`: Axios instance configured for API communication.
- `src/contexts/`: `AuthContext.jsx` (user state) and `ThemeContext.jsx`.
- `src/components/`:
  - `ProtectedRoute.jsx`: Restricted to logged-in users.
  - `AdminRoute.jsx`: Restricted to users with the `admin` role.
  - `AutocompleteInput.jsx`: Reusable component for university search.
- `src/pages/`:
  - `LoginPage.jsx` / `RegisterPage.jsx`: Authentication views.
  - `DashboardPage.jsx`: Main workspace for users to see their own forms.
  - `FormBuilderPage.jsx`: The core drag-and-drop / configuration interface for forms.
  - `FormSubmitPage.jsx`: The public-facing (or internal) view where users fill out forms.
  - `SubmissionsPage.jsx`: View and export data for a specific form.
  - `AdminDashboardPage.jsx`: Global stats and user management (Admin only).

### 🚀 Server (`/server`)
The Express backend.
- `index.js`: Entry point, middleware setup, and static file serving.
- `db/`:
  - `pool.js`: PostgreSQL connection pool.
  - `migrate.js`: Schema definitions and table creation.
  - `seed.js`: Initial data (e.g., universities list).
  - `add-user-isolation.js`: Migration script to enable multi-user features.
- `middleware/auth.js`: JWT verification and role checking.
- `routes/`:
  - `auth.js`: User registration and login logic.
  - `forms.js`: CRUD operations for forms (with user isolation).
  - `fields.js`: Management of form versions and fields.
  - `submissions.js`: Handling form entries.
  - `export.js`: Logic for generating Excel files (`exceljs`).
  - `autocomplete.js`: Search API for university data.
  - `admin-users.js`: Admin-only endpoints for managing users.
- `data/universities.xlsx`: Source data for the autocomplete feature.

---

## 🔐 Security & Roles
- **First-User-Admin**: The system automatically assigns the `admin` role to the first user registered.
- **Role-Based Access Control (RBAC)**:
  - `👑 Admin`: Can view all forms, all users, and system-wide statistics.
  - `👤 User`: Can only manage forms they created.
- **User Isolation**: Forms and submissions are linked to a `user_id`. Middleware ensures users cannot access data belonging to others.

---

## 🛠️ Tech Stack Details
- **Backend Dependencies**: `express`, `pg`, `jsonwebtoken`, `bcryptjs`, `exceljs`, `joi`, `helmet`, `cors`.
- **Frontend Dependencies**: `react`, `react-router-dom`, `axios`.
- **Styling**: Modern Vanilla CSS using variables for easy theming and Glassmorphism effects.

---

## 🚦 Getting Started (Quick Reference)
1. **Database**: Create a PostgreSQL DB named `formbuilder`.
2. **Environment**: Configure `.env` in the root with `DB_USER`, `DB_PASSWORD`, and `JWT_SECRET`.
3. **Initialization** (Server):
   ```bash
   npm run migrate
   node db/add-user-isolation.js
   npm run seed
   ```
4. **Development**:
   - Server: `cd server && npm run dev`
   - Client: `cd client && npm run dev`

---

## 💡 Key Instructions for Gemini Agent
- **Surgical Edits**: When modifying `FormBuilderPage.jsx` or `FormSubmitPage.jsx`, ensure you maintain the `FIELD_TYPES` array and its corresponding rendering logic.
- **Database Safety**: Always check for `user_id` isolation when writing or modifying backend routes.
- **Styling**: Adhere to the Glassmorphism CSS variables defined in `index.css`.
---

## 📅 Session Update Log: April 1, 2026

### 🛠️ Architecture & Core Changes
- **Collaborative Access System:** 
  - Forms are visible globally but require explicit approval for interaction (Build, Submit, View, Export, Duplicate).
  - **Ownership-First UI:** Forms are grouped by creator on the dashboard, with the current user's forms prioritized at the top.
  - **Standardized Security:** Centralized `checkFormAccess` and `checkFormOwnership` utilities in `middleware/auth.js`.
  - **Dynamic Reset:** (Reverted) Experimented with session-based approval resets to ensure fresh security checks.
- **Enhanced Dashboard:** 
  - Added a global **Search Bar** to filter forms by name or creator.
  - Improved UI stability by switching to block layouts for form titles, preventing vertical character breakage.
  - **Collaborator Export:** Enabled approved collaborators to export submitted data to Excel.

### ✨ New Features & Field Types
- **🏠 Advanced Residential Address:** 
  - Composite field with automatic **Pincode Lookup** (auto-fills State and District).
- **🧮 CGPA to Percentage Converter:** 
  - Integrated math formulas for automated data conversion.
- **🎓 Dynamic Learning Lists:**
  - **Branch Learning:** Automatically expands the "Branch / Stream" dropdown based on "Other" user submissions.
- **👑 Admin User Management:** 
  - Admins can now manage all users, reset passwords, and change roles directly from the dashboard.
  - **Admin Privacy:** Restricted Admin-owned forms from being visible to regular users unless explicitly shared.

### 🐞 Bug Fixes
- **🏗️ Layout Glitches:** Fixed major UI issues where form titles would break into vertical lines on certain screens.
- **🔐 Access Logic:** Resolved "form not found" errors during duplication and navigation.
- **📥 Export Stabilized:** Standardized the Excel export route to handle collaborative permissions correctly.
