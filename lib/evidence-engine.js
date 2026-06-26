const { CASE_TYPE_TO_DEPARTMENT, SEVERITY_CASE_TYPE_MAP } = require('./taxonomy');

const BENGALI_DIGITS = { '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4', '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9' };

function normalizeBengaliDigits(text) {
  return text.replace(/[০-৯]/g, (d) => BENGALI_DIGITS[d] ?? d);
}

/** @type {RegExp[]} Regex patterns for extracting monetary amounts from complaint text (BDT/taka/tk). */
const AMOUNT_PATTERNS = [
  /(\d[\d,]*)\s*(?:taka|tk|bdt|৳)/gi,
  /(?:৳|tk|bdt)\s*(\d[\d,]*)/gi,
  /(\d[\d,]*)\s*(?:bdr)/gi,
];

/** @type {{regex: RegExp, type: string}[]} Regex patterns for extracting time references from complaint text. */
const TIME_PATTERNS = [
  { regex: /(\d{1,2})\s*(?::\d{2})?\s*(am|pm)/i, type: 'clock' },
  { regex: /(morning|afternoon|evening|night|today|yesterday)/i, type: 'period' },
  { regex: /(\d{1,2})\s*hours?\s*ago/i, type: 'relative' },
  { regex: /(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(january|february|march|april|may|june|july|august|september|october|november|december)/i, type: 'date' },
  { regex: /(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?/i, type: 'date' },
  { regex: /(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i, type: 'weekday' },
  { regex: /last\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i, type: 'weekday' },
  { regex: /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/i, type: 'numeric_date' },
];

const MONTH_MAP = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};

const WEEKDAY_MAP = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
};

/**
 * @type {Record<string, string[]>} Keywords mapping complaint text to case_type classifications.
 * Expanded to cover paraphrases, synonyms, and Bangla/Banglish variants.
 */
const TYPE_KEYWORDS = {
  wrong_transfer: [
    'wrong number', 'wrong person', 'sent to wrong', 'transferred to wrong',
    'wrong account', 'incorrect transfer', 'sent by mistake', 'accidentally sent',
    'wrong recipient', 'sent to someone else', 'by mistake', 'sent incorrectly',
    'wrong side', 'did not send', 'didnt send', 'not send any', 'never sent',
    'not authorize', 'unauthorized', 'not my doing',
    'need to reverse', 'reverse this', 'cancel the transfer', 'recall',
    'sent to wrong', 'went to wrong', 'gone to wrong', 'transfer to wrong',
    'sent it to the wrong', 'money went to', 'transferred it to the wrong',
    'accidentally transferred', 'mistakenly sent', 'wrongly sent',
    'i did not send', 'not my transaction', 'someone else',
    'get my money back', 'help me get', 'want my money back',
    'ভুল নম্বর', 'ভুল মানুষ', 'লিখে দিন', 'ভুলে পাঠালাম',
    'ভুল একাউন্ট', 'ভুল ব্যক্তি', 'কাছে পাঠালাম', 'ভুল করে পাঠালাম',
  ],
  payment_failed: [
    'failed', 'failure', 'not received', 'deducted but', 'deducted not',
    'balance deducted', 'transaction failed', 'payment failed', 'payment not',
    'not completed', 'showing pending', 'অসফল', 'সমস্যা', 'হয়নি',
    'money deducted', 'amount deducted', 'money taken', 'balance cut',
    'deducted from my', 'taken from my', 'cut from my',
    'money stuck', 'stuck', 'pending', 'processing',
    'could not complete', 'unable to complete', 'did not go through',
    'not working', 'error', 'problem', 'issue with payment',
    'charge but', 'charged but not', 'debited but',
    'without my knowledge', 'without my permission', 'without receiving',
    'money not', 'balance not updated', 'not reflected',
    'deducted', 'balance was deducted',
  ],
  refund_request: [
    'refund', 'return', 'money back', 'get back', 'reimburse', 'return my',
    'ফেরত', 'রিফান্ড', 'return money', 'want back', 'need back',
    'give back', 'send back', 'return the', 'get my money',
    'want my money back', 'need my money back', 'please return',
    'cancel and refund', 'reverse and return', 'money should be',
  ],
  duplicate_payment: [
    'duplicate', 'charged twice', 'double', 'two times', 'multiple times',
    'same payment', 'deducted twice', 'debited twice', 'দুইবার',
    'twice', 'twice charged', 'two charges', 'charged two',
    'double charged', 'multiple charge', 'same amount twice',
    'same amount charged', 'charged more than once',
    'extra charge', 'additional charge', 'overcharged',
  ],
  merchant_settlement_delay: [
    'settlement', 'merchant', 'store', 'shop', 'business', 'received from',
    'merchant payment', 'দোকান', 'পেমেন্ট পাইনি',
    'not received payment', 'payment not received', 'settlement pending',
    'merchant balance', 'store payment', 'shop payment',
    'received my payment', 'did not receive', 'haven\'t received',
    'settlement delay', 'delayed settlement', 'pending settlement',
    'my store', 'my shop', 'my business', 'for my shop',
    'merchant side', 'store side',
  ],
  agent_cash_in_issue: [
    'agent', 'cash in', 'cash-in', 'deposit', 'cash deposit', 'recharged',
    'added balance', 'ক্যাশ ইন', 'এজেন্ট',
    'agent cash', 'through agent', 'via agent', 'by agent',
    'cash in not', 'cash in failed', 'deposit not reflected',
    'balance not added', 'recharge not', 'not reflected',
    'agent deposit', 'agent recharge', 'agent added',
    'mobile recharge', 'recharge balance', 'top up',
    'added but not', 'recharged but', 'deposited but',
  ],
  phishing_or_social_engineering: [
    'scam', 'fake call', 'fraud', 'suspicious', 'asked for pin',
    'asked for otp', 'asked for password', 'someone called', 'fake message',
    'otp share', 'pin share', 'জাল', 'প্রতারণা', 'স্ক্যাম',
    'phishing', 'impersonate', 'pretending', 'fake sms',
    'unknown caller', 'strange call', 'weird message',
    'asked for credentials', 'requested pin', 'requested otp',
    'told me to share', 'forced me to', 'threatened',
    'fake agent', 'fake customer', 'impersonation',
    'call from unknown', 'message from unknown', 'suspicious call',
    'suspicious message', 'suspicious sms', 'fraudulent',
  ],
};

/** @type {string[]} Keywords that indicate suspicious/phishing activity in complaint text. */
const SUSPICIOUS_KEYWORDS = [
  'scam', 'fraud', 'suspicious', 'fake', 'unknown number',
  'asked for', 'requested pin', 'requested otp',
  'জাল', 'প্রতারণা', 'সন্দেহ', 'অজ্ঞাত',
  'phishing', 'impersonate', 'pretending', 'threatened',
  'forced me', 'fake call', 'fake message', 'fake sms',
  'suspicious call', 'suspicious message', 'suspicious sms',
  'unknown caller', 'strange call', 'weird message',
];

/**
 * Extracts monetary amounts from complaint text using regex patterns.
 * Handles currency-prefixed/suffixed amounts and standalone large numbers.
 * @param {string} complaint - The customer complaint text.
 * @returns {number[]} Array of extracted amounts in BDT.
 */
function extractAmount(complaint) {
  const amounts = [];
  const seen = new Set();
  for (const pattern of AMOUNT_PATTERNS) {
    const re = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = re.exec(complaint)) !== null) {
      const numStr = (match[1] || match[0]).replace(/[^\d]/g, '');
      const val = parseInt(numStr, 10);
      if (!isNaN(val) && val > 0 && !seen.has(val)) {
        seen.add(val);
        amounts.push(val);
      }
    }
  }
  return amounts;
}

