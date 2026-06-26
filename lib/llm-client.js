const https = require('https');
const http = require('http');

/** @type {string} OpenRouter API base URL for chat completions. */
const OPENROUTER_BASE = 'https://openrouter.ai/api/v1/chat/completions';

/** @type {string} Default model identifier (auto-select via OpenRouter). */
const DEFAULT_MODEL = 'auto';

/** @type {number} Request timeout in milliseconds. */
const TIMEOUT_MS = 20000;

/**
 * Retrieves the OpenRouter API key from environment variables.
 * @returns {string} The API key, or empty string if not set.
 */
function getApiKey() {
  return process.env.OPENROUTER_API_KEY || '';
}

/**
 * Retrieves the model name from environment variables, falling back to the default.
 * @returns {string} The model identifier to use for LLM requests.
 */
function getModel() {
  return process.env.MODEL_NAME || DEFAULT_MODEL;
}

/**
 * Builds the HTTPS request options for the OpenRouter API call.
 * @param {Array<{role: string, content: string}>} messages - Chat messages array.
 * @param {string} model - The model identifier.
 * @returns {Object} HTTPS request options object.
 */
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

/**
 * Calls the OpenRouter LLM API with the given messages and returns the parsed JSON response.
 * Returns null if no API key is set, on timeout, or on parse failure.
 * @param {Array<{role: string, content: string}>} messages - Chat messages array (system + user).
 * @returns {Promise<Object|null>} Parsed JSON response from the LLM, or null on failure.
 */
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
