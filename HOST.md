# Local LAN Network Hosting Guide

This guide explains how to host your Form Builder application on your local LAN network so other machines can access it.

---

## Quick Start

### 1. Find Your Local IP Address

**On Windows (PowerShell):**
```powershell
ipconfig
```
Look for **IPv4 Address** under your network adapter (usually `192.168.x.x` or `10.x.x.x`)

**On Mac/Linux:**
```bash
ifconfig
```
Look for `inet` address (not `127.0.0.1`)

### 2. Update `.env` File

Edit the `.env` file in your project root:

```env
PORT=5000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=formbuilder
DB_USER=postgres
DB_PASSWORD=pass123
JWT_SECRET=form-dashboard-jwt-secret-2026
```

The server already listens on `0.0.0.0` (all network interfaces), so no changes needed here!

### 3. Update Client API Configuration

Edit `client/src/api/client.js` and ensure it uses the correct server URL:

```javascript
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;
```

### 4. Create `.env.local` in Client Folder (if needed)

Create `client/.env.local`:

```
VITE_API_URL=http://YOUR_LOCAL_IP:5000/api
```

Or hardcode it during build (see Production Build section below).

### 5. Start the Server

```bash
cd server
npm install
npm run dev
```

Or use PM2 for production:

```bash
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 6. Build & Serve Frontend

```bash
cd client
npm install
npm run build
```

The built files are served automatically by the Express server.

### 7. Access from Another Machine

On any computer on your LAN, open your browser:

```
http://YOUR_LOCAL_IP:5000
```

Example: `http://192.168.1.10:5000`

---

## Detailed Configuration

### Server Configuration (server/index.js)

Your server is already configured to listen on all network interfaces:

```javascript
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Form Dashboard API running at http://0.0.0.0:${PORT}`);
    console.log(`   Local: http://localhost:${PORT}`);
});
```

To access from LAN, use `http://YOUR_IP:PORT`

### Environment Variables Explained

| Variable | Purpose | Default |
|----------|---------|---------|
| `PORT` | Server port | 5000 |
| `DB_HOST` | PostgreSQL host | localhost |
| `DB_PORT` | PostgreSQL port | 5432 |
| `DB_NAME` | Database name | formbuilder |
| `DB_USER` | Database user | postgres |
| `DB_PASSWORD` | Database password | pass123 |
| `JWT_SECRET` | JWT token secret | form-dashboard-jwt-secret-2026 |

### Using Different Ports

To use a different port (e.g., 8080):

**Update `.env`:**
```env
PORT=8080
```

**Access via:** `http://YOUR_LOCAL_IP:8080`

---

## Database Setup

### Install PostgreSQL Locally

**Windows:**
1. Download from https://www.postgresql.org/download/windows/
2. Install with createdb, createuser utilities
3. Default port: 5432

**Mac (Homebrew):**
```bash
brew install postgresql
brew services start postgresql
```

**Linux (Ubuntu):**
```bash
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib
sudo service postgresql start
```

### Initialize Database

```bash
cd server
npm run migrate
npm run seed
```

This will:
- Create all required tables
- Create indexes for performance
- Seed university data

---

## Production Deployment (PM2)

### 1. Install PM2 Globally

```bash
npm install -g pm2
```

### 2. Configure ecosystem.config.js

Edit `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [
    {
      name: 'form-dashboard-api',
      script: './server/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
        DB_HOST: 'localhost',
        DB_PORT: 5432,
        DB_NAME: 'formbuilder',
        DB_USER: 'postgres',
        DB_PASSWORD: 'pass123',
      },
    },
  ],
};
```

### 3. Start with PM2

```bash
pm2 start ecosystem.config.js

# View logs
pm2 logs form-dashboard-api

# Monitor
pm2 monit

# Stop
pm2 stop form-dashboard-api

# Restart
pm2 restart form-dashboard-api
```

### 4. Enable Auto-start on Reboot

