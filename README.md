# 📋 Form Dashboard — Offline Dynamic Form Builder

A self-hosted, offline-capable form management system built for environments with limited or no internet connectivity. Create dynamic forms, collect submissions, and export data — all from a local network.

---

## ✨ Features

- **Dynamic Form Builder** — Drag-and-drop-style interface to create forms with multiple field types
- **Public Form Links** — Share forms via links (`/f/:formId`) — no login required for respondents
- **Smart Autocomplete** — Pincode, College, and University search with auto-fill for State & District
- **University Management** — Admin panel to add, search, and manage 1,385+ universities
- **Excel Export** — Download all submissions as `.xlsx` files with one click
- **Offline-First** — Runs entirely on a local network with zero internet dependency
- **Role-Based Access** — Admin and user roles with JWT authentication
- **Dark Glassmorphic UI** — Modern, responsive design with smooth animations

---

## 🛠️ Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Frontend** | React | 19.2 |
| **Routing** | React Router | 7.13 |
| **Styling** | TailwindCSS | 4.2 |
| **Build Tool** | Vite | 7.3 |
| **Backend** | Express.js | 4.21 |
| **Database** | PostgreSQL | 16.x |
| **Auth** | JWT (jsonwebtoken) | 9.0 |
| **Runtime** | Node.js | 22.x LTS |

---

## 📁 Project Structure

```
dashboard/
├── .env                         # Environment configuration
├── .env.example                 # Template for .env
├── ecosystem.config.js          # PM2 production config
├── Final_list_Collges.xlsx      # University data source
│
├── server/                      # ── Backend ──
│   ├── index.js                 # Express app entry point
│   ├── package.json
│   ├── db/
│   │   ├── pool.js              # PostgreSQL connection pool
│   │   ├── migrate.js           # Table creation script
│   │   ├── seed.js              # Pincode data importer
│   │   └── import-universities.js # University data importer
│   ├── middleware/
│   │   └── auth.js              # JWT auth & admin middleware
│   └── routes/
│       ├── auth.js              # Login, Register, Me
│       ├── forms.js             # Form CRUD + duplicate/lock
│       ├── fields.js            # Form field management
│       ├── submissions.js       # Submission handling
│       ├── export.js            # Excel export
│       ├── public.js            # Public form access & autocomplete
│       ├── universities.js      # University management (admin)
│       └── autocomplete.js      # Authenticated autocomplete
│
└── client/                      # ── Frontend ──
    ├── vite.config.js           # Vite + TailwindCSS config
    ├── package.json
    └── src/
        ├── main.jsx             # React entry point
        ├── App.jsx              # Router setup
        ├── index.css            # TailwindCSS import
        ├── api/
        │   └── client.js        # Axios HTTP client with JWT
        ├── contexts/
        │   └── AuthContext.jsx   # Auth state provider
        ├── components/
        │   ├── ProtectedRoute.jsx
        │   ├── AutocompleteInput.jsx
        │   └── PublicAutocompleteInput.jsx
        └── pages/
            ├── LoginPage.jsx
            ├── RegisterPage.jsx
            ├── DashboardPage.jsx
            ├── FormBuilderPage.jsx
            ├── FormSubmitPage.jsx
            ├── FormSelectPage.jsx
            ├── PublicFormPage.jsx
            ├── SubmissionsPage.jsx
            └── UniversitiesPage.jsx
```

---

## 🚀 Quick Start (Development)

### Prerequisites