/**
 * Extracts time information from complaint text (clock time, period, relative, date, or weekday).
 * @param {string} complaint - The customer complaint text.
 * @returns {{type: string, value: string, raw: string} | null} Extracted time info or null if none found.
 */
function extractTimeInfo(complaint) {
  for (const p of TIME_PATTERNS) {
    const match = complaint.match(p.regex);
    if (match) {
      if (p.type === 'date') {
        const day = match[1] || match[2];
        const monthStr = (match[2] || match[1]).toLowerCase();
        const monthNum = MONTH_MAP[monthStr];
        if (monthNum !== undefined) {
          return { type: 'date', value: `${monthNum}/${day}`, raw: match[0] };
        }
      }
      if (p.type === 'weekday') {
        const dayStr = match[1].toLowerCase().replace('last ', '');
        return { type: 'weekday', value: dayStr, raw: match[0] };
      }
      if (p.type === 'numeric_date') {
        return { type: 'numeric_date', value: `${match[1]}/${match[2]}/${match[3]}`, raw: match[0] };
      }
      return { type: p.type, value: match[1] || match[0], raw: match[0] };
    }
  }
  return null;
}

/**
 * Matches complaint amounts against transaction history entries.
 * Supports exact match, within 5%, and within 20% for fuzzy matching.
 * @param {number[]} complaintAmounts - Amounts extracted from the complaint.
 * @param {Array<Object>} transactionHistory - Customer's recent transaction history.
 * @returns {Array<{tx: Object, score: number, reason: string}>} Match results with scores.
 */
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
        matches.push({ tx, score: 0.85, reason: `approximate_amount_match_${amt}` });
      } else if (pct <= 0.2) {
        matches.push({ tx, score: 0.5, reason: `fuzzy_amount_match_${amt}` });
      }
    }
  }
  return matches;
}

