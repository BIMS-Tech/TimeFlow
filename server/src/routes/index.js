const express = require('express');
const router = express.Router();

// Controllers
const timesheetController = require('../controllers/timesheet.controller');
const employeeController = require('../controllers/employee.controller');
const webhookController = require('../controllers/webhook.controller');
const authController = require('../controllers/auth.controller');
const wrikeController = require('../controllers/wrike.controller');
const authMiddleware = require('../middleware/auth.middleware');
const portalController = require('../controllers/portal.controller');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Multer for rejection file uploads
const rejectionUploadDir = path.join(__dirname, '../../uploads/rejections');
if (!fs.existsSync(rejectionUploadDir)) fs.mkdirSync(rejectionUploadDir, { recursive: true });
const upload = multer({ dest: rejectionUploadDir, limits: { fileSize: 10 * 1024 * 1024 } });

// Middleware: only users with an employee_id link can access portal routes
function requireEmployee(req, res, next) {
  if (!req.user || !req.user.employee_id) {
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

// ============================================
// DASHBOARD ROUTES
// ============================================

/**
 * @route GET /api/dashboard
 * @desc Get dashboard statistics
 */
router.get('/dashboard', timesheetController.getDashboard.bind(timesheetController));

// ============================================
// TIMESHEET ROUTES
// ============================================

/**
 * @route POST /api/timesheet/process
 * @desc Process timesheets for a period
 */
router.post('/timesheet/process', timesheetController.processPeriod.bind(timesheetController));

/**
 * @route POST /api/timesheet/generate
 * @desc Generate timesheet for specific employee
 */
router.post('/timesheet/generate', timesheetController.generateForEmployee.bind(timesheetController));

/**
 * @route POST /api/timesheet/preview
 * @desc Preview timesheet hours from Wrike for an employee + date range (no DB writes)
 */
router.post('/timesheet/preview', timesheetController.previewTimesheet.bind(timesheetController));

/**
 * @route POST /api/timesheet/submit
 * @desc Submit timesheet for approval (imports timelogs, generates PDF, creates Wrike task)
 */
router.post('/timesheet/submit', timesheetController.submitTimesheet.bind(timesheetController));

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
router.post('/timesheet/periods', timesheetController.createPeriod.bind(timesheetController));

/**
 * @route POST /api/timesheet/periods/monthly
 * @desc Create periods for a month
 */
router.post('/timesheet/periods/monthly', timesheetController.createMonthlyPeriods.bind(timesheetController));

/**
 * @route GET /api/timesheet/periods/:id
 * @desc Get period by ID
 */
router.get('/timesheet/periods/:id', timesheetController.getPeriod.bind(timesheetController));
router.put('/timesheet/periods/:id', timesheetController.updatePeriod.bind(timesheetController));
router.delete('/timesheet/periods/:id', timesheetController.deletePeriod.bind(timesheetController));

/**
 * @route GET /api/timesheet/periods/:id/summaries
 * @desc Get summaries for a period
 */
router.get('/timesheet/periods/:id/summaries', timesheetController.getPeriodSummaries.bind(timesheetController));

/**
 * @route GET /api/timesheet/periods/:id/payslips
 * @desc Get payslips for a period
 */
router.get('/timesheet/periods/:id/payslips', timesheetController.getPeriodPayslips.bind(timesheetController));

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
router.post('/timesheet/summaries/:id/resend', timesheetController.resendApproval.bind(timesheetController));

/**
 * @route POST /api/timesheet/summaries/:id/approve
 * @desc Manually approve a summary
 */
router.post('/timesheet/summaries/:id/approve', timesheetController.approveSummary.bind(timesheetController));

/**
 * @route POST /api/timesheet/summaries/:id/reject
 * @desc Manually reject a summary
 */
router.post('/timesheet/summaries/:id/reject', timesheetController.rejectSummary.bind(timesheetController));

/**
 * @route POST /api/timesheet/summaries/:id/generate-payslip
 * @desc Generate (or re-generate) payslip for an approved summary
 */
router.post('/timesheet/summaries/:id/generate-payslip', timesheetController.generatePayslipForSummary.bind(timesheetController));

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
router.post('/timesheet/entries', timesheetController.addTimeEntry.bind(timesheetController));

/**
 * @route POST /api/timesheet/entries/bulk
 * @desc Bulk import time entries
 */
router.post('/timesheet/entries/bulk', timesheetController.bulkImportEntries.bind(timesheetController));

// ============================================
// PAYSLIP ROUTES
// ============================================

/**
 * @route GET /api/timesheet/payslips/:id
 * @desc Get payslip details
 */
router.get('/timesheet/payslips/:id', timesheetController.getPayslip.bind(timesheetController));

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
router.post('/employees', employeeController.create.bind(employeeController));

/**
 * @route GET /api/employees/:id
 * @desc Get employee by ID
 */
router.get('/employees/:id', employeeController.getById.bind(employeeController));

/**
 * @route PUT /api/employees/:id
 * @desc Update employee
 */
router.put('/employees/:id', employeeController.update.bind(employeeController));

/**
 * @route DELETE /api/employees/:id
 * @desc Delete employee
 */
router.delete('/employees/:id', employeeController.delete.bind(employeeController));

/**
 * @route POST /api/employees/:id/deactivate
 * @desc Deactivate employee
 */
router.post('/employees/:id/deactivate', employeeController.deactivate.bind(employeeController));

/**
 * @route POST /api/employees/:id/activate
 * @desc Activate employee
 */
router.post('/employees/:id/activate', employeeController.activate.bind(employeeController));

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
router.get('/employees/:id/portal-account', employeeController.getPortalAccount.bind(employeeController));
router.post('/employees/:id/create-portal-account', employeeController.createPortalAccount.bind(employeeController));

/**
 * @route POST /api/employees/:id/revoke-access
 * @desc Revoke portal access for an employee
 */
router.post('/employees/:id/revoke-access', employeeController.revokeAccess.bind(employeeController));

/**
 * @route POST /api/employees/:id/restore-access
 * @desc Restore portal access for an employee
 */
router.post('/employees/:id/restore-access', employeeController.restoreAccess.bind(employeeController));

/**
 * @route POST /api/employees/:id/reset-password
 * @desc Reset portal password for an employee
 */
router.post('/employees/:id/reset-password', employeeController.resetPassword.bind(employeeController));

// ============================================
// WRIKE TIMESHEET ROUTES
// ============================================

/**
 * @route GET /api/wrike/timelogs?date=YYYY-MM-DD
 * @desc Fetch weekly timelogs from Wrike for all employees
 */
router.get('/wrike/timelogs', wrikeController.getWeeklyTimelogs.bind(wrikeController));

/**
 * @route POST /api/wrike/import
 * @desc Import a week of Wrike timelogs into time_entries
 */
router.post('/wrike/import', wrikeController.importWeekTimelogs.bind(wrikeController));

/**
 * @route GET /api/wrike/contacts
 * @desc Get all Wrike contacts/users
 */
router.get('/wrike/contacts', wrikeController.getContacts.bind(wrikeController));

/**
 * @route GET /api/wrike/folders
 * @desc List all Wrike folders (to find the correct WRIKE_FOLDER_ID)
 */
router.get('/wrike/folders', wrikeController.getFolders.bind(wrikeController));

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
// EMPLOYEE PORTAL ROUTES
// ============================================

router.get('/portal/me', requireEmployee, portalController.getMe.bind(portalController));
router.get('/portal/timesheets', requireEmployee, portalController.getMyTimesheets.bind(portalController));
router.get('/portal/timesheets/:id', requireEmployee, portalController.getTimesheetDetail.bind(portalController));
router.get('/portal/timesheets/:id/csv', requireEmployee, portalController.downloadCSV.bind(portalController));
router.post('/portal/timesheets/:id/approve', requireEmployee, portalController.approveTimesheet.bind(portalController));
router.post('/portal/timesheets/:id/reject', requireEmployee, upload.array('files', 5), portalController.rejectTimesheet.bind(portalController));
router.get('/portal/payslips', requireEmployee, portalController.getMyPayslips.bind(portalController));
router.get('/portal/payslips/:id/pdf', requireEmployee, portalController.downloadPayslipPDF.bind(portalController));
router.post('/portal/change-password', requireEmployee, portalController.changePassword.bind(portalController));

module.exports = router;
