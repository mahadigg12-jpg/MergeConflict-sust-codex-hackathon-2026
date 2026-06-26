const https = require('https');
const http = require('http');

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'auto';
const TIMEOUT_MS = 20000;

function getApiKey() {
  return process.env.OPENROUTER_API_KEY || '';
}

function getModel() {
  return process.env.MODEL_NAME || DEFAULT_MODEL;
}

function buildRequest(messages, model) {
  const body = JSON.stringify({
    model,
    messages,
    temperature: 0.3,
    max_tokens: 1500,
    response_format: { type: 'json_object' },
  });

  return {
    hostname: 'openrouter.ai',
    path: '/api/v1/chat/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getApiKey()}`,
      'HTTP-Referer': 'https://queuestorm-investigator.local',
      'X-Title': 'QueueStorm Investigator',
      'Content-Length': Buffer.byteLength(body),
    },
    timeout: TIMEOUT_MS,
  };
}

function callLLM(messages) {
  const apiKey = getApiKey();
  if (!apiKey) {
    return Promise.resolve(null);
  }

  const model = getModel();
  const options = buildRequest(messages, model);
  const body = JSON.stringify({
    model,
    messages,
    temperature: 0.3,
    max_tokens: 1500,
    response_format: { type: 'json_object' },
  });

  return new Promise((resolve) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.choices && parsed.choices[0] && parsed.choices[0].message) {
            const content = parsed.choices[0].message.content;
            try {
              resolve(JSON.parse(content));
            } catch {
              resolve(null);
            }
          } else {
            resolve(null);
          }
        } catch {
          resolve(null);
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });

    req.on('error', () => {
      resolve(null);
    });

    req.write(body);
    req.end();
  });
}

module.exports = { callLLM };
