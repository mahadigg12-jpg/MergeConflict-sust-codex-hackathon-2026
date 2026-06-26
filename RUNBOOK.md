# Runbook

Step by step instructions to bring this service up from a clean checkout.

1. **Prerequisites**
   - Node.js 18 or newer installed (`node -v` to check).
   - npm (ships with Node).

2. **Clone the repo**
   ```bash
   git clone https://github.com/mahadigg12-jpg/MergeConflict-sust-codex-hackathon-2026.git
   cd MergeConflict-sust-codex-hackathon-2026
   ```

3. **Install dependencies**
   ```bash
   npm install
   ```

4. **Configure environment**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and set:
   - `PORT` (default 3000)
   - `OPENROUTER_API_KEY` (your OpenRouter API key)
   - `MODEL_NAME` (default `auto` — OpenRouter auto-selects the best model)

   Without `OPENROUTER_API_KEY`, the service still works using rule-based template responses for text fields.

5. **Start the service**
   ```bash
   npm start
   ```
   You should see:
   ```
   QueueStorm Investigator listening on port 3000
   Health: http://localhost:3000/health
   Analyze: http://localhost:3000/analyze-ticket
   Swagger UI: http://localhost:3000/api-docs
   ```

6. **Confirm it's healthy**
   ```bash
   curl http://localhost:3000/health
   ```
   Expected response:
   ```json
   {"status":"ok"}
   ```

7. **Test the analysis endpoint**
   ```bash
   curl -X POST http://localhost:3000/analyze-ticket \
     -H "Content-Type: application/json" \
     -d '{
       "ticket_id": "TKT-TEST-001",
       "complaint": "I sent 5000 taka to a wrong number around 2pm today",
       "transaction_history": [
         {
           "transaction_id": "TXN-9101",
           "timestamp": "2026-04-14T14:08:22Z",
           "type": "transfer",
           "amount": 5000,
           "counterparty": "+8801719876543",
           "status": "completed"
         }
       ]
     }'
   ```
   Expected: A JSON response, refer to sample-output.json

8. **Docker (alternative)**
   ```bash
   docker build -t queuestorm-investigator .
   docker run -p 3000:3000 --env-file .env queuestorm-investigator
   ```
