const XLSX = require('xlsx');

/**
 * Metrobank Business Online Solutions (MBOS) upload file builders.
 *
 * Two formats, taken verbatim from the templates the bank supplied:
 *
 *  • ISO 20022 EFT XLS ("ISO20022EFTXLS TEMPLATE_2026.xls")
 *    52 columns (A..AZ), Excel 97-2003 workbook (*.xls). Covers both domestic
 *    (RTGS / PDDTS / PESONet / GSRT) and Foreign Transfer — they differ only in
 *    which columns are mandatory, driven by the Remittance Type in column A.
 *    Uploading an *.xlsx here is what makes MBOS answer with the
 *    "Metrobank B.O.S. Advisory" page instead of accepting the batch.
 *
 *  • Standard TAMA XLS ("STANDARD TAMA XLS FILE FORMAT.xlsx")
 *    9 columns, Transfer to Another Metrobank Account.
 */

// ── Column headers (exactly as in the bank templates, order matters) ─────────
const ISO_HEADERS = [
  'Remittance Type', 'Amount', 'Transfer Currency', 'Sender Account No.',
  'Purpose Code', 'Purpose Description', 'Remarks', 'Beneficiary Account No.',
  'Beneficiary IBAN', 'Charge Type', 'Sender Town/City', 'Sender Postal Code',
  'Sender Country', 'Beneficiary Customer Code', 'Beneficiary Name Prefix',
  'Beneficiary Customer Type', 'Beneficiary Corporate Name', 'Beneficiary First Name',
  'Beneficiary Middle Name', 'Beneficiary Last Name', 'Beneficiary Building No.',
  'Beneficiary Building Name', 'Beneficiary Street Name', 'Beneficiary Town/City',
  'Beneficiary Postal Code', 'Beneficiary Country', 'Beneficiary Full Address',
  'Beneficiary Phone No.', 'Beneficiary Mobile No.', 'Beneficiary Email Address',
  'Beneficiary Bank', 'Beneficiary Bank SWIFT Code', 'Beneficiary Bank Address',
  'Intermediary Bank', 'Intermediary Bank SWIFT Code', 'Intermediary Bank Address',
  'Ultimate Debtor Customer Type', 'Ultimate Debtor Corporate Name',
  'Ultimate Debtor First Name', 'Ultimate Debtor Middle Name', 'Ultimate Debtor Last Name',
  'Ultimate Debtor Town/City', 'Ultimate Debtor Postal Code', 'Ultimate Debtor Country',
  'Ultimate Creditor Customer Type', 'Ultimate Creditor Corporate Name',
  'Ultimate Creditor First Name', 'Ultimate Creditor Middle Name', 'Ultimate Creditor Last Name',
  'Ultimate Creditor Town/City', 'Ultimate Creditor Postal Code', 'Ultimate Creditor Country',
];

const TAMA_HEADERS = [
  'Corporate Code', 'Client Reference Number', 'Last Name', 'First Name',
  'Middle Name', 'Destination Account', 'Amount', 'Remarks', 'Beneficiary E-mail',
];

// Max field lengths per the ISO 20022 EFT XLS spec, by column index.
const ISO_MAX = [
  1, 15, 3, 13, 4, 35, 140, 34, 34, 1, 35, 16, 35, 15, 4, 1, 140, 50, 40, 50,
  16, 35, 70, 35, 16, 35, 255, 35, 35, 140, 255, 20, 255, 11, 11, 255,
  20, 140, 50, 40, 50, 35, 16, 35, 20, 140, 50, 40, 50, 35, 16, 35,
];

// ── Remittance types (column A) ─────────────────────────────────────────────
const REMITTANCE_TYPES = { RTGS: 0, PDDTS: 1, PESONET: 2, GSRT: 3, FOREIGN: 4 };
const FOREIGN = REMITTANCE_TYPES.FOREIGN;

const REMITTANCE_ALIASES = {
  RTGS: 0, PDDTS: 1, PESONET: 2, 'PESO NET': 2, GSRT: 3,
  FOREIGN: 4, 'FOREIGN TRANSFER': 4, FT: 4, DFT: 4, TT: 4,
  SWIFT: 4, WIRE: 4, 'WIRE TRANSFER': 4, TELEGRAPHIC: 4,
};

