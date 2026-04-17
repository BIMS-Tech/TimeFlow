const LOCAL_REQUIRED = [
  { key: 'first_name', label: 'First Name' },
  { key: 'last_name', label: 'Last Name' },
  { key: 'bank_account_number', label: 'Bank Account Number' },
];

const FOREIGN_REQUIRED = [
  { key: 'first_name', label: 'First Name' },
  { key: 'last_name', label: 'Last Name' },
  { key: 'bank_account_number', label: 'Bank Account Number' },
  { key: 'bank_name', label: 'Bank Name' },
  { key: 'bank_swift_code', label: 'SWIFT Code' },
  { key: 'beneficiary_address', label: 'Beneficiary Address' },
  { key: 'country_of_destination', label: 'Country of Destination' },
  { key: 'purpose_nature', label: 'Purpose / Nature' },
  { key: 'remittance_type', label: 'Remittance Type' },
];

export function getMissingBankFields(emp) {
  const required = emp.hire_category === 'foreign' ? FOREIGN_REQUIRED : LOCAL_REQUIRED;
  return required.filter(f => !emp[f.key]).map(f => f.label);
}

export function isBankProfileComplete(emp) {
  return getMissingBankFields(emp).length === 0;
}
