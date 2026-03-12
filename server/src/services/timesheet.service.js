const Employee = require('../models/Employee');
const PayPeriod = require('../models/PayPeriod');
const TimeEntry = require('../models/TimeEntry');
const TimeEntriesSummary = require('../models/TimeEntriesSummary');
const Payslip = require('../models/Payslip');
const wrikeService = require('./wrike.service');
const pdfService = require('./pdf.service');
const csvService = require('./csv.service');
const driveService = require('./drive.service');
const db = require('../database/connection');
require('dotenv').config();

/**
 * Timesheet Service
 * Core business logic for timesheet processing
 */
class TimesheetService {
  /**
   * Process timesheets for a period
   * Main entry point for cron job
   */
  async processPeriod(periodId = null) {
    console.log('🔄 Starting timesheet processing...');
    
    try {
      // Get or create current period
      const period = periodId 
        ? await PayPeriod.findById(periodId)
        : await PayPeriod.getOrCreateCurrentPeriod();

      if (!period) {
        throw new Error('No pay period found');
      }

      console.log(`📅 Processing period: ${period.period_name}`);

      // Update period status
      await PayPeriod.updateStatus(period.id, 'processing');

      // Get all active employees
      const employees = await Employee.findAll(true);
      console.log(`👥 Found ${employees.length} active employees`);

      const results = {
        period: period,
        processed: 0,
        pending: 0,
        errors: []
      };

      // Process each employee
      for (const employee of employees) {
        try {
          const result = await this.processEmployeeTimesheet(employee, period);
          if (result.success) {
            results.processed++;
          } else {
            results.pending++;
          }
        } catch (error) {
          results.errors.push({
            employee: employee.name,
            error: error.message
          });
          console.error(`❌ Error processing ${employee.name}:`, error.message);
        }
      }

      // Update period status based on results
      if (results.errors.length === 0) {
        await PayPeriod.updateStatus(period.id, 'pending_approval');
      }

      console.log(`✅ Processing complete: ${results.processed} processed, ${results.pending} pending`);
      return results;
    } catch (error) {
      console.error('❌ Period processing failed:', error);
      throw error;
    }
  }

  /**
   * Process timesheet for a single employee
   */
  async processEmployeeTimesheet(employee, period) {
    console.log(`📋 Processing timesheet for ${employee.name}...`);

    // Check if summary already exists
    let summary = await TimeEntriesSummary.findByEmployeeAndPeriod(employee.id, period.id);

    if (summary && summary.approval_status === 'approved') {
      console.log(`⏭️  ${employee.name} already approved, skipping`);
      return { success: false, reason: 'already_approved' };
    }

    // If already pending with an existing Wrike task, don't create a duplicate
    if (summary && summary.approval_status === 'pending' && summary.wrike_task_id) {
      console.log(`⏭️  ${employee.name} already has a pending approval task (${summary.wrike_task_id}), returning existing`);
      return {
        success: true,
        summary,
        wrikeTask: { id: summary.wrike_task_id },
        alreadyPending: true
      };
    }

    // Calculate hours from time entries
    const totalHours = await TimeEntry.getTotalHours(employee.id, period.start_date, period.end_date);

    if (totalHours === 0) {
      console.log(`⏭️  ${employee.name} has no hours for this period`);
      return { success: false, reason: 'no_hours' };
    }

    // Get hourly rate
    const hourlyRate = employee.hourly_rate || parseFloat(process.env.DEFAULT_HOURLY_RATE || 500);

    // Calculate hours breakdown
    const hoursBreakdown = await this.calculateHoursBreakdown(employee.id, period, totalHours, hourlyRate);

    // Create or update summary
    summary = await TimeEntriesSummary.upsert({
      employee_id: employee.id,
      period_id: period.id,
      total_hours: hoursBreakdown.totalHours,
      regular_hours: hoursBreakdown.regularHours,
      overtime_hours: hoursBreakdown.overtimeHours,
      hourly_rate: hourlyRate,
      gross_amount: hoursBreakdown.grossAmount,
      net_amount: hoursBreakdown.grossAmount
    });

    // Get task breakdown
    const taskBreakdown = await this.getTaskBreakdown(employee.id, period);
    await TimeEntriesSummary.saveTaskBreakdown(summary.id, taskBreakdown);

    // Generate timesheet CSV (for employee review/approval)
    const csvResult = await csvService.generateTimesheetCSV(
      summary,
      employee,
      period,
      taskBreakdown
    );

    // Update summary with CSV path (stored in timesheet_pdf_path column)
    await TimeEntriesSummary.updateFilePaths(summary.id, {
      timesheet_pdf_path: csvResult.filePath
    });

    // Mark as pending internal approval (employee reviews via portal)
    await TimeEntriesSummary.markPendingApproval(summary.id);

    console.log(`✅ Timesheet pending approval for ${employee.name} — employee will review in portal`);

    return {
      success: true,
      summary: await TimeEntriesSummary.findById(summary.id),
      csvResult
    };
  }