```bash
pm2 startup
pm2 save
```

---

## Firewall Configuration

### Windows Firewall

1. Open **Windows Defender Firewall** → **Advanced Settings**
2. Click **Inbound Rules** → **New Rule**
3. Select **Port** → **Next**
4. Choose **TCP**, enter port `5000` → **Next**
5. Select **Allow the connection** → **Next**
6. Name it "Form Dashboard" → **Finish**

### Mac Firewall

System Settings → Security & Privacy → Firewall Options → Add your app

### Linux (UFW)

```bash
sudo ufw allow 5000/tcp
sudo ufw enable
```

---

## Troubleshooting

### "Connection refused" from another machine

**Problem:** Other machines can't connect to your machine

**Solutions:**
1. Verify firewall allows port 5000
2. Check your server is running: `npm run dev`
3. Verify correct IP address: `ipconfig` (Windows) or `ifconfig` (Mac/Linux)
4. Ensure both machines on same network
5. Test locally first: `http://localhost:5000`

### "Database connection failed"

**Problem:** Server can't connect to PostgreSQL

**Solutions:**
1. Check PostgreSQL is running
2. Verify `DB_HOST`, `DB_USER`, `DB_PASSWORD` in `.env`
3. Test connection: 
   ```bash
   psql -h localhost -U postgres -d formbuilder
   ```
4. Run migrations: `npm run migrate`

### "API calls fail from LAN client"

**Problem:** Frontend loads but API calls fail

**Solutions:**
1. Open browser DevTools → Network tab
2. Check API URL in requests (should be `http://YOUR_IP:5000/api/...`)
3. Update `VITE_API_URL` environment variable
4. Clear browser cache
5. Check CORS is enabled in server (it is by default)

### Port already in use

```bash
# Find process using port 5000 (Windows)
netstat -ano | findstr :5000

# Kill process
taskkill /PID <PID> /F
```

---

## Production Checklist

- [ ] Change JWT_SECRET to a secure value
- [ ] Update database password
- [ ] Use environment variables for all config
- [ ] Enable HTTPS (using nginx reverse proxy)
- [ ] Setup firewall rules
- [ ] Configure backups for PostgreSQL
- [ ] Monitor server performance with PM2
- [ ] Setup log rotation
- [ ] Test from multiple LAN machines
- [ ] Document your local IP for team

---

## Access Credentials

After setup, the **first user** created becomes admin automatically.

**Setup Flow:**
1. Go to `http://YOUR_IP:5000`
2. Click **Register**
3. Create first user → automatically becomes **Admin** ✓
4. Admin can:
   - Create forms
   - Edit forms
   - Delete forms
   - View all forms and submissions
5. Subsequent users → regular users
   - Can only see their own forms

---

## Example LAN Access Scenarios

### Scenario 1: Access on Same WiFi

Developer machine: `192.168.1.10`
Other machine: `192.168.1.20`

Access: `http://192.168.1.10:5000`

### Scenario 2: Different Subnets (Same Network)

Server: `10.0.1.50`

Access: `http://10.0.1.50:5000`

### Scenario 3: Specific Room/Office Setup

Server: `192.168.1.100` (Port 5000)
Rooms: Use `http://192.168.1.100:5000`

---

## Performance Tips

1. **Database indexing** is already configured
2. **Connection pooling** is enabled (max 20)
3. **CORS** is configured for all origins
4. **Compression** can be added:

```javascript
const compression = require('compression');
app.use(compression());
```

5. **Static file caching** for frontend:

```javascript
app.use(express.static(clientBuildPath, {
  maxAge: '1d',
  etag: false
}));
```

---

## Security Notes

⚠️ **For Local LAN Only** - This setup is for internal networks

For production/internet:
- Use HTTPS with SSL certificates
- Use reverse proxy (nginx/Apache)
- Implement rate limiting
- Add request validation
- Use stronger passwords
- Implement CSRF protection
- Add authentication logging
- Regular security updates

