# Required Deliverables Checklist (Problem Statement, Section 11)

| Deliverable | Required? | Status | Where |
|---|---|---|---|
| GitHub repository | Yes | Done — push this repo; make public or add organizer GitHub handle `bipulhf` as collaborator | [repo URL] |
| Endpoint URL, Docker image, or runbook | Yes | Done | `RUNBOOK.md`, `Dockerfile` |
| README.md | Yes | Complete | `README.md` |
| Dependency file | Yes | Done | `package.json` |
| Sample output file | Yes | Generated from live call | `sample-output.json` |
| MODELS section in README | Yes | Complete | `README.md` → MODELS section |
| .env.example | Recommended | Done | `.env.example` |
| Architecture Walkthrough Video (≤90s) | Recommended | Not started | See script placeholder below |

## Video script placeholder

[PLACEHOLDER: Write a script for a video of up to 90 seconds covering:
1. Solution architecture — hybrid rule-based + LLM copilot
2. API flow — request in, evidence engine runs, LLM generates text, safety filter checks, response out
3. Evidence reasoning — multi-signal transaction matching with scoring
4. Safety guardrails — regex post-filter blocks PIN/OTP requests and refund promises
5. Deployment setup — Node.js + Express, OpenRouter for LLM, Docker fallback
6. Known limitations — keyword matching, Bangla coverage, LLM dependency]

Submit the video as a viewable link through the submission form once recorded.