  /**
   * Calculate hours breakdown (regular vs overtime)
   */
  async calculateHoursBreakdown(employeeId, period, totalHours, hourlyRate) {
    // Get working hours per day setting
    const settings = await db.getOne(
      "SELECT setting_value FROM system_settings WHERE setting_key = 'working_hours_per_day'"
    );
    const workingHoursPerDay = parseInt(settings?.setting_value || 8);

    // Calculate number of working days in period (Mon–Fri only)
    const startDate = new Date(period.start_date);
    const endDate = new Date(period.end_date);
    const workingDays = this.countWorkingDays(startDate, endDate);

    // Regular hours = working hours per day * working days
    const maxRegularHours = workingHoursPerDay * workingDays;
    const regularHours = Math.min(totalHours, maxRegularHours);
    const overtimeHours = Math.max(0, totalHours - maxRegularHours);

    // Get overtime multiplier
    const overtimeSetting = await db.getOne(
      "SELECT setting_value FROM system_settings WHERE setting_key = 'overtime_multiplier'"
    );
    const overtimeMultiplier = parseFloat(overtimeSetting?.setting_value || 1.5);

    // Calculate gross amount
    const grossAmount = (regularHours * hourlyRate) + (overtimeHours * hourlyRate * overtimeMultiplier);

    return {
      totalHours,
      regularHours,
      overtimeHours,
      grossAmount
    };
  }

  /**
   * Count Mon–Fri working days between two dates (inclusive)
   */
  countWorkingDays(startDate, endDate) {
    let count = 0;
    const current = new Date(startDate);
    while (current <= endDate) {
      const day = current.getDay();
      if (day !== 0 && day !== 6) count++;
      current.setDate(current.getDate() + 1);
    }
    return count;
  }

  /**
   * Get task breakdown for an employee in a period
   */
  async getTaskBreakdown(employeeId, period) {
    const entries = await TimeEntry.findByDateRange(employeeId, period.start_date, period.end_date);
    
    return entries.map(entry => ({
      task_date: entry.entry_date,
      task_name: entry.task_description || 'General Work',
      project_name: entry.project_name || 'N/A',
      hours: parseFloat(entry.hours_worked),
      description: entry.task_description,
      wrike_task_id: entry.wrike_task_id
    }));
  }

  /**
   * Handle approval from Wrike webhook
   */
  async handleApproval(wrikeTaskId, newStatus) {
    console.log(`📨 Processing webhook for task: ${wrikeTaskId}, status: ${newStatus}`);

    // Find summary by Wrike task ID
    const summary = await TimeEntriesSummary.findByWrikeTaskId(wrikeTaskId);

    if (!summary) {
      console.warn(`⚠️  No summary found for task: ${wrikeTaskId}`);
      return { success: false, reason: 'summary_not_found' };
    }

    // Safety check - don't process if already processed
    if (summary.approval_status !== 'pending') {
      console.log(`⏭️  Summary already ${summary.approval_status}`);
      return { success: false, reason: 'already_processed' };
    }

    if (newStatus === 'Approved' || newStatus === 'Completed') {
      return await this.processApproval(summary);
    } else if (newStatus === 'Rejected' || newStatus === 'Cancelled') {
      return await this.processRejection(summary);
    }

    return { success: false, reason: 'unknown_status' };
  }

  /**
   * Process approval
   */
  async processApproval(summary, approvedBy = 'employee') {
    console.log(`✅ Processing approval for summary: ${summary.id}`);

    // Get full details
    const fullSummary = await TimeEntriesSummary.getWithDetails(summary.id);
    const period = await PayPeriod.findById(fullSummary.period_id);

    // Mark as approved first — approval must succeed even if Drive upload fails
    await TimeEntriesSummary.markApproved(summary.id, approvedBy);
    fullSummary.approval_status = 'approved';

    // Generate final payslip PDF
    const payslip = await this.generatePayslip(fullSummary, period);

    // Update summary with payslip path immediately (so employee can download even without Drive)
    await TimeEntriesSummary.updateFilePaths(summary.id, {
      payslip_pdf_path: payslip.pdf_path
    });

    // Upload to Drive (optional — failure does NOT block approval)
    let driveResult = null;
    try {
      driveResult = await this.uploadPayslipToDrive(payslip, fullSummary, period);
      await TimeEntriesSummary.updateFilePaths(summary.id, {
        drive_file_id: driveResult.fileId,
        drive_file_url: driveResult.webViewLink
      });
    } catch (driveError) {
      console.warn(`⚠️  Drive upload failed (approval still succeeded): ${driveError.message}`);
    }

    console.log(`🎉 Approval complete for ${fullSummary.employee_name}`);

    return {
      success: true,
      action: 'approved',
      summary: fullSummary,
      payslip,
      drive: driveResult
    };
  }

