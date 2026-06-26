const https = require('https');
const http = require('http');

/** @type {string} OpenRouter API base URL for chat completions. */
const OPENROUTER_BASE = 'https://openrouter.ai/api/v1/chat/completions';

/** @type {string} Default model identifier (auto-select via OpenRouter). */
const DEFAULT_MODEL = 'auto';

/** @type {number} Request timeout in milliseconds. */
const TIMEOUT_MS = 20000;

/** @type {Set<string>} Cache for blacklisted API keys. */
const badKeys = new Set();

/**
 * Retrieves the list of OpenRouter API keys from environment variables.
 * @returns {string[]} Array of API keys.
 */
function getApiKeys() {
  const keysStr = process.env.OPENROUTER_API_KEYS || process.env.OPENROUTER_API_KEY || '';
  return keysStr.split(',').map((k) => k.trim()).filter((k) => k.length > 0);
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
 * @param {string} apiKey - The API key to use.
 * @param {Array<{role: string, content: string}>} messages - Chat messages array.
 * @param {string} model - The model identifier.
 * @returns {Object} HTTPS request options object.
 */
function buildRequest(apiKey, messages, model) {
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
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://queuestorm-investigator.local',
      'X-Title': 'QueueStorm Investigator',
      'Content-Length': Buffer.byteLength(body),
    },
    timeout: TIMEOUT_MS,
  };
}

/**
 * Makes a single call to the OpenRouter LLM API.
 * @param {string} apiKey - The API key to use.
 * @param {Array<{role: string, content: string}>} messages - Chat messages array.
 * @returns {Promise<Object|null>} Parsed JSON response or failure state.
 */
function singleLLMCall(apiKey, messages) {
  const model = getModel();
  const options = buildRequest(apiKey, messages, model);
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
        const rawPreview = data.length > 200 ? data.substring(0, 200) + '...' : data;
        console.log(`[LLM-DEBUG] Raw response: ${rawPreview}`);
        
        // Handle explicit auth error
        if (res.statusCode === 401 || res.statusCode === 403) {
          resolve({ _authError: true, _error: true });
          return;
        }

        try {
          const parsed = JSON.parse(data);

          // Check for top-level API error (auth, rate limit, etc.)
          if (parsed.error) {
            console.log(`[LLM-DEBUG] OpenRouter API error: ${JSON.stringify(parsed.error)}`);
            resolve({ _retry: parsed.error.code === 429, _authError: parsed.error.code === 401 || parsed.error.code === 403, _error: true });
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
                resolve({ _error: true, _retry: false }); // Bad format, don't retry same key
              }
              return;
            }
          }

          console.log(`[LLM-DEBUG] ❌ No valid choices in response — returning error`);
          resolve({ _error: true, _retry: false });
        } catch (e) {
          console.log(`[LLM-DEBUG] ❌ Failed to parse response body: ${e.message}`);
          resolve({ _error: true, _retry: true }); // Network issue or HTML error page, retry
        }
      });
    });

    req.on('timeout', () => {
      console.log(`[LLM-DEBUG] ❌ Request timed out`);
      req.destroy();
      resolve({ _error: true, _retry: true });
    });

    req.on('error', (err) => {
      console.log(`[LLM-DEBUG] ❌ Request error: ${err.message}`);
      resolve({ _error: true, _retry: true });
    });

    req.write(body);
    req.end();
  });
}

const GLOBAL_TIMEOUT_MS = 14000;
const MAX_RETRIES_PER_KEY = 3;
const SAME_KEY_DELAY_MS = 500;

async function executeWithRotation(messages) {
  const allKeys = getApiKeys();
  if (allKeys.length === 0) {
    console.log('[LLM-DEBUG] No API keys found — returning null (will use template fallback)');
    return null;
  }

  const model = getModel();
  console.log(`[LLM-DEBUG] Model: ${model}`);

  const validKeys = allKeys.filter((k) => !badKeys.has(k));
  if (validKeys.length === 0) {
    console.log('[LLM-DEBUG] All available API keys are blacklisted — returning null (will use template fallback)');
    return null;
  }

  for (let keyIdx = 0; keyIdx < validKeys.length; keyIdx++) {
    const apiKey = validKeys[keyIdx];
    const keyPrefix = apiKey.substring(0, 12) + '...';
    console.log(`[LLM-DEBUG] Using API key: ${keyPrefix} (${keyIdx + 1}/${validKeys.length})`);
    
    let keyFailures = 0;

    for (let attempt = 1; attempt <= MAX_RETRIES_PER_KEY; attempt++) {
      console.log(`[LLM-DEBUG] Attempt ${attempt}/${MAX_RETRIES_PER_KEY} on key ${keyPrefix}`);
      const result = await singleLLMCall(apiKey, messages);

      if (result && result._error) {
        if (result._authError) {
          console.log(`[LLM-DEBUG] ❌ Auth error (401/403) detected. Instantly blacklisting key ${keyPrefix}.`);
          badKeys.add(apiKey);
          break; // Break the attempt loop to instantly rotate to the next key
        }

        keyFailures++;
        if (keyFailures >= MAX_RETRIES_PER_KEY) {
          console.log(`[LLM-DEBUG] ❌ Key ${keyPrefix} failed ${MAX_RETRIES_PER_KEY} times. Blacklisting and rotating.`);
          badKeys.add(apiKey);
          break; // Rotate to next key (0ms delay)
        }

        // Retry on same key
        console.log(`[LLM-DEBUG] ⏳ Error detected. Retrying same key in ${SAME_KEY_DELAY_MS}ms...`);
        await new Promise((r) => setTimeout(r, SAME_KEY_DELAY_MS));
        continue;
      }

      // Success
      return result;
    }
  }

  console.log('[LLM-DEBUG] Exhausted all valid API keys without success.');
  return null;
}

/**
 * Wraps the execution logic with a strict global timeout.
 */
function callLLM(messages) {
  const timeoutPromise = new Promise((resolve) => {
    setTimeout(() => {
      console.log(`[LLM-DEBUG] ⏰ GLOBAL TIMEOUT (${GLOBAL_TIMEOUT_MS}ms) REACHED! Aborting LLM calls.`);
      resolve(null);
    }, GLOBAL_TIMEOUT_MS);
  });

  return Promise.race([
    executeWithRotation(messages),
    timeoutPromise,
  ]);
}

module.exports = { callLLM };