/**
 * Matches complaint time references against transaction timestamps.
 * Supports clock time, period, relative time, date, weekday, and numeric date.
 * @param {{type: string, value: string, raw: string} | null} complaintTime - Extracted time info from complaint.
 * @param {Array<Object>} transactionHistory - Customer's recent transaction history.
 * @returns {Array<{tx: Object, score: number, reason: string}>} Match results with scores.
 */
function matchTimeToTransactions(complaintTime, transactionHistory) {
  if (!complaintTime || !transactionHistory.length) return [];

  const matches = [];
  for (const tx of transactionHistory) {
    const txDate = new Date(tx.timestamp);
    if (isNaN(txDate.getTime())) continue;

    const txHour = txDate.getUTCHours();
    const txDay = txDate.getUTCDay();
    const txMonth = txDate.getUTCMonth();
    const txDateNum = txDate.getUTCDate();

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
    } else if (complaintTime.type === 'date') {
      const parts = complaintTime.value.split('/');
      const month = parseInt(parts[0], 10);
      const day = parseInt(parts[1], 10);
      if (txMonth === month && txDateNum === day) {
        matches.push({ tx, score: 0.9, reason: `date_match_${complaintTime.value}` });
      }
    } else if (complaintTime.type === 'weekday') {
      const targetDay = WEEKDAY_MAP[complaintTime.value.toLowerCase()];
      if (targetDay !== undefined && txDay === targetDay) {
        matches.push({ tx, score: 0.5, reason: `weekday_match_${complaintTime.value}` });
      }
    } else if (complaintTime.type === 'numeric_date') {
      const parts = complaintTime.value.split('/');
      const month = parseInt(parts[0], 10) - 1;
      const day = parseInt(parts[1], 10);
      if (txMonth === month && txDateNum === day) {
        matches.push({ tx, score: 0.9, reason: `numeric_date_match_${complaintTime.value}` });
      }
    }
  }
  return matches;
}

/**
 * Matches complaint keywords against transaction types (transfer, payment, cash_in, etc.).
 * @param {string} complaintLower - Lowercased complaint text.
 * @param {Array<Object>} transactionHistory - Customer's recent transaction history.
 * @returns {Array<{tx: Object, score: number, reason: string}>} Match results with scores.
 */
function matchTypeToTransactions(complaintLower, transactionHistory) {
  const matches = [];
  for (const tx of transactionHistory) {
    const txType = tx.type;
    if (txType === 'transfer' && /send|transfer|sent|পাঠানো|পাঠালাম|money.*to|taka.*to/.test(complaintLower)) {
      matches.push({ tx, score: 0.6, reason: 'type_match_transfer' });
    } else if (txType === 'payment' && /pay|paid|payment|পেমেন্ট|charged|debit/.test(complaintLower)) {
      matches.push({ tx, score: 0.6, reason: 'type_match_payment' });
    } else if (txType === 'cash_in' && /cash.?in|deposit|recharge|ক্যাশ.?ইন|top.?up|added.?balance/.test(complaintLower)) {
      matches.push({ tx, score: 0.6, reason: 'type_match_cash_in' });
    } else if (txType === 'cash_out' && /cash.?out|withdraw|ক্যাশ.?আউট/.test(complaintLower)) {
      matches.push({ tx, score: 0.6, reason: 'type_match_cash_out' });
    } else if (txType === 'refund' && /refund|return|ফেরত/.test(complaintLower)) {
      matches.push({ tx, score: 0.6, reason: 'type_match_refund' });
    } else if (txType === 'settlement' && /settle|merchant|সেটেল|store|shop|business/.test(complaintLower)) {
      matches.push({ tx, score: 0.6, reason: 'type_match_settlement' });
    }
  }
  return matches;
}

/**
 * Matches phone numbers, merchant names, agent IDs, or partial identifiers from complaint text
 * against transaction counterparties.
 * @param {string} complaintLower - Lowercased complaint text.
 * @param {Array<Object>} transactionHistory - Customer's recent transaction history.
 * @returns {Array<{tx: Object, score: number, reason: string}>} Match results with scores.
 */
function matchCounterpartyToTransactions(complaintLower, transactionHistory) {
  const matches = [];
  const phoneRegex = /\+?880\d{10}|\d{11}/g;
  const phones = complaintLower.match(phoneRegex) || [];

  for (const tx of transactionHistory) {
    if (tx.counterparty) {
      const cp = tx.counterparty.toLowerCase();
      const cpDigits = tx.counterparty.replace(/\D/g, '');

      for (const phone of phones) {
        const p = phone.replace(/\D/g, '');
        if (cpDigits.endsWith(p.slice(-10)) || p.endsWith(cpDigits.slice(-10))) {
          matches.push({ tx, score: 0.9, reason: 'counterparty_phone_match' });
        }
      }

      if (complaintLower.includes(cp) || complaintLower.includes(cp.replace('+', ''))) {
        matches.push({ tx, score: 0.85, reason: 'counterparty_name_match' });
      }
    }
  }
  return matches;
}

