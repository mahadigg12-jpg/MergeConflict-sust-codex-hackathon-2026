# QueueStorm Investigator — Health Check Service

Minimal Express service exposing `GET /health` for the SUST CSE Carnival 2026
Codex Community Hackathon preliminary round. This repo currently covers only
the health check; `POST /analyze-ticket` will be added separately.

## Tech stack

- Node.js
- Express 4
- swagger-ui-express (interactive API docs)
- cors (all origins accepted)

## Setup

```bash
npm install
```

## Run

```bash
npm start
```

By default the service listens on port 3000. Set `PORT` in your environment
(see `.env.example`) to use a different port.

## API docs

Interactive Swagger UI is served at:

```
http://localhost:3000/api-docs
```

## CORS

CORS is enabled for all origins (`cors()` with no options), so the endpoint
can be called directly from any browser-based judge harness or testing tool
without preflight issues.

## Verify

```bash
curl http://localhost:3000/health
# {"status":"ok"}
```

## Notes / limitations

- `POST /analyze-ticket` is not implemented yet in this repo.
- No external services, secrets, or API keys are used by this service.
