const express = require('express');
const router = express.Router();

// Controllers
const timesheetController = require('../controllers/timesheet.controller');
const employeeController = require('../controllers/employee.controller');
const webhookController = require('../controllers/webhook.controller');
const authController = require('../controllers/auth.controller');
const wrikeController = require('../controllers/wrike.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { requireRole, requirePage, denyIfAmountsHidden, stripMoneyFromBody, redactAmountsMiddleware } = require('../middleware/auth.middleware');
const portalController = require('../controllers/portal.controller');
const verificationController = require('../controllers/verification.controller');
const adminController = require('../controllers/admin.controller');

const requireSuperAdmin         = requireRole('super_admin');
const requireHROrAbove          = requireRole('super_admin', 'hr');
const requirePayrollOrAbove     = requireRole('super_admin', 'hr', 'payroll_officer');
const requireAccountingOrAbove  = requireRole('super_admin', 'accounting_manager');
const requirePayrollOrSuperAdmin = requireRole('super_admin', 'payroll_officer');
// Everyone who may actually run payroll. Deliberately excludes 'timekeeper',
// whose remit is checking hours before payroll, not processing it.
const requirePayrollOps         = requireRole('super_admin', 'payroll_officer', 'accounting_manager');
// Timesheet verification + Wrike reads — payroll ops plus the timekeeper.
const requireVerifier           = requireRole('super_admin', 'payroll_officer', 'accounting_manager', 'timekeeper');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Multer for rejection file uploads
const rejectionUploadDir = path.join(__dirname, '../../uploads/rejections');
if (!fs.existsSync(rejectionUploadDir)) fs.mkdirSync(rejectionUploadDir, { recursive: true });
const upload = multer({ dest: rejectionUploadDir, limits: { fileSize: 10 * 1024 * 1024 } });

// Multer for CSV bulk uploads (memory storage — no temp file needed)
const csvUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// Middleware: only users with an employee_id link can access portal routes
function requireEmployee(req, res, next) {
  if (!req.user || (req.user.role !== 'employee' && !req.user.employee_id)) {
    return res.status(403).json({ success: false, error: 'Employee portal access only' });
  }
  next();
}

// ============================================
// AUTH ROUTES (public)
// ============================================

router.post('/auth/login', authController.login.bind(authController));
router.get('/auth/me', authMiddleware, authController.me.bind(authController));
router.post('/auth/logout', authMiddleware, authController.logout.bind(authController));

// Protect all routes below this line
router.use(authMiddleware);
// Blank out money-bearing fields for users whose amounts are hidden. Placed
// immediately after auth so it applies to every response below, not just the
// endpoints someone remembered to annotate.
router.use(redactAmountsMiddleware);

// ============================================
// DASHBOARD ROUTES
// ============================================

/**
 * @route GET /api/dashboard
 * @desc Get dashboard statistics
 */
router.get('/dashboard', timesheetController.getDashboard.bind(timesheetController));
router.get('/dashboard/category-hours', timesheetController.getCategoryHours.bind(timesheetController));

// ============================================
// TIMESHEET ROUTES
// ============================================

/**
 * @route POST /api/timesheet/process
 * @desc Process timesheets for a period
 */
router.post('/timesheet/process', requirePayrollOps, requirePage('process'), timesheetController.processPeriod.bind(timesheetController));

/**
 * @route POST /api/timesheet/generate
 * @desc Generate timesheet for specific employee
 */
router.post('/timesheet/generate', requirePayrollOps, requirePage('process'), timesheetController.generateForEmployee.bind(timesheetController));

/**
 * @route POST /api/timesheet/preview
 * @desc Preview timesheet hours from Wrike for an employee + date range (no DB writes)
 */
router.post('/timesheet/preview', requirePayrollOps, requirePage('process'), timesheetController.previewTimesheet.bind(timesheetController));

/**
 * @route POST /api/timesheet/submit
 * @desc Submit timesheet for approval (imports timelogs, generates PDF, creates Wrike task)
 */
router.post('/timesheet/submit', requirePayrollOps, requirePage('process'), timesheetController.submitTimesheet.bind(timesheetController));

/**
 * @route GET /api/timesheet/pending
 * @desc Get pending approvals
 */
router.get('/timesheet/pending', timesheetController.getPendingApprovals.bind(timesheetController));

/**
 * @route GET /api/timesheet/rejected
 * @desc Get employee-rejected timesheets awaiting admin review
 */
router.get('/timesheet/rejected', timesheetController.getRejectedTimesheets.bind(timesheetController));

/**
 * @route GET /api/timesheet/counts
 * @desc Get pending + rejected counts for nav badges
 */
router.get('/timesheet/counts', timesheetController.getCounts.bind(timesheetController));

// ============================================
// PERIOD ROUTES
// ============================================

/**
 * @route GET /api/timesheet/periods
 * @desc Get all periods
 */
router.get('/timesheet/periods', timesheetController.getPeriods.bind(timesheetController));

/**
 * @route POST /api/timesheet/periods
 * @desc Create a new period
 */
router.post('/timesheet/periods', requirePayrollOrAbove, requirePage('periods'), timesheetController.createPeriod.bind(timesheetController));

/**
 * @route POST /api/timesheet/periods/monthly
 * @desc Create periods for a month
 */
router.post('/timesheet/periods/monthly', requirePayrollOrAbove, requirePage('periods'), timesheetController.createMonthlyPeriods.bind(timesheetController));
router.post('/timesheet/periods/foreign-monthly', requirePayrollOrAbove, requirePage('periods'), timesheetController.createForeignMonthlyPeriod.bind(timesheetController));

/**
 * @route GET /api/timesheet/periods/:id
 * @desc Get period by ID
 */
router.get('/timesheet/periods/:id', timesheetController.getPeriod.bind(timesheetController));
router.put('/timesheet/periods/:id', requirePayrollOrAbove, requirePage('periods'), timesheetController.updatePeriod.bind(timesheetController));
router.delete('/timesheet/periods/:id', requirePayrollOrAbove, requirePage('periods'), timesheetController.deletePeriod.bind(timesheetController));

/**
 * @route POST /api/timesheet/periods/:id/unlock | /lock
 * @desc  Super admin lifts or restores the lock on a processed period.
 */
router.post('/timesheet/periods/:id/unlock', requireSuperAdmin, requirePage('periods'), timesheetController.unlockPeriod.bind(timesheetController));
router.post('/timesheet/periods/:id/lock',   requireSuperAdmin, requirePage('periods'), timesheetController.lockPeriod.bind(timesheetController));

/**
 * @route GET /api/timesheet/periods/:id/summaries
 * @desc Get summaries for a period
 */
router.get('/timesheet/periods/:id/summaries', requirePage('periods'), timesheetController.getPeriodSummaries.bind(timesheetController));

/**
 * @route GET /api/timesheet/periods/:id/payslips
 * @desc Get payslips for a period
 */
router.get('/timesheet/periods/:id/payslips', requirePage('payslips', 'process', 'bank_upload'), timesheetController.getPeriodPayslips.bind(timesheetController));
router.get('/timesheet/periods/:id/summary-pdf', requirePayrollOps, requirePage('payslips'), denyIfAmountsHidden, timesheetController.downloadPeriodSummaryPDF.bind(timesheetController));
router.get('/timesheet/periods/:id/summary-xlsx', requirePayrollOps, requirePage('payslips'), denyIfAmountsHidden, timesheetController.downloadPeriodSummaryXLSX.bind(timesheetController));

// ============================================
// SUMMARY ROUTES
// ============================================

/**
 * @route GET /api/timesheet/summaries/:id
 * @desc Get summary details
 */
router.get('/timesheet/summaries/:id', timesheetController.getSummary.bind(timesheetController));

/**
 * @route POST /api/timesheet/summaries/:id/resend
 * @desc Resend approval request
 */
router.post('/timesheet/summaries/:id/resend', requirePayrollOps, timesheetController.resendApproval.bind(timesheetController));

/**
 * @route POST /api/timesheet/summaries/:id/approve
 * @desc Manually approve a summary
 */
router.post('/timesheet/summaries/:id/approve', requirePayrollOps, timesheetController.approveSummary.bind(timesheetController));

/**
 * @route POST /api/timesheet/summaries/:id/reject
 * @desc Manually reject a summary
 */
router.post('/timesheet/summaries/:id/reject', requirePayrollOps, timesheetController.rejectSummary.bind(timesheetController));

/**
 * @route POST /api/timesheet/summaries/:id/generate-payslip
 * @desc Generate (or re-generate) payslip for an approved summary
 */
router.post('/timesheet/summaries/:id/generate-payslip', requirePayrollOps, timesheetController.generatePayslipForSummary.bind(timesheetController));

// ============================================
// TIME ENTRY ROUTES
// ============================================

/**
 * @route GET /api/timesheet/employees/:id/entries
 * @desc Get time entries for an employee
 */
router.get('/timesheet/employees/:id/entries', timesheetController.getEmployeeEntries.bind(timesheetController));

/**
 * @route POST /api/timesheet/entries
 * @desc Add time entry
 */
router.post('/timesheet/entries', requirePayrollOps, timesheetController.addTimeEntry.bind(timesheetController));

/**
 * @route POST /api/timesheet/entries/bulk
 * @desc Bulk import time entries
 */
router.post('/timesheet/entries/bulk', requirePayrollOps, timesheetController.bulkImportEntries.bind(timesheetController));

// ============================================
// PAYSLIP ROUTES
// ============================================

/**
 * @route GET /api/timesheet/payslips/:id
 * @desc Get payslip details
 */
router.get('/timesheet/payslips/:id', requirePage('payslips', 'process', 'bank_upload'), timesheetController.getPayslip.bind(timesheetController));

/**
 * @route GET /api/timesheet/payslips/:id/pdf
 * @desc Download payslip PDF file
 */
router.get('/timesheet/payslips/:id/pdf', requirePage('payslips'), denyIfAmountsHidden, timesheetController.downloadPayslipPDF.bind(timesheetController));

/**
 * @route DELETE /api/timesheet/payslips/:id
 * @desc Delete a payslip (super_admin only)
 */
router.delete('/timesheet/payslips/:id', requireSuperAdmin, requirePage('payslips'), timesheetController.deletePayslip.bind(timesheetController));

/**
 * @route POST /api/timesheet/payslips/:id/release
 * @desc Release a single payslip to the employee (payroll_officer, super_admin)
 */
router.post('/timesheet/payslips/:id/release', requirePayrollOrSuperAdmin, requirePage('payslips'), timesheetController.releasePayslip.bind(timesheetController));

/**
 * @route POST /api/timesheet/periods/:id/release-payslips
 * @desc Release all generated payslips for a period (payroll_officer, super_admin)
 */
router.post('/timesheet/periods/:id/release-payslips', requirePayrollOrSuperAdmin, requirePage('payslips'), timesheetController.releasePayslips.bind(timesheetController));

/**
 * @route POST /api/timesheet/periods/:id/mark-bank-downloaded
 * @desc Record bank file download timestamp (accounting_manager, super_admin)
 */
router.post('/timesheet/periods/:id/mark-bank-downloaded', requireAccountingOrAbove, requirePage('bank_upload'), timesheetController.markBankDownloaded.bind(timesheetController));

/**
 * @route POST /api/timesheet/periods/:id/mark-bank-uploaded
 * @desc Mark a period's bank file as uploaded (accounting_manager, super_admin)
 */
router.post('/timesheet/periods/:id/mark-bank-uploaded', requireAccountingOrAbove, requirePage('bank_upload'), timesheetController.markBankUploaded.bind(timesheetController));

/**
 * @route POST /api/timesheet/bulk-generate-payslips
 * @desc Bulk approve & generate payslips for a period (all or selected employees)
 */
router.post('/timesheet/bulk-generate-payslips', requirePayrollOps, requirePage('payslips'), timesheetController.bulkGeneratePayslips.bind(timesheetController));
router.post('/timesheet/generate-payslips-for-period', requirePayrollOps, requirePage('payslips'), timesheetController.generatePayslipsForPeriod.bind(timesheetController));

/**
 * @route GET /api/jobs/:id
 * @desc Poll async payroll job status
 */
router.get('/jobs/:id', timesheetController.getJobStatus.bind(timesheetController));

/**
 * @route GET /api/payroll/bank-file
 * @desc Generate bank transfer file for a period (?periodId=X&type=local|foreign)
 */
router.get('/payroll/bank-file', requireAccountingOrAbove, requirePage('bank_upload'), denyIfAmountsHidden, timesheetController.generateBankFile.bind(timesheetController));

/**
 * @route GET /api/payroll/summary-range
 * @desc Payroll summary across a custom date range, as PDF or CSV
 * @query start=YYYY-MM-DD, end=YYYY-MM-DD, format=pdf|csv
 */
router.get('/payroll/summary-range', requirePayrollOps, requirePage('payslips'), denyIfAmountsHidden, timesheetController.downloadRangeSummary.bind(timesheetController));

// ============================================
// EMPLOYEE ROUTES
// ============================================

/**
 * @route GET /api/employees
 * @desc Get all employees
 */
router.get('/employees', employeeController.getAll.bind(employeeController));

/**
 * @route POST /api/employees
 * @desc Create new employee
 */
router.post('/employees/bulk', requireHROrAbove, requirePage('employees'), csvUpload.single('file'), employeeController.bulkUpload.bind(employeeController));
router.post('/employees', requireHROrAbove, requirePage('employees'), stripMoneyFromBody, employeeController.create.bind(employeeController));

/**
 * @route GET /api/employees/:id
 * @desc Get employee by ID
 */
router.get('/employees/:id', employeeController.getById.bind(employeeController));

/**
 * @route PUT /api/employees/:id
 * @desc Update employee
 */
router.put('/employees/:id', requireHROrAbove, requirePage('employees'), stripMoneyFromBody, employeeController.update.bind(employeeController));

/**
 * @route DELETE /api/employees/:id
 * @desc Delete employee
 */
router.delete('/employees/:id', requireHROrAbove, requirePage('employees'), employeeController.delete.bind(employeeController));

/**
 * @route POST /api/employees/:id/deactivate
 * @desc Deactivate employee
 */
router.post('/employees/:id/deactivate', requireHROrAbove, requirePage('employees'), employeeController.deactivate.bind(employeeController));

/**
 * @route POST /api/employees/:id/activate
 * @desc Activate employee
 */
router.post('/employees/:id/activate', requireHROrAbove, requirePage('employees'), employeeController.activate.bind(employeeController));

/**
 * @route GET /api/employees/:id/timesheets
 * @desc Get employee timesheet history
 */
router.get('/employees/:id/timesheets', employeeController.getTimesheets.bind(employeeController));

/**
 * @route GET /api/employees/:id/payslips
 * @desc Get employee payslips
 */
router.get('/employees/:id/payslips', employeeController.getPayslips.bind(employeeController));

/**
 * @route GET /api/employees/:id/portal-account
 * @desc Get portal account info for an employee
 */
router.get('/employees/:id/portal-account', requireHROrAbove, requirePage('employees'), employeeController.getPortalAccount.bind(employeeController));
router.post('/employees/:id/create-portal-account', requireHROrAbove, requirePage('employees'), employeeController.createPortalAccount.bind(employeeController));

/**
 * @route POST /api/employees/:id/revoke-access
 * @desc Revoke portal access for an employee
 */
router.post('/employees/:id/revoke-access', requireHROrAbove, requirePage('employees'), employeeController.revokeAccess.bind(employeeController));

/**
 * @route POST /api/employees/:id/restore-access
 * @desc Restore portal access for an employee
 */
router.post('/employees/:id/restore-access', requireHROrAbove, requirePage('employees'), employeeController.restoreAccess.bind(employeeController));

/**
 * @route POST /api/employees/:id/reset-password
 * @desc Reset portal password for an employee
 */
router.post('/employees/:id/reset-password', requireHROrAbove, requirePage('employees'), employeeController.resetPassword.bind(employeeController));

// ============================================
// WRIKE TIMESHEET ROUTES
// ============================================

/**
 * @route GET /api/wrike/timelogs?date=YYYY-MM-DD
 * @desc Fetch weekly timelogs from Wrike for all employees
 */
router.get('/wrike/timelogs', requireVerifier, requirePage('work_timesheets'), wrikeController.getWeeklyTimelogs.bind(wrikeController));
router.get('/wrike/timelogs/monthly', requireVerifier, requirePage('work_timesheets'), wrikeController.getMonthlyTimelogs.bind(wrikeController));

/**
 * @route POST /api/wrike/import
 * @desc Import a week of Wrike timelogs into time_entries
 */
router.post('/wrike/import', requireVerifier, wrikeController.importWeekTimelogs.bind(wrikeController));

/**
 * @route GET /api/wrike/contacts
 * @desc Get all Wrike contacts/users
 */
router.get('/wrike/contacts', requireVerifier, wrikeController.getContacts.bind(wrikeController));

/**
 * @route GET /api/wrike/folders
 * @desc List all Wrike folders (to find the correct WRIKE_FOLDER_ID)
 */
router.get('/wrike/folders', requireVerifier, wrikeController.getFolders.bind(wrikeController));
router.post('/wrike/import-period', requireVerifier, requirePage('verify'), wrikeController.importPeriodTimelogs.bind(wrikeController));
router.post('/wrike/backfill-categories', requirePayrollOps, wrikeController.backfillCategories.bind(wrikeController));

// ============================================
// WEBHOOK ROUTES
// ============================================

/**
 * @route POST /api/webhooks/wrike
 * @desc Handle Wrike webhook
 */
router.post('/webhooks/wrike', webhookController.handleWrikeWebhook.bind(webhookController));

/**
 * @route GET /api/webhooks/logs
 * @desc Get webhook logs
 */
router.get('/webhooks/logs', webhookController.getWebhookLogs.bind(webhookController));

/**
 * @route GET /api/webhooks/unprocessed
 * @desc Get unprocessed webhook events
 */
router.get('/webhooks/unprocessed', webhookController.getUnprocessedEvents.bind(webhookController));

/**
 * @route POST /api/webhooks/retry
 * @desc Retry unprocessed events
 */
router.post('/webhooks/retry', webhookController.retryUnprocessedEvents.bind(webhookController));

/**
 * @route POST /api/webhooks/test
 * @desc Test webhook endpoint
 */
router.post('/webhooks/test', webhookController.testWebhook.bind(webhookController));

// ============================================
// TIMESHEET VERIFICATION ROUTES
// ============================================

router.get('/verifications/status',            requireVerifier, requirePage('verify', 'process'), verificationController.getStatus.bind(verificationController));
router.get('/verifications/period/:periodId',  requireVerifier, requirePage('verify', 'payslips'), verificationController.getForPeriod.bind(verificationController));
router.post('/verifications/upsert',           requireVerifier, requirePage('verify'), stripMoneyFromBody, verificationController.upsert.bind(verificationController));
router.post('/verifications/bulk',             requireVerifier, requirePage('verify'), verificationController.bulk.bind(verificationController));

// ============================================
// ADMIN — USER MANAGEMENT ROUTES (super_admin only)
// ============================================

router.get('/admin/permissions/catalog',       requireSuperAdmin, adminController.permissionCatalog.bind(adminController));
router.put('/admin/users/:id/permissions',     requireSuperAdmin, adminController.updatePermissions.bind(adminController));
router.get('/admin/users',                     requireSuperAdmin, adminController.listUsers.bind(adminController));
router.post('/admin/users',                    requireSuperAdmin, adminController.createUser.bind(adminController));
router.put('/admin/users/:id',                 requireSuperAdmin, adminController.updateUser.bind(adminController));
router.post('/admin/users/:id/reset-password', requireSuperAdmin, adminController.resetPassword.bind(adminController));
router.post('/admin/users/:id/deactivate',     requireSuperAdmin, adminController.deactivateUser.bind(adminController));
router.post('/admin/users/:id/activate',       requireSuperAdmin, adminController.activateUser.bind(adminController));
router.delete('/admin/users/:id',              requireSuperAdmin, adminController.deleteUser.bind(adminController));

// ============================================
// EMPLOYEE PORTAL ROUTES
// ============================================

router.get('/portal/me', requireEmployee, portalController.getMe.bind(portalController));
router.put('/portal/profile', requireEmployee, portalController.updateProfile.bind(portalController));
router.get('/portal/timesheets', requireEmployee, portalController.getMyTimesheets.bind(portalController));
router.get('/portal/timesheets/:id', requireEmployee, portalController.getTimesheetDetail.bind(portalController));
router.get('/portal/timesheets/:id/csv', requireEmployee, portalController.downloadCSV.bind(portalController));
router.post('/portal/timesheets/:id/approve', requireEmployee, portalController.approveTimesheet.bind(portalController));
router.post('/portal/timesheets/:id/reject', requireEmployee, upload.array('files', 5), portalController.rejectTimesheet.bind(portalController));
router.get('/portal/payslips', requireEmployee, portalController.getMyPayslips.bind(portalController));
router.get('/portal/payslips/:id/pdf', requireEmployee, portalController.downloadPayslipPDF.bind(portalController));
router.post('/portal/change-password', requireEmployee, portalController.changePassword.bind(portalController));
router.get('/portal/category-hours', requireEmployee, portalController.getCategoryHours.bind(portalController));

module.exports = router;