/**
 * Matches complaint text against transaction status for additional evidence signals.
 * @param {string} complaintLower - Lowercased complaint text.
 * @param {Array<Object>} transactionHistory - Customer's recent transaction history.
 * @returns {Array<{tx: Object, score: number, reason: string}>} Match results with scores.
 */
function matchStatusToTransactions(complaintLower, transactionHistory) {
  const matches = [];
  for (const tx of transactionHistory) {
    if (tx.status === 'pending' && /pending|stuck|processing|waiting|not.*yet|অপেক্ষমান/.test(complaintLower)) {
      matches.push({ tx, score: 0.7, reason: 'status_match_pending' });
    } else if (tx.status === 'failed' && /failed|failure|unsuccessful|not.*complete|অসফল/.test(complaintLower)) {
      matches.push({ tx, score: 0.8, reason: 'status_match_failed' });
    } else if (tx.status === 'reversed' && /reversed|cancel|void|undo/.test(complaintLower)) {
      matches.push({ tx, score: 0.8, reason: 'status_match_reversed' });
    }
  }
  return matches;
}

/**
 * Aggregates match scores per transaction and sorts by score (descending), then recency.
 * @param {Array<{tx: Object, score: number, reason: string}>} allMatches - All match results from different signals.
 * @returns {Array<{tx: Object, score: number, reasons: string[]}>} Aggregated and sorted transaction scores.
 */
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

  const sorted = Object.values(txScores).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return new Date(b.tx.timestamp) - new Date(a.tx.timestamp);
  });
  return sorted;
}

/**
 * Normalizes a phone number to last 11 digits for comparison.
 * @param {string} phone - Phone number string.
 * @returns {string} Normalized 11-digit string.
 */
function normalizePhone(phone) {
  return phone.replace(/\D/g, '').slice(-11);
}

/**
 * Detects if the same counterparty appears multiple times in transaction history,
 * indicating an established recipient relationship that may contradict a wrong-transfer claim.
 * Triggers when the complaint references the counterparty directly, or when there are multiple
 * same-counterparty transfers and the complaint mentions transfer activity.
 * @param {Array<Object>} transactionHistory - Customer's recent transaction history.
 * @param {string} complaintLower - Lowercased complaint text.
 * @returns {boolean} True if an established recipient pattern is detected.
 */
