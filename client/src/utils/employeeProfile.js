import { isMetrobankAccount } from './bankFormats';

const LOCAL_REQUIRED = [
  { key: 'first_name', label: 'First Name' },
  { key: 'last_name', label: 'Last Name' },
  { key: 'bank_account_number', label: 'Bank Account Number' },
];

// Mirrors missingIsoFields() in server/src/services/bank-file.service.js —
// what the ISO 20022 EFT file needs for a Foreign Transfer row.
const FOREIGN_REQUIRED = [
  { key: 'first_name', label: 'First Name' },
  { key: 'last_name', label: 'Last Name' },
  { key: 'bank_account_number', label: 'Bank Account Number' },
  { key: 'bank_swift_code', label: 'SWIFT Code' },
  { key: 'bank_address', label: 'Beneficiary Bank Address' },
  { key: 'country_of_destination', label: 'Country of Destination' },
  { key: 'currency', label: 'Currency' },
  { key: 'beneficiary_building_no', label: 'Beneficiary Building No.' },
  { key: 'beneficiary_building_name', label: 'Beneficiary Building Name' },
  { key: 'beneficiary_street', label: 'Beneficiary Street Name' },
  { key: 'beneficiary_city', label: 'Beneficiary Town/City' },
];

// A foreign hire sent over a domestic rail (RTGS / PDDTS / PESONet / GSRT) uses
// the single full-address column instead of the split address parts.
const DOMESTIC_RAILS = ['0', '1', '2', '3', 'RTGS', 'PDDTS', 'PESONET', 'PESO NET', 'GSRT'];
const FOREIGN_DOMESTIC_RAIL_REQUIRED = [
  ...FOREIGN_REQUIRED.filter(f => !f.key.startsWith('beneficiary_') && f.key !== 'currency'),
  { key: 'beneficiary_address', label: 'Beneficiary Address' },
];

function isDomesticRail(emp) {
  const raw = String(emp.remittance_type || '').trim().toUpperCase();
  return DOMESTIC_RAILS.includes(raw);
}

export function getMissingBankFields(emp) {
  if (emp.hire_category === 'foreign') {
    const required = isDomesticRail(emp) ? FOREIGN_DOMESTIC_RAIL_REQUIRED : FOREIGN_REQUIRED;
    return required.filter(f => !emp[f.key]).map(f => f.label);
  }
  const missing = LOCAL_REQUIRED.filter(f => !emp[f.key]).map(f => f.label);
  // The local file is TAMA, which only reaches Metrobank accounts.
  if (!isMetrobankAccount(emp.bank_name)) missing.push(`Metrobank account (has ${String(emp.bank_name).trim()})`);
  return missing;
}

export function isBankProfileComplete(emp) {
  return getMissingBankFields(emp).length === 0;
}