// ── Purpose codes (ANNEX A) ─────────────────────────────────────────────────
const PURPOSE_CODES = {
  ALLW: 'ALLOWANCE', COMM: 'COMMISSION', DIVD: 'DIVIDEND', INVS: 'INVESTMENT',
  LOAN: 'LOAN PAYOUT', RRCT: 'REIMBURSEMENT', SALA: 'SALARY', ADCS: 'ADVERTISING',
  ROYA: 'ROYALTIES', SUPP: 'SUPPLIER PAYMENT', AIRB: 'AIR FREIGHT CHARGES',
  FERB: 'SEA FREIGHT CHARGES', TAXS: 'TAX PAYMENT', GDDS: 'PURCHASE AND SALE OF GOODS',
  OTHR: 'OTHER PAYMENT PURPOSE', BOND: 'SETTLEMENT OF BOND', CHAR: 'CHARITY AND DONATION',
  SERV: 'SERVICES', CBFF: 'CAPITAL', CASH: 'CASH MANAGEMENT TRANSFER',
};
// CNY accepts only its own four codes.
const CNY_PURPOSE_CODES = { GOD: 'GOODS TRADE', STR: 'SERVICE TRADE', CTF: 'CAPITAL TRANSFER', OCA: 'OTHER CURRENT ACCOUNTS TRANSFER' };
const DEFAULT_PURPOSE_CODE = 'SALA';
const DEFAULT_CNY_PURPOSE_CODE = 'OCA';

const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'CHF', 'JPY', 'AUD', 'CAD', 'HKD', 'SGD', 'CNY'];

// Characters MBOS rejects in any field (FAQ #2 of the EFT format guide).
const PROHIBITED = /[`~!@#$%^&*_\-={}[\]|\\;"<>]/g;

/**
 * Strip everything MBOS refuses to parse: prohibited punctuation, Ñ/ñ, and any
 * remaining non-ASCII (accents are folded first so "José" becomes "Jose").
 * Email fields keep `@ . _ -` since those are structural.
 */
function sanitize(value, maxLength = null, { email = false } = {}) {
  if (value === null || value === undefined) return '';
  let out = String(value)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // fold accents
    .replace(/Ñ/g, 'N').replace(/ñ/g, 'n');
  out = email
    ? out.replace(/[`~!#$%^&*={}[\]|\\;"<>]/g, '')
    : out.replace(PROHIBITED, ' ');
  out = out.replace(/[^\x20-\x7E]/g, ' ').replace(/\s+/g, ' ').trim();
  if (maxLength && out.length > maxLength) out = out.slice(0, maxLength).trim();
  return out;
}

/** Amount as a number with 2 decimals — MBOS wants a dot separator and no thousands comma. */
function amount(value) {
  return Math.round((parseFloat(value) || 0) * 100) / 100;
}

/** Account numbers: digits only, no spaces and no dashes. */
function accountNumber(value, maxLength) {
  const digits = String(value ?? '').replace(/\D/g, '');
  return maxLength ? digits.slice(0, maxLength) : digits;
}

/**
 * Resolve an employee's free-text remittance_type to the numeric code in column A.
 * Falls back to Foreign Transfer for foreign hires, PESONet otherwise.
 */
function resolveRemittanceType(emp) {
  const raw = String(emp.remittance_type ?? '').trim().toUpperCase();
  if (/^[0-4]$/.test(raw)) return parseInt(raw, 10);
  if (REMITTANCE_ALIASES[raw] !== undefined) return REMITTANCE_ALIASES[raw];
  const collapsed = raw.replace(/[^A-Z]/g, '');
  if (REMITTANCE_ALIASES[collapsed] !== undefined) return REMITTANCE_ALIASES[collapsed];
  return emp.hire_category === 'foreign' ? FOREIGN : REMITTANCE_TYPES.PESONET;
}

/** Resolve purpose_nature (free text or a code) to a valid ANNEX A purpose code. */
function resolvePurposeCode(emp, currency) {
  const raw = String(emp.purpose_nature ?? '').trim().toUpperCase();
  const isCny = String(currency ?? '').toUpperCase() === 'CNY';
  const table = isCny ? CNY_PURPOSE_CODES : PURPOSE_CODES;

  if (table[raw]) return raw;
  const byDescription = Object.keys(table).find(code => table[code] === raw);
  if (byDescription) return byDescription;

  const fallback = process.env.BANK_PURPOSE_CODE
    ? String(process.env.BANK_PURPOSE_CODE).trim().toUpperCase()
    : null;
  if (fallback && table[fallback]) return fallback;
  return isCny ? DEFAULT_CNY_PURPOSE_CODE : DEFAULT_PURPOSE_CODE;
}

