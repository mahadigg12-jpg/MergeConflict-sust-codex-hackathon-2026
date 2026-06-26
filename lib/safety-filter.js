/** @type {RegExp[]} Patterns detecting requests for credentials (PIN, OTP, password, card number) in output text. */
const CREDENTIAL_REQUEST_PATTERNS = [
  /\b(please\s+)?(share|provide|enter|tell|give|send)\s+.{0,25}\b(pin|otp|password|secret|card\s*number|cvv)/gi,
  /\b(pin|otp|password|secret|card\s*number|cvv)\s+.{0,25}(please\s+)?(share|provide|enter|tell|give|send)/gi,
  /\bverify\s+.{0,15}\b(pin|otp|password|secret)/gi,
  /\b(pin|otp|password)\s*$/gi,
  /\bমোবাইল\s*নম্বর\s*দিন/gi,
  /\bপিন\s*দিন/gi,
  /\bপিন\s*বলুন/gi,
  /\bপাসওয়ার্ড\s*দিন/gi,
];

/** @type {RegExp[]} Patterns detecting unauthorized refund/reversal promises in output text. */
const REFUND_PROMISE_PATTERNS = [
  /\bwill\s+(refund|reverse|return|unblock|recover)\b/gi,
  /\b(refund|reverse|return)\s+(confirmed|approved|processed)\b/gi,
  /\byou\s+will\s+receive\s+.*back\b/gi,
  /\bmoney\s+will\s+be\s+returned\b/gi,
  /\bআমরা\s+রিফান্ড\s+দেব\b/gi,
  /\bপেসো\s+ফেরত\s+পাবেন\b/gi,
];

/** @type {RegExp[]} Patterns detecting instructions to contact suspicious third parties. */
const THIRD_PARTY_CONTACT_PATTERNS = [
  /contact\s+\S+@/gi,
  /contact\s+\S+\.com/gi,
  /contact\s+\S+\.net/gi,
  /contact.*whatsapp/gi,
  /contact.*telegram/gi,
  /এই\s+নম্বরে\s+যোগাযোগ\s+করুন/gi,
];

/** @type {RegExp[]} Patterns detecting prompt injection attempts in complaint text. */
const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+previous/gi,
  /disregard\s+.*instructions/gi,
  /you\s+are\s+now/gi,
  /system\s*prompt/gi,
  /new\s+instructions/gi,
  /forget\s+everything/gi,
  /\[INST\]/gi,
  /<<SYS>>/gi,
];

/** @type {string} Safe fallback text for refund-related responses. */
const SAFE_REFUND_FALLBACK = 'Any eligible amount will be returned through official channels after a thorough review by our support team.';

/** @type {string} Safe fallback text when credential requests are detected. */
const SAFE_CREDENTIAL_FALLBACK = 'For your security, our team will verify your account through official channels. Please do not share your PIN, OTP, or password with anyone.';

/** @type {string} Safe fallback text when third-party contact instructions are detected. */
const SAFE_THIRD_PARTY_FALLBACK = 'For assistance, please contact our official customer support through the app or our verified hotline.';

/**
 * Checks if text matches any of the given regex patterns.
 * @param {string} text - Text to check.
 * @param {RegExp[]} patterns - Array of regex patterns to test against.
 * @returns {boolean} True if any pattern matches the text.
 */
function containsPattern(text, patterns) {
  if (!text || typeof text !== 'string') return false;
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) return true;
  }
  return false;
}

/**
 * Checks if text contains prompt injection attempts.
 * @param {string} text - Text to check for injection patterns.
 * @returns {boolean} True if prompt injection is detected.
 */
function containsPromptInjection(text) {
  return containsPattern(text, PROMPT_INJECTION_PATTERNS);
}

/**
 * Applies safety filters to a single text field. Detects and replaces credential requests,
 * refund promises, and third-party contact instructions with safe fallback text.
 * @param {string} text - The text field to filter.
 * @returns {{text: string, violations: Array<{type: string, original: string}>}} Filtered text and list of violations detected.
 */
function filterText(text) {
  if (!text || typeof text !== 'string') return { text, violations: [] };

  const violations = [];
  let filtered = text;

  if (containsPattern(filtered, CREDENTIAL_REQUEST_PATTERNS)) {
    violations.push({ type: 'credential_request', original: filtered });
    filtered = SAFE_CREDENTIAL_FALLBACK;
  }

  if (containsPattern(filtered, REFUND_PROMISE_PATTERNS)) {
    violations.push({ type: 'refund_promise', original: filtered });
    filtered = filtered
      .replace(/\bwill\s+refund\s+.{0,50}/gi, SAFE_REFUND_FALLBACK)
      .replace(/\bwill\s+reverse\s+.{0,50}/gi, SAFE_REFUND_FALLBACK)
      .replace(/\byou\s+will\s+receive\s+.{0,50}back/gi, SAFE_REFUND_FALLBACK)
      .replace(/\brefund\s+confirmed\b/gi, 'Under review')
      .replace(/\bwill\s+return\s+.{0,50}/gi, SAFE_REFUND_FALLBACK)
      .replace(/\bআমরা\s+রিফান্ড\s+দেব\s+.{0,50}/gi, SAFE_REFUND_FALLBACK);
  }

  if (containsPattern(filtered, THIRD_PARTY_CONTACT_PATTERNS)) {
    violations.push({ type: 'third_party_contact', original: filtered });
    filtered = filtered.replace(
      /contact\s+\S+@\S+/gi,
      'contact our official support'
    ).replace(
      /contact\s+\S+\.com/gi,
      'contact our official support'
    ).replace(
      /contact\s+\S+\.net/gi,
      'contact our official support'
    );
  }

  return { text: filtered, violations };
}

/**
 * Applies safety filters to all text fields in a response object (customer_reply,
 * recommended_next_action, agent_summary). Returns the filtered response and all violations.
 * @param {Object} response - The response object to filter.
 * @param {string} response.customer_reply - Customer-facing reply text.
 * @param {string} response.recommended_next_action - Agent next action text.
 * @param {string} response.agent_summary - Agent summary text.
 * @returns {{filtered: Object, violations: Array<{type: string, original: string, field: string}>}} Filtered response and violations.
 */
function filterResponse(response) {
  const allViolations = [];
  const filtered = { ...response };

  const customerReplyResult = filterText(response.customer_reply);
  filtered.customer_reply = customerReplyResult.text;
  allViolations.push(...customerReplyResult.violations.map((v) => ({ ...v, field: 'customer_reply' })));

  const nextActionResult = filterText(response.recommended_next_action);
  filtered.recommended_next_action = nextActionResult.text;
  allViolations.push(...nextActionResult.violations.map((v) => ({ ...v, field: 'recommended_next_action' })));

  const summaryResult = filterText(response.agent_summary);
  filtered.agent_summary = summaryResult.text;
  allViolations.push(...summaryResult.violations.map((v) => ({ ...v, field: 'agent_summary' })));

  return { filtered, violations: allViolations };
}

module.exports = { filterResponse, filterText, containsPromptInjection };
