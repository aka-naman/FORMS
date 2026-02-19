# INSTALLATION_OFFLINE.md — Complete Offline Setup Guide

This guide assumes you have a **USB drive** with the following:

```
USB Drive (e.g., E:\)
├── node-v22.x.x-x64.msi            ← Node.js installer (from nodejs.org)
├── postgresql-16.x-windows-x64.exe  ← PostgreSQL installer (from enterprisedb.com)
└── dashboard\                       ← Project folder copied from YOUR development PC
    ├── .env
    ├── Final_list_Collges.xlsx
    ├── server\
    │   ├── node_modules\            ← THIS is all the backend libraries (already present)
    │   ├── package.json
    │   ├── index.js
    │   ├── db\
    │   ├── routes\
    │   └── middleware\
    └── client\
        ├── node_modules\            ← THIS is all the frontend libraries (already present)
        ├── dist\                    ← Pre-built frontend (already present)
        ├── package.json
        └── src\
```

> **About `node_modules`:** You do NOT "install" anything from this folder.
> It IS the installed libraries. When you copy the project folder, `node_modules` comes with it.
> Node.js reads from this folder automatically when you run any `.js` file — no commands needed.

---

## Step 1: Install Node.js

1. Plug in USB drive
2. Double-click: `E:\node-v22.x.x-x64.msi`
3. Click **Next** → **Next** → **Next**
4. ✅ Ensure **"Add to PATH"** is checked (it is checked by default)
5. Click **Install** → wait → click **Finish**

### Verify Node.js is installed:

1. Press `Win + R` → type `powershell` → press Enter
2. Type:

```powershell
node --version
```

Expected output: `v22.x.x`

```powershell
npm --version
```

Expected output: `10.x.x`

> If these commands show "not recognized", **restart your PC** and try again (PATH needs a restart to take effect).

---

## Step 2: Install PostgreSQL

1. Double-click: `E:\postgresql-16.x-windows-x64.exe`
2. Click **Next**
3. **Installation directory:** Leave default → `C:\Program Files\PostgreSQL\16` → Click **Next**
4. **Select Components:** Keep ALL checked → Click **Next**
5. **Data Directory:** Leave default → Click **Next**
6. **Password:** Type `postgres` → Confirm: `postgres` → Click **Next**
7. **Port:** Leave as `5432` → Click **Next**
8. **Locale:** Leave default → Click **Next**
9. Click **Next** → **Install** → wait for it to finish
10. **Uncheck** "Launch Stack Builder" → Click **Finish**

### Add PostgreSQL to System PATH:

1. Press `Win` key → type `environment` → click **"Edit the system environment variables"**
2. Click the **Environment Variables** button (bottom of the dialog)
3. In **System variables** (bottom section), find `Path` → click it → click **Edit**
4. Click **New**
5. Type: `C:\Program Files\PostgreSQL\16\bin`
6. Click **OK** → **OK** → **OK**

### Verify PostgreSQL is installed:

1. **Close** any open PowerShell windows
2. Open a **new** PowerShell window (`Win + R` → `powershell`)
3. Type:

```powershell
psql --version
```

Expected output: `psql (PostgreSQL) 16.x`

---

## Step 3: Create the Database

In the same PowerShell window, type:

```powershell
psql -U postgres
```

It will ask for a password. Type: `postgres` (the password you set in Step 2)

You are now in the PostgreSQL command prompt (it shows `postgres=#`). Type:

```sql
CREATE DATABASE formbuilder;
```

Press Enter. You should see `CREATE DATABASE`.

Now type:

```sql
\q
```

Press Enter. This exits PostgreSQL and returns to PowerShell.

---

## Step 4: Copy the Project Folder

Copy the `dashboard` folder from USB to your PC:

```powershell
xcopy E:\dashboard C:\Projects\dashboard\ /E /I /H
```