/** Sender/company details shared by every row, read from the environment. */
function senderConfig() {
  const chargeTypeRaw = String(process.env.BANK_CHARGE_TYPE ?? '0').trim();
  return {
    account:    accountNumber(process.env.BANK_SOURCE_ACCOUNT, 13),
    townCity:   sanitize(process.env.BANK_SENDER_CITY || process.env.PAYOR_CITY, 35),
    postalCode: sanitize(process.env.BANK_SENDER_POSTAL_CODE || process.env.PAYOR_ZIP_CODE, 16),
    country:    sanitize(process.env.BANK_SENDER_COUNTRY || process.env.PAYOR_COUNTRY || 'Philippines', 35),
    chargeType: /^[0-2]$/.test(chargeTypeRaw) ? parseInt(chargeTypeRaw, 10) : 0,
    debtorName: sanitize(process.env.PAYOR_NAME, 140),
    corporateCode: sanitize(process.env.BANK_CORPORATE_CODE, 255),
  };
}

/** Config the ISO 20022 file cannot be built without. Returns a list of env var names. */
function missingIsoConfig(cfg, needsForeignFields) {
  const missing = [];
  if (!cfg.account) missing.push('BANK_SOURCE_ACCOUNT');
  if (needsForeignFields) {
    if (!cfg.townCity)   missing.push('BANK_SENDER_CITY');
    if (!cfg.country)    missing.push('BANK_SENDER_COUNTRY');
    if (!cfg.debtorName) missing.push('PAYOR_NAME');
  }
  return missing;
}

/**
 * Everything the ISO 20022 row needs, given its remittance type. `netAmount` is
 * optional; pass it to also catch amounts MBOS would reject outright.
 */
function missingIsoFields(emp, remittanceType, netAmount = null) {
  const missing = [];
  const need = (value, label) => { if (!String(value ?? '').trim()) missing.push(label); };

  need(emp.first_name, 'First Name');
  need(emp.last_name, 'Last Name');
  need(accountNumber(emp.bank_account_number), 'Bank Account Number');
  need(emp.bank_swift_code, 'SWIFT Code');
  need(emp.bank_address, 'Beneficiary Bank Address');
  need(emp.country_of_destination, 'Country of Destination');

  if (remittanceType === FOREIGN) {
    const currency = String(emp.currency ?? '').trim().toUpperCase();
    need(currency, 'Currency');
    if (currency && !SUPPORTED_CURRENCIES.includes(currency)) {
      missing.push(`Currency ${currency} not accepted (${SUPPORTED_CURRENCIES.join(', ')})`);
    }
    // JPY transfers must be at least 5,000 and a whole multiple of 1,000.
    if (currency === 'JPY' && netAmount !== null) {
      const value = amount(netAmount);
      if (value < 5000 || value % 1000 !== 0) missing.push('JPY amount (min 5000, multiples of 1000)');
    }
    need(emp.beneficiary_building_no, 'Beneficiary Building No.');
    need(emp.beneficiary_building_name, 'Beneficiary Building Name');
    need(emp.beneficiary_street, 'Beneficiary Street Name');
    need(emp.beneficiary_city, 'Beneficiary Town/City');
  } else {
    need(emp.beneficiary_address, 'Beneficiary Address');
  }
  return missing;
}

/** Employee fields the TAMA row needs. */
function missingTamaFields(emp) {
  const missing = [];
  if (!String(emp.first_name ?? '').trim()) missing.push('First Name');
  if (!String(emp.last_name ?? '').trim()) missing.push('Last Name');
  if (!accountNumber(emp.bank_account_number)) missing.push('Bank Account Number');
  return missing;
}

/**
 * One ISO 20022 row, from an { emp, netAmount, reference, remarks } entry.
 * Empty optional cells are left as null so they render as truly blank cells,
 * matching the bank's own template.
 */
