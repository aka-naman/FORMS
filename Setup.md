# 🚀 Multi-User Form Builder - Setup Guide (Non-Docker)

Complete setup guide to install and run the Form Builder application on a new PC without Docker.

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Clone/Download Project](#clonedownload-project)
3. [Database Setup](#database-setup)
4. [Server Setup](#server-setup)
5. [Client Setup](#client-setup)
6. [Run the Project](#run-the-project)
7. [First Time Setup](#first-time-setup)
8. [Troubleshooting](#troubleshooting)

---

## 🔧 Prerequisites

### Required Software

- **Node.js** (v14 or higher)
  - Download: https://nodejs.org/
  - Verify: `node --version` and `npm --version`

- **PostgreSQL** (v12 or higher)
  - Download: https://www.postgresql.org/download/
  - Verify: `psql --version`

- **Git** (optional, for cloning)
  - Download: https://git-scm.com/

### System Requirements

- **RAM**: 2GB minimum (4GB recommended)
- **Disk Space**: 1GB free
- **Network**: Internet access (for first-time npm installations)

---

## 📥 Clone/Download Project

### Option A: Using Git (Recommended)

```bash
git clone <repository-url> formbuilder
cd formbuilder
```

### Option B: Manual Download

1. Download project as ZIP
2. Extract to desired location
3. Open terminal/PowerShell in the extracted folder

**Folder structure should look like:**

```
formbuilder/
├── server/
│   ├── routes/
│   ├── middleware/
│   ├── db/
│   ├── index.js
│   ├── package.json
│   └── ...
├── client/
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── ...
├── .env
├── .env.example
├── package.json
└── README.md
```

---

## 🗄️ Database Setup

### Step 1: Install & Start PostgreSQL

**Windows:**
- Install from https://www.postgresql.org/download/windows/
- PostgreSQL starts automatically as a service
- Verify: Open Command Prompt and run `psql -U postgres`

**Mac (Homebrew):**
```bash
brew install postgresql
brew services start postgresql
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib
sudo service postgresql start
```

### Step 2: Create Database & User

Connect to PostgreSQL:

```bash
psql -U postgres
```

Then run these commands in psql:

```sql
-- Create user
CREATE USER formbuilder WITH PASSWORD 'pass123';

-- Create database
CREATE DATABASE formbuilder OWNER formbuilder;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE formbuilder TO formbuilder;

-- Exit psql
\q
```

### Step 3: Verify Connection

```bash
psql -h localhost -U formbuilder -d formbuilder
```

If successful, you'll see the psql prompt. Exit with `\q`

---

## 🔧 Server Setup

### Step 1: Navigate to Server Directory

```bash
cd server
```

### Step 2: Install Dependencies

```bash
npm install
```

This installs:
- Express.js (web framework)
- PostgreSQL driver
- JWT authentication
- CORS, Helmet, Morgan
- And other dependencies from `package.json`

### Step 3: Configure Environment Variables

**Create/Edit `.env` file in the `server` directory:**

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=formbuilder
DB_USER=formbuilder
DB_PASSWORD=pass123

# JWT Secret (change this in production!)
JWT_SECRET=form-dashboard-jwt-secret-2026
```

**⚠️ Important for Production:**
- Change `JWT_SECRET` to a random strong value
- Change `DB_PASSWORD` to a secure password
- Set `NODE_ENV=production`

### Step 4: Run Database Migrations

Initialize the database schema:

```bash
npm run migrate
```

This creates all required tables:
- `users` - User accounts and roles
- `forms` - Form definitions
- `form_versions` - Form versions
- `form_fields` - Individual form fields
- `submissions` - Form submissions
- `submission_values` - Submission field values
- `universities` - University autocomplete data

### Step 5: Add Multi-User Support

Apply database changes for user isolation:

```bash
node db/add-user-isolation.js
```

Expected output:
```
🔄 Adding user isolation to forms...
1️⃣  Checking for user_id column...
   ✓ Added user_id column
...
✅ User isolation setup completed successfully!
```

### Step 6: Seed Sample Data (Optional)

Load university data for autocomplete:

```bash
npm run seed
```

### Step 7: Verify Server

Test that the server starts correctly:

```bash
npm run dev
```

Expected output:
```
🚀 Form Dashboard API running at http://0.0.0.0:5000
   Local: http://localhost:5000
```

Press `Ctrl+C` to stop (we'll run it properly later)

---

## ⚛️ Client Setup

### Step 1: Navigate to Client Directory

```bash
cd ../client
```

### Step 2: Install Dependencies

```bash
npm install
```

This installs:
- React
- React Router
- Axios
- Vite (build tool)
- And other dependencies

### Step 3: Configure API URL (if needed)

**File: `client/.env.local` (create if doesn't exist)**

For local development, the default is fine:
```
VITE_API_URL=http://localhost:5000/api
```

For LAN access, use your machine IP:
```
VITE_API_URL=http://192.168.1.10:5000/api
```

### Step 4: Build Frontend (for production)

```bash
npm run build
```

This creates an optimized production build in `client/dist/`

---

## 🚀 Run the Project

### Option 1: Development Mode (Recommended for Setup)

**Terminal 1 - Start Backend:**
```bash
cd server
npm run dev
```

Expected:
```
🚀 Form Dashboard API running at http://0.0.0.0:5000
```

**Terminal 2 - Start Frontend:**
```bash
cd client
npm run dev
```

Expected:
```
Local: http://localhost:5173
```

**Access the app:** http://localhost:5173

### Option 2: Production Mode

**Build the client:**
```bash
cd client
npm run build
```

**Start the server (serves built client):**
```bash
cd ../server
npm run dev
```

The server automatically serves the built frontend from `client/dist/`

**Access the app:** http://localhost:5000

### Option 3: Using PM2 (For Persistent Running)

Install PM2 globally:
```bash
npm install -g pm2
```

Start both services:
```bash
# From project root
pm2 start server/index.js --name "form-api"
pm2 start "npm run dev" --cwd client --name "form-client"

# Monitor
pm2 monit

# Stop
pm2 stop all

# Start at system boot
pm2 startup
pm2 save
```

---

## 👥 First Time Setup (Multi-User System)

### Understanding the Architecture

This is a **multi-user form builder** where:
- **First User** = Auto-admin (can create forms, see all forms/users)
- **Other Users** = Regular users (can only create and manage their own forms)
- **Admin Dashboard** = View all users, forms, and statistics

### Step 1: First Registration

1. Open http://localhost:5173 (or your server URL)
2. Click **Register**
3. Create first user (this becomes **Admin**)
   - Username: `admin`
   - Password: `password123` (change later)
4. Login with these credentials

### Step 2: Admin Access

After login as admin:
- Click **📊 Admin Dashboard** button (top right)
- View all users and their forms
- Monitor system statistics

### Step 3: Create More Users

1. Logout from admin account
2. Register new user
3. Login - this user can only see/manage their own forms
4. Regular users can still fill admin's forms, but cannot edit them

---

## 📁 Project Structure

```
formbuilder/
│
├── server/
│   ├── db/
│   │   ├── pool.js           # Database connection
│   │   ├── migrate.js        # Create tables
│   │   ├── seed.js           # Load university data
│   │   └── add-user-isolation.js  # Add multi-user support
│   │
│   ├── middleware/
│   │   └── auth.js           # JWT authentication
│   │
│   ├── routes/
│   │   ├── auth.js           # Login/Register
│   │   ├── forms.js          # Form CRUD (user-isolated)
│   │   ├── fields.js         # Form fields
│   │   ├── submissions.js    # Form submissions
│   │   ├── export.js         # Export to Excel
│   │   └── autocomplete.js   # University autocomplete
│   │
│   ├── index.js              # Express server entry
│   ├── package.json
│   └── .env                  # Environment variables
│
├── client/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx
│   │   │   ├── RegisterPage.jsx
│   │   │   ├── DashboardPage.jsx       # User forms
│   │   │   ├── AdminDashboardPage.jsx  # Admin stats
│   │   │   ├── FormBuilderPage.jsx
│   │   │   ├── FormSubmitPage.jsx
│   │   │   └── SubmissionsPage.jsx
│   │   │
│   │   ├── components/
│   │   │   ├── ProtectedRoute.jsx
│   │   │   ├── AdminRoute.jsx         # Admin-only access
│   │   │   └── AutocompleteInput.jsx
│   │   │
│   │   ├── contexts/
│   │   │   ├── AuthContext.jsx        # User auth state
│   │   │   └── ThemeContext.jsx
│   │   │
│   │   ├── api/
│   │   │   └── client.js              # API configuration
│   │   │
│   │   ├── App.jsx                    # Routes configuration
│   │   └── main.jsx
│   │
│   ├── styles/
│   │   ├── admin-dashboard.css        # Admin panel styles
│   │   └── ...
│   │
│   ├── package.json
│   └── vite.config.js
│
├── .env                       # Environment variables
├── .env.example              # Example variables
├── Setup.md                  # This file
├── FIELD_TYPES_GUIDE.md     # How to add field types
├── HOST.md                   # LAN hosting guide
├── MULTIUSER.md              # Multi-user architecture
└── README.md
```

---

## 🏃 Quick Commands Reference

| Task | Command |
|------|---------|
| Start server | `cd server && npm run dev` |
| Start client | `cd client && npm run dev` |
| Initialize DB | `cd server && npm run migrate` |
| Add multi-user support | `cd server && node db/add-user-isolation.js` |
| Load sample data | `cd server && npm run seed` |
| Build for production | `cd client && npm run build` |
| Install dependencies | `npm install` |

---

## 🌐 Access from Other Machines (LAN)

### Enable LAN Access

1. **Find your machine IP:**
   - Windows: `ipconfig` → look for IPv4 Address
   - Mac/Linux: `ifconfig` → look for inet

2. **Update client `.env.local`:**
   ```env
   VITE_API_URL=http://192.168.1.10:5000/api
   ```

3. **Access from another machine:**
   ```
   http://192.168.1.10:5173  (dev mode)
   or
   http://192.168.1.10:5000  (production mode)
   ```

---

## 🐛 Troubleshooting

### "Port already in use"

**Problem:** Server fails to start with port error

**Solution:**
```bash
# Find process using port 5000
netstat -ano | findstr :5000

# Kill the process (replace PID)
taskkill /PID <PID> /F

# Or change PORT in .env
PORT=5001
```

### "Cannot connect to database"

**Problem:** Database connection error

**Check:**
1. Is PostgreSQL running?
   - Windows: Check Services
   - Mac: `brew services list`
   - Linux: `sudo service postgresql status`

2. Verify credentials in `.env`:
   - `DB_HOST=localhost`
   - `DB_PASSWORD=pass123` (or your password)
   - `DB_NAME=formbuilder`

3. Test connection:
   ```bash
   psql -h localhost -U formbuilder -d formbuilder
   ```

### "Module not found" errors

**Solution:**
```bash
# Clear npm cache
npm cache clean --force

# Reinstall dependencies
rm -rf node_modules package-lock.json  # Windows: del node_modules
npm install
```

### "API calls fail" (CORS error)

**Problem:** Frontend can't call backend API

**Check:**
1. Backend running on correct port? `npm run dev`
2. CORS enabled in server (`cors()` middleware)
3. API URL correct in frontend `.env.local`
4. Firewall not blocking ports 5000/5173

### "No forms appear in dashboard"

**Problem:** After login, dashboard is empty

**Possible causes:**
- Database not initialized: Run `npm run migrate`
- User not created properly: Try registering again
- Check browser console for errors (F12)

### "Admin Dashboard not accessible"

**Problem:** "Access Denied" message

**Check:**
1. Are you logged in as admin?
   - First user created = admin
   - Check user badge (👑 Admin vs 👤 User)
2. Try logging out and back in
3. Clear browser cache and localStorage

---

## 📝 Environment Variables Explained

### Server (.env)

```env
# Server Port (default: 5000)
PORT=5000

# Node environment
NODE_ENV=development  # or 'production'

# Database Connection
DB_HOST=localhost          # PostgreSQL server address
DB_PORT=5432              # PostgreSQL port
DB_NAME=formbuilder       # Database name
DB_USER=formbuilder       # Database user
DB_PASSWORD=pass123       # Database password (change in production!)

# JWT Token Secret (change this!)
JWT_SECRET=form-dashboard-jwt-secret-2026
```

### Client (.env.local)

```env
# API Base URL (for backend communication)
VITE_API_URL=http://localhost:5000/api

# For LAN access:
# VITE_API_URL=http://192.168.1.10:5000/api
```

---

## 🔐 Security Notes

⚠️ **IMPORTANT FOR PRODUCTION:**

1. **Change JWT_SECRET:**
   ```bash
   # Generate random secret
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. **Change Database Password:**
   ```sql
   ALTER USER formbuilder WITH PASSWORD 'new-secure-password';
   ```

3. **Enable HTTPS:**
   - Use nginx or Apache reverse proxy
   - Install SSL certificate (Let's Encrypt)

4. **Firewall Rules:**
   - Limit port 5000 to trusted IPs only
   - Don't expose database port (5432) publicly

5. **Regular Backups:**
   ```bash
   pg_dump -h localhost -U formbuilder -d formbuilder > backup.sql
   ```

---

## 🎯 Next Steps

1. **Customize Field Types**: See `FIELD_TYPES_GUIDE.md`
2. **Host on LAN**: See `HOST.md`
3. **Understand Multi-User System**: See `MULTIUSER.md`
4. **Deploy to Production**: Use PM2, nginx, and proper SSL

---

## ✅ Setup Checklist

- [ ] Node.js installed and verified
- [ ] PostgreSQL installed and running
- [ ] Project cloned/downloaded
- [ ] Server dependencies installed (`npm install`)
- [ ] .env file configured with DB credentials
- [ ] Database migrations run (`npm run migrate`)
- [ ] User isolation added (`node db/add-user-isolation.js`)
- [ ] Database seed data loaded (`npm run seed`)
- [ ] Client dependencies installed (`npm install`)
- [ ] Server starts without errors (`npm run dev`)
- [ ] Client starts without errors (`npm run dev`)
- [ ] Can access app at http://localhost:5173
- [ ] Can register first user (becomes admin)
- [ ] Can access admin dashboard (👑 Admin)
- [ ] Can register second user and see user isolation

---

## 🎉 You're Ready!

Your Form Builder is now setup and ready to use. Happy building! 📋✨
