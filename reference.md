 client\src\pages\FormSubmitPage.jsx: const cgpa_converter  inside render field

  
   1. Check Browser Console (CRITICAL):
      On the computer where login is failing, press F12 and look at the Console tab.
       * If you see ERR_CONNECTION_REFUSED to http://localhost:5000/..., the build failed to update or you have a hidden .env file in the client/ folder override.
       * If you see 500 Internal Server Error, the issue is your Database connection on the server.

   2. Verify DB Configuration:
      Ensure your .env in the root folder uses DB_HOST=localhost (if Postgres is on the same machine) and the correct password. If the server cannot talk to the database, login will fail even with the right
  credentials.

If rebuilding the frontend doesn't work, we need to move from "restarting" to "Active Diagnostics." Here is the industry-level troubleshooting roadmap to find the exact bottleneck:

  1. The "Health Check" Test
  On the computer where login is failing, open a new tab and go to:
  http://<YOUR_HOST_IP>:5000/api/health

   * If it shows {"status":"ok"}: Your network and server are fine. The issue is definitely the Frontend-to-Backend URL mapping.
   * If it shows "Timed Out" or "Refused": Your computer's Firewall is blocking port 5000. You need to "Allow an app through Windows Firewall" for Node.js.

  2. The "Database Bridge" Issue
  Sometimes the server starts, but it cannot talk to PostgreSQL.
   * The Symptom: You hit "Login," the spinner spins forever, or returns a 500 Internal Server Error.
   * The Check: Look at the terminal where your server is running. If you see Connection Refused or Password authentication failed for user postgres, your backend is alive but "blind" to the data.
   * Fix: Ensure your .env has DB_HOST=127.0.0.1 (if DB is on the same machine) and that the Postgres service is actually running.

  3. The "CORS" Security Block
  Browsers have a security feature called CORS. If your frontend thinks it's at localhost:5173 but the backend is at 192.168.x.x:5000, the browser might block the login for safety.
   * Diagnostic: Open F12 Console. Look for a red error saying: "Blocked by CORS policy: No 'Access-Control-Allow-Origin' header."
   * Fix: I will double-check the server/index.js file to ensure cors() is configured to allow all LAN connections.

  4. Direct Database Check (The "Forgotten Admin" Case)
  Are you sure the user exists in the database?
   * Diagnostic: Run this command in your project root:

   1     node -e "const p=require('./server/db/pool'); p.query('SELECT username, role FROM users').then(r=>console.log(r.rows))"
      This will print every registered user. If the list is empty, you need to register a new account first.

  5. Final "Hardcoded" Killswitch
  If all else fails, we can force the API URL into the code without using environment variables. I can write a script to surgically replace every instance of import.meta.env.VITE_API_URL with the literal
  string of your IP.

  ---

  My recommendation:
  Try the Health Check (Step 1) right now.
  Does http://<YOUR_HOST_IP>:5000/api/health load a JSON response?




   1. The API URL (Most Likely)
  Check your client/src/api/client.js. If it looks like this:

   1 baseURL: 'http://localhost:5000/api'
  It will fail. When you click "Login" on the other PC, the browser tries to
  find the backend on itself (localhost), not on your server PC.

  The Fix:
  You should use relative paths so the browser automatically uses the IP
  address in the URL bar:
   1 // client/src/api/client.js
   2 const api = axios.create({
   3   baseURL: '/api', // This tells the browser: "Use the same IP/Domain
     I'm currently on"
   4 });

  2. Windows Firewall
  Even if you can "see" the login page (Port 5173 or 5000), Windows often
  blocks the specific request that sends the login data.
   * The Fix: On the Host PC, go to Windows Defender Firewall -> Advanced
     Settings -> Inbound Rules.
   * Create a New Rule for Port 5000 (and 5173 if using dev mode) and set it
     to Allow the connection.

  3. Backend Binding
  The Node.js server must be listening on 0.0.0.0 (all interfaces), not just
  127.0.0.1.
   * Check server/index.js. It should look like this:
   1     app.listen(PORT, '0.0.0.0', () => { ... });
      (We already checked this in a previous turn, and it is correctly set
  to 0.0.0.0).

  4. How to Debug it right now
  On the other PC (the one that can't log in):
   1. Open the login page.
   2. Press F12 to open Developer Tools.
   3. Go to the Network tab.
   4. Try to login.
   5. Look for a red line (usually POST /login). Click it and look at the
      Remote Address or Console error.
       * If it says Connection Refused to localhost:5000, it's definitely
         the API URL issue.
       * If it says Timeout, it's the Firewall.



-------------------------------------XXXXXX_--------------------------------------------


Here are the most likely reasons and solutions for this happening on a LAN setup:

  1. Database Mismatch (The most likely cause)
  When you move from localhost to a LAN setup, you might be connecting to a different database instance than you think.
   - The Issue: Your .env file points to DB_HOST=localhost. If you are running the database on the same machine, this is
     fine. However, if you registered your user while testing on one "environment" (e.g., inside a Docker container or a
     different DB install) and are now trying to log in via another, the users table might be empty.
   - The Check: Check if any users actually exist in your database. You can run this command in your project root to see
     the registered users:

   1   node -e "const pool = require('./server/db/pool'); pool.query('SELECT username, role FROM users').then(r =>
     console.log(r.rows)).catch(console.error)"
   - Solution: If the table is empty, you need to Register a new user first while accessing the site via the LAN IP. The
     first user you register will automatically become the admin.

  2. Vite Proxy Issues
  In client/vite.config.js, you have a proxy configured:
   1 proxy: {
   2   '/api': {
   3     target: 'http://localhost:5000',
   4     changeOrigin: true,
   5   },
   6 },
   - The Issue: When you access http://<LAN_IP>:5173, your browser sends login requests to
     http://<LAN_IP>:5173/api/auth/login. Vite then proxies this to http://localhost:5000.
   - The Catch: If your backend is not actually running on the same physical machine as the Vite dev server, or if the
     backend isn't listening on 0.0.0.0, the proxy might fail. (However, since you get "Invalid Credentials" instead of
     a 404/500, the proxy is likely working).

  3. Environment Variable Overrides
  Your server code loads .env.example first, then .env:
   1 require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.example') });
   2 require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), override: true });
   - The Issue: If your .env file isn't correctly formatted or is missing in the directory where you are starting the
     server, it might be falling back to defaults in .env.example, which likely uses different database credentials or a
     different JWT_SECRET.
   - Solution: Ensure the .env file in your project root contains the correct DB_PASSWORD and DB_NAME.

  4. BCrypt Hashing on different OS
   - The Issue: If you copied the database folder (data files) from a different Operating System (e.g., Linux to
     Windows), sometimes the bcrypt hashes can behave unexpectedly due to library versions, though this is rare with
     bcryptjs.
   - Solution: Try registering a fresh user via the LAN interface (/register page) and then log in with that user.

  Recommended Steps:
   1. Try Registering: Go to http://<LAN_IP>:5173/register and try creating a new user. If it says "Username already
      taken," then the user exists. If it succeeds, try logging in.
   2. Check Database: Run the Node command I provided above to verify that the users table contains the expected data.
   3. Check Logs: Watch the terminal where your server is running. You should see a log like POST /api/auth/login 401.
      If you don't see any logs when you click login, your frontend isn't hitting the backend correctly.



<img width="1919" height="1023" alt="image" src="https://github.com/user-attachments/assets/6d3c7ef1-02fd-4555-bb7e-ab76a1558558" />

<img width="1919" height="1020" alt="image" src="https://github.com/user-attachments/assets/b809dd7f-b25b-43b5-981a-911383f6ad5d" />
<img width="1919" height="1020" alt="image" src="https://github.com/user-attachments/assets/ac949a66-3335-4f0a-b045-859319759a15" />
Formula: (Obtained / Scale) * (Factor * Scale)



<img width="1918" height="972" alt="image" src="https://github.com/user-attachments/assets/993d1e26-db04-444a-a998-10e2124f111d" />
                        const result = (obtained / scale) * (factor);


      



































