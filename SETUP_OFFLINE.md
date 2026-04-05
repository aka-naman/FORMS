# 🛠️ Offline Setup Guide: Multi-User Form Builder

This guide provides step-by-step instructions to set up and run the Form Builder project on a new PC with **Node.js** and **PostgreSQL** already installed.

---

## 📂 1. Project Structure
Ensure your project folder is organized as follows:
```text
22-2-forms/
├── client/             # React Frontend (Vite)
├── server/             # Node.js Backend (Express)
├── .env                # Environment Variables (Root)
└── README.md
```

---

## 🗄️ 2. PostgreSQL Database Setup

1.  Open **pgAdmin 4** or **psql** terminal.
2.  Create a new database named `form_builder_db`:
    ```sql
    CREATE DATABASE form_builder_db;
    ```
3.  (Optional) Create a dedicated user:
    ```sql
    CREATE USER form_admin WITH PASSWORD 'your_secure_password';
    GRANT ALL PRIVILEGES ON DATABASE form_builder_db TO form_admin;
    ```

---

## ⚙️ 3. Environment Configuration

Create a file named `.env` in the **root directory** and copy the following (update with your database credentials):

```env
# Database Configuration
PGUSER=postgres
PGHOST=localhost
PGDATABASE=form_builder_db
PGPASSWORD=your_postgres_password
PGPORT=5432

# Authentication
JWT_SECRET=industry_level_secret_key_2026

# Server Port
PORT=5000
```

---

## 📦 4. Install Dependencies

Open a terminal in the root project folder and run:

### Server Dependencies
```bash
cd server
npm install
```

### Client Dependencies
```bash
cd ../client
npm install
```

---

## 🚀 5. Database Migrations (Critical)

To enable all "Industry-Level" features, you must run the migration scripts in the following order. Open a terminal in the `server` directory:

1.  **Base Schema**: `node db/migrate.js`
2.  **User Isolation**: `node db/add-user-isolation.js`
3.  **Industry Scaling (Audit/Soft Delete)**: `node db/industry-upgrade.js`
4.  **Notifications System**: `node db/add-notifications.js`
5.  **Collaboration Features**: `node db/migrate-collateral.js`
6.  **Organizational Groups (New Type)**: `node db/add-group-type.js`

---

## 🌱 6. Seed Initial Data

To populate the University list and Group types, run:
```bash
node db/seed.js
```

---

## 🏃 7. Running the Project

### Option A: Development Mode (Standard)
Run both commands in separate terminal windows:

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
    Access at: `http://localhost:5173`

### Option B: Production / LAN Mode (Recommended for Offline Use)
This allows other PCs on the same network to access the forms.

1.  **Build the Frontend**:
    ```bash
    cd client
    npm run build
    ```
2.  **Start the Server**:
    ```bash
    cd ../server
    npm start
    ```
3.  **Find your Local IP**:
    *   The server terminal will display: `Network: http://192.168.x.x:5000`
4.  **Firewall Setup**:
    *   Ensure Windows Firewall allows connections on Port `5000`.

---

## 👑 8. First User Registration
The **first user** to register on the application is automatically granted the **Admin** role. 
1.  Go to the Register page.
2.  Create your account.
3.  You will now have access to the **Admin Dashboard** tab at the top.

---

## 📝 9. Troubleshooting
*   **Database Connection Refused**: Check if PostgreSQL service is running and credentials in `.env` match.
*   **Export Fails**: Ensure the server has permission to write to its directory (though Excel is streamed directly).
*   **Vite Errors**: Clear `node_modules` and run `npm install` again.
