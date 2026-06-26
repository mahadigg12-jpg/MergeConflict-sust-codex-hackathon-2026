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

function singleLLMCall(messages) {
  const apiKey = getApiKey();
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
      console.log(`[LLM-DEBUG] Response status: ${res.statusCode}`);
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        console.log(`[LLM-DEBUG] Raw response (first 500 chars): ${data.substring(0, 500)}`);
        try {
          const parsed = JSON.parse(data);

          // Check for top-level API error (auth, rate limit, etc.)
          if (parsed.error) {
            console.log(`[LLM-DEBUG] OpenRouter API error: ${JSON.stringify(parsed.error)}`);
            resolve({ _retry: parsed.error.code === 429, _error: true });
            return;
          }

          // Check if the model's finish_reason indicates an error (e.g. mid-stream rate limit)
          if (parsed.choices && parsed.choices[0]) {
            const choice = parsed.choices[0];
            if (choice.finish_reason === 'error' || choice.error) {
              const errCode = choice.error?.code || 0;
              console.log(`[LLM-DEBUG] ❌ Model returned finish_reason=error: ${JSON.stringify(choice.error)}`);
              resolve({ _retry: errCode === 429, _error: true });
              return;
            }

            if (choice.message && choice.message.content) {
              const content = choice.message.content;
              console.log(`[LLM-DEBUG] ✅ Got LLM response content (length: ${content.length})`);
              try {
                const result = JSON.parse(content);
                console.log(`[LLM-DEBUG] ✅ Successfully parsed LLM JSON — ticket_id: ${result.ticket_id}`);
                resolve(result);
              } catch (e) {
                console.log(`[LLM-DEBUG] ❌ Failed to parse LLM content as JSON: ${e.message}`);
                resolve(null);
              }
              return;
            }
          }

          console.log(`[LLM-DEBUG] ❌ No valid choices in response — returning null`);
          resolve(null);
        } catch (e) {
          console.log(`[LLM-DEBUG] ❌ Failed to parse response body: ${e.message}`);
          resolve(null);
        }
      });
    });

    req.on('timeout', () => {
      console.log(`[LLM-DEBUG] ❌ Request timed out after ${TIMEOUT_MS}ms`);
      req.destroy();
      resolve(null);
    });

    req.on('error', (err) => {
      console.log(`[LLM-DEBUG] ❌ Request error: ${err.message}`);
      resolve(null);
    });

    req.write(body);
    req.end();
  });
}

const MAX_RETRIES = 3;

async function callLLM(messages) {
  const apiKey = getApiKey();
  console.log(`[LLM-DEBUG] API key present: ${!!apiKey}, key prefix: ${apiKey ? apiKey.substring(0, 12) + '...' : 'NONE'}`);
  if (!apiKey) {
    console.log('[LLM-DEBUG] No API key found — returning null (will use template fallback)');
    return null;
  }

  const model = getModel();
  console.log(`[LLM-DEBUG] Model: ${model}`);

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    console.log(`[LLM-DEBUG] Attempt ${attempt}/${MAX_RETRIES} — sending request to openrouter.ai...`);
    const result = await singleLLMCall(messages);

    if (result && result._error) {
      if (result._retry && attempt < MAX_RETRIES) {
        const delayMs = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
        console.log(`[LLM-DEBUG] ⏳ Rate limited (429) — retrying in ${delayMs / 1000}s...`);
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }
      console.log(`[LLM-DEBUG] ❌ API error — no more retries, falling back to template`);
      return null;
    }

    return result; // success or null (non-retryable failure)
  }

  return null;
}

module.exports = { callLLM };