  /**
   * Process rejection
   */
  async processRejection(summary) {
    console.log(`❌ Processing rejection for summary: ${summary.id}`);

    // Mark as rejected
    await TimeEntriesSummary.markRejected(summary.id, 'Rejected via Wrike');

    // Get full details for notification
    const fullSummary = await TimeEntriesSummary.getWithDetails(summary.id);

    console.log(`📝 Summary ${summary.id} marked as rejected`);

    return {
      success: true,
      action: 'rejected',
      summary: fullSummary
    };
  }

  /**
   * Generate final payslip after approval
   */
  async generatePayslip(summary, period) {
    console.log(`📄 Generating payslip for ${summary.employee_name}...`);

    // Safety check
    if (summary.approval_status !== 'approved') {
      throw new Error('Cannot generate payslip for non-approved summary');
    }

    // Idempotency: return existing payslip if one was already created for this summary
    const existing = await Payslip.findBySummaryId(summary.id);
    if (existing) {
      console.log(`✅ Payslip already exists: ${existing.payslip_number}`);
      return existing;
    }

    // Generate payslip number
    const payslipNumber = await Payslip.generatePayslipNumber();

    // Build employee object from the joined summary fields
    // Note: summary.employee_id = integer FK (employees.id)
    //       summary.emp_code    = string code like "EMP001"
    const employee = {
      name: summary.employee_name,
      employee_id: summary.emp_code,
      department: summary.department,
      position: summary.position,
      email: summary.email,
      currency: summary.currency
    };

    // Generate PDF
    const pdfResult = await pdfService.generatePayslipPDF(
      summary,
      employee,
      period,
      payslipNumber
    );

    // Create payslip record — pass the same number used in the PDF
    const payslip = await Payslip.create({
      summary_id: summary.id,
      payslip_number: payslipNumber,
      employee_id: summary.employee_id,
      period_id: period.id,
      total_hours: summary.total_hours,
      hourly_rate: summary.hourly_rate,
      gross_amount: summary.gross_amount,
      net_amount: summary.net_amount,
      pdf_path: pdfResult.filePath
    });

    console.log(`✅ Payslip generated: ${payslipNumber}`);

    return payslip;
  }

  /**
   * Upload payslip to Google Drive
   */
  async uploadPayslipToDrive(payslip, summary, period) {
    console.log(`☁️  Uploading payslip to Drive...`);

    try {
      const result = await driveService.uploadPayslip(
        payslip.pdf_path,
        summary.employee_name,
        period.period_name
      );

      // Update payslip with drive info
      await Payslip.updateFileInfo(payslip.id, {
        drive_file_id: result.fileId,
        drive_file_url: result.webViewLink
      });

      console.log(`✅ Payslip uploaded: ${result.webViewLink}`);

      return result;
    } catch (error) {
      console.error(`❌ Failed to upload to Drive: ${error.message}`);
      throw error;
    }
  }

  /**
   * Resend approval request
   */
  async resendApproval(summaryId) {
    const summary = await TimeEntriesSummary.getWithDetails(summaryId);

    if (!summary) {
      throw new Error('Summary not found');
    }

    if (summary.approval_status !== 'pending' && summary.approval_status !== 'rejected') {
      throw new Error('Can only resend for pending or rejected summaries');
    }

    // Reset to pending
    await TimeEntriesSummary.resetToPending(summaryId);

    // Get employee
    const employee = await Employee.findById(summary.employee_id);

    // Create new Wrike task (summary from getWithDetails already includes period dates)
    const wrikeTask = await wrikeService.createTimesheetApprovalTask(summary, employee, {
      start_date: summary.start_date,
      end_date: summary.end_date
    });

    // Update with new task ID
    await TimeEntriesSummary.setApprovalTaskId(summaryId, wrikeTask.id);

    // Attach existing timesheet file (CSV)
    if (summary.timesheet_pdf_path) {
      try {
        const ext = summary.timesheet_pdf_path.endsWith('.csv') ? 'csv' : 'pdf';
        await wrikeService.attachFileToTask(
          wrikeTask.id,
          summary.timesheet_pdf_path,
          `Timesheet_${summary.period_name}.${ext}`
        );
      } catch (error) {
        console.warn('Could not attach timesheet file:', error.message);
      }
    }

    return {
      success: true,
      wrikeTask: wrikeTask
    };
  }

