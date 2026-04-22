const Employee = require('../models/Employee');
const PayPeriod = require('../models/PayPeriod');
const TimeEntry = require('../models/TimeEntry');
const TimeEntriesSummary = require('../models/TimeEntriesSummary');
const Payslip = require('../models/Payslip');
const wrikeService = require('./wrike.service');
const pdfService = require('./pdf.service');
const csvService = require('./csv.service');
const db = require('../database/connection');
require('dotenv').config();

const ERR_ALREADY_APPROVED = 'already_approved';
const ERR_ALREADY_GENERATED = 'A payslip has already been generated for this employee and period.';

/**
 * Timesheet Service
 * Core business logic for timesheet processing
 */
class TimesheetService {
  constructor() {
    this._settingsCache = null;
  }

  /** Load system settings once and cache for the lifetime of the process */
  async getSettings() {
    if (this._settingsCache) return this._settingsCache;
    const rows = await db.query(
      "SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('working_hours_per_day','overtime_multiplier')"
    );
    const map = {};
    for (const r of rows) map[r.setting_key] = r.setting_value;
    this._settingsCache = {
      workingHoursPerDay: parseInt(map['working_hours_per_day'] || 8),
      overtimeMultiplier: parseFloat(map['overtime_multiplier'] || 1.5),
    };
    return this._settingsCache;
  }

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
      // Approved — check if payslip actually exists; if not, generate it
      const existingPayslip = await Payslip.findBySummaryId(summary.id);
      if (existingPayslip) {
        console.log(`⏭️  ${employee.name} already has a payslip for this period, skipping`);
        return { success: false, reason: ERR_ALREADY_APPROVED };
      }
      // Payslip missing — generate it now
      console.log(`🔁  ${employee.name} payslip missing — generating now`);
      const fullSummary = await TimeEntriesSummary.getWithDetails(summary.id);
      const payslip = await this.generatePayslip(fullSummary, period);
      await TimeEntriesSummary.updateFilePaths(summary.id, { payslip_pdf_path: payslip.pdf_path });
      return { success: true, summary: fullSummary, payslip };
    }

    // If pending but no payslip yet, complete the approval
    if (summary && summary.approval_status === 'pending') {
      const existingPayslip = await Payslip.findBySummaryId(summary.id);
      if (existingPayslip) {
        console.log(`⏭️  ${employee.name} already has a pending timesheet with payslip`);
        return { success: true, summary, alreadyPending: true };
      }
      console.log(`🔁  ${employee.name} has pending summary without payslip — completing now`);
      const approvalResult = await this.processApproval(summary, 'auto');
      return { success: true, summary: approvalResult.summary, payslip: approvalResult.payslip };
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

    // Generate timesheet CSV (for records)
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

    // Mark pending first (required state for processApproval), then generate payslip
    await TimeEntriesSummary.markPendingApproval(summary.id);
    const pendingSummary = await TimeEntriesSummary.findById(summary.id);
    const approvalResult = await this.processApproval(pendingSummary, 'auto');

    console.log(`✅ Payslip generated for ${employee.name}`);

    return {
      success: true,
      summary: approvalResult.summary,
      payslip: approvalResult.payslip,
      csvResult
    };
  }

  /**
   * Calculate hours breakdown (regular vs overtime)
   */
  async calculateHoursBreakdown(employeeId, period, totalHours, hourlyRate) {
    const { workingHoursPerDay, overtimeMultiplier } = await this.getSettings();
    const workingDays = this.countWorkingDays(new Date(period.start_date), new Date(period.end_date));
    const maxRegularHours = workingHoursPerDay * workingDays;
    const regularHours  = Math.min(totalHours, maxRegularHours);
    const overtimeHours = Math.max(0, totalHours - maxRegularHours);
    const grossAmount   = (regularHours * hourlyRate) + (overtimeHours * hourlyRate * overtimeMultiplier);
    return { totalHours, regularHours, overtimeHours, grossAmount };
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
   * Process approval
   */
  async processApproval(summary, approvedBy = 'employee') {
    console.log(`✅ Generating payslip for summary: ${summary.id}`);

    // Get full details
    const fullSummary = await TimeEntriesSummary.getWithDetails(summary.id);
    const period = await PayPeriod.findById(fullSummary.period_id);

    // Mark as approved first — approval must succeed even if Drive upload fails
    await TimeEntriesSummary.markApproved(summary.id, approvedBy);
    fullSummary.approval_status = 'approved';

    // Generate final payslip PDF
    const payslip = await this.generatePayslip(fullSummary, period);

    // Update summary with payslip path
    await TimeEntriesSummary.updateFilePaths(summary.id, {
      payslip_pdf_path: payslip.pdf_path
    });

    console.log(`🎉 Approval complete for ${fullSummary.employee_name}`);

    return {
      success: true,
      action: 'approved',
      summary: fullSummary,
      payslip
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

    // Fetch full employee record so the PDF has all fields (bank details, hourly_rate, etc.)
    const employee = await Employee.findById(summary.employee_id) || {
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
   * Resend approval request (re-processes a rejected/pending summary)
   */
  async resendApproval(summaryId) {
    const summary = await TimeEntriesSummary.getWithDetails(summaryId);

    if (!summary) {
      throw new Error('Summary not found');
    }

    if (summary.approval_status !== 'pending' && summary.approval_status !== 'rejected') {
      throw new Error('Can only resend for pending or rejected summaries');
    }

    await TimeEntriesSummary.resetToPending(summaryId);
    const pendingSummary = await TimeEntriesSummary.findById(summaryId);
    return await this.processApproval(pendingSummary, 'admin');
  }

  /**
   * Get dashboard statistics
   */
  async getDashboardStats() {
    const [
      currentLocalPeriod,
      currentForeignPeriod,
      summaryStats,
      grossByCurrency,
      payslipStats,
      netByCurrency,
      payslipTypeStats,
      pendingApprovals,
      employeeCount,
      periodTypeCounts,
    ] = await Promise.all([
      PayPeriod.getCurrentPeriodByType('local'),
      PayPeriod.getCurrentPeriodByType('foreign'),
      TimeEntriesSummary.getStatistics(null),
      TimeEntriesSummary.getGrossByCurrency(null),
      Payslip.getStatistics(null),
      Payslip.getNetByCurrency(null),
      Payslip.getTypeStats(),
      TimeEntriesSummary.getPendingApprovals(),
      db.getOne('SELECT COUNT(*) AS count FROM employees WHERE is_active = 1'),
      db.getOne(`SELECT
        SUM(CASE WHEN period_type = 'foreign' THEN 1 ELSE 0 END) AS foreign_count,
        SUM(CASE WHEN period_type = 'local' OR period_type IS NULL THEN 1 ELSE 0 END) AS local_count,
        COUNT(*) AS total
        FROM pay_periods`),
    ]);

    return {
      currentLocalPeriod,
      currentForeignPeriod,
      summaries: { ...summaryStats, grossByCurrency },
      payslips:  { ...payslipStats, netByCurrency, local_count: payslipTypeStats?.local_count || 0, foreign_count: payslipTypeStats?.foreign_count || 0 },
      pendingApprovals: pendingApprovals.length,
      employeeCount: employeeCount?.count || 0,
      periodCounts: { total: periodTypeCounts?.total || 0, local: periodTypeCounts?.local_count || 0, foreign: periodTypeCounts?.foreign_count || 0 },
    };
  }

  /**
   * Category hours breakdown — filterable by period and/or employee.
   * Used by both admin dashboard and employee portal.
   */
  async getCategoryHours(periodId = null, employeeId = null) {
    const conditions = [];
    const params = [];

    if (periodId) {
      const period = await PayPeriod.findById(periodId);
      if (period) {
        conditions.push('te.entry_date BETWEEN ? AND ?');
        params.push(period.start_date, period.end_date);
      }
    }

    if (employeeId) {
      conditions.push('te.employee_id = ?');
      params.push(parseInt(employeeId));
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const categoryBreakdown = await db.query(`
      SELECT
        COALESCE(NULLIF(TRIM(te.category), ''), NULLIF(TRIM(te.project_name), ''), 'Uncategorized') AS category,
        ROUND(SUM(te.hours_worked), 2)                                                               AS total_hours,
        COUNT(DISTINCT te.employee_id)                                                               AS employee_count
      FROM time_entries te
      ${where}
      GROUP BY COALESCE(NULLIF(TRIM(te.category), ''), NULLIF(TRIM(te.project_name), ''), 'Uncategorized')
      ORDER BY total_hours DESC
      LIMIT 30
    `, params);

    const categoryEmployeeBreakdown = await db.query(`
      SELECT
        COALESCE(NULLIF(TRIM(te.category), ''), NULLIF(TRIM(te.project_name), ''), 'Uncategorized') AS category,
        e.name                                                                                        AS employee_name,
        e.employee_id                                                                                 AS emp_code,
        ROUND(SUM(te.hours_worked), 2)                                                               AS hours
      FROM time_entries te
      JOIN employees e ON te.employee_id = e.id
      ${where}
      GROUP BY COALESCE(NULLIF(TRIM(te.category), ''), NULLIF(TRIM(te.project_name), ''), 'Uncategorized'), te.employee_id
      ORDER BY COALESCE(NULLIF(TRIM(te.category), ''), NULLIF(TRIM(te.project_name), ''), 'Uncategorized'), hours DESC
    `, params);

    return { categoryBreakdown, categoryEmployeeBreakdown };
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

    let noApprovedHours = false;
    try {
      let timelogs = await wrikeService.getTimeLogs(startDate, endDate, [employee.wrike_user_id]);
      const approvedLogs = timelogs.filter(l => l.approvalStatus?.toLowerCase() === 'approved');
      if (timelogs.length > 0 && approvedLogs.length === 0) {
        noApprovedHours = true;
      }
      timelogs = approvedLogs;
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
      noApprovedHours, // true when Wrike has timelogs but none are approved
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
   * Process timesheet for an employee and period — imports approved Wrike timelogs and generates payslip.
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

    // Fetch and import only APPROVED Wrike timelogs for this employee + range
    let timelogs = await wrikeService.getTimeLogs(startDate, endDate, [employee.wrike_user_id]);
    const allTimelogs = timelogs;
    timelogs = timelogs.filter(l => l.approvalStatus?.toLowerCase() === 'approved');
    if (allTimelogs.length > 0 && timelogs.length === 0) {
      throw new Error(
        `No Wrike-approved hours found for this period. ${allTimelogs.length} timelog(s) exist but none are approved in Wrike yet. Please approve them in Wrike before generating payslips.`
      );
    }
    const byUser   = wrikeService.groupTimeLogsByUser(timelogs);
    const userLogs = byUser[employee.wrike_user_id] || [];
    const taskTitles = await wrikeService.getTaskTitles(userLogs.map(l => l.taskId).filter(Boolean));

    await this._importLogs(employee.id, startDate, endDate, userLogs, taskTitles);

    // Now run standard timesheet processing for this employee + period
    const result = await this.processEmployeeTimesheet(employee, period);

    // Surface failures as real errors so the HTTP layer returns non-200
    if (!result.success) {
      if (result.reason === 'no_hours') {
        throw new Error(
          'No hours found for this period. Make sure timelogs are approved in Wrike and imported via the "Wrike Timesheets" page.'
        );
      }
      if (result.reason === ERR_ALREADY_APPROVED) {
        throw new Error(ERR_ALREADY_GENERATED);
      }
      throw new Error(`Timesheet processing failed: ${result.reason}`);
    }

    return result;
  }

  /**
   * Import Wrike timelogs for one employee into time_entries.
   * Uses a single pre-load query to check for duplicates instead of N per-entry queries.
   */
  async _importLogs(employeeId, startDate, endDate, userLogs, taskTitles) {
    if (!userLogs.length) return;
    // Load all existing wrike entries for this employee/range in one query
    const existing = await db.query(
      `SELECT task_description FROM time_entries
       WHERE employee_id = ? AND entry_date BETWEEN ? AND ? AND source = 'wrike'`,
      [employeeId, startDate, endDate]
    );
    const existingLogIds = new Set(
      existing.map(e => { const m = e.task_description?.match(/^\[([^\]]+)\]/); return m?.[1]; }).filter(Boolean)
    );
    for (const log of userLogs) {
      if (!log.hours || log.hours <= 0) continue;
      if (existingLogIds.has(String(log.logId))) continue;
      await TimeEntry.create({
        employee_id:      employeeId,
        entry_date:       log.date,
        hours_worked:     log.hours,
        task_description: `[${log.logId}] ${log.comment || taskTitles[log.taskId] || ''}`.trim(),
        project_name:     taskTitles[log.taskId] || null,
        wrike_task_id:    log.taskId || null,
        source:           'wrike'
      });
    }
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
   * Bulk approve & generate payslips for a period.
   * employeeIds = array of employee DB ids, or null/empty = all employees.
   */
  /**
   * Full-pipeline payslip generation for all (or selected) employees in a period.
   * Batch-fetches all Wrike timelogs in parallel (one set of concurrent calls) instead
   * of one Wrike call per employee, then imports and generates payslips sequentially.
   * Returns per-employee details so the frontend can show a result table.
   */
  async generatePayslipsForPeriod(periodId, employeeIds = null) {
    const period = await PayPeriod.findById(periodId);
    if (!period) throw new Error('Period not found');

    const allEmployees = await Employee.findAll(true);
    const targets = (employeeIds?.length
      ? allEmployees.filter(e => employeeIds.includes(e.id))
      : allEmployees
    );

    // ── Batch-fetch Wrike timelogs for all employees in parallel ──────────────
    const wrikeEmployees = targets.filter(e => e.wrike_user_id);
    const wrikeUserIds   = [...new Set(wrikeEmployees.map(e => e.wrike_user_id))];
    let timelogsByUser = {};
    let taskTitles     = {};
    if (wrikeUserIds.length) {
      try {
        const allLogs = await wrikeService.getTimeLogs(period.start_date, period.end_date, wrikeUserIds);
        const approved = allLogs.filter(l => l.approvalStatus?.toLowerCase() === 'approved');
        timelogsByUser = wrikeService.groupTimeLogsByUser(approved);
        const taskIds  = [...new Set(approved.map(l => l.taskId).filter(Boolean))];
        if (taskIds.length) taskTitles = await wrikeService.getTaskTitles(taskIds);
      } catch (err) {
        console.warn('⚠️  Batch Wrike fetch failed:', err.message);
      }
    }

    const results = { generated: 0, skipped: 0, errors: [], details: [] };

    for (const emp of targets) {
      if (!emp.wrike_user_id) {
        results.skipped++;
        results.details.push({ emp: { name: emp.name, employee_id: emp.employee_id }, status: 'skipped', error: 'No Wrike ID' });
        continue;
      }
      const userLogs = timelogsByUser[emp.wrike_user_id] || [];
      if (!userLogs.length) {
        results.skipped++;
        results.details.push({ emp: { name: emp.name, employee_id: emp.employee_id }, status: 'no_hours' });
        continue;
      }
      try {
        // Import logs using the batched helper, then run standard processing
        await this._importLogs(emp.id, period.start_date, period.end_date, userLogs, taskTitles);
        const result = await this.processEmployeeTimesheet(emp, period);
        if (!result.success) {
          results.skipped++;
          results.details.push({ emp: { name: emp.name, employee_id: emp.employee_id }, status: result.reason === ERR_ALREADY_APPROVED ? 'exists' : 'skipped' });
        } else {
          results.generated++;
          results.details.push({
            emp:    { name: emp.name, employee_id: emp.employee_id },
            status: result.alreadyPending ? 'exists' : 'generated',
            hours:  result.summary?.total_hours,
            gross:  result.payslip?.gross_amount,
          });
        }
      } catch (err) {
        const msg = err.message || '';
        if (msg.includes(ERR_ALREADY_GENERATED) || msg.includes(ERR_ALREADY_APPROVED)) {
          results.skipped++;
          results.details.push({ emp: { name: emp.name, employee_id: emp.employee_id }, status: 'exists' });
        } else {
          results.errors.push({ employeeName: emp.name, error: msg });
          results.details.push({ emp: { name: emp.name, employee_id: emp.employee_id }, status: 'error', error: msg });
        }
      }
    }

    return { period: period.period_name, ...results };
  }

  async bulkApproveAndGenerate(periodId, employeeIds = null) {
    const period = await PayPeriod.findById(periodId);
    if (!period) throw new Error('Period not found');

    const summaries = await TimeEntriesSummary.findByPeriod(periodId);
    const targets = employeeIds && employeeIds.length
      ? summaries.filter(s => employeeIds.includes(s.employee_id))
      : summaries;

    const results = { generated: 0, skipped: 0, errors: [] };

    for (const s of targets) {
      try {
        // Auto-approve if still pending
        if (s.approval_status === 'pending') {
          await this.processApproval(s, 'admin:bulk');
          results.generated++;
        } else if (s.approval_status === 'approved') {
          // Already approved — ensure payslip exists
          const existing = await Payslip.findBySummaryId(s.id);
          if (!existing) {
            const fullSummary = await TimeEntriesSummary.getWithDetails(s.id);
            await this.generatePayslip(fullSummary, period);
            results.generated++;
          } else {
            results.skipped++;
          }
        } else {
          results.skipped++;
        }
      } catch (err) {
        results.errors.push({ summaryId: s.id, employeeName: s.employee_name || s.employee_id, error: err.message });
      }
    }

    return { period: period.period_name, ...results };
  }

  /**
   * Generate bank transfer file content for a period.
   * type = 'local' (CSV) | 'foreign' (SWIFT text)
   */
  async generateBankFile(periodId, type = 'local', employeeIds = null) {
    const period = await PayPeriod.findById(periodId);
    if (!period) throw new Error('Period not found');

    const payslips = await Payslip.findByPeriod(periodId);
    if (!payslips.length) throw new Error('No payslips found for this period. Generate payslips first.');

    const targetCategory = type === 'foreign' ? 'foreign' : 'local';
    const LOCAL_REQUIRED = ['first_name', 'last_name', 'bank_account_number'];
    const FOREIGN_REQUIRED = ['first_name', 'last_name', 'bank_account_number', 'bank_name', 'bank_swift_code', 'beneficiary_address', 'country_of_destination', 'purpose_nature', 'remittance_type'];
    const requiredFields = type === 'foreign' ? FOREIGN_REQUIRED : LOCAL_REQUIRED;

    const rows = [];
    const skipped = [];
    for (const p of payslips) {
      const emp = await Employee.findById(p.employee_id);
      if (!emp) continue;
      if (emp.hire_category !== targetCategory) continue;
      if (employeeIds && employeeIds.length && !employeeIds.includes(emp.id)) continue;
      const missing = requiredFields.filter(f => !emp[f]);
      if (missing.length > 0) {
        skipped.push({ name: emp.name, missing });
        continue;
      }
      rows.push({ payslip: p, emp });
    }

    if (!rows.length) {
      const skipDetail = skipped.length ? ` (${skipped.length} skipped due to incomplete profiles)` : '';
      throw new Error(`No ${targetCategory} employees with complete profiles and payslips found for this period${skipDetail}.`);
    }

    if (type === 'foreign') {
      // ── DFT pipe-delimited format ─────────────────────────────────────────
      // D row: transaction data (one per employee)
      // C row: tax period / payee-payor info (one per employee)
      // W row: withholding tax data (one per employee)
      const transactionDate = new Date().toISOString().split('T')[0];
      const sourceAccount = process.env.BANK_SOURCE_ACCOUNT || '';
      const payorName = process.env.PAYOR_NAME || '';
      const payorTin = process.env.PAYOR_TIN || '';
      const payorAddress = process.env.PAYOR_ADDRESS || '';
      const payorZip = process.env.PAYOR_ZIP_CODE || '';

      const lines = [];
      rows.forEach(({ payslip: p, emp }) => {
        // D row – remittance transaction
        lines.push([
          'D',
          emp.remittance_type || '',
          emp.currency || '',
          Number(p.net_amount).toFixed(2),
          sourceAccount,
          emp.bank_account_number || '',
          '0',
          emp.beneficiary_code || emp.employee_id || '',
          emp.bank_account_name || emp.name || '',
          emp.first_name || '',
          emp.middle_name || '',
          emp.last_name || '',
          emp.beneficiary_address || '',
          emp.bank_name || '',
          emp.bank_address || '',
          emp.bank_swift_code || '',
          `DFT ${transactionDate}`,
          emp.purpose_nature || '',
          emp.country_of_destination || '',
          '0',
          emp.intermediary_bank_name || '',
          emp.intermediary_bank_address || '',
          emp.intermediary_bank_swift || '',
        ].join('|'));

        // C row – tax period / payee-payor
        lines.push([
          'C',
          period.start_date ? period.start_date.toISOString ? period.start_date.toISOString().split('T')[0] : String(period.start_date).split('T')[0] : '',
          period.end_date ? period.end_date.toISOString ? period.end_date.toISOString().split('T')[0] : String(period.end_date).split('T')[0] : '',
          emp.bank_account_name || emp.name || '',
          emp.payee_tin || '',
          emp.beneficiary_address || '',
          emp.payee_zip_code || '',
          emp.payee_foreign_address || '',
          emp.payee_foreign_zip_code || '',
          payorName,
          payorTin,
          payorAddress,
          payorZip,
        ].join('|'));

        // W row – withholding tax
        lines.push([
          'W',
          emp.tax_code || '',
          '',
          '',
          '',
          Number(p.gross_amount || 0).toFixed(2),
          Number(p.tax_deductions || 0).toFixed(2),
        ].join('|'));
      });

      return {
        content: lines.join('\r\n'),
        filename: `bank_transfer_dft_${periodId}.txt`,
        contentType: 'text/plain',
        skipped
      };
    }

    // ── XCS format for local bank transfers ───────────────────────────────────
    // Fields: Last Name, First Name, Middle Name, Account Number, Amount
    const escape = (v) => `"${String(v || '').replace(/"/g, '""')}"`;
    const csvLines = ['Last Name,First Name,Middle Name,Account Number,Amount'];
    rows.forEach(({ payslip: p, emp }) => {
      csvLines.push([
        escape(emp.last_name || ''),
        escape(emp.first_name || ''),
        escape(emp.middle_name || ''),
        escape(emp.bank_account_number || ''),
        escape(Number(p.net_amount || 0).toFixed(2)),
      ].join(','));
    });
    return {
      content: csvLines.join('\r\n'),
      filename: `bank_transfer_xcs_${periodId}.csv`,
      contentType: 'text/csv',
      skipped
    };
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
