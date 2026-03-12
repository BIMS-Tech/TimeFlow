import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message = error.response?.data?.error || error.message;
    console.error('API Error:', message);

    // On 401, clear stored credentials and redirect to login
    if (error.response?.status === 401 && window.location.pathname !== '/login') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }

    return Promise.reject(error);
  }
);

// ============================================
// Auth API
// ============================================
export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
};

// ============================================
// Dashboard API
// ============================================
export const dashboardAPI = {
  getStats: () => api.get('/dashboard'),
};

// ============================================
// Employees API
// ============================================
export const employeesAPI = {
  getAll: (activeOnly = true) => api.get(`/employees?activeOnly=${activeOnly}`),
  getById: (id) => api.get(`/employees/${id}`),
  create: (data) => api.post('/employees', data),
  update: (id, data) => api.put(`/employees/${id}`, data),
  delete: (id) => api.delete(`/employees/${id}`),
  deactivate: (id) => api.post(`/employees/${id}/deactivate`),
  activate: (id) => api.post(`/employees/${id}/activate`),
  getTimesheets: (id) => api.get(`/employees/${id}/timesheets`),
  getPayslips: (id) => api.get(`/employees/${id}/payslips`),
  getPortalAccount: (id) => api.get(`/employees/${id}/portal-account`),
  createPortalAccount: (id) => api.post(`/employees/${id}/create-portal-account`),
  revokeAccess: (id) => api.post(`/employees/${id}/revoke-access`),
  restoreAccess: (id) => api.post(`/employees/${id}/restore-access`),
  resetPassword: (id) => api.post(`/employees/${id}/reset-password`),
};

// ============================================
// Timesheet API
// ============================================
export const timesheetAPI = {
  process: (periodId) => api.post('/timesheet/process', { periodId }),
  generate: (employeeId, periodId) => api.post('/timesheet/generate', { employeeId, periodId }),
  getPending: () => api.get('/timesheet/pending'),
  getRejected: () => api.get('/timesheet/rejected'),
  getCounts: () => api.get('/timesheet/counts'),
  getPeriods: (limit, offset) => api.get(`/timesheet/periods?limit=${limit || 20}&offset=${offset || 0}`),
  getPeriod: (id) => api.get(`/timesheet/periods/${id}`),
  createPeriod: (data) => api.post('/timesheet/periods', data),
  updatePeriod: (id, data) => api.put(`/timesheet/periods/${id}`, data),
  deletePeriod: (id) => api.delete(`/timesheet/periods/${id}`),
  createMonthlyPeriods: (year, month) => api.post('/timesheet/periods/monthly', { year, month }),
  getPeriodSummaries: (id) => api.get(`/timesheet/periods/${id}/summaries`),
  getPeriodPayslips: (id) => api.get(`/timesheet/periods/${id}/payslips`),
  getSummary: (id) => api.get(`/timesheet/summaries/${id}`),
  resendApproval: (id) => api.post(`/timesheet/summaries/${id}/resend`),
  approveSummary: (id) => api.post(`/timesheet/summaries/${id}/approve`),
  rejectSummary: (id, reason) => api.post(`/timesheet/summaries/${id}/reject`, { reason }),
  generatePayslip: (id) => api.post(`/timesheet/summaries/${id}/generate-payslip`),
  getEmployeeEntries: (id, startDate, endDate) => 
    api.get(`/timesheet/employees/${id}/entries?startDate=${startDate}&endDate=${endDate}`),
  addEntry: (data) => api.post('/timesheet/entries', data),
  bulkImportEntries: (entries) => api.post('/timesheet/entries/bulk', { entries }),
};

// ============================================
// Payslips API
// ============================================
export const payslipsAPI = {
  getById: (id) => api.get(`/timesheet/payslips/${id}`),
};

// ============================================
// Timesheet Generator API
// ============================================
export const timesheetGeneratorAPI = {
  preview: (employeeId, startDate, endDate) =>
    api.post('/timesheet/preview', { employeeId, startDate, endDate }),
  submit: (employeeId, startDate, endDate, periodName) =>
    api.post('/timesheet/submit', { employeeId, startDate, endDate, periodName }),
};

// ============================================
// Wrike API
// ============================================
export const wrikeAPI = {
  getWeeklyTimelogs: (date) => api.get(`/wrike/timelogs${date ? `?date=${date}` : ''}`),
  importWeek: (date) => api.post('/wrike/import', { date }),
  getContacts: () => api.get('/wrike/contacts'),
};

// ============================================
// Webhooks API
// ============================================
export const webhooksAPI = {
  getLogs: (limit) => api.get(`/webhooks/logs?limit=${limit || 50}`),
  getUnprocessed: () => api.get('/webhooks/unprocessed'),
  retry: () => api.post('/webhooks/retry'),
  test: (taskId, status) => api.post('/webhooks/test', { taskId, status }),
};

// ============================================
// Employee Portal API
// ============================================
export const portalAPI = {
  getMe: () => api.get('/portal/me'),
  getTimesheets: () => api.get('/portal/timesheets'),
  getTimesheetDetail: (id) => api.get(`/portal/timesheets/${id}`),
  approve: (id) => api.post(`/portal/timesheets/${id}/approve`),
  reject: (id, reason, files) => {
    const form = new FormData();
    form.append('reason', reason);
    if (files) files.forEach(f => form.append('files', f));
    return api.post(`/portal/timesheets/${id}/reject`, form, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  downloadPDF: (id) => api.get(`/portal/timesheets/${id}/pdf`, { responseType: 'blob' }),
  getPayslips: () => api.get('/portal/payslips'),
  downloadPayslipPDF: (id) => api.get(`/portal/payslips/${id}/pdf`, { responseType: 'blob' }),
  changePassword: (currentPassword, newPassword) =>
    api.post('/portal/change-password', { currentPassword, newPassword }),
};

export default api;
