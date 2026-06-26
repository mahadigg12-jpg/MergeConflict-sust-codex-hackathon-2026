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

const DEPARTMENTS = [
  'customer_support',
  'dispute_resolution',
  'payments_ops',
  'merchant_operations',
  'agent_operations',
  'fraud_risk',
];

const SEVERITIES = ['low', 'medium', 'high', 'critical'];

const EVIDENCE_VERDICTS = ['consistent', 'inconsistent', 'insufficient_data'];

const TRANSACTION_TYPES = [
  'transfer',
  'payment',
  'cash_in',
  'cash_out',
  'settlement',
  'refund',
];

const TRANSACTION_STATUSES = ['completed', 'failed', 'pending', 'reversed'];

const CHANNELS = [
  'in_app_chat',
  'call_center',
  'email',
  'merchant_portal',
  'field_agent',
];

const USER_TYPES = ['customer', 'merchant', 'agent', 'unknown'];

const LANGUAGES = ['en', 'bn', 'mixed'];

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