Or simply drag-and-drop the `dashboard` folder from USB to `C:\Projects\` using File Explorer.

> **This is the step where `node_modules` gets copied.** Since the folder is already inside
> `dashboard\server\` and `dashboard\client\`, all libraries are now on the offline PC.
> You do NOT need to run `npm install`. Everything is already there.

---

## Step 5: Configure the .env File

1. Open File Explorer → navigate to `C:\Projects\dashboard`
2. Right-click `.env` → **Open with** → **Notepad**
3. Make sure it contains exactly this:

```
PORT=5000
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=formbuilder
DB_USER=postgres
DB_PASSWORD=postgres
JWT_SECRET=my-offline-secret-key-12345
```

4. Save the file (`Ctrl + S`) and close Notepad

> ⚠️ **IMPORTANT:** `DB_HOST` must be `127.0.0.1`, NOT `localhost`.
> ⚠️ **IMPORTANT:** `DB_PASSWORD` must match what you typed during PostgreSQL installation.

---

## Step 6: Create Database Tables

Open PowerShell and type:

```powershell
cd C:\Projects\dashboard\server
node db/migrate.js
```

Expected output:
```
✅ Migration completed successfully
```

> This creates all the tables (users, forms, submissions, universities, etc.) in your database.

---

## Step 7: Import University Data

Still in the same PowerShell window:

```powershell
node db/import-universities.js
```

Expected output:
```
📂 Reading Excel file: C:\Projects\dashboard\Final_list_Collges.xlsx
📊 Found 1385 unique universities (after dedup)
  ⏳ Inserted 1385/1385 universities...
✅ Successfully imported 1385 universities
✅ Trigram index created for fast search
```

---

## Step 8: Start the Server

Still in the same PowerShell window:

```powershell
node index.js
```

Expected output:
```
🚀 Server running on http://0.0.0.0:5000
```

> **Do NOT close this PowerShell window** — the server stops if you close it.

---

## Step 9: Open the Application

1. Open any web browser (Chrome, Edge, Firefox)
2. Go to: `http://localhost:5000`
3. Click **Register** → create your admin account
   - The **first user** who registers automatically becomes the admin
4. Log in with the account you just created
5. You're in! Start creating forms.

---

## Step 10: Access from Other PCs on the Network

To find this PC's IP address, open a **new** PowerShell window and type:

```powershell
ipconfig
```

Look for **IPv4 Address** under your active network adapter (e.g., `192.168.1.50`).

Other PCs on the same local network can access the app at:

```
http://192.168.1.50:5000
```

---

## How to Restart the App After PC Reboot

Every time you restart the PC, you need to start the server again:

1. Open PowerShell
2. Type:

```powershell
cd C:\Projects\dashboard\server
node index.js
```

3. Open browser → `http://localhost:5000`

> You do NOT need to repeat Steps 1–7 ever again. Those are one-time setup only.

---

## FAQ

**Q: Do I need internet at any point on the offline PC?**
A: No. Zero internet needed. Everything runs locally.

**Q: What is `node_modules`? Do I install something from it?**
A: `node_modules` is a folder that contains all the JavaScript libraries (Express, React, etc.).
You don't install "from" it — when you copied the project folder, the libraries came along.
Node.js automatically looks inside `node_modules` when running your code. That's it.

**Q: Do I need to install React, Express, or any library separately?**
A: No. They're all inside `node_modules`. No separate installation needed.

**Q: Do I need Python, Java, TypeScript, or any other language?**
A: No. Only Node.js and PostgreSQL. This project uses plain JavaScript.

**Q: What if I get "port 5000 already in use"?**
A: Another program is using port 5000. Either close it, or change `PORT=5001` in the `.env` file and restart.

**Q: What if I get "ECONNREFUSED 127.0.0.1:5432"?**
A: PostgreSQL service is not running. Press `Win + R` → type `services.msc` → find `postgresql-x64-16` → right-click → **Start**.