- [Node.js v22+ LTS](https://nodejs.org/)
- [PostgreSQL 16+](https://www.enterprisedb.com/downloads/postgres-postgresql-downloads)

### 1. Clone & Configure

```bash
git clone https://github.com/YOUR_USERNAME/dashboard.git
cd dashboard
cp .env.example .env
```

Edit `.env` with your database credentials:

```env
PORT=5000
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=formbuilder
DB_USER=postgres
DB_PASSWORD=postgres
JWT_SECRET=change-this-to-a-random-secret
```

### 2. Create Database

```bash
psql -U postgres -c "CREATE DATABASE formbuilder;"
```

### 3. Install Dependencies

```bash
cd server && npm install && cd ..
cd client && npm install && cd ..
```

### 4. Run Migrations & Import Data

```bash
cd server
node db/migrate.js
node db/import-universities.js
```

### 5. Start Development Servers

**Terminal 1 — Backend:**
```bash
cd server
npm run dev
```

**Terminal 2 — Frontend:**
```bash
cd client
npm run dev
```

Open **http://localhost:5173** in your browser.

---

## 🏭 Production Deployment

### Build Frontend

```bash
cd client
npm run build
```

### Start Server

```bash
cd server
node index.js
```

The backend serves the pre-built frontend at **http://localhost:5000**.

### With PM2 (Auto-restart)

```bash
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
```

---

## 🔌 Offline Deployment

This application is designed to run on a PC **without internet**. See **[INSTALLATION_OFFLINE.md](INSTALLATION_OFFLINE.md)** for the complete step-by-step guide.

**Summary:**
1. Copy the project folder (with `node_modules/` and `client/dist/`) to USB
2. Download Node.js and PostgreSQL installers to USB
3. Install both on the offline PC
4. Configure `.env`, run migrations, start server
5. Access at `http://localhost:5000`

---

## 📡 API Endpoints

### Public (No Authentication)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/public/forms/:id` | Get form schema |
| POST | `/api/public/forms/:id/submit` | Submit form response |
| GET | `/api/public/autocomplete/pincode?q=` | Pincode search |
| GET | `/api/public/autocomplete/college?q=` | College search |
| GET | `/api/public/autocomplete/university?q=` | University search |

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register (first user = admin) |
| POST | `/api/auth/login` | Login → returns JWT |
| GET | `/api/auth/me` | Current user info |

### Forms (Admin Only)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/forms` | List all forms |
| POST | `/api/forms` | Create form |
| PUT | `/api/forms/:id` | Rename form |
| DELETE | `/api/forms/:id` | Delete form |
| POST | `/api/forms/:id/duplicate` | Duplicate form |
| POST | `/api/forms/:id/lock` | Lock form |
| PUT | `/api/forms/:fid/versions/:vid/fields` | Update fields |
| GET | `/api/forms/:fid/versions/:vid/submissions` | List submissions |
| GET | `/api/forms/:id/export` | Export as Excel |

### Universities (Admin Only)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/universities?q=&page=` | List/search |
| POST | `/api/universities` | Add university |
| DELETE | `/api/universities/:id` | Delete university |

---

## 📄 Field Types

| Type | Description | Special Behavior |
|------|-------------|-----------------|
| `text` | Single-line text input | — |
| `textarea` | Multi-line text area | — |
| `dropdown` | Select from options | Configurable options list |
| `pincode` | Pincode lookup | Auto-fills district & state |
| `college_autocomplete` | College search | Fuzzy search with suggestions |
| `university_autocomplete` | University search | Auto-fills State & District fields |

---

## 📚 Additional Documentation

| Guide | Description |
|-------|-------------|
| [INSTALLATION_OFFLINE.md](INSTALLATION_OFFLINE.md) | Step-by-step offline PC setup |
| [GUIDE_1_OFFLINE_DEPLOYMENT.md](GUIDE_1_OFFLINE_DEPLOYMENT.md) | Full deployment guide with dependency list |
| [GUIDE_2_ARCHITECTURE_FLOW.md](GUIDE_2_ARCHITECTURE_FLOW.md) | Architecture diagrams & data flow |
| [GUIDE_3_DETAILED_DOCUMENTATION.md](GUIDE_3_DETAILED_DOCUMENTATION.md) | File-by-file code documentation |

---

## 📜 License

This project is private and intended for internal use.
