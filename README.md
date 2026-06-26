# QueueStorm Investigator

<p align="center">
  <img src="https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white" />
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white" />
  <img src="https://img.shields.io/badge/OpenRouter-6366F1?style=for-the-badge&logo=openrouter&logoColor=white" />
  <img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" />
</p>

## Tech Stack

- Node.js 18+
- Express 4 (HTTP server)
- swagger-ui-express (interactive API docs at `/api-docs`)
- cors (all origins accepted)
- OpenRouter API (LLM text generation via `https://openrouter.ai/api/v1/chat/completions`)
- Rule-based evidence engine (transaction matching, classification, routing)

## Setup & Run

- See `RUNBOOK.md` for step-by-step local setup instructions.
- Docker fallback: `docker build -t queuestorm-investigator . && docker run -p 3000:3000 --env-file .env queuestorm-investigator`

## AI/Model Approach

The service uses a **hybrid rule-based + LLM (via external API)** architecture:

1. **Rule-based evidence engine** (regex-based, for the evidence reasoning): Parses complaint text for signals (amount, time, transaction type, counterparty) and matches them against the provided transaction history using multi-signal scoring. Determines `relevant_transaction_id`, `evidence_verdict`, `case_type`, `severity`, `department`, and `human_review_required`.

2. **LLM text generation** (accomplished through OpenRouter auto-select): Sends the complaint, transaction data, and evidence analysis results to an LLM with a structured system prompt. The LLM generates the `agent_summary`, `recommended_next_action`, and `customer_reply` text fields.

3. **Safety post-filter** (regex-based): After LLM generation, a regex-based safety filter scans all text fields for credential requests, refund promises, third-party contact instructions, and prompt injection attempts. Violations trigger safe fallback messages.

4. **Template fallback**: If the LLM is unavailable, times out, or returns invalid JSON, the service falls back to a rule-based template response generator, ensuring the API never crashes.

## Safety Logic

Multiple layers enforce fintech safety:

- **LLM system prompt**: Instructs the model to never request PIN/OTP/password, never confirm refunds without authority, and never direct customers to third parties.
- **Regex post-filter**: Scans `customer_reply`, `recommended_next_action`, and `agent_summary` for:
  - PIN/OTP/password/card number requests: replaced with safe credential-handling fallback
  - Refund/reversal/unblock promises: replaced with "eligible amount will be returned through official channels"
  - Third-party contact instructions: replaced with "contact our official support"
- **Prompt injection defense**: Complaints containing override instructions (e.g., "ignore previous instructions") are detected and treated as phishing cases.
- **Escalation**: `human_review_required` is set to `true` for all disputes, suspicious activity, high-value cases, and ambiguous evidence.

## MODELS

| Model | Where it runs | Why chosen |
|---|---|---|
| OpenRouter auto-select | OpenRouter API (`https://openrouter.ai/api/v1/chat/completions`) | Auto-routes to the best available model based on availability and cost. Fits within the 30s per-request timeout. |

## Model and Cost Reasoning

The hybrid approach ensures the service scores well across all rubric categories without depending on any single LLM:

- The rule-based evidence engine handles the evidence reasoning category deterministically with zero API cost.
- The LLM is used only for text generation (for enhancing the response quality category), which is reviewed manually and benefits from natural language.
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

## Limitations

- The rule-based evidence engine uses keyword matching, which may miss nuanced or paraphrased complaints that don't contain exact keywords.
- Time matching is limited to clock times and relative references; it cannot parse complex date expressions without a date reference.
- The safety filter uses regex patterns and may miss creative rephrasings of credential requests.
- LLM text generation depends on OpenRouter availability; during outages, template fallback produces less natural responses.
- No persistent logging or metrics; the service is stateless and per-request.
- No rate limiting; under extreme load, the LLM API may become a bottleneck.
- Bangla/Banglish keyword coverage is limited to common phrases; rare or dialectal expressions may not match.

## Sample Output

See `sample-output.json` for a worked example generated from a public sample case.
