/**
 * Page-level access control and amount redaction.
 *
 * A user's ROLE supplies the default set of pages and view flags. A super admin
 * can then override either of those for one specific user from the Users screen;
 * the override is stored as a JSON string in users.permissions, where NULL means
 * "no override — use the role defaults".
 *
 * The defaults below deliberately mirror the nav each role already saw, so
 * enabling this system changes nothing until someone actually sets an override.
 */

const PAGES = [
  { key: 'dashboard',       label: 'Dashboard',             path: '/'           },
  { key: 'employees',       label: 'Upload Employees',      path: '/employees'  },
  { key: 'periods',         label: 'Create Payroll Period', path: '/periods'    },
  { key: 'verify',          label: 'Verify Timesheet',      path: '/wrike'      },
  { key: 'process',         label: 'Process Payroll',       path: '/generate'   },
  { key: 'bank_upload',     label: 'Generate Bank Upload',  path: '/bank-upload'},
  { key: 'payslips',        label: 'Payslips',              path: '/payslips'   },
  { key: 'work_timesheets', label: 'Work Timesheets',       path: '/wrike-raw'  },
  { key: 'users',           label: 'Users',                 path: '/users'      },
];

const PAGE_KEYS = PAGES.map(p => p.key);

const FLAGS = [
  {
    key: 'hide_amounts',
    label: 'Hide amounts & rates',
    help: 'Hours stay visible. Hourly rates, gross/net pay, deductions and cash advance are removed from both the screen and the API response.',
  },
];

const FLAG_KEYS = FLAGS.map(f => f.key);

const ROLE_PAGES = {
  super_admin:        [...PAGE_KEYS],
  hr:                 ['dashboard', 'employees'],
  payroll_officer:    ['dashboard', 'periods', 'verify', 'process', 'payslips'],
  accounting_manager: ['dashboard', 'periods', 'verify', 'process', 'bank_upload', 'payslips'],
  timekeeper:         ['dashboard', 'verify', 'work_timesheets'],
  employee:           [],
};

// A timekeeper checks hours, not money — so amounts are off by default for them.
const ROLE_FLAGS = {
  timekeeper: { hide_amounts: true },
};

/** users.permissions may arrive as a JSON string or an already-parsed object. */
function parseOverride(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Resolve the effective pages + flags for a user.
 * @returns {{ pages: string[], flags: { hide_amounts: boolean }, customised: boolean }}
 */
function resolvePermissions(user) {
  const role = user?.role;

  // A super admin always keeps everything. Without this, a super admin could
  // save an override that removes their own Users page and lock the last
  // administrator out of the only screen that can undo it.
  if (role === 'super_admin') {
    return { pages: [...PAGE_KEYS], flags: { hide_amounts: false }, customised: false };
  }

  const defaults = {
    pages: ROLE_PAGES[role] ? [...ROLE_PAGES[role]] : [],
    flags: { hide_amounts: false, ...(ROLE_FLAGS[role] || {}) },
  };

  const override = parseOverride(user?.permissions);
  if (!override) return { ...defaults, customised: false };

  return {
    pages: Array.isArray(override.pages)
      ? override.pages.filter(k => PAGE_KEYS.includes(k))
      : defaults.pages,
    flags: { ...defaults.flags, ...pickFlags(override.flags) },
    customised: true,
  };
}

function pickFlags(input) {
  const out = {};
  if (input && typeof input === 'object') {
    FLAG_KEYS.forEach(k => { if (k in input) out[k] = Boolean(input[k]); });
  }
  return out;
}

/**
 * Normalise an override coming from the Users screen before it is stored.
 * Returns null when the override carries nothing — which resets the user to
 * their role defaults.
 */
function sanitizeOverride(input) {
  if (input === null || input === undefined) return null;
  const out = {};
  if (Array.isArray(input.pages)) {
    out.pages = PAGE_KEYS.filter(k => input.pages.includes(k)); // dedup + stable order
  }
  const flags = pickFlags(input.flags);
  if (Object.keys(flags).length) out.flags = flags;
  return Object.keys(out).length ? out : null;
}

/**
 * Response keys that carry money. Hours, minutes and dates are deliberately
 * absent — a user with amounts hidden still sees the time they are checking.
 */
const MONEY_KEYS = new Set([
  'hourly_rate', 'daily_rate', 'monthly_rate', 'rate',
  'gross_amount', 'net_amount', 'basic_pay', 'allowance', 'salary',
  'cash_advance', 'tax_deductions', 'other_deductions', 'deductions',
  'sss_ee', 'sss_er', 'sss_mpf',
  'philhealth_ee', 'philhealth_er',
  'pagibig_ee', 'pagibig_er',
  'bir_tax',
  'pay', 'total_pay', 'est_pay', 'amount', 'total_gross', 'total_net',
]);

/** Deep copy with every money-bearing key blanked to null. */
function redactAmounts(value) {
  if (Array.isArray(value)) return value.map(redactAmounts);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = MONEY_KEYS.has(k) ? null : redactAmounts(v);
    }
    return out;
  }
  return value;
}

module.exports = {
  PAGES, PAGE_KEYS, FLAGS, FLAG_KEYS,
  ROLE_PAGES, ROLE_FLAGS,
  resolvePermissions, sanitizeOverride,
  MONEY_KEYS, redactAmounts,
};
