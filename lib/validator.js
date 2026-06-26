const {
  CASE_TYPES,
  DEPARTMENTS,
  SEVERITIES,
  EVIDENCE_VERDICTS,
  TRANSACTION_TYPES,
  TRANSACTION_STATUSES,
  CHANNELS,
  USER_TYPES,
  LANGUAGES,
} = require('./taxonomy');

function validateRequest(body) {
  if (!body || typeof body !== 'object') {
    return { valid: false, status: 400, error: 'Request body must be a JSON object.' };
  }

  if (!body.ticket_id || typeof body.ticket_id !== 'string') {
    return { valid: false, status: 400, error: 'ticket_id is required and must be a string.' };
  }

  if (!body.complaint || typeof body.complaint !== 'string') {
    return { valid: false, status: 400, error: 'complaint is required and must be a string.' };
  }

  if (body.complaint.trim().length === 0) {
    return { valid: false, status: 422, error: 'complaint must not be empty.' };
  }

  if (body.language !== undefined && !LANGUAGES.includes(body.language)) {
    return { valid: false, status: 400, error: `language must be one of: ${LANGUAGES.join(', ')}` };
  }

  if (body.channel !== undefined && !CHANNELS.includes(body.channel)) {
    return { valid: false, status: 400, error: `channel must be one of: ${CHANNELS.join(', ')}` };
  }

  if (body.user_type !== undefined && !USER_TYPES.includes(body.user_type)) {
    return { valid: false, status: 400, error: `user_type must be one of: ${USER_TYPES.join(', ')}` };
  }

  if (body.transaction_history !== undefined) {
    if (!Array.isArray(body.transaction_history)) {
      return { valid: false, status: 400, error: 'transaction_history must be an array.' };
    }

    for (let i = 0; i < body.transaction_history.length; i++) {
      const tx = body.transaction_history[i];
      const txError = validateTransaction(tx, i);
      if (txError) return txError;
    }
  }

  return { valid: true };
}

function validateTransaction(tx, index) {
  if (!tx || typeof tx !== 'object') {
    return { valid: false, status: 400, error: `transaction_history[${index}] must be an object.` };
  }

  if (!tx.transaction_id || typeof tx.transaction_id !== 'string') {
    return { valid: false, status: 400, error: `transaction_history[${index}].transaction_id is required and must be a string.` };
  }

  if (!tx.timestamp || typeof tx.timestamp !== 'string') {
    return { valid: false, status: 400, error: `transaction_history[${index}].timestamp is required and must be a string (ISO 8601).` };
  }

  if (!tx.type || !TRANSACTION_TYPES.includes(tx.type)) {
    return { valid: false, status: 400, error: `transaction_history[${index}].type must be one of: ${TRANSACTION_TYPES.join(', ')}` };
  }

  if (tx.amount === undefined || tx.amount === null || typeof tx.amount !== 'number') {
    return { valid: false, status: 400, error: `transaction_history[${index}].amount is required and must be a number.` };
  }

  if (tx.counterparty !== undefined && typeof tx.counterparty !== 'string') {
    return { valid: false, status: 400, error: `transaction_history[${index}].counterparty must be a string.` };
  }

  if (tx.status !== undefined && !TRANSACTION_STATUSES.includes(tx.status)) {
    return { valid: false, status: 400, error: `transaction_history[${index}].status must be one of: ${TRANSACTION_STATUSES.join(', ')}` };
  }

  return null;
}

function validateResponseSchema(resp) {
  const errors = [];

  if (!resp.ticket_id || typeof resp.ticket_id !== 'string') {
    errors.push('ticket_id is required and must be a string');
  }

  if (resp.relevant_transaction_id !== null && resp.relevant_transaction_id !== undefined && typeof resp.relevant_transaction_id !== 'string') {
    errors.push('relevant_transaction_id must be a string or null');
  }

  if (!EVIDENCE_VERDICTS.includes(resp.evidence_verdict)) {
    errors.push(`evidence_verdict must be one of: ${EVIDENCE_VERDICTS.join(', ')}`);
  }

  if (!CASE_TYPES.includes(resp.case_type)) {
    errors.push(`case_type must be one of: ${CASE_TYPES.join(', ')}`);
  }

  if (!SEVERITIES.includes(resp.severity)) {
    errors.push(`severity must be one of: ${SEVERITIES.join(', ')}`);
  }

  if (!DEPARTMENTS.includes(resp.department)) {
    errors.push(`department must be one of: ${DEPARTMENTS.join(', ')}`);
  }

  if (typeof resp.agent_summary !== 'string') {
    errors.push('agent_summary is required and must be a string');
  }

  if (typeof resp.recommended_next_action !== 'string') {
    errors.push('recommended_next_action is required and must be a string');
  }

  if (typeof resp.customer_reply !== 'string') {
    errors.push('customer_reply is required and must be a string');
  }

  if (typeof resp.human_review_required !== 'boolean') {
    errors.push('human_review_required is required and must be a boolean');
  }

  if (resp.confidence !== undefined && resp.confidence !== null) {
    if (typeof resp.confidence !== 'number' || resp.confidence < 0 || resp.confidence > 1) {
      errors.push('confidence must be a number between 0 and 1');
    }
  }

  if (resp.reason_codes !== undefined && resp.reason_codes !== null) {
    if (!Array.isArray(resp.reason_codes)) {
      errors.push('reason_codes must be an array');
    } else {
      for (const code of resp.reason_codes) {
        if (typeof code !== 'string') {
          errors.push('each reason_code must be a string');
          break;
        }
      }
    }
  }

  return errors;
}

module.exports = { validateRequest, validateResponseSchema };
