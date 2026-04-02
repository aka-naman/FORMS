# 🏁 COMPLETE SUPER-DETAILED OFFLINE SETUP GUIDE
## Multi-User Dynamic Form Builder (V1.0)

This document provides the **exact sequence of commands** and steps to set up this project on a computer with **zero internet access**.

---

### 📂 Phase 1: Online Preparation (On a PC with Internet)
*You must perform these steps on a PC with internet before moving to the offline machine.*

1.  **Download Node.js Installer:** Download the `.msi` (Windows) or `.pkg` (Mac) installer for **Node.js v18 or v20**.
2.  **Download PostgreSQL Installer:** Download the installer for **PostgreSQL v14+**.
3.  **Prepare the Project Folder:**
    - Open a terminal in `22-2-forms/server` and run: `npm install`
    - Open a terminal in `22-2-forms/client` and run: `npm install`
    - Then run: `npm run build` (This creates the `client/dist` folder).
4.  **Copy to USB:** Copy the entire `22-2-forms` folder to a USB drive. **Crucial:** Ensure `node_modules` and `client/dist` are included.

---

### 🛠️ Phase 2: Offline PC Environment Setup
*On the target offline computer.*

1.  **Install Software:**
    - Run the Node.js installer you downloaded.
    - Run the PostgreSQL installer. Follow the prompts and **note down your password**.
2.  **Create the Database:**
    - Open **pgAdmin 4** (installed with PostgreSQL).
    - Right-click "Databases" -> "Create" -> "Database...".
    - Name it: `formbuilder`. Click **Save**.
3.  **Configure Environment:**
    - Open `22-2-forms/server/.env` in Notepad.
    - Change `DB_USER` to `postgres` (default).
    - Change `DB_PASSWORD` to the password you set during PostgreSQL installation.
    - Ensure `PORT=5000`.

---

### 🚀 Phase 3: The Exact Command Sequence
*Open a terminal (Command Prompt or PowerShell) and navigate to the `server` folder.*

#### **Step 1: Create Base Tables**
```bash
node db/migrate.js
```
> **What to expect:** You should see `✓ users table`, `✓ forms table`, etc. ending with `✅ All migrations completed successfully!`.

#### **Step 2: Create Collaborative & Learning Features**
```bash
node db/migrate-collateral.js
```
> **What to expect:** You should see `✓ branches table` and `✓ seeded initial branches`. This enables the "learning" system.

#### **Step 3: Seed University Data**
```bash
node db/seed.js
```
> **What to expect:** You should see `Parsed X rows from Excel` and `✅ Seeded universities successfully!`. This populates the autocomplete.

#### **Step 4: Start Server for Admin Registration**
```bash
node index.js
```
> **What to expect:** `🚀 Form Dashboard API running at: http://localhost:5000`.
> **Action:** Leave this terminal open.

#### **Step 5: Register the FIRST USER (The Admin)**
1.  Open your web browser and go to: `http://localhost:5000/register`
2.  Enter a username (e.g., `admin`) and a password.
3.  Click **Register**.
4.  **Important:** Once you are logged in, go back to the terminal and press **`Ctrl + C`** to stop the server.

#### **Step 6: Enable User Isolation**
*Now that an admin user exists, you must link the database structure.*
```bash
node db/add-user-isolation.js
```
> **What to expect:** `✅ User isolation setup completed successfully!`.

---

### 🏃 Phase 4: Final Daily Usage
From now on, whenever you want to use the app, just run:
```bash
cd server
node index.js
```
*Access the system at `http://localhost:5000`.*

---

### 💡 Key Features Verified for this Setup:
- **🎓 Smart Autocomplete:** Search for any university; it uses the seeded database.
- **🧠 Learning System:** If you type a new university or branch name during submission, it is saved for future suggestions.
- **🏠 Address Lookup:** States and Districts for India are automatically loaded from `server/data/india_states_districts.json`.
- **👑 Admin Control:** As the first user, you can access `http://localhost:5000/admin` to see all system data and manage users.
- **📊 Offline Exports:** The "Export Excel" button on the submissions page works entirely without an internet connection.
