# Required Deliverables Checklist (Problem Statement, Section 11)

| Deliverable | Required? | Status | Where |
|---|---|---|---|
| GitHub repository | Yes | [PLACEHOLDER: TODO — push this repo; make public or add organizer GitHub handle `bipulhf` as collaborator] | [PLACEHOLDER: repo URL] |
| Endpoint URL, Docker image, or runbook | Yes | Runbook done. Live URL / Docker pending. | `RUNBOOK.md` done. Live URL: [PLACEHOLDER]. Docker: [PLACEHOLDER `docker pull ...` command] |
| README.md | Yes | Drafted with placeholders — ready for AI rewrite | `README.md` |
| Dependency file | Yes | Done | `package.json` |
| Sample output file | Yes | Dummy placeholder — replace once `/analyze-ticket` exists | `samples/sample-output.json` |
| MODELS section in README | Yes | Placeholder table — fill in once a model is chosen | `README.md` → MODELS section |
| .env.example | Recommended | Done | `.env.example` |
| Architecture Walkthrough Video (≤90s) | Recommended | Not started | See script placeholder below |

## Video script placeholder

[PLACEHOLDER: Write a script for a video of up to 90 seconds covering, in order:
1. Solution architecture (one sentence)
2. API flow — request in, response out
3. Evidence reasoning — how relevant_transaction_id / evidence_verdict are decided
4. Safety guardrails — what's blocked and why
5. Deployment setup — where it's hosted
6. Known limitations]

Submit the video as a viewable link through the submission form once recorded.

## Still missing for full submission (beyond this health-check repo)

- [PLACEHOLDER: `POST /analyze-ticket` implementation]
- [PLACEHOLDER: Evidence reasoning logic]
- [PLACEHOLDER: Safety guardrail enforcement on `customer_reply` / `recommended_next_action`]
- [PLACEHOLDER: Real sample output generated from a live call]
