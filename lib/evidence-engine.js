const { CASE_TYPE_TO_DEPARTMENT, SEVERITY_CASE_TYPE_MAP } = require('./taxonomy');

const AMOUNT_PATTERNS = [
  /(\d[\d,]*)\s*(?:taka|tk|bdt|৳)/gi,
  /(?:৳|tk|bdt)\s*(\d[\d,]*)/gi,
  /(\d[\d,]*)\s*(?:bdr)/gi,
];

const TIME_PATTERNS = [
  { regex: /(\d{1,2})\s*(?::\d{2})?\s*(am|pm)/i, type: 'clock' },
  { regex: /(morning|afternoon|evening|night|today|yesterday)/i, type: 'period' },
  { regex: /(\d{1,2})\s*hours?\s*ago/i, type: 'relative' },
];

const TYPE_KEYWORDS = {
  wrong_transfer: [
    'wrong number', 'wrong person', 'sent to wrong', 'transferred to wrong',
    'wrong account', 'incorrect transfer', 'sent by mistake', 'accidentally sent',
    'wrong recipient', 'sent to someone else', 'by mistake', 'sent incorrectly',
    'wrong side', 'লিখে দিন', 'ভুল নম্বর', 'ভুল মানুষ',
  ],
  payment_failed: [
    'failed', 'failure', 'not received', 'deducted but', 'deducted not',
    'balance deducted', 'transaction failed', 'payment not', 'not completed',
    'pending', 'stuck', 'showing pending', 'অসফল',
  ],
  refund_request: [
    'refund', 'return', 'money back', 'get back', 'reimburse', 'return my',
    'ফেরত', 'রিফান্ড', 'return money',
  ],
  duplicate_payment: [
    'duplicate', 'charged twice', 'double', 'two times', 'multiple times',
    'same payment', 'deducted twice', 'debited twice', 'দুইবার',
  ],
  merchant_settlement_delay: [
    'settlement', 'merchant', 'store', 'shop', 'business', 'received from',
    'merchant payment', 'দোকান',
  ],
  agent_cash_in_issue: [
    'agent', 'cash in', 'cash-in', 'deposit', 'cash deposit', 'recharged',
    'added balance', 'ক্যাশ ইন', 'এজেন্ট',
  ],
  phishing_or_social_engineering: [
    'scam', 'fake call', 'fraud', 'suspicious', 'asked for pin',
    'asked for otp', 'asked for password', 'someone called', 'fake message',
    'otp share', 'pin share', 'জাল', 'প্রতারণা', 'স্ক্যাম',
  ],
};

const SUSPICIOUS_KEYWORDS = [
  'scam', 'fraud', 'suspicious', 'fake', 'unknown number',
  'asked for', 'requested pin', 'requested otp',
  'জাল', 'প্রতারণা', 'সন্দেহ', 'অজ্ঞাত',
];

function extractAmount(complaint) {
  const amounts = [];
  for (const pattern of AMOUNT_PATTERNS) {
    const re = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = re.exec(complaint)) !== null) {
      const numStr = (match[1] || match[0]).replace(/[^\d]/g, '');
      const val = parseInt(numStr, 10);
      if (!isNaN(val) && val > 0) amounts.push(val);
    }
  }
  return amounts;
}

function extractTimeInfo(complaint) {
  for (const p of TIME_PATTERNS) {
    const match = complaint.match(p.regex);
    if (match) return { type: p.type, value: match[1] || match[0], raw: match[0] };
  }
  return null;
}

function matchAmountsToTransactions(complaintAmounts, transactionHistory) {
  if (!complaintAmounts.length || !transactionHistory.length) return [];

  const matches = [];
  for (const tx of transactionHistory) {
    for (const amt of complaintAmounts) {
      const diff = Math.abs(tx.amount - amt);
      const pct = tx.amount > 0 ? diff / tx.amount : Infinity;
      if (diff === 0) {
        matches.push({ tx, score: 1.0, reason: `exact_amount_match_${amt}` });
      } else if (pct <= 0.05) {
        matches.push({ tx, score: 0.8, reason: `approximate_amount_match_${amt}` });
      }
    }
  }
  return matches;
}

