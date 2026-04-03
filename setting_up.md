# 🏁 COMPLETE SUPER-DETAILED OFFLINE SETUP GUIDE
## Multi-User Dynamic Form Builder (V1.0)

This document provides the **exact sequence of commands** and configurations to set up this project from scratch on a computer with **zero internet access**.

---

### 📂 Phase 1: Preparation (On a PC WITH Internet)
*Before moving to the offline machine, you must prepare the environment.*

1.  **Download Installers:**
    - **Node.js:** Download the LTS version (v18 or v20) `.msi` (Windows) or `.pkg` (Mac) installer.
    - **PostgreSQL:** Download the installer for version 14 or 15.
2.  **Install Dependencies & Build Frontend:**
    - Open a terminal in the `server` directory and run: `npm install`
    - Open a terminal in the `client` directory and run: `npm install`
    - In the `client` directory, run: `npm run build`
    - *Note: This creates the `client/dist` folder which the server uses to serve the application.*
3.  **Transfer to Offline Machine:**
    - Copy the entire project folder (including `node_modules` and `client/dist`) to a USB drive or external HDD.

---

### 🛠️ Phase 2: Environment Setup (On the Offline PC)

1.  **Install Software:**
    - Install **Node.js** using the installer you downloaded.
    - Install **PostgreSQL**. **Crucial:** Note down the password you set for the `postgres` user during installation.
2.  **Create the Database:**
    - Open **pgAdmin 4** (installed with PostgreSQL).
    - Right-click "Databases" -> "Create" -> "Database...".
    - Set the name to: `formbuilder`.
    - Click **Save**.
3.  **Configure Environment Variables:**
    - In the root folder, open the `.env` file with a text editor (Notepad/VS Code).
    - Ensure the following values match your PostgreSQL setup:
      ```env
      PORT=5000
      DB_HOST=localhost
      DB_PORT=5432
      DB_NAME=formbuilder
      DB_USER=postgres
      DB_PASSWORD=your_postgres_password_here
      JWT_SECRET=form-dashboard-jwt-secret-2026
      ```

---

### 🚀 Phase 3: Database Initialization & Seeding
*Open a terminal (Command Prompt or PowerShell) and navigate to the `server` folder.*

#### **Step 1: Create Core Database Tables**
Run the main migration script to create the tables for users, forms, and submissions.
```bash
node db/migrate.js
```
> **Verification:** You should see messages like `✓ users table created` and `✅ All migrations completed successfully!`.

#### **Step 2: Initialize Collaborative Features**
Enable the branch/stream learning and collaborative permissions.
```bash
node db/migrate-collateral.js
```
> **Verification:** Look for `✓ branches table` and `✓ seeded initial branches`.

#### **Step 3: Seed University Autocomplete List**
Populate the system with the university database from the Excel file.
```bash
node db/seed.js
```
> **Verification:** You should see `Parsed X rows from Excel` and `✅ Seeded universities successfully!`.

#### **Step 4: Enable Multi-User Isolation**
Finalize the database schema to support private workspaces.
```bash
node db/add-user-isolation.js
```
> **Verification:** You should see `✅ User isolation setup completed successfully!`.

---

### 🏃 Phase 4: Launching the Application

1.  **Start the Server:**
    In your terminal (still in the `server` folder), run:
    ```bash
    node index.js
    ```
2.  **Access the App:**
    - Open your web browser.
    - Go to: `http://localhost:5000`
3.  **First User (Admin) Setup:**
    - Click on **Register**.
    - Create your account (e.g., username: `admin`, password: `yourpassword`).
    - **Note:** The first user registered in the system is automatically granted **Admin** privileges.

---

### 📋 Daily Usage Summary
Every time you want to run the system:
1.  Open Terminal.
2.  Navigate to `server` folder.
3.  Run `node index.js`.
4.  Open `http://localhost:5000` in the browser.

---

### 💡 Key Features Verified for this Setup:
- **🎓 Smart Autocomplete:** Search for any university; it uses the seeded database.
- **🧠 Learning System:** If you type a new university or branch name during submission, it is saved for future suggestions.
- **🏠 Address Lookup:** 
  - States and Districts for India are automatically loaded from `server/data/india_states_districts.json`.
  - **Note for Offline Use:** While the State and District dropdowns work perfectly offline, the "Pincode Lookup" (autofilling State/District from a 6-digit code) requires an internet connection to the Indian Postal API. In an offline environment, users will need to select the State and District manually from the dropdowns.
- **👑 Admin Control:** As the first user, you can access the admin dashboard to see all system data and manage users.
- **📊 Offline Exports:** The "Export Excel" button on the submissions page works entirely without an internet connection.

---

### 💡 Troubleshooting
- **Database Connection Error:** Double-check the `DB_PASSWORD` in your `.env` file.
- **Port Conflict:** If port 5000 is used, change `PORT=5000` in `.env` and restart.
- **Missing UI:** Ensure the `client/dist` folder exists. If not, you must run `npm run build` in the `client` folder (requires Node.js).
