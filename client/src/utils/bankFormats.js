/**
 * Metrobank (MBOS) upload-file vocabularies.
 * Mirrors server/src/services/bank-file.service.js — keep the two in sync.
 */

// Column A of the ISO 20022 EFT file. The value stored on the employee is the
// label; the server maps it (and legacy free text) to the numeric code.
export const REMITTANCE_OPTIONS = [
  { value: 'Foreign Transfer', label: 'Foreign Transfer (4)' },
  { value: 'RTGS',    label: 'RTGS (0)' },
  { value: 'PDDTS',   label: 'PDDTS (1)' },
  { value: 'PESONet', label: 'PESONet (2)' },
  { value: 'GSRT',    label: 'GSRT (3)' },
];

// ANNEX A purpose codes — all currencies except CNY.
export const PURPOSE_OPTIONS = [
  { value: 'SALA', label: 'SALA — Salary' },
  { value: 'ALLW', label: 'ALLW — Allowance' },
  { value: 'COMM', label: 'COMM — Commission' },
  { value: 'SERV', label: 'SERV — Services' },
  { value: 'RRCT', label: 'RRCT — Reimbursement' },
  { value: 'SUPP', label: 'SUPP — Supplier Payment' },
  { value: 'DIVD', label: 'DIVD — Dividend' },
  { value: 'INVS', label: 'INVS — Investment' },
  { value: 'LOAN', label: 'LOAN — Loan Payout' },
  { value: 'ADCS', label: 'ADCS — Advertising' },
  { value: 'ROYA', label: 'ROYA — Royalties' },
  { value: 'AIRB', label: 'AIRB — Air Freight Charges' },
  { value: 'FERB', label: 'FERB — Sea Freight Charges' },
  { value: 'TAXS', label: 'TAXS — Tax Payment' },
  { value: 'GDDS', label: 'GDDS — Purchase and Sale of Goods' },
  { value: 'BOND', label: 'BOND — Settlement of Bond' },
  { value: 'CHAR', label: 'CHAR — Charity and Donation' },
  { value: 'CBFF', label: 'CBFF — Capital' },
  { value: 'CASH', label: 'CASH — Cash Management Transfer' },
  { value: 'OTHR', label: 'OTHR — Other Payment Purpose' },
];

// CNY transfers accept only these four.
export const CNY_PURPOSE_OPTIONS = [
  { value: 'GOD', label: 'GOD — Goods Trade' },
  { value: 'STR', label: 'STR — Service Trade' },
  { value: 'CTF', label: 'CTF — Capital Transfer' },
  { value: 'OCA', label: 'OCA — Other Current Accounts Transfer' },
];

export function purposeOptionsFor(currency) {
  return String(currency || '').toUpperCase() === 'CNY' ? CNY_PURPOSE_OPTIONS : PURPOSE_OPTIONS;
}

// Currencies MBOS accepts for a Foreign Transfer, plus PHP for domestic payroll.
export const MBOS_CURRENCIES = [
  { value: 'PHP', label: 'PHP ₱' },
  { value: 'USD', label: 'USD $' },
  { value: 'EUR', label: 'EUR €' },
  { value: 'GBP', label: 'GBP £' },
  { value: 'CHF', label: 'CHF' },
  { value: 'JPY', label: 'JPY ¥' },
  { value: 'AUD', label: 'AUD $' },
  { value: 'CAD', label: 'CAD $' },
  { value: 'HKD', label: 'HKD $' },
  { value: 'SGD', label: 'SGD $' },
  { value: 'CNY', label: 'CNY ¥' },
];