function matchTimeToTransactions(complaintTime, transactionHistory) {
  if (!complaintTime || !transactionHistory.length) return [];

  const matches = [];
  for (const tx of transactionHistory) {
    const txDate = new Date(tx.timestamp);
    if (isNaN(txDate.getTime())) continue;

    const txHour = txDate.getUTCHours();
    const txMinutes = txDate.getUTCMinutes();

    if (complaintTime.type === 'clock') {
      const compHour = parseInt(complaintTime.value, 10);
      const isPM = /pm/i.test(complaintTime.raw);
      const hour24 = isPM && compHour < 12 ? compHour + 12 : compHour === 12 && !isPM ? 0 : compHour;
      if (Math.abs(txHour - hour24) <= 1) {
        matches.push({ tx, score: 0.7, reason: `time_match_${complaintTime.value}` });
      }
    } else if (complaintTime.type === 'period') {
      const period = complaintTime.value.toLowerCase();
      if ((period === 'morning' && txHour >= 6 && txHour < 12) ||
          (period === 'afternoon' && txHour >= 12 && txHour < 17) ||
          (period === 'evening' && txHour >= 17 && txHour < 21) ||
          (period === 'night' && (txHour >= 21 || txHour < 6)) ||
          period === 'today') {
        matches.push({ tx, score: 0.5, reason: `period_match_${period}` });
      }
    } else if (complaintTime.type === 'relative') {
      const hoursAgo = parseInt(complaintTime.value, 10);
      const now = new Date();
      const diffHours = Math.abs((now - txDate) / (1000 * 60 * 60));
      if (diffHours <= hoursAgo + 1) {
        matches.push({ tx, score: 0.6, reason: `relative_time_match_${hoursAgo}h` });
      }
    }
  }
  return matches;
}

function matchTypeToTransactions(complaintLower, transactionHistory) {
  const matches = [];
  for (const tx of transactionHistory) {
    const txType = tx.type;
    if (txType === 'transfer' && /send|transfer|sent|পাঠানো|পাঠালাম/.test(complaintLower)) {
      matches.push({ tx, score: 0.6, reason: 'type_match_transfer' });
    } else if (txType === 'payment' && /pay|paid|payment|পেমেন্ট/.test(complaintLower)) {
      matches.push({ tx, score: 0.6, reason: 'type_match_payment' });
    } else if (txType === 'cash_in' && /cash.?in|deposit|recharge|ক্যাশ.?ইন/.test(complaintLower)) {
      matches.push({ tx, score: 0.6, reason: 'type_match_cash_in' });
    } else if (txType === 'cash_out' && /cash.?out|withdraw|ক্যাশ.?আউট/.test(complaintLower)) {
      matches.push({ tx, score: 0.6, reason: 'type_match_cash_out' });
    } else if (txType === 'refund' && /refund|return|ফেরত/.test(complaintLower)) {
      matches.push({ tx, score: 0.6, reason: 'type_match_refund' });
    } else if (txType === 'settlement' && /settle|merchant|সেটেল/.test(complaintLower)) {
      matches.push({ tx, score: 0.6, reason: 'type_match_settlement' });
    }
  }
  return matches;
}

function matchCounterpartyToTransactions(complaintLower, transactionHistory) {
  const matches = [];
  const phoneRegex = /\+?880\d{10}|\d{11}/g;
  const phones = complaintLower.match(phoneRegex) || [];

  for (const tx of transactionHistory) {
    if (tx.counterparty) {
      const cp = tx.counterparty.replace(/\D/g, '');
      for (const phone of phones) {
        const p = phone.replace(/\D/g, '');
        if (cp.endsWith(p.slice(-10)) || p.endsWith(cp.slice(-10))) {
          matches.push({ tx, score: 0.9, reason: 'counterparty_match' });
        }
      }
    }
  }
  return matches;
}

function aggregateScores(allMatches) {
  const txScores = {};
  for (const match of allMatches) {
    const id = match.tx.transaction_id;
    if (!txScores[id]) {
      txScores[id] = { tx: match.tx, score: 0, reasons: [] };
    }
    txScores[id].score += match.score;
    txScores[id].reasons.push(match.reason);
  }

  const sorted = Object.values(txScores).sort((a, b) => b.score - a.score);
  return sorted;
}