function buildIsoRow({ emp, netAmount, reference, remarks }, cfg) {
  const remittanceType = resolveRemittanceType(emp);
  const isForeign = remittanceType === FOREIGN;
  const currency  = sanitize(emp.currency, 3).toUpperCase();
  const swift     = sanitize(emp.bank_swift_code, 20).toUpperCase();
  const intSwift  = sanitize(emp.intermediary_bank_swift, 11).toUpperCase();

  const row = new Array(ISO_HEADERS.length).fill(null);
  const set = (index, value, options) => {
    if (value === null || value === undefined || value === '') return;
    row[index] = typeof value === 'number' ? value : sanitize(value, ISO_MAX[index], options);
  };

  set(0, remittanceType);
  set(1, amount(netAmount));
  set(2, currency);
  set(3, cfg.account);
  set(7, accountNumber(emp.bank_account_number, 34));
  set(12, cfg.country);
  set(15, 0);                                     // Beneficiary Customer Type: 0 = Individual
  set(17, emp.first_name);
  set(18, emp.middle_name);
  set(19, emp.last_name);
  set(25, emp.country_of_destination);
  set(30, swift);                                 // "Beneficiary Bank" holds the SWIFT code too
  set(31, swift);
  set(32, emp.bank_address);

  if (isForeign) {
    set(4, resolvePurposeCode(emp, currency));
    set(5, reference);
    set(6, remarks);
    set(9, cfg.chargeType);
    set(10, cfg.townCity);
    set(11, cfg.postalCode);
    set(20, emp.beneficiary_building_no);
    set(21, emp.beneficiary_building_name);
    set(22, emp.beneficiary_street);
    set(23, emp.beneficiary_city);
    set(24, emp.beneficiary_postal_code);
    set(29, emp.email, { email: true });
    if (intSwift) {
      set(33, intSwift);
      set(34, intSwift);
      set(35, emp.intermediary_bank_address);
    }
    // Ultimate Debtor — the company sending the payroll
    set(36, 'Corporation');
    set(37, cfg.debtorName);
    set(41, cfg.townCity);
    set(42, cfg.postalCode);
    set(43, cfg.country);
    // Ultimate Creditor — the employee being paid
    set(44, 'Individual');
    set(46, emp.first_name);
    set(47, emp.middle_name);
    set(48, emp.last_name);
    set(49, emp.beneficiary_city);
    set(50, emp.beneficiary_postal_code);
    set(51, emp.country_of_destination);
  } else {
    set(6, remarks);
    set(26, emp.beneficiary_address);             // domestic uses the single full-address column
  }

  return row;
}

/** One TAMA row. */
function buildTamaRow({ emp, netAmount, reference, remarks }, cfg) {
  return [
    cfg.corporateCode || null,
    sanitize(reference, 255) || null,
    sanitize(emp.last_name, 255),
    sanitize(emp.first_name, 255),
    sanitize(emp.middle_name, 100) || null,
    accountNumber(emp.bank_account_number, 13),
    amount(netAmount),
    sanitize(remarks, 255) || null,
    sanitize(emp.email, 255, { email: true }) || null,
  ];
}

/**
 * Serialize rows to a workbook buffer. bookType 'biff8' produces a real *.xls.
 * Amounts are numeric cells forced to two decimals so they never render as
 * "12345.6" or pick up a thousands separator.
 */
function writeWorkbook(sheetData, sheetName, bookType, amountColumn) {
  const ws = XLSX.utils.aoa_to_sheet(sheetData);
  for (let r = 1; r < sheetData.length; r++) {
    const cell = ws[XLSX.utils.encode_cell({ r, c: amountColumn })];
    if (cell && cell.t === 'n') cell.z = '0.00';
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return XLSX.write(wb, { type: 'buffer', bookType });
}

/**
 * ISO 20022 EFT file — Excel 97-2003 (*.xls), as the format spec requires.
 * `entries` are { emp, netAmount, reference, remarks }.
 */
function buildIsoFile(entries) {
  const cfg = senderConfig();
  const needsForeignFields = entries.some(e => resolveRemittanceType(e.emp) === FOREIGN);
  const missingConfig = missingIsoConfig(cfg, needsForeignFields);
  if (missingConfig.length) {
    throw new Error(`Bank file configuration incomplete — set ${missingConfig.join(', ')} in the server environment.`);
  }
  const sheetData = [ISO_HEADERS, ...entries.map(e => buildIsoRow(e, cfg))];
  return {
    content: writeWorkbook(sheetData, 'Sheet 1', 'biff8', 1),
    extension: 'xls',
    contentType: 'application/vnd.ms-excel',
  };
}

/** TAMA file — matches the bank's *.xlsx template. */
function buildTamaFile(entries) {
  const cfg = senderConfig();
  if (!cfg.corporateCode) {
    throw new Error('Bank file configuration incomplete — set BANK_CORPORATE_CODE in the server environment.');
  }
  const sheetData = [TAMA_HEADERS, ...entries.map(e => buildTamaRow(e, cfg))];
  return {
    content: writeWorkbook(sheetData, 'Sheet1', 'xlsx', 6),
    extension: 'xlsx',
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
}

module.exports = {
  ISO_HEADERS,
  TAMA_HEADERS,
  REMITTANCE_TYPES,
  PURPOSE_CODES,
  CNY_PURPOSE_CODES,
  SUPPORTED_CURRENCIES,
  sanitize,
  amount,
  accountNumber,
  resolveRemittanceType,
  resolvePurposeCode,
  missingIsoFields,
  missingTamaFields,
  buildIsoFile,
  buildTamaFile,
};
