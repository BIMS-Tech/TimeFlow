const timesheetService = require('../services/timesheet.service');
const Employee = require('../models/Employee');
const PayPeriod = require('../models/PayPeriod');
const TimeEntry = require('../models/TimeEntry');
const TimeEntriesSummary = require('../models/TimeEntriesSummary');
const Payslip = require('../models/Payslip');

/**
 * Timesheet Controller
 * Handles timesheet-related API endpoints
 */
class TimesheetController {
  /**
   * Get dashboard statistics
   * GET /api/timesheet/dashboard
   */
  async getDashboard(req, res) {
    try {
      const stats = await timesheetService.getDashboardStats();
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Process current period
   * POST /api/timesheet/process
   */
  async processPeriod(req, res) {
    try {
      const { periodId } = req.body;
      const result = await timesheetService.processPeriod(periodId);
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Generate timesheet for specific employee
   * POST /api/timesheet/generate
   */
  async generateForEmployee(req, res) {
    try {
      const { employeeId, periodId } = req.body;
      const result = await timesheetService.generateForEmployee(employeeId, periodId);
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get all periods
   * GET /api/timesheet/periods
   */
  async getPeriods(req, res) {
    try {
      const { limit, offset } = req.query;
      const periods = await PayPeriod.findAll(
        parseInt(limit) || 20,
        parseInt(offset) || 0
      );
      res.json({
        success: true,
        data: periods
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get period by ID
   * GET /api/timesheet/periods/:id
   */
  async getPeriod(req, res) {
    try {
      const period = await PayPeriod.getWithSummaries(req.params.id);
      if (!period) {
        return res.status(404).json({
          success: false,
          error: 'Period not found'
        });
      }
      res.json({
        success: true,
        data: period
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get summaries for a period
   * GET /api/timesheet/periods/:id/summaries
   */
  async getPeriodSummaries(req, res) {
    try {
      const summaries = await TimeEntriesSummary.findByPeriod(req.params.id);
      res.json({
        success: true,
        data: summaries
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get summary details
   * GET /api/timesheet/summaries/:id
   */
  async getSummary(req, res) {
    try {
      const summary = await TimeEntriesSummary.getWithDetails(req.params.id);
      if (!summary) {
        return res.status(404).json({
          success: false,
          error: 'Summary not found'
        });
      }

      // Get task breakdown
      const taskBreakdown = await TimeEntriesSummary.getTaskBreakdown(req.params.id);

      res.json({
        success: true,
        data: {
          ...summary,
          taskBreakdown
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get pending approvals
   * GET /api/timesheet/pending
   */
  async getPendingApprovals(req, res) {
    try {
      const pending = await TimeEntriesSummary.getPendingApprovals();
      res.json({
        success: true,
        data: pending
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get rejected timesheets
   * GET /api/timesheet/rejected
   */
  async getRejectedTimesheets(req, res) {
    try {
      const rejected = await TimeEntriesSummary.getRejectedTimesheets();
      res.json({ success: true, data: rejected });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Get counts for nav badges (pending + rejected)
   * GET /api/timesheet/counts
   */
  async getCounts(req, res) {
    try {
      const [pending, rejected] = await Promise.all([
        TimeEntriesSummary.countByStatus('pending'),
        TimeEntriesSummary.countByStatus('rejected')
      ]);
      res.json({ success: true, data: { pending, rejected } });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Resend approval request
   * POST /api/timesheet/summaries/:id/resend
   */
  async resendApproval(req, res) {
    try {
      const result = await timesheetService.resendApproval(req.params.id);
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Manually approve a summary
   * POST /api/timesheet/summaries/:id/approve
   */
  async approveSummary(req, res) {
    try {
      const summary = await TimeEntriesSummary.findById(req.params.id);
      if (!summary) {
        return res.status(404).json({
          success: false,
          error: 'Summary not found'
        });
      }

      const result = await timesheetService.processApproval(summary);
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Generate (or re-generate) payslip for an approved summary
   * POST /api/timesheet/summaries/:id/generate-payslip
   */
  async generatePayslipForSummary(req, res) {
    try {
      const summary = await TimeEntriesSummary.getWithDetails(req.params.id);
      if (!summary) {
        return res.status(404).json({ success: false, error: 'Summary not found' });
      }
      if (summary.approval_status !== 'approved') {
        return res.status(400).json({ success: false, error: 'Summary must be approved first' });
      }
      const PayPeriod = require('../models/PayPeriod');
      const period = await PayPeriod.findById(summary.period_id);
      const payslip = await timesheetService.generatePayslip(summary, period);
      res.json({ success: true, data: payslip });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Manually reject a summary
   * POST /api/timesheet/summaries/:id/reject
   */
  async rejectSummary(req, res) {
    try {
      const { reason } = req.body;
      const summary = await TimeEntriesSummary.markRejected(req.params.id, reason);
      res.json({
        success: true,
        data: summary
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get time entries for an employee
   * GET /api/timesheet/employees/:id/entries
   */
  async getEmployeeEntries(req, res) {
    try {
      const { startDate, endDate } = req.query;
      let entries;

      if (startDate && endDate) {
        entries = await TimeEntry.findByDateRange(req.params.id, startDate, endDate);
      } else {
        entries = await TimeEntry.findByEmployee(req.params.id);
      }

      res.json({
        success: true,
        data: entries
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Add time entry
   * POST /api/timesheet/entries
   */
  async addTimeEntry(req, res) {
    try {
      const entry = await TimeEntry.create(req.body);
      res.status(201).json({
        success: true,
        data: entry
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Bulk import time entries
   * POST /api/timesheet/entries/bulk
   */
  async bulkImportEntries(req, res) {
    try {
      const { entries } = req.body;
      const result = await TimeEntry.bulkCreate(entries);
      res.status(201).json({
        success: true,
        data: result,
        count: result.length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get payslips for a period
   * GET /api/timesheet/periods/:id/payslips
   */
  async getPeriodPayslips(req, res) {
    try {
      const payslips = await Payslip.findByPeriod(req.params.id);
      res.json({
        success: true,
        data: payslips
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get payslip details
   * GET /api/timesheet/payslips/:id
   */
  async getPayslip(req, res) {
    try {
      const payslip = await Payslip.getWithDetails(req.params.id);
      if (!payslip) {
        return res.status(404).json({
          success: false,
          error: 'Payslip not found'
        });
      }
      res.json({
        success: true,
        data: payslip
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Create a new period
   * POST /api/timesheet/periods
   */
  async createPeriod(req, res) {
    try {
      const period = await PayPeriod.create(req.body);
      res.status(201).json({
        success: true,
        data: period
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Create periods for a month
   * POST /api/timesheet/periods/monthly
   */
  async createMonthlyPeriods(req, res) {
    try {
      const { year, month } = req.body;
      const periods = await PayPeriod.createMonthlyPeriods(year, month);
      res.status(201).json({
        success: true,
        data: periods
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Update a period
   * PUT /api/timesheet/periods/:id
   */
  async updatePeriod(req, res) {
    try {
      const { period_name, start_date, end_date, status } = req.body;
      const period = await PayPeriod.update(req.params.id, { period_name, start_date, end_date, status });
      if (!period) return res.status(404).json({ success: false, error: 'Period not found' });
      res.json({ success: true, data: period });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Delete a period
   * DELETE /api/timesheet/periods/:id
   */
  async deletePeriod(req, res) {
    try {
      const period = await PayPeriod.findById(req.params.id);
      if (!period) return res.status(404).json({ success: false, error: 'Period not found' });
      await PayPeriod.delete(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Preview timesheet hours from Wrike for an employee + date range (no DB writes)
   * POST /api/timesheet/preview
   */
  async previewTimesheet(req, res) {
    try {
      const { employeeId, startDate, endDate } = req.body;
      if (!employeeId || !startDate || !endDate) {
        return res.status(400).json({ success: false, error: 'employeeId, startDate and endDate are required' });
      }
      const result = await timesheetService.previewTimesheet(employeeId, startDate, endDate);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Submit timesheet for approval — imports timelogs, generates PDF, creates Wrike task
   * POST /api/timesheet/submit
   */
  async submitTimesheet(req, res) {
    try {
      const { employeeId, startDate, endDate, periodName } = req.body;
      if (!employeeId || !startDate || !endDate) {
        return res.status(400).json({ success: false, error: 'employeeId, startDate and endDate are required' });
      }
      const result = await timesheetService.submitTimesheet(employeeId, startDate, endDate, periodName);
      res.json({ success: true, data: result });
    } catch (error) {
      console.error('❌ submitTimesheet error:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = new TimesheetController();
