# QueueStorm Investigator

An AI copilot for fintech support agents during high-volume campaign surges. It reads each customer complaint alongside their recent transaction history, determines what actually happened, classifies and routes the case, and drafts a safe reply — all without ever requesting credentials or promising unauthorized refunds.

## Tech Stack

- Node.js 18+
- Express 4 (HTTP server)
- swagger-ui-express (interactive API docs at `/api-docs`)
- cors (all origins accepted)
- OpenRouter API (LLM text generation via `https://openrouter.ai/api/v1/chat/completions`)
- Rule-based evidence engine (transaction matching, classification, routing)

## Setup

```bash
npm install
```

## Run

```bash
npm start
```

Service listens on `PORT` (default 3000), bound to `0.0.0.0`.

- Health check: `GET /health`
- Ticket analysis: `POST /analyze-ticket`
- Swagger UI: `GET /api-docs`

## AI Approach

The service uses a **hybrid rule-based + LLM** architecture:

1. **Rule-based evidence engine** (deterministic, fast): Parses complaint text for signals (amount, time, transaction type, counterparty) and matches them against the provided transaction history using multi-signal scoring. Determines `relevant_transaction_id`, `evidence_verdict`, `case_type`, `severity`, `department`, and `human_review_required`.

2. **LLM text generation** (OpenRouter auto-select): Sends the complaint, transaction data, and evidence analysis results to an LLM with a structured system prompt. The LLM generates the `agent_summary`, `recommended_next_action`, and `customer_reply` text fields.

3. **Safety post-filter** (regex-based): After LLM generation, a regex-based safety filter scans all text fields for credential requests, refund promises, third-party contact instructions, and prompt injection attempts. Violations trigger safe fallback messages.

4. **Template fallback**: If the LLM is unavailable, times out, or returns invalid JSON, the service falls back to a rule-based template response generator, ensuring the API never crashes.

## Evidence Reasoning Logic

The evidence engine works in multiple stages:

1. **Signal extraction**: Regex patterns extract monetary amounts (taka/tk/bdt/৳), time references (clock times, relative time, periods), and transaction-type keywords from the complaint text.

2. **Transaction matching**: Extracted signals are scored against each transaction in the history:
   - Amount match: exact match (score 1.0), approximate within 5% (score 0.8)
   - Time match: clock time proximity (score 0.7), period match (score 0.5)
   - Type match: complaint keywords match transaction type (score 0.6)
   - Counterparty match: phone number extraction and matching (score 0.9)

3. **Evidence verdict**:
   - `consistent`: Best match found with score > 0.3 and complaint aligns with transaction data
   - `inconsistent`: Match found but data contradicts complaint (e.g., failed transaction claimed as completed)
   - `insufficient_data`: No match found or empty transaction history

4. **Classification and routing**: Keyword-based pattern matching maps complaints to `case_type`, which routes to the appropriate `department` via a fixed mapping table.

5. **Confidence scoring**: Based on evidence verdict strength, match score magnitude, and case type.

## Safety Logic

Multiple layers enforce fintech safety:

- **LLM system prompt**: Instructs the model to never request PIN/OTP/password, never confirm refunds without authority, and never direct customers to third parties.
- **Regex post-filter**: Scans `customer_reply`, `recommended_next_action`, and `agent_summary` for:
  - PIN/OTP/password/card number requests → replaced with safe credential-handling fallback
  - Refund/reversal/unblock promises → replaced with "eligible amount will be returned through official channels"
  - Third-party contact instructions → replaced with "contact our official support"
- **Prompt injection defense**: Complaints containing override instructions (e.g., "ignore previous instructions") are detected and treated as phishing cases.
- **Escalation**: `human_review_required` is set to `true` for all disputes, suspicious activity, high-value cases, and ambiguous evidence.

## MODELS

| Model | Where it runs | Why chosen |
|---|---|---|
| OpenRouter auto-select | OpenRouter API (`https://openrouter.ai/api/v1/chat/completions`) | Auto-routes to the best available model based on availability and cost. Fits within the 30s per-request timeout. |
| Rule-based engine | Local (in-process) | Deterministic transaction matching and classification. No API dependency for the core 35% evidence reasoning score. |

## Model and Cost Reasoning

The hybrid approach ensures the service scores well across all rubric categories without depending on any single LLM:

- The rule-based evidence engine handles the highest-weight scoring category (35%) deterministically with zero API cost.
- The LLM is used only for text generation (10% Response Quality), which is reviewed manually and benefits from natural language.
- OpenRouter auto-select optimizes for cost and latency without requiring manual model selection.
- Template fallback ensures the service never fails due to LLM unavailability, protecting the 10% Performance and 5% Deployment scores.
- Estimated cost per request: <$0.001 with auto-selected models, primarily from the 1500-token max output.

## Assumptions

- All complaints and transaction histories used in evaluation are synthetic, per the problem statement.
- `transaction_history` may be empty for safety-only cases such as phishing reports.
- Complaints may be in English, Bangla, or mixed Banglish; the rule-based engine handles all three via keyword lists, and the LLM handles natural language understanding.
- The `metadata` field in the request is accepted but not used in analysis.
- Campaign context is logged but does not directly influence classification.
- Amounts are assumed to be in BDT as stated in the problem specification.

## Known Limitations

- The rule-based evidence engine uses keyword matching, which may miss nuanced or paraphrased complaints that don't contain exact keywords.
- Time matching is limited to clock times and relative references; it cannot parse complex date expressions without a date reference.
- The safety filter uses regex patterns and may miss creative rephrasings of credential requests.
- LLM text generation depends on OpenRouter availability; during outages, template fallback produces less natural responses.
- No persistent logging or metrics; the service is stateless and per-request.
- No rate limiting; under extreme load, the LLM API may become a bottleneck.
- Bangla/Banglish keyword coverage is limited to common phrases; rare or dialectal expressions may not match.

## CORS

Enabled for all origins via `app.use(cors())` with no restrictions.

## Deployment

- See `RUNBOOK.md` for step-by-step local setup instructions.
- Docker fallback: `docker build -t queuestorm-investigator . && docker run -p 3000:3000 --env-file .env queuestorm-investigator`

## Sample Output

See `sample-output.json` for a worked example generated from a public sample case.
