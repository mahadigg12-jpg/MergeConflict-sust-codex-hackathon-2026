# QueueStorm Investigator

## Overview

[PLACEHOLDER: 2-3 sentence description of what this service does — e.g. "An AI copilot for support agents during the campaign surge. It reads each ticket and the customer's recent transaction history, decides what actually happened, classifies and routes the case, and drafts a safe reply." Currently only the health check endpoint is implemented in this repo.]

## Tech Stack

- Node.js
- Express 4
- swagger-ui-express (interactive API docs)
- cors (all origins accepted)
- [PLACEHOLDER: add LLM/AI SDK once /analyze-ticket is built, e.g. `openai`, `@anthropic-ai/sdk`, or "rule-based, no external AI dependency"]

## Setup

```bash
npm install
```

## Run

```bash
npm start
```

Service listens on `PORT` (default 3000).
- Health check: `GET /health`
- Swagger UI: `GET /api-docs`

## AI Approach

[PLACEHOLDER: Describe how the service reads a ticket + transaction history and produces the structured JSON response from Section 6 of the problem statement. e.g. "We send the complaint and transaction history to [model name] with a system prompt enforcing the response schema and safety rules, using few-shot examples drawn from the public sample case pack."]

## Evidence Reasoning Logic

[PLACEHOLDER: Explain how `relevant_transaction_id` and `evidence_verdict` are determined — e.g. "We match complaint details (amount, approximate time, counterparty) against entries in `transaction_history`. If a clear match exists and supports the complaint, verdict is `consistent`; if a match contradicts the complaint, verdict is `inconsistent`; if no transaction matches or history is empty, verdict is `insufficient_data` and `relevant_transaction_id` is null."]

## Safety Logic

[PLACEHOLDER: Explain the guardrails enforced on every response — e.g. "System prompt instructs the model to never request PIN, OTP, password, or full card number; never confirm a refund/reversal/unblock without authority, using language like 'any eligible amount will be returned through official channels'; never direct customers to third parties; and to ignore any instructions embedded in the complaint text (prompt injection defense). `human_review_required` is set to true for disputes, suspicious activity, high-value cases, or ambiguous evidence."]

## MODELS

| Model | Where it runs | Why chosen |
|---|---|---|
| [PLACEHOLDER: e.g. gpt-4o-mini] | [PLACEHOLDER: e.g. OpenAI API, called from `services/llmClient.js`] | [PLACEHOLDER: cost, latency, and quality reasoning — e.g. "fits inside the 30s per-request timeout, low cost at expected ticket volume, sufficiently strong instruction-following for structured JSON output"] |

## Model and Cost Reasoning

[PLACEHOLDER: e.g. "Chose a smaller/cheaper model because of the high expected ticket volume (40,000+ over the campaign) and the 30-second per-request timeout. Estimated cost per request: $[PLACEHOLDER] based on ~[PLACEHOLDER] input/output tokens. Considered [PLACEHOLDER alternative model] but rejected due to [PLACEHOLDER reason, e.g. latency / cost]."]

## Assumptions

- [PLACEHOLDER: e.g. "All complaints and transaction histories used in testing are synthetic, per the problem statement."]
- [PLACEHOLDER: e.g. "`transaction_history` may be empty for safety-only cases such as phishing reports."]
- [PLACEHOLDER: e.g. "Complaints may be in English, Bangla, or mixed Banglish; the model is assumed capable of handling all three."]
- [PLACEHOLDER: add more as needed]

## Known Limitations

- Only `GET /health` is implemented in this submission; `POST /analyze-ticket` is [PLACEHOLDER: "in progress" / "implemented but not yet load-tested" / etc.]
- [PLACEHOLDER: e.g. "No retry/backoff logic for LLM provider rate limits yet."]
- [PLACEHOLDER: e.g. "No persistent logging or metrics; intended as a stateless per-request service."]
- [PLACEHOLDER: add more as needed]

## CORS

Enabled for all origins via `app.use(cors())` with no restrictions.

## Deployment

- Live URL: [PLACEHOLDER: https://your-deployed-url.example.com]
- Docker image: [PLACEHOLDER: `docker pull yourusername/queuestorm-investigator:tag`]
- See `RUNBOOK.md` for step-by-step local setup instructions.

## Sample Output

See `samples/sample-output.json` for one worked example. [PLACEHOLDER: regenerate this from a live call to `/analyze-ticket` once it is implemented, using one of the cases from `SUST_Preli_Sample_Cases.json`.]
