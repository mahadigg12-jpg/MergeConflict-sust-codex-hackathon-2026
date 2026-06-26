const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');

const app = express();

// CORS — accept requests from any origin
app.use(cors());

app.use(express.json());

const swaggerSpec = {
  openapi: '3.0.0',
  info: {
    title: 'QueueStorm Investigator API',
    version: '1.0.0',
    description:
      'Health check service for the SUST CSE Carnival 2026 Codex Community Hackathon preliminary round.'
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
    }
  }
};

// Swagger UI at /api-docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// GET /health — judge harness pings this to confirm the service is up
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Service listening on port ${PORT}`);
  console.log(`Swagger UI available at http://localhost:${PORT}/api-docs`);
});
