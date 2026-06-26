/** @type {string[]} All valid case_type enum values per Section 7.1 of the problem statement. */
const CASE_TYPES = [
  'wrong_transfer',
  'payment_failed',
  'refund_request',
  'duplicate_payment',
  'merchant_settlement_delay',
  'agent_cash_in_issue',
  'phishing_or_social_engineering',
  'other',
];

/** @type {string[]} All valid department enum values per Section 7.1. */
const DEPARTMENTS = [
  'customer_support',
  'dispute_resolution',
  'payments_ops',
  'merchant_operations',
  'agent_operations',
  'fraud_risk',
];

/** @type {string[]} All valid severity enum values per Section 6.1. */
const SEVERITIES = ['low', 'medium', 'high', 'critical'];

/** @type {string[]} All valid evidence_verdict enum values per Section 6.1. */
const EVIDENCE_VERDICTS = ['consistent', 'inconsistent', 'insufficient_data'];

/** @type {string[]} All valid transaction type enum values per Section 5.2. */
const TRANSACTION_TYPES = [
  'transfer',
  'payment',
  'cash_in',
  'cash_out',
  'settlement',
  'refund',
];

/** @type {string[]} All valid transaction status enum values per Section 5.2. */
const TRANSACTION_STATUSES = ['completed', 'failed', 'pending', 'reversed'];

/** @type {string[]} All valid channel enum values per Section 5.1. */
const CHANNELS = [
  'in_app_chat',
  'call_center',
  'email',
  'merchant_portal',
  'field_agent',
];

/** @type {string[]} All valid user_type enum values per Section 5.1. */
const USER_TYPES = ['customer', 'merchant', 'agent', 'unknown'];

/** @type {string[]} All valid language enum values per Section 5.1. */
const LANGUAGES = ['en', 'bn', 'mixed'];

/** @type {Record<string, string>} Maps case_type to its default department per Section 7.2. */
const CASE_TYPE_TO_DEPARTMENT = {
  wrong_transfer: 'dispute_resolution',
  payment_failed: 'payments_ops',
  refund_request: 'customer_support',
  duplicate_payment: 'payments_ops',
  merchant_settlement_delay: 'merchant_operations',
  agent_cash_in_issue: 'agent_operations',
  phishing_or_social_engineering: 'fraud_risk',
  other: 'customer_support',
};

/** @type {Record<string, string>} Maps case_type to its default severity level. */
const SEVERITY_CASE_TYPE_MAP = {
  wrong_transfer: 'high',
  payment_failed: 'medium',
  refund_request: 'low',
  duplicate_payment: 'high',
  merchant_settlement_delay: 'medium',
  agent_cash_in_issue: 'medium',
  phishing_or_social_engineering: 'critical',
  other: 'low',
};

module.exports = {
  CASE_TYPES,
  DEPARTMENTS,
  SEVERITIES,
  EVIDENCE_VERDICTS,
  TRANSACTION_TYPES,
  TRANSACTION_STATUSES,
  CHANNELS,
  USER_TYPES,
  LANGUAGES,
  CASE_TYPE_TO_DEPARTMENT,
  SEVERITY_CASE_TYPE_MAP,
};