function detectEstablishedRecipient(transactionHistory, complaintLower) {
  if (transactionHistory.length < 2) return false;
  const counterpartyCounts = {};
  for (const tx of transactionHistory) {
    if (tx.counterparty) {
      counterpartyCounts[tx.counterparty] = (counterpartyCounts[tx.counterparty] || 0) + 1;
    }
  }
  const hasTransferIntent = /send|transfer|sent|পাঠানো|পাঠালাম|revers|cancel|wrong/i.test(complaintLower);
  for (const [cp, count] of Object.entries(counterpartyCounts)) {
    if (count >= 2) {
      const cpNorm = normalizePhone(cp);
      if (complaintLower.includes(cp.toLowerCase()) || complaintLower.includes(cp.replace('+', ''))) {
        return true;
      }
      const phoneRegex = /\+?880\d{10}|\d{11}/g;
      const phones = complaintLower.match(phoneRegex) || [];
      for (const phone of phones) {
        if (normalizePhone(phone) === cpNorm) {
          return true;
        }
      }
      if (hasTransferIntent) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Detects if the top transaction matches are ambiguous (similar scores, different counterparties).
 * When ambiguous, the system should return insufficient_data instead of guessing.
 * @param {Array<{tx: Object, score: number, reasons: string[]} | {tx: Object, score: number, reasons: string[]}>} aggregated - Aggregated transaction scores.
 * @param {string} caseType - Classified case type.
 * @returns {boolean} True if the match is ambiguous and should be rejected.
 */
function isAmbiguousMatch(aggregated, caseType) {
  if (aggregated.length < 2) return false;
  const top = aggregated[0];
  const second = aggregated[1];
  if (top.score <= 0.3) return false;
  if (caseType === 'duplicate_payment') return false;
  if (top.tx.counterparty && second.tx.counterparty && top.tx.counterparty === second.tx.counterparty) return false;
  const gap = top.score - second.score;
  if (gap < 0.1 && top.score < 2.0) return true;
  return false;
}

/**
 * Detects if the complaint is vague or uncertain, indicating the customer doesn't know
 * what specifically went wrong. These should map to 'other' regardless of keyword matches.
 * @param {string} complaintLower - Lowercased complaint text.
 * @returns {boolean} True if the complaint is vague/uncertain.
 */
function isUncertainComplaint(complaintLower) {
  return /not sure|unsure|don'?t know|do not know|confused|unclear|maybe|perhaps|possibly|which one|which transaction|which payment/i.test(complaintLower);
}

function isStrongPaymentFailureSignal(complaintLower) {
  const hasFailureKeyword = /failed|failure|showed failed|app showed failed|says failed|অসফল|ব্যর্থ|money stuck|stuck/.test(complaintLower);
  const hasDeduction = /deducted|deduction|balance|money.*deduct|taken|cut|charge|কেটে|কাটা|ব্যালেন্স|not.*come.*back|not.*reflected|not.*yet/.test(complaintLower);
  return hasFailureKeyword && hasDeduction;
}

/**
 * Classifies the complaint into a case_type using keyword matching with priority ordering.
 * payment_failed takes priority over refund_request when strong failure signals are present.
 * @param {string} complaintLower - Lowercased complaint text.
 * @returns {string} The classified case_type enum value.
 */
function classifyCaseType(complaintLower) {
  if (isUncertainComplaint(complaintLower)) return 'other';

  if (/otp|o t p|pin|password|passcode|full card|card number|credential|scam|fraud|phishing|blocked if|account will be blocked|ওটিপি|ও টি পি|পিন|পাসওয়ার্ড|প্রতার|ব্লক/.test(complaintLower)) {
    return 'phishing_or_social_engineering';
  }

  if (/deducted twice|charged twice|paid twice|duplicate|double payment|twice from|dui bar|duibar|deduct hoise dui|দুইবার|দুবার|ডাবল/.test(complaintLower)) {
    return 'duplicate_payment';
  }

  if (/wrong number|wrong person|sent to wrong|transferred to wrong|wrong account|accidentally sent|by mistake|wrong recipient|ভুল নম্বর|ভুল মানুষ|ভুলে পাঠালাম|ভুল করে পাঠালাম|reverse it|reverse this|cancel the transfer/.test(complaintLower)) {
    return 'wrong_transfer';
  }

  if (/settlement|settled|sales have not|sales of|daily sales|payout|paid out|সেটেল/.test(complaintLower)) {
    return 'merchant_settlement_delay';
  }

  if (/cash.?in|cash-in|cashin|agent|cash deposit|এজেন্ট|ক্যাশ ইন|ক্যাশইন/.test(complaintLower)) {
    return 'agent_cash_in_issue';
  }

  if (isStrongPaymentFailureSignal(complaintLower)) {
    return 'payment_failed';
  }

  if (/refund|return my money|money back|want my money|টাকা ফেরত|ফেরত চাই|ফেরত দিন|রিফান্ড/.test(complaintLower)) {
    return 'refund_request';
  }

  if (/failed|failure|not received|deducted|money stuck|stuck|pending|processing|অসফল|সমস্যা|হয়নি/.test(complaintLower)) {
    return 'payment_failed';
  }

  const scoreMap = {};
  for (const [type, keywords] of Object.entries(TYPE_KEYWORDS)) {
    let score = 0;
    for (const kw of keywords) {
      if (complaintLower.includes(kw.toLowerCase())) {
        score += 1;
      }
    }
    if (score > 0) scoreMap[type] = score;
  }

  if (Object.keys(scoreMap).length > 0) {
    const sorted = Object.entries(scoreMap).sort(function (a, b) { return b[1] - a[1]; });
    if (sorted[0][1] >= 2) return sorted[0][0];
  }

  return 'other';
}

/**
 * Determines case severity based on case type, amounts, complaint text, and transaction status.
 * Applies context-aware overrides for specific scenarios.
 * @param {string} caseType - Classified case type.
 * @param {number[]} complaintAmounts - Amounts extracted from the complaint.
 * @param {string} complaintLower - Lowercased complaint text.
 * @param {Array<Object>} transactionHistory - Customer's recent transaction history.
 * @returns {string} The severity enum value (low, medium, high, critical).
 */
function determineSeverity(caseType, complaintAmounts, complaintLower, transactionHistory) {
  const maxAmount = complaintAmounts.length > 0 ? Math.max(...complaintAmounts) : 0;
  const isSuspicious = SUSPICIOUS_KEYWORDS.some((kw) => complaintLower.includes(kw));

  if (isSuspicious) return 'critical';
  if (maxAmount >= 50000) return 'critical';

  if (caseType === 'phishing_or_social_engineering') return 'critical';

  if (caseType === 'wrong_transfer') {
    if (maxAmount >= 5000) return 'high';
    return 'medium';
  }

  if (caseType === 'duplicate_payment') return 'high';

  if (caseType === 'merchant_settlement_delay') {
    if (maxAmount >= 50000) return 'critical';
    if (maxAmount >= 10000) return 'high';
    return 'medium';
  }

  if (caseType === 'agent_cash_in_issue') return 'high';

  if (caseType === 'payment_failed') {
    if (maxAmount >= 10000) return 'high';
    if (/deducted|balance|taken|cut|charge|কেটে|কাটা|ব্যালেন্স/.test(complaintLower)) return 'high';
    return 'medium';
  }

  if (caseType === 'refund_request') {
    if (maxAmount >= 10000) return 'medium';
    return 'low';
  }

  if (maxAmount >= 50000) return 'critical';
  if (maxAmount >= 10000) return 'high';

  return SEVERITY_CASE_TYPE_MAP[caseType] || 'low';
}

/**
 * Determines whether the case requires human review based on case type, evidence, and severity.
 * @param {string} caseType - Classified case type.
 * @param {string} evidenceVerdict - Evidence verdict (consistent, inconsistent, insufficient_data).
 * @param {string} severity - Case severity level.
 * @param {boolean} isSuspicious - Whether the complaint contains suspicious keywords.
 * @returns {boolean} True if human review is required.
 */
function determineHumanReview(caseType, evidenceVerdict, severity, isSuspicious, maxAmount, complaintLower) {
  if (caseType === 'phishing_or_social_engineering') return true;
  if (severity === 'critical') return true;
  if (isSuspicious) return true;

  if (caseType === 'wrong_transfer') {
    return true;
  }

  if (caseType === 'duplicate_payment') {
    return evidenceVerdict === 'consistent';
  }

  if (caseType === 'merchant_settlement_delay') {
    return false;
  }

  if (caseType === 'agent_cash_in_issue') {
    const agentConfirms = /my terminal|went through|i processed|shows completed|agent report|i see/.test(complaintLower);
    if (agentConfirms) return false;
    return evidenceVerdict === 'consistent';
  }

  if (caseType === 'payment_failed') {
    if (evidenceVerdict === 'inconsistent') return false;
    return severity === 'high';
  }

  if (caseType === 'refund_request') {
    if (evidenceVerdict === 'inconsistent') return false;
    const isRepeatComplaint = /third time|third complaint|multiple times|repeat|again/i.test(complaintLower);
    if (isRepeatComplaint && maxAmount >= 10000) return true;
    return false;
  }

  if (evidenceVerdict === 'inconsistent') return true;
  if (severity === 'high') return true;
  if (evidenceVerdict === 'insufficient_data' && severity !== 'low') return true;

  return false;
}

/**
 * Builds an array of reason codes explaining the evidence analysis decision.
 * @param {string} caseType - Classified case type.
 * @param {string} evidenceVerdict - Evidence verdict.
 * @param {boolean} hasMatch - Whether any transaction matched the complaint.
 * @param {boolean} isSuspicious - Whether the complaint contains suspicious keywords.
 * @param {string[]} matchedReasons - Specific match reasons from signal detection.
 * @returns {string[]} Array of reason code labels.
 */
function buildReasonCodes(caseType, evidenceVerdict, hasMatch, isSuspicious, matchedReasons) {
  const codes = [caseType];
  if (evidenceVerdict === 'consistent') codes.push('transaction_match');
  else if (evidenceVerdict === 'inconsistent') codes.push('transaction_contradiction');
  else codes.push('no_transaction_match');
  if (isSuspicious) codes.push('suspicious_content');
  if (matchedReasons) codes.push(...matchedReasons.slice(0, 3));
  return codes;
}

/**
 * Computes a confidence score (0.0-1.0) based on evidence verdict, match strength, and case type.
 * @param {string} evidenceVerdict - Evidence verdict.
 * @param {number} matchScore - Aggregated match score for the best transaction.
 * @param {string} caseType - Classified case type.
 * @returns {number} Confidence score between 0 and 1.
 */
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

/**
 * Main evidence analysis function. Analyzes a support ticket by matching the complaint against
 * transaction history using multiple signals (amount, time, type, counterparty, status). Produces a
 * structured evidence result with classification, routing, severity, and escalation decisions.
 *
 * @param {Object} ticket - The support ticket object.
 * @param {string} ticket.ticket_id - Unique ticket identifier.
 * @param {string} ticket.complaint - Customer complaint text.
 * @param {Array<Object>} [ticket.transaction_history=[]] - Customer's recent transaction history.
 * @returns {{relevant_transaction_id: string|null, evidence_verdict: string, case_type: string, severity: string, department: string, human_review_required: boolean, confidence: number, reason_codes: string[]}} Structured evidence analysis result.
 */
function getExpectedTransactionType(caseType) {
  switch (caseType) {
    case 'wrong_transfer': return 'transfer';
    case 'payment_failed':
    case 'refund_request':
    case 'duplicate_payment': return 'payment';
    case 'merchant_settlement_delay': return 'settlement';
    case 'agent_cash_in_issue': return 'cash_in';
    default: return null;
  }
}

function getMinimumScore(caseType, complaintAmounts, complaintPhones) {
  if (complaintAmounts.length === 0 && complaintPhones.length === 0) return 0.3;
  return 0.8;
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
    const severity = determineSeverity(caseType, complaintAmounts, complaintLower, transactionHistory);
    const department = CASE_TYPE_TO_DEPARTMENT[caseType];
    const humanReview = determineHumanReview(caseType, 'insufficient_data', severity, isSuspicious, complaintAmounts.length > 0 ? Math.max(...complaintAmounts) : 0, complaintLower);

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
  const statusMatches = matchStatusToTransactions(complaintLower, transactionHistory);

  const allMatches = [...amountMatches, ...timeMatches, ...typeMatches, ...cpMatches, ...statusMatches];
  const aggregated = aggregateScores(allMatches);

  const caseType = classifyCaseType(complaintLower);
  const isSuspicious = SUSPICIOUS_KEYWORDS.some((kw) => complaintLower.includes(kw));
  const severity = determineSeverity(caseType, complaintAmounts, complaintLower, transactionHistory);

  let relevantTransactionId = null;
  let evidenceVerdict = 'insufficient_data';
  let matchScore = 0;
  let matchedReasons = [];

  const minScore = getMinimumScore(caseType, complaintAmounts, []);
  const bestScore = aggregated.length > 0 ? aggregated[0].score : 0;

  if (aggregated.length > 0 && bestScore >= minScore) {
    if (isAmbiguousMatch(aggregated, caseType)) {
      evidenceVerdict = 'insufficient_data';
      relevantTransactionId = null;
      matchScore = aggregated[0].score;
      matchedReasons = ['ambiguous_match_multiple_similar_transactions'];
    } else {
      const best = aggregated[0];

      if (caseType === 'duplicate_payment' && aggregated.length >= 2) {
        const duplicateMatches = aggregated.filter((a) =>
          a.tx.amount === best.tx.amount &&
          a.tx.counterparty === best.tx.counterparty &&
          a.tx.type === best.tx.type &&
          a.tx.status === 'completed' &&
          best.tx.status === 'completed' &&
          Math.abs(new Date(a.tx.timestamp) - new Date(best.tx.timestamp)) <= 10 * 60 * 1000
        );
        if (duplicateMatches.length >= 2) {
          relevantTransactionId = best.tx.transaction_id;
          matchScore = best.score;
          matchedReasons = [...best.reasons, 'suspected_duplicate_second_transaction'];
        } else {
          relevantTransactionId = best.tx.transaction_id;
          matchScore = best.score;
          matchedReasons = best.reasons;
        }
      } else {
        relevantTransactionId = best.tx.transaction_id;
        matchScore = best.score;
        matchedReasons = best.reasons;
      }

      if (caseType === 'phishing_or_social_engineering') {
        const isUnauthorizedActivity = /never made|not my|didn't make|did not make|not recognize|unrecognized|unauthorized|freeze|stolen|hacked|compromised/.test(complaintLower);
        if (isUnauthorizedActivity && relevantTransactionId) {
          evidenceVerdict = 'consistent';
        } else {
          evidenceVerdict = 'insufficient_data';
          relevantTransactionId = null;
        }
      } else if (caseType === 'other') {
        evidenceVerdict = 'insufficient_data';
      } else if (caseType === 'duplicate_payment') {
        const isDuplicatePair = caseType === 'duplicate_payment' &&
          aggregated.length >= 2 &&
          aggregated.filter((a) =>
            a.tx.amount === best.tx.amount &&
            a.tx.counterparty === best.tx.counterparty &&
            a.tx.type === best.tx.type &&
            a.tx.status === 'completed' &&
            best.tx.status === 'completed' &&
            Math.abs(new Date(a.tx.timestamp) - new Date(best.tx.timestamp)) <= 10 * 60 * 1000
          ).length >= 2;
        evidenceVerdict = isDuplicatePair ? 'consistent' : 'inconsistent';
      } else {
        switch (caseType) {
          case 'wrong_transfer':
            if (detectEstablishedRecipient(transactionHistory, complaintLower)) {
              evidenceVerdict = 'inconsistent';
            } else if (best.tx.type !== 'transfer') {
              evidenceVerdict = 'inconsistent';
            } else if (best.tx.status === 'failed' || best.tx.status === 'reversed') {
              evidenceVerdict = 'inconsistent';
            } else if (best.tx.status === 'pending') {
              evidenceVerdict = 'insufficient_data';
            } else {
              evidenceVerdict = 'consistent';
            }
            break;
          case 'payment_failed':
            if (best.tx.type !== 'payment') {
              evidenceVerdict = 'inconsistent';
            } else if (best.tx.status === 'failed' || best.tx.status === 'pending') {
              evidenceVerdict = 'consistent';
            } else {
              evidenceVerdict = 'inconsistent';
            }
            break;
          case 'refund_request':
            if (best.tx.status === 'completed') {
              evidenceVerdict = 'consistent';
            } else if (best.tx.status === 'failed' || best.tx.status === 'reversed') {
              evidenceVerdict = 'inconsistent';
            } else {
              evidenceVerdict = 'insufficient_data';
            }
            break;
          case 'merchant_settlement_delay':
            if (best.tx.type !== 'settlement') {
              evidenceVerdict = 'inconsistent';
            } else if (best.tx.status === 'pending') {
              evidenceVerdict = 'consistent';
            } else {
              evidenceVerdict = 'inconsistent';
            }
            break;
          case 'agent_cash_in_issue':
            if (best.tx.type !== 'cash_in') {
              evidenceVerdict = 'inconsistent';
            } else if (best.tx.status === 'completed') {
              const agentConfirms = /my terminal|went through|i processed|shows completed|agent report|i see/.test(complaintLower);
              evidenceVerdict = agentConfirms ? 'consistent' : 'inconsistent';
            } else if (best.tx.status === 'pending' || best.tx.status === 'failed') {
              evidenceVerdict = 'consistent';
            } else {
              evidenceVerdict = 'inconsistent';
            }
            break;
          default:
            evidenceVerdict = 'consistent';
        }
      }
    }
  } else {
    const expectedType = getExpectedTransactionType(caseType);
    const typedMatches = expectedType
      ? transactionHistory.filter((tx) => tx.type === expectedType)
      : [];
    if (typedMatches.length === 1) {
      relevantTransactionId = typedMatches[0].transaction_id;
      matchScore = 1;
      matchedReasons = ['single_type_match'];
    } else {
      evidenceVerdict = 'insufficient_data';
    }
  }

  const department = CASE_TYPE_TO_DEPARTMENT[caseType];

  let finalDepartment = department;
  if (caseType === 'refund_request') {
    const maxAmt = complaintAmounts.length > 0 ? Math.max(...complaintAmounts) : 0;
    const isRepeatComplaint = /third time|third complaint|multiple times|repeat|again/i.test(complaintLower);
    if (isRepeatComplaint || maxAmt >= 10000) {
      finalDepartment = 'dispute_resolution';
    }
  }

  if (evidenceVerdict === 'inconsistent' && (caseType === 'payment_failed' || caseType === 'agent_cash_in_issue')) {
    finalDepartment = 'customer_support';
  }

  if (evidenceVerdict === 'inconsistent' && caseType === 'duplicate_payment') {
    finalDepartment = 'customer_support';
  }

  let finalSeverity = severity;
  let finalHumanReview = determineHumanReview(caseType, evidenceVerdict, severity, isSuspicious, complaintAmounts.length > 0 ? Math.max(...complaintAmounts) : 0, complaintLower);

  if (caseType === 'wrong_transfer' && evidenceVerdict === 'inconsistent' && detectEstablishedRecipient(transactionHistory, complaintLower)) {
    finalSeverity = 'high';
    finalHumanReview = true;
  }

  if (caseType === 'phishing_or_social_engineering' && evidenceVerdict === 'consistent' && transactionHistory.length > 0) {
    const expectedType = getExpectedTransactionType(caseType);
    const matching = transactionHistory.filter(function (tx) { return !expectedType || tx.type === expectedType; });
    if (matching.length > 0) {
      matching.sort(function (a, b) { return new Date(a.timestamp) - new Date(b.timestamp); });
      relevantTransactionId = matching[0].transaction_id;
    }
  }

  if (caseType === 'duplicate_payment' && evidenceVerdict === 'inconsistent') {
    finalSeverity = 'low';
  }

  if (caseType === 'agent_cash_in_issue' && evidenceVerdict === 'inconsistent') {
    finalSeverity = 'low';
  }

  if (caseType === 'agent_cash_in_issue' && evidenceVerdict === 'consistent') {
    const agentConfirms = /my terminal|went through|i processed|shows completed|agent report|i see/.test(complaintLower);
    if (agentConfirms) finalSeverity = 'medium';
  }

  if ((caseType === 'merchant_settlement_delay' || caseType === 'payment_failed') && evidenceVerdict === 'inconsistent') {
    finalSeverity = 'low';
  }

  if (caseType === 'refund_request' && evidenceVerdict === 'consistent') {
    const maxAmt = complaintAmounts.length > 0 ? Math.max(...complaintAmounts) : 0;
    if (maxAmt >= 10000) finalSeverity = 'high';
  }

  const confidence = computeConfidence(evidenceVerdict, matchScore, caseType);
  const reasonCodes = buildReasonCodes(caseType, evidenceVerdict, aggregated.length > 0, isSuspicious, matchedReasons);

  return {
    relevant_transaction_id: relevantTransactionId,
    evidence_verdict: evidenceVerdict,
    case_type: caseType,
    severity: finalSeverity,
    department: finalDepartment,
    human_review_required: finalHumanReview,
    confidence,
    reason_codes: reasonCodes,
  };
}

module.exports = { analyzeEvidence };
