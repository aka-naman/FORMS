# Guide 1: Offline Deployment on a Fresh Windows PC

This guide covers how to deploy the Form Dashboard on a **brand-new Windows PC with no internet** access.

> **Strategy:** You prepare everything on an internet-connected PC first — download all installers & dependencies — then transfer them to the offline PC via USB drive.

---

## Part A: What to Download (on an internet-connected PC)

You need **2 installers** and the **project folder** with all its libraries pre-included.

> **No git or npm commands are needed on the internet PC.** Everything is downloaded manually via browser.

---

### 1. Node.js (JavaScript Runtime)

| Item | Download Link |
|------|--------------|
| Node.js **v22.x LTS** — Windows 64-bit `.msi` installer | [https://nodejs.org/en/download/](https://nodejs.org/en/download/) |

- Click **"Windows Installer (.msi) 64-bit"** to download
- This includes `node` and `npm` (both are needed)
- File will be named something like `node-v22.15.0-x64.msi`

---

### 2. PostgreSQL (Database)

| Item | Download Link |
|------|--------------|
| PostgreSQL **16.x** — Windows x86-64 installer | [https://www.enterprisedb.com/downloads/postgres-postgresql-downloads](https://www.enterprisedb.com/downloads/postgres-postgresql-downloads) |

- Click the **Windows x86-64** download button for version **16.x**
- This includes pgAdmin 4 (GUI) and psql (command line)
- File will be named something like `postgresql-16.8-1-windows-x64.exe`

---

### 3. Project Code (Download as ZIP from GitHub)

| Item | How to Download |
|------|----------------|
| Project source code | Go to your GitHub repository → click the green **"Code"** button → click **"Download ZIP"** |

This gives you the project source code without needing Git.

---

### 4. NPM Packages (Libraries) — Already Included

If you pushed the project to GitHub **with `node_modules/` included** (not gitignored), you don't need to download anything extra — the ZIP will contain all libraries.

**However, if `node_modules/` is gitignored** (the default), you need someone with Node.js + internet to prepare the folder:

**Option A (Recommended): Prepare on any PC with Node.js + internet**

On any PC that has Node.js installed and internet access, extract the ZIP, then open a terminal and run:
```
cd dashboard\server
npm install
cd ..\client
npm install
npm run build
```

This downloads all libraries and pre-builds the frontend. Then copy the entire `dashboard/` folder to USB.

**Option B: Manual reference list**

If you absolutely cannot run any commands, below is the **complete list of every npm package** used by this project. Each can be downloaded as a `.tgz` file from npmjs.com, but **this method is extremely impractical** because each package has its own dependencies (hundreds of files). **Option A is strongly recommended.**

---

### Complete Dependency Reference (for documentation purposes)

#### Backend (`server/`) — 11 packages

| Package | Version | Purpose | Link |
|---------|---------|---------|------|
| express | ^4.21.0 | Web server framework | [npmjs.com/package/express](https://www.npmjs.com/package/express) |
| pg | ^8.13.0 | PostgreSQL database client | [npmjs.com/package/pg](https://www.npmjs.com/package/pg) |
| bcryptjs | ^2.4.3 | Password hashing | [npmjs.com/package/bcryptjs](https://www.npmjs.com/package/bcryptjs) |
| jsonwebtoken | ^9.0.2 | JWT token signing & verification | [npmjs.com/package/jsonwebtoken](https://www.npmjs.com/package/jsonwebtoken) |
| joi | ^17.13.0 | Request body validation | [npmjs.com/package/joi](https://www.npmjs.com/package/joi) |
| cors | ^2.8.5 | Cross-origin request handling | [npmjs.com/package/cors](https://www.npmjs.com/package/cors) |
| helmet | ^7.1.0 | Security HTTP headers | [npmjs.com/package/helmet](https://www.npmjs.com/package/helmet) |
| morgan | ^1.10.0 | HTTP request logger | [npmjs.com/package/morgan](https://www.npmjs.com/package/morgan) |
| dotenv | ^16.4.5 | Loads .env file variables | [npmjs.com/package/dotenv](https://www.npmjs.com/package/dotenv) |
| exceljs | ^4.4.0 | Excel file read/write | [npmjs.com/package/exceljs](https://www.npmjs.com/package/exceljs) |
| csv-parser | ^3.0.0 | CSV file parser | [npmjs.com/package/csv-parser](https://www.npmjs.com/package/csv-parser) |

#### Frontend (`client/`) — 5 runtime + 10 dev packages

**Runtime dependencies:**

| Package | Version | Purpose | Link |
|---------|---------|---------|------|
| react | ^19.2.0 | UI component library | [npmjs.com/package/react](https://www.npmjs.com/package/react) |
| react-dom | ^19.2.0 | React DOM renderer | [npmjs.com/package/react-dom](https://www.npmjs.com/package/react-dom) |
| react-router-dom | ^7.13.0 | Client-side routing/navigation | [npmjs.com/package/react-router-dom](https://www.npmjs.com/package/react-router-dom) |
| react-hook-form | ^7.71.1 | Form state management | [npmjs.com/package/react-hook-form](https://www.npmjs.com/package/react-hook-form) |
| axios | ^1.13.5 | HTTP client for API calls | [npmjs.com/package/axios](https://www.npmjs.com/package/axios) |

**Dev dependencies (needed to build the frontend, not needed at runtime):**

| Package | Version | Purpose | Link |
|---------|---------|---------|------|
| vite | ^7.3.1 | Build tool & dev server | [npmjs.com/package/vite](https://www.npmjs.com/package/vite) |
| @vitejs/plugin-react | ^5.1.1 | React support for Vite | [npmjs.com/package/@vitejs/plugin-react](https://www.npmjs.com/package/@vitejs/plugin-react) |
| tailwindcss | ^4.2.0 | CSS utility framework | [npmjs.com/package/tailwindcss](https://www.npmjs.com/package/tailwindcss) |
| @tailwindcss/vite | ^4.2.0 | TailwindCSS Vite plugin | [npmjs.com/package/@tailwindcss/vite](https://www.npmjs.com/package/@tailwindcss/vite) |
| eslint | ^9.39.1 | Code linter | [npmjs.com/package/eslint](https://www.npmjs.com/package/eslint) |
| @eslint/js | ^9.39.1 | ESLint JavaScript config | [npmjs.com/package/@eslint/js](https://www.npmjs.com/package/@eslint/js) |
| eslint-plugin-react-hooks | ^7.0.1 | React hooks lint rules | [npmjs.com/package/eslint-plugin-react-hooks](https://www.npmjs.com/package/eslint-plugin-react-hooks) |
| eslint-plugin-react-refresh | ^0.4.24 | React refresh lint rules | [npmjs.com/package/eslint-plugin-react-refresh](https://www.npmjs.com/package/eslint-plugin-react-refresh) |
| globals | ^16.5.0 | Global variable definitions | [npmjs.com/package/globals](https://www.npmjs.com/package/globals) |
| @types/react | ^19.2.7 | TypeScript types for React | [npmjs.com/package/@types/react](https://www.npmjs.com/package/@types/react) |
| @types/react-dom | ^19.2.3 | TypeScript types for ReactDOM | [npmjs.com/package/@types/react-dom](https://www.npmjs.com/package/@types/react-dom) |

---

### USB Drive Contents (Final)

Your USB drive should look like this:

```
USB Drive/
├── node-v22.x.x-x64.msi           ← Node.js installer
├── postgresql-16.x-windows-x64.exe ← PostgreSQL installer
└── dashboard/                      ← Project folder (with node_modules and client/dist pre-included)
    ├── .env
    ├── Final_list_Collges.xlsx
    ├── server/
    │   ├── node_modules/           ← Must be present (from npm install)
    │   ├── package.json
    │   ├── index.js
    │   ├── db/
    │   ├── routes/
    │   └── middleware/
    └── client/
        ├── node_modules/           ← Must be present (from npm install)
        ├── dist/                   ← Must be present (from npm run build)
        ├── package.json
        └── src/
```

---

## Part B: Installation on the Offline PC

### Step 1: Install Node.js

1. Double-click `node-v22.x.x-x64.msi`
2. Click **Next** through the wizard
3. ✅ Make sure **"Add to PATH"** is checked (default)
4. Click **Install** → **Finish**
5. **Verify:** Open `Command Prompt` or `PowerShell` and run:
   ```
   node --version
   npm --version
   ```
   Both should print version numbers.

### Step 2: Install PostgreSQL

1. Double-click `postgresql-16.x-windows-x64.exe`
2. Click **Next** through the wizard
3. **Installation directory:** Keep default (`C:\Program Files\PostgreSQL\16`)
4. **Select Components:** Keep all selected (PostgreSQL Server, pgAdmin 4, Command Line Tools)
5. **Data Directory:** Keep default
6. **Password:** Set a password for the `postgres` superuser — **remember this!**
   - Recommended: use `postgres` as the password for simplicity
7. **Port:** Keep default `5432`
8. **Locale:** Keep default
9. Click **Next** → **Install** → **Finish**
10. **Uncheck** "Launch Stack Builder" — not needed.

#### Add PostgreSQL to System PATH

1. Open **Start Menu** → search "Environment Variables" → click **"Edit the system environment variables"**
2. Click **Environment Variables** button
3. Under **System variables**, find `Path` → click **Edit**
4. Click **New** → add: `C:\Program Files\PostgreSQL\16\bin`
5. Click **OK** → **OK** → **OK**
6. **Close and reopen** PowerShell
7. **Verify:**
   ```
   psql --version
   ```
   Should print `psql (PostgreSQL) 16.x`

### Step 3: Create the Database

Open **PowerShell** and run:

```powershell
psql -U postgres
```

Enter the password you set during installation. Then in the `psql` prompt:

```sql
CREATE DATABASE formbuilder;
\q
```

### Step 4: Copy the Project

1. Copy the entire `dashboard/` folder from the USB drive to the offline PC  
   - Recommended location: `C:\Projects\dashboard`

### Step 5: Configure the Environment File

1. Navigate to the project root: `C:\Projects\dashboard`
2. Open the file `.env` in Notepad (or create it from `.env.example`)
3. Set the following values:

```env
PORT=5000
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=formbuilder
DB_USER=postgres
DB_PASSWORD=postgres
JWT_SECRET=any-random-string-you-want-here
```

> **IMPORTANT:** Use `127.0.0.1` as `DB_HOST`, **not** `localhost`. This avoids IPv6 connection issues on Windows.

> **IMPORTANT:** `DB_PASSWORD` must match the password you set during PostgreSQL installation.

### Step 6: Run Database Migration

This creates all required tables in the database:

```powershell
cd C:\Projects\dashboard\server
node db/migrate.js
```

Expected output:
```
✅ Migration completed successfully
```

### Step 7: Import University Data

```powershell
cd C:\Projects\dashboard\server
node db/import-universities.js
```

Expected output:
```
📂 Reading Excel file: C:\Projects\dashboard\Final_list_Collges.xlsx
📊 Found 1385 unique universities (after dedup)
✅ Successfully imported 1385 universities
✅ Trigram index created for fast search
```

### Step 8: Seed Pincode Data (Optional)

If you have pincode CSV data in `server/data/`:

```powershell
cd C:\Projects\dashboard\server
node db/seed.js
```

---

## Part C: Running the Application

### Option 1: Development Mode (Two Terminals)

**Terminal 1 — Backend:**
```powershell
cd C:\Projects\dashboard\server
node index.js
```
Output: `🚀 Server running on http://0.0.0.0:5000`

**Terminal 2 — Frontend (only if client/dist/ was NOT pre-built):**
```powershell
cd C:\Projects\dashboard\client
npx vite
```
Output: `Local: http://localhost:5173/`

Open browser → `http://localhost:5173`

### Option 2: Production Mode (Single Server, Recommended)

If you pre-built the frontend (`npm run build` in client folder), only the backend is needed:

```powershell
cd C:\Projects\dashboard\server
node index.js
```

Open browser → `http://localhost:5000`

The backend serves the pre-built frontend automatically.

### First-Time Setup

1. Open the application URL in a browser
2. Click **Register** → create your admin account (first user automatically becomes admin)
3. Log in and start creating forms!

---

## Part D: Making It Accessible on the Local Network (Intranet)

### Find the PC's IP Address

```powershell
ipconfig
```

Look for **IPv4 Address** under your active network adapter (e.g., `192.168.1.50`).

### Access from Other PCs

Other computers on the same network can access the form dashboard at:
```
http://192.168.1.50:5000
```

### Share Form Links

When you copy a form's public link from the dashboard, replace `localhost` with the PC's IP address:
```
http://192.168.1.50:5000/f/1
```

---

## Part E: Auto-Start on Boot (Optional)

### Using PM2 (Process Manager)

If you want the server to start automatically when the PC boots:

1. Install PM2 globally (do this on the internet-connected PC before transfer, or include it in `node_modules`):
   ```powershell
   npm install -g pm2
   ```

2. Start the application:
   ```powershell
   cd C:\Projects\dashboard
   pm2 start ecosystem.config.js
   pm2 save
   ```

3. Set PM2 to run on startup:
   ```powershell
   pm2-startup install
   ```

---

## Quick Reference Card

| Component | Version | Purpose |
|-----------|---------|---------|
| Node.js | v22.x LTS | Runs JavaScript on the server |
| npm | (bundled with Node) | Package manager for JS libraries |
| PostgreSQL | 16.x | Database for storing forms, submissions, universities |
| Express.js | 4.21.x | Web framework (backend HTTP server) |
| React | 19.2.x | Frontend UI library |
| Vite | 7.3.x | Frontend build tool (dev only) |
| TailwindCSS | 4.2.x | CSS framework (dev only, compiled into build) |

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `ECONNREFUSED 127.0.0.1:5432` | PostgreSQL service not running. Open Services app → start "postgresql-x64-16" |
| `ECONNREFUSED ::1:5432` | Change `DB_HOST` to `127.0.0.1` in `.env` |
| `password authentication failed` | Wrong password in `.env` — must match PostgreSQL installation password |
| `relation "forms" does not exist` | Run `node db/migrate.js` first |
| Frontend shows blank page | Make sure backend is running. If using dev mode, make sure Vite proxy is working |
| `npm: command not found` | Node.js PATH not set. Reinstall Node.js with "Add to PATH" checked |
