# 🚀 Comprehensive Offline Setup Guide

This guide covers everything you need to set up the **Multi-User Dynamic Form Builder** on a completely new machine (Windows/Linux/macOS).

---

## 🛠️ 1. Prerequisites (Must Be Installed First)

Before starting, ensure the following are installed on your system:

1.  **Node.js (v18 or higher)**: [Download from nodejs.org](https://nodejs.org/)
    *   Verify: `node -v` and `npm -v`
2.  **PostgreSQL (v14 or higher)**: [Download from postgresql.org](https://www.postgresql.org/download/)
    *   Ensure the PostgreSQL service is running.
3.  **Git (Optional)**: [Download from git-scm.com](https://git-scm.com/)

---

## 🗄️ 2. Database Initialization

### Using SQL Shell (psql) or pgAdmin:
1.  Login to your PostgreSQL instance.
2.  Run the following command to create the database:
    ```sql
    CREATE DATABASE form_builder_db;
    ```
3.  *(Optional but Recommended)* Create a dedicated user:
    ```sql
    CREATE USER form_admin WITH PASSWORD 'your_secure_password';
    GRANT ALL PRIVILEGES ON DATABASE form_builder_db TO form_admin;
    ```

---

## ⚙️ 3. Environment Configuration

In the **root directory** of the project, create a file named `.env` and paste the following. Adjust the values to match your PostgreSQL setup:

```env
# --- Database Configuration ---
PGUSER=postgres
PGHOST=localhost
PGDATABASE=form_builder_db
PGPASSWORD=your_postgres_password
PGPORT=5432

# --- Security & Auth ---
# Change this to a random long string for production
JWT_SECRET=industry_level_secret_key_2026

# --- Server Port ---
PORT=5000
```

---

## 📦 4. Installing Dependencies

Open a terminal in the project root and run these commands:

### A. Backend Setup
```bash
cd server
npm install
```

### B. Frontend Setup
```bash
cd ../client
npm install
```

---

## 🚀 5. Database Schema & Migrations

To enable all advanced features (Multi-user isolation, Audit logs, Notifications), you **MUST** run these scripts in order. From the `server` directory:

```bash
# 1. Create Base Tables
node db/migrate.js

# 2. Add User Isolation (Ownership & Permissions)
node db/add-user-isolation.js

# 3. Industry Scaling (Audit History & Soft Deletes)
node db/industry-upgrade.js

# 4. Notifications System (Approvals & Requests)
node db/add-notifications.js

# 5. Advanced Collaborative Permissions
node db/migrate-collateral.js

# 6. Specialized Field Types (Zone/Group)
node db/add-group-type.js
```

---

## 🌱 6. Seed Initial Data (Crucial)

To populate the lists of Universities and Organizational Groups for the autocomplete fields, run:
```bash
node db/seed.js
```

---

## 🏃 7. Running the Application

### Option A: Development Mode (For Coding)
Open two separate terminal windows:

*   **Terminal 1 (Server)**:
    ```bash
    cd server
    npm run dev
    ```
*   **Terminal 2 (Client)**:
    ```bash
    cd client
    npm run dev
    ```
    *Access at: `http://localhost:5173`*

### Option B: Production / LAN Mode (Best for Offline Use)
This mode builds the frontend for speed and allows other PCs to connect.

1.  **Build Frontend**:
    ```bash
    cd client
    npm run build
    ```
2.  **Start Server**:
    ```bash
    cd ../server
    npm start
    ```
3.  **Find your IP Address**:
    *   On Windows: `ipconfig` (Look for IPv4 Address)
    *   On Linux/Mac: `ifconfig` or `ip addr`
4.  **Access from other PCs**:
    *   `http://192.168.x.x:5000` (Replace with your IP)

---

## 👑 8. Creating the First Admin

The system has a "First-User-Admin" logic.
1.  Open the application in your browser.
2.  Go to the **Register** page.
3.  Create the very first account.
4.  This user will **automatically** be granted `admin` privileges. You will see an **Admin Dashboard** tab in the navigation.

---

## 🛡️ 9. Troubleshooting

| Issue | Solution |
| :--- | :--- |
| **"Database connection failed"** | Verify your `.env` credentials and ensure PostgreSQL is running. |
| **"Bcrypt" or "Node-gyp" error** | Run `npm install --build-from-source` or update Node.js. |
| **"Module not found"** | Run `npm install` again in the specific directory (client or server). |
| **Port 5000 is busy** | Change `PORT=5000` in `.env` to another number (e.g., 5001). |

---

## 🧹 10. Complete Reset (Dangerous!)
If you want to wipe everything and start over from scratch:
1.  Drop the database: `DROP DATABASE form_builder_db;`
2.  Re-create it: `CREATE DATABASE form_builder_db;`
3.  Repeat steps 5 and 6.
