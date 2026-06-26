require('dotenv').config();
const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const { validateRequest } = require('./lib/validator');
const { analyzeEvidence } = require('./lib/evidence-engine');
const { callLLM } = require('./lib/llm-client');
const { buildMessages, buildTemplateResponse } = require('./lib/prompt-builder');
const { filterResponse, containsPromptInjection } = require('./lib/safety-filter');

const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));

const swaggerSpec = {
  openapi: '3.0.0',
  info: {
    title: 'QueueStorm Investigator API',
    version: '1.0.0',
    description:
      'AI copilot for support agents during campaign surges. Reads each ticket and transaction history, decides what happened, classifies and routes the case, and drafts a safe reply.'
  },
  paths: {
    '/health': {
      get: {
        summary: 'Health check',
        description:
          'Returns service status. The judge harness calls this to confirm readiness before sending test cases.',
        responses: {
          200: {
            description: 'Service is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/analyze-ticket': {
      post: {
        summary: 'Analyze a support ticket',
        description:
          'Accepts a customer complaint and transaction history, returns a structured JSON response with classification, routing, and safe reply.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['ticket_id', 'complaint'],
                properties: {
                  ticket_id: { type: 'string' },
                  complaint: { type: 'string' },
                  language: { type: 'string', enum: ['en', 'bn', 'mixed'] },
                  channel: { type: 'string' },
                  user_type: { type: 'string' },
                  campaign_context: { type: 'string' },
                  transaction_history: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        transaction_id: { type: 'string' },
                        timestamp: { type: 'string' },
                        type: { type: 'string' },
                        amount: { type: 'number' },
                        counterparty: { type: 'string' },
                        status: { type: 'string' }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Successful analysis' },
          400: { description: 'Malformed input' },
          422: { description: 'Semantically invalid input' },
          500: { description: 'Internal error' }
        }
      }
    }
  }
};

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.post('/analyze-ticket', async (req, res) => {
  try {
    const validation = validateRequest(req.body);
    if (!validation.valid) {
      return res.status(validation.status).json({ error: validation.error });
    }

    const ticket = req.body;

    if (containsPromptInjection(ticket.complaint)) {
      const safeResponse = buildTemplateResponse(ticket, {
        relevant_transaction_id: null,
        evidence_verdict: 'insufficient_data',
        case_type: 'phishing_or_social_engineering',
        severity: 'critical',
        department: 'fraud_risk',
        human_review_required: true,
        confidence: 0.1,
        reason_codes: ['prompt_injection_detected', 'phishing_or_social_engineering'],
      });
      const safetyResult = filterResponse(safeResponse);
      return res.status(200).json(safetyResult.filtered);
    }

    const evidenceResult = analyzeEvidence(ticket);

    const messages = buildMessages(ticket, evidenceResult);
    const llmResult = await callLLM(messages);

    let response;
    if (llmResult && llmResult.ticket_id) {
      response = {
        ticket_id: ticket.ticket_id,
        relevant_transaction_id: evidenceResult.relevant_transaction_id,
        evidence_verdict: evidenceResult.evidence_verdict,
        case_type: evidenceResult.case_type,
        severity: evidenceResult.severity,
        department: evidenceResult.department,
        agent_summary: llmResult.agent_summary || '',
        recommended_next_action: llmResult.recommended_next_action || '',
        customer_reply: llmResult.customer_reply || '',
        human_review_required: evidenceResult.human_review_required,
        confidence: evidenceResult.confidence,
        reason_codes: evidenceResult.reason_codes,
      };
    } else {
      response = buildTemplateResponse(ticket, evidenceResult);
    }

    const safetyResult = filterResponse(response);

    if (safetyResult.violations.length > 0) {
      console.log(`[SAFETY] Violations on ticket ${ticket.ticket_id}:`,
        safetyResult.violations.map((v) => `${v.field}:${v.type}`).join(', '));
    }

    return res.status(200).json(safetyResult.filtered);
  } catch (err) {
    console.error('[ERROR] /analyze-ticket:', err.message);
    return res.status(500).json({ error: 'Internal server error. Please try again.' });
  }
});

app.use((err, req, res, _next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON in request body.' });
  }
  console.error('[ERROR] Unhandled:', err.message);
  return res.status(500).json({ error: 'Internal server error.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`QueueStorm Investigator listening on port ${PORT}`);
  console.log(`Health: http://localhost:${PORT}/health`);
  console.log(`Analyze: http://localhost:${PORT}/analyze-ticket`);
  console.log(`Swagger UI: http://localhost:${PORT}/api-docs`);
});