function classifyCaseType(complaintLower) {
  let bestType = 'other';
  let bestScore = 0;

  for (const [type, keywords] of Object.entries(TYPE_KEYWORDS)) {
    let score = 0;
    for (const kw of keywords) {
      if (complaintLower.includes(kw.toLowerCase())) {
        score += 1;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestType = type;
    }
  }

  return bestType;
}

function determineSeverity(caseType, complaintAmounts, complaintLower) {
  const maxAmount = complaintAmounts.length > 0 ? Math.max(...complaintAmounts) : 0;
  const isSuspicious = SUSPICIOUS_KEYWORDS.some((kw) => complaintLower.includes(kw));

  if (isSuspicious) return 'critical';
  if (maxAmount >= 50000) return 'critical';
  if (maxAmount >= 10000) return 'high';

  return SEVERITY_CASE_TYPE_MAP[caseType] || 'low';
}

function determineHumanReview(caseType, evidenceVerdict, severity, isSuspicious) {
  if (caseType === 'phishing_or_social_engineering') return true;
  if (severity === 'critical') return true;
  if (severity === 'high') return true;
  if (evidenceVerdict === 'insufficient_data') return true;
  if (evidenceVerdict === 'inconsistent') return true;
  if (isSuspicious) return true;
  return false;
}

function buildReasonCodes(caseType, evidenceVerdict, hasMatch, isSuspicious, matchedReasons) {
  const codes = [caseType];
  if (evidenceVerdict === 'consistent') codes.push('transaction_match');
  else if (evidenceVerdict === 'inconsistent') codes.push('transaction_contradiction');
  else codes.push('no_transaction_match');
  if (isSuspicious) codes.push('suspicious_content');
  if (matchedReasons) codes.push(...matchedReasons.slice(0, 3));
  return codes;
}

function computeConfidence(evidenceVerdict, matchScore, caseType) {
  let base = 0;
  if (evidenceVerdict === 'consistent') base = 0.7;
  else if (evidenceVerdict === 'inconsistent') base = 0.65;
  else base = 0.3;

  if (matchScore > 1.5) base += 0.15;
  else if (matchScore > 0.8) base += 0.1;
  else if (matchScore > 0.3) base += 0.05;

  if (caseType === 'phishing_or_social_engineering') base += 0.05;

  return Math.min(Math.round(base * 100) / 100, 1.0);
}

function analyzeEvidence(ticket) {
  const complaint = ticket.complaint || '';
  const complaintLower = complaint.toLowerCase();
  const transactionHistory = ticket.transaction_history || [];

  const complaintAmounts = extractAmount(complaint);
  const complaintTime = extractTimeInfo(complaint);

  if (transactionHistory.length === 0) {
    const caseType = classifyCaseType(complaintLower);
    const isSuspicious = SUSPICIOUS_KEYWORDS.some((kw) => complaintLower.includes(kw));
    const severity = determineSeverity(caseType, complaintAmounts, complaintLower);
    const department = CASE_TYPE_TO_DEPARTMENT[caseType];
    const humanReview = determineHumanReview(caseType, 'insufficient_data', severity, isSuspicious);

    return {
      relevant_transaction_id: null,
      evidence_verdict: 'insufficient_data',
      case_type: caseType,
      severity,
      department,
      human_review_required: humanReview,
      confidence: 0.2,
      reason_codes: buildReasonCodes(caseType, 'insufficient_data', false, isSuspicious, []),
    };
  }

  const amountMatches = matchAmountsToTransactions(complaintAmounts, transactionHistory);
  const timeMatches = matchTimeToTransactions(complaintTime, transactionHistory);
  const typeMatches = matchTypeToTransactions(complaintLower, transactionHistory);
  const cpMatches = matchCounterpartyToTransactions(complaintLower, transactionHistory);

  const allMatches = [...amountMatches, ...timeMatches, ...typeMatches, ...cpMatches];
  const aggregated = aggregateScores(allMatches);

  const caseType = classifyCaseType(complaintLower);
  const isSuspicious = SUSPICIOUS_KEYWORDS.some((kw) => complaintLower.includes(kw));
  const severity = determineSeverity(caseType, complaintAmounts, complaintLower);

  let relevantTransactionId = null;
  let evidenceVerdict = 'insufficient_data';
  let matchScore = 0;
  let matchedReasons = [];

  if (aggregated.length > 0 && aggregated[0].score > 0.3) {
    const best = aggregated[0];
    relevantTransactionId = best.tx.transaction_id;
    matchScore = best.score;
    matchedReasons = best.reasons;

    if (caseType === 'wrong_transfer' || caseType === 'payment_failed' ||
        caseType === 'duplicate_payment' || caseType === 'refund_request') {
      if (best.tx.status === 'completed' && caseType === 'payment_failed') {
        evidenceVerdict = 'inconsistent';
      } else if (best.tx.status === 'failed' && caseType !== 'payment_failed') {
        evidenceVerdict = 'inconsistent';
      } else {
        evidenceVerdict = 'consistent';
      }
    } else if (caseType === 'phishing_or_social_engineering') {
      evidenceVerdict = 'insufficient_data';
    } else {
      evidenceVerdict = 'consistent';
    }
  } else {
    evidenceVerdict = 'insufficient_data';
  }

  const department = CASE_TYPE_TO_DEPARTMENT[caseType];
  const humanReview = determineHumanReview(caseType, evidenceVerdict, severity, isSuspicious);
  const confidence = computeConfidence(evidenceVerdict, matchScore, caseType);
  const reasonCodes = buildReasonCodes(caseType, evidenceVerdict, aggregated.length > 0, isSuspicious, matchedReasons);

  return {
    relevant_transaction_id: relevantTransactionId,
    evidence_verdict: evidenceVerdict,
    case_type: caseType,
    severity,
    department,
    human_review_required: humanReview,
    confidence,
    reason_codes: reasonCodes,
  };
}

module.exports = { analyzeEvidence };