  /**
   * Get dashboard statistics
   */
  async getDashboardStats() {
    const currentPeriod = await PayPeriod.getCurrentPeriod();

    // All stats are global (all periods) so the 4 cards are always consistent
    const summaryStats   = await TimeEntriesSummary.getStatistics(null);
    const grossByCurrency = await TimeEntriesSummary.getGrossByCurrency(null);
    const payslipStats   = await Payslip.getStatistics(null);
    const netByCurrency  = await Payslip.getNetByCurrency(null);
    const pendingApprovals = await TimeEntriesSummary.getPendingApprovals();

    return {
      currentPeriod,
      summaries: { ...summaryStats, grossByCurrency },
      payslips:  { ...payslipStats,  netByCurrency },
      pendingApprovals: pendingApprovals.length
    };
  }

  /**
   * Manually trigger timesheet generation for specific employee
   */
  async generateForEmployee(employeeId, periodId = null) {
    const employee = await Employee.findById(employeeId);
    if (!employee) {
      throw new Error('Employee not found');
    }

    const period = periodId
      ? await PayPeriod.findById(periodId)
      : await PayPeriod.getOrCreateCurrentPeriod();

    if (!period) {
      throw new Error('Period not found');
    }

    return this.processEmployeeTimesheet(employee, period);
  }

  /**
   * Preview timesheet for an employee over a custom date range.
   * Tries Wrike live first; falls back to imported time_entries in DB if Wrike returns 0.
   */
  async previewTimesheet(employeeId, startDate, endDate) {
    const employee = await Employee.findById(employeeId);
    if (!employee) throw new Error('Employee not found');
    if (!employee.wrike_user_id) throw new Error('Employee has no Wrike user ID linked');

    const hourlyRate = parseFloat(employee.hourly_rate) || parseFloat(process.env.DEFAULT_HOURLY_RATE || 500);
    const fakeperiod = { start_date: startDate, end_date: endDate };

    // ── 1. Try fetching from Wrike live ─────────────────────────────────────
    let source     = 'wrike';
    let dailyMap   = {};
    let taskDetails = [];
    let totalHours = 0;
    let wrikeError = null;

    try {
      const timelogs  = await wrikeService.getTimeLogs(startDate, endDate, [employee.wrike_user_id]);
      const byUser    = wrikeService.groupTimeLogsByUser(timelogs);
      const userLogs  = byUser[employee.wrike_user_id] || [];
      const taskTitles = await wrikeService.getTaskTitles(userLogs.map(l => l.taskId).filter(Boolean));

      for (const log of userLogs) {
        const d = log.date?.substring(0, 10); // normalise to YYYY-MM-DD regardless of time suffix
        if (!dailyMap[d]) dailyMap[d] = 0;
        dailyMap[d] += log.hours;
      }

      taskDetails = userLogs.map(log => ({
        date:      log.date?.substring(0, 10),
        hours:     log.hours,
        taskId:    log.taskId,
        taskTitle: taskTitles[log.taskId] || log.taskId || '—',
        comment:   log.comment || ''
      }));

      totalHours = userLogs.reduce((sum, l) => sum + l.hours, 0);
    } catch (err) {
      wrikeError = err.message;
      console.error('⚠️  previewTimesheet Wrike fetch failed:', err.message);
    }

    // ── 2. Fall back to imported DB entries when Wrike returns 0 ────────────
    if (totalHours === 0) {
      const dbEntries = await TimeEntry.findByDateRange(employee.id, startDate, endDate);

      if (dbEntries.length > 0) {
        source     = 'db';
        dailyMap   = {};
        taskDetails = [];

        for (const entry of dbEntries) {
          const d = String(entry.entry_date).substring(0, 10);
          if (!dailyMap[d]) dailyMap[d] = 0;
          dailyMap[d] += parseFloat(entry.hours_worked);

          taskDetails.push({
            date:      d,
            hours:     parseFloat(entry.hours_worked),
            taskId:    entry.wrike_task_id || null,
            taskTitle: entry.project_name || entry.task_description || '—',
            comment:   entry.task_description || ''
          });
        }

        totalHours = dbEntries.reduce((sum, e) => sum + parseFloat(e.hours_worked), 0);
      }
    }

    const breakdown = await this.calculateHoursBreakdown(employee.id, fakeperiod, totalHours, hourlyRate);

    return {
      employee: {
        id:           employee.id,
        employee_id:  employee.employee_id,
        name:         employee.name,
        department:   employee.department,
        position:     employee.position,
        email:        employee.email,
        hourly_rate:  hourlyRate,
        wrike_user_id: employee.wrike_user_id
      },
      startDate,
      endDate,
      source,          // 'wrike' | 'db'
      wrikeError,      // null if Wrike succeeded
      dailyHours:    dailyMap,
      taskDetails,
      totalHours:    +totalHours.toFixed(2),
      regularHours:  +breakdown.regularHours.toFixed(2),
      overtimeHours: +breakdown.overtimeHours.toFixed(2),
      hourlyRate,
      grossAmount:   +breakdown.grossAmount.toFixed(2)
    };
  }

