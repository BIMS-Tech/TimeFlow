'use strict';

// SSS 2025 Contribution Table
// Each row: [maxSalary (exclusive upper bound), eeShare, mpfEE]
const SSS_BRACKETS = [
  [5250,     250, 0],
  [5750,     275, 0],
  [6250,     300, 0],
  [6750,     325, 0],
  [7250,     350, 0],
  [7750,     375, 0],
  [8250,     400, 0],
  [8750,     425, 0],
  [9250,     450, 0],
  [9750,     475, 0],
  [10250,    500, 0],
  [10750,    525, 0],
  [11250,    550, 0],
  [11750,    575, 0],
  [12250,    600, 0],
  [12750,    625, 0],
  [13250,    650, 0],
  [13750,    675, 0],
  [14250,    700, 0],
  [14750,    725, 0],
  [15250,    750, 0],
  [15750,    775, 0],
  [16250,    800, 0],
  [16750,    825, 0],
  [17250,    850, 0],
  [17750,    875, 0],
  [18250,    900, 0],
  [18750,    925, 0],
  [19250,    950, 0],
  [19750,    975, 0],
  [20250,   1000, 0],
  [20750,   1000,  25],
  [21250,   1000,  50],
  [21750,   1000,  75],
  [22250,   1000, 100],
  [22750,   1000, 125],
  [23250,   1000, 150],
  [23750,   1000, 175],
  [24250,   1000, 200],
  [24750,   1000, 225],
  [25250,   1000, 250],
  [25750,   1000, 275],
  [26250,   1000, 300],
  [26750,   1000, 325],
  [27250,   1000, 350],
  [27750,   1000, 375],
  [28250,   1000, 400],
  [28750,   1000, 425],
  [29250,   1000, 450],
  [29750,   1000, 475],
  [30250,   1000, 500],
  [30750,   1000, 525],
  [31250,   1000, 550],
  [31750,   1000, 575],
  [32250,   1000, 600],
  [32750,   1000, 625],
  [33250,   1000, 650],
  [33750,   1000, 675],
  [34250,   1000, 700],
  [34750,   1000, 725],
  [Infinity, 1000, 750],
];

// BIR TRAIN law — semi-monthly withholding tax brackets
// [maxTaxable (exclusive), fixedTax, excessRate, floor]
const BIR_BRACKETS = [
  [10417.01,      0,       0,    0],
  [16667.00,      0,    0.15, 10417.01],
  [33333.00,    937.50,  0.20, 16667.00],
  [83333.00,   4270.70,  0.25, 33333.00],
  [333333.00, 16770.70,  0.30, 83333.00],
  [Infinity,  91770.70,  0.35, 333333.00],
];

const FULL_DEDUCTION_TYPES = ['FTE-LCL', 'PTE-WB'];
const TAX_ONLY_TYPES       = ['PTE-WOB'];
const NO_DEDUCTION_TYPES   = ['FTE-INTL', 'PTE-INTL', 'PB-INTL', 'PB-LCL'];

// Derive local/foreign from employee_type for bank file routing
function getHireCategory(employeeType) {
  if (!employeeType) return 'local';
  if (['FTE-INTL', 'PTE-INTL', 'PB-INTL'].includes(employeeType)) return 'foreign';
  return 'local';
}

function getSSSContributions(monthlySalary) {
  for (const [maxSalary, eeShare, mpfEE] of SSS_BRACKETS) {
    if (monthlySalary < maxSalary) return { eeShare, mpfEE };
  }
  return { eeShare: 1000, mpfEE: 750 };
}

// PhilHealth EE contribution — only deducted on 1st cut-off
// Monthly EE = monthly_salary × 2.5% (capped at ₱90,000 basis)
function getPhilHealthForCutoff(monthlySalary, cutoff) {
  if (cutoff !== 1) return 0;
  const basis = Math.min(monthlySalary, 90000);
  if (basis <= 10000) return 500;
  return Math.round(basis * 0.025 * 100) / 100;
}

// Pag-IBIG mandatory employee share — only deducted on 1st cut-off
function getPagIBIGForCutoff(monthlySalary, cutoff) {
  if (cutoff !== 1) return 0;
  return monthlySalary <= 1500 ? 100 : 200;
}

// BIR withholding tax on semi-monthly taxable income (TRAIN law)
function getBIRTax(semiMonthlyTaxable) {
  if (semiMonthlyTaxable <= 0) return 0;
  for (const [maxTaxable, fixedTax, rate, floor] of BIR_BRACKETS) {
    if (semiMonthlyTaxable < maxTaxable) {
      return fixedTax + (semiMonthlyTaxable - floor) * rate;
    }
  }
  return 0;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Compute all payroll deductions for a single cut-off payslip.
 *
 * @param {string} employeeType  - e.g. 'FTE-LCL', 'PTE-WB', 'PTE-WOB', 'FTE-INTL', etc.
 * @param {number} semiMonthlyGross - gross pay for this 15-day period
 * @param {object} period - { start_date } — used to determine 1st vs 2nd cut-off
 * @returns {object} deduction breakdown + total
 */
function computeDeductions(employeeType, semiMonthlyGross, period) {
  const zero = { sssEE: 0, sssMPF: 0, philhealthEE: 0, pagibigEE: 0, birTax: 0, total: 0, cutoff: 0 };

  if (!employeeType || NO_DEDUCTION_TYPES.includes(employeeType)) return zero;

  // Determine cut-off: day 1–15 = 1st, day 16+ = 2nd
  const startDateStr = period.start_date instanceof Date
    ? period.start_date.toISOString().substring(0, 10)
    : String(period.start_date).substring(0, 10);
  const startDay = parseInt(startDateStr.split('-')[2], 10);
  const cutoff = startDay <= 15 ? 1 : 2;

  const monthlySalary = semiMonthlyGross * 2;

  if (TAX_ONLY_TYPES.includes(employeeType)) {
    // PTE-WOB: standard BIR withholding, no government contributions
    const birTax = round2(Math.max(0, getBIRTax(semiMonthlyGross)));
    return { ...zero, birTax, total: birTax, cutoff };
  }

  if (FULL_DEDUCTION_TYPES.includes(employeeType)) {
    const sss       = getSSSContributions(monthlySalary);
    const philhealth = getPhilHealthForCutoff(monthlySalary, cutoff);
    const pagibig    = getPagIBIGForCutoff(monthlySalary, cutoff);

    let sssEE = 0, sssMPF = 0, sssDeduction = 0;
    if (cutoff === 1) {
      sssEE       = sss.eeShare;
      sssDeduction = sssEE;
    } else {
      sssMPF       = sss.mpfEE;
      sssDeduction = sssMPF;
    }

    // BIR taxable: 1st cut-off deducts SSS EE + PhilHealth + Pag-IBIG
    //              2nd cut-off deducts SSS MPF only
    const taxableBase = cutoff === 1
      ? semiMonthlyGross - sssDeduction - philhealth - pagibig
      : semiMonthlyGross - sssDeduction;

    const birTax = round2(Math.max(0, getBIRTax(Math.max(0, taxableBase))));
    const total  = round2(sssDeduction + philhealth + pagibig + birTax);

    return { sssEE, sssMPF, philhealthEE: philhealth, pagibigEE: pagibig, birTax, total, cutoff };
  }

  return zero;
}

module.exports = {
  computeDeductions,
  getSSSContributions,
  getBIRTax,
  getHireCategory,
  FULL_DEDUCTION_TYPES,
  TAX_ONLY_TYPES,
  NO_DEDUCTION_TYPES,
};
