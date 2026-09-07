/**
 * Client-side mirror of server/src/utils/permissions.js.
 *
 * The server is the authority — it sends the resolved set on login and on
 * /auth/me. This copy exists only as a fallback so a session stored before this
 * feature shipped (no `permissions` on the cached user) still renders the right
 * nav instead of an empty sidebar.
 */

export const PAGES = [
  { key: 'dashboard',       label: 'Dashboard',             path: '/'            },
  { key: 'employees',       label: 'Upload Employees',      path: '/employees'   },
  { key: 'periods',         label: 'Create Payroll Period', path: '/periods'     },
  { key: 'verify',          label: 'Verify Timesheet',      path: '/wrike'       },
  { key: 'process',         label: 'Process Payroll',       path: '/generate'    },
  { key: 'bank_upload',     label: 'Generate Bank Upload',  path: '/bank-upload' },
  { key: 'payslips',        label: 'Payslips',              path: '/payslips'    },
  { key: 'work_timesheets', label: 'Work Timesheets',       path: '/wrike-raw'   },
  { key: 'users',           label: 'Users',                 path: '/users'       },
];

export const PAGE_KEYS = PAGES.map(p => p.key);

export const ROLE_PAGES = {
  super_admin:        [...PAGE_KEYS],
  hr:                 ['dashboard', 'employees'],
  payroll_officer:    ['dashboard', 'periods', 'verify', 'process', 'payslips'],
  accounting_manager: ['dashboard', 'periods', 'verify', 'process', 'bank_upload', 'payslips'],
  timekeeper:         ['dashboard', 'verify', 'work_timesheets'],
  employee:           [],
};

export const ROLE_FLAGS = {
  timekeeper: { hide_amounts: true },
};

export const FLAG_LABELS = {
  hide_amounts: {
    label: 'Hide amounts & rates',
    help: 'Hours stay visible. Hourly rates, gross/net pay, deductions and cash advance are removed from the screen and from the API response.',
  },
};

/** Effective pages + flags for a user object, preferring what the server sent. */
export function effectivePermissions(user) {
  if (!user) return { pages: [], hideAmounts: false };
  if (user.role === 'super_admin') return { pages: [...PAGE_KEYS], hideAmounts: false };

  const sent = user.permissions;
  if (sent && Array.isArray(sent.pages)) {
    return { pages: sent.pages, hideAmounts: Boolean(sent.flags?.hide_amounts) };
  }
  return {
    pages: ROLE_PAGES[user.role] || [],
    hideAmounts: Boolean((ROLE_FLAGS[user.role] || {}).hide_amounts),
  };
}