  /**
   * Submit timesheet for approval — imports timelogs, generates PDF, routes to employee portal.
   */
  async submitTimesheet(employeeId, startDate, endDate, periodName = null) {
    const employee = await Employee.findById(employeeId);
    if (!employee) throw new Error('Employee not found');

    // Derive period name if not provided
    const name = periodName || (() => {
      const s = new Date(startDate);
      const e = new Date(endDate);
      return `${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}–${e.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    })();

    // Get or create pay period
    let period = await PayPeriod.findByDateRange(startDate, endDate);
    if (!period) {
      period = await PayPeriod.create({ period_name: name, start_date: startDate, end_date: endDate });
    }

    // Fetch and import Wrike timelogs for this employee + range
    const timelogs  = await wrikeService.getTimeLogs(startDate, endDate, [employee.wrike_user_id]);
    const byUser    = wrikeService.groupTimeLogsByUser(timelogs);
    const userLogs  = byUser[employee.wrike_user_id] || [];
    const taskTitles = await wrikeService.getTaskTitles(userLogs.map(l => l.taskId).filter(Boolean));

    // Import into time_entries (skip duplicates)
    for (const log of userLogs) {
      if (!log.hours || log.hours <= 0) continue;
      const existing = await TimeEntry.findDuplicate(employee.id, log.date, log.logId);
      if (existing) continue;
      const description = `[${log.logId}] ${log.comment || taskTitles[log.taskId] || ''}`.trim();
      await TimeEntry.create({
        employee_id:      employee.id,
        entry_date:       log.date,
        hours_worked:     log.hours,
        task_description: description,
        project_name:     taskTitles[log.taskId] || null,
        wrike_task_id:    log.taskId || null,
        source:           'wrike'
      });
    }

    // Now run standard timesheet processing for this employee + period
    const result = await this.processEmployeeTimesheet(employee, period);

    // Surface failures as real errors so the HTTP layer returns non-200
    if (!result.success) {
      if (result.reason === 'no_hours') {
        throw new Error(
          'No hours found for this period. Import Wrike timelogs first via the "Wrike Timesheets" page.'
        );
      }
      if (result.reason === 'already_approved') {
        throw new Error('This timesheet has already been approved and a payslip was generated.');
      }
      throw new Error(`Timesheet processing failed: ${result.reason}`);
    }

    return result;
  }

  /**
   * Approve a timesheet summary by ID (called from employee portal)
   */
  async approveSummary(summaryId, approvedBy = 'employee') {
    const summary = await TimeEntriesSummary.findById(summaryId);
    if (!summary) throw new Error('Timesheet not found');
    if (summary.approval_status !== 'pending') {
      throw new Error(`Cannot approve — timesheet is already ${summary.approval_status}`);
    }
    return await this.processApproval(summary, approvedBy);
  }

  /**
   * Reject a timesheet summary by ID (called from employee portal)
   */
  async rejectSummary(summaryId, reason, rejectionFiles = null) {
    const summary = await TimeEntriesSummary.findById(summaryId);
    if (!summary) throw new Error('Timesheet not found');
    if (summary.approval_status !== 'pending') {
      throw new Error(`Cannot reject — timesheet is already ${summary.approval_status}`);
    }
    await TimeEntriesSummary.markRejected(summary.id, reason, rejectionFiles);
    const fullSummary = await TimeEntriesSummary.getWithDetails(summary.id);
    console.log(`❌ Timesheet ${summaryId} rejected by employee. Reason: ${reason}`);
    return { success: true, action: 'rejected', summary: fullSummary };
  }
}

module.exports = new TimesheetService();
