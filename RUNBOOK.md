# Runbook

Step by step instructions to bring this service up from a clean checkout.

1. **Prerequisites**
   - Node.js 18 or newer installed (`node -v` to check).
   - npm (ships with Node).

2. **Clone the repo**
   ```bash
   git clone <your-repo-url>
   cd <your-repo-folder>
   ```

3. **Install dependencies**
   ```bash
   npm install
   ```

4. **(Optional) Configure environment**
   ```bash
   cp .env.example .env
   # edit .env if you want a port other than 3000
   ```

5. **Start the service**
   ```bash
   npm start
   ```
   You should see: `Service listening on port 3000`

6. **Confirm it's healthy**
   ```bash
   curl http://localhost:3000/health
   ```
   Expected response:
   ```json
   {"status":"ok"}
   ```

That's it — no database, no external API keys, no build step required.
