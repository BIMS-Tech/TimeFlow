const TimeEntriesSummary = require('../models/TimeEntriesSummary');
const Employee = require('../models/Employee');
const Payslip = require('../models/Payslip');
const User = require('../models/User');
const timesheetService = require('../services/timesheet.service');
const db = require('../database/connection');
const path = require('path');
const fs = require('fs');

/**
 * Employee Portal Controller
 * Endpoints for employees to view and action their own timesheets
 */
class PortalController {
  /**
   * GET /api/portal/me
   * Return the logged-in employee's profile
   */
  async getMe(req, res) {
    try {
      const employee = await Employee.findById(req.user.employee_id);
      if (!employee) return res.status(404).json({ success: false, error: 'Employee record not found' });
      res.json({ success: true, data: employee });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/portal/timesheets
   * List all timesheets for the logged-in employee
   */
  async getMyTimesheets(req, res) {
    try {
      const timesheets = await TimeEntriesSummary.findByEmployee(req.user.employee_id);
      res.json({ success: true, data: timesheets });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/portal/timesheets/:id
   * Get a specific timesheet (must belong to the logged-in employee)
   */
  async getTimesheetDetail(req, res) {
    try {
      const summary = await TimeEntriesSummary.getWithDetails(req.params.id);
      if (!summary) return res.status(404).json({ success: false, error: 'Timesheet not found' });
      if (summary.employee_id !== req.user.employee_id) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }
      res.json({ success: true, data: summary });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/portal/timesheets/:id/approve
   */
  async approveTimesheet(req, res) {
    try {
      const summary = await TimeEntriesSummary.findById(req.params.id);
      if (!summary) return res.status(404).json({ success: false, error: 'Timesheet not found' });
      if (summary.employee_id !== req.user.employee_id) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }

      const result = await timesheetService.approveSummary(summary.id, `employee:${req.user.id}`);
      res.json({ success: true, data: result });
    } catch (error) {
      console.error('❌ Portal approve error:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/portal/timesheets/:id/reject
   * Body: { reason: string }
   * Optional: multipart with file uploads (field name: "files")
   */
  async rejectTimesheet(req, res) {
    try {
      const summary = await TimeEntriesSummary.findById(req.params.id);
      if (!summary) return res.status(404).json({ success: false, error: 'Timesheet not found' });
      if (summary.employee_id !== req.user.employee_id) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }

      const reason = req.body.reason || 'No reason provided';

      // Collect uploaded file paths if any
      const uploadedFiles = req.files
        ? req.files.map(f => ({ name: f.originalname, path: f.path, size: f.size }))
        : null;

      const result = await timesheetService.rejectSummary(summary.id, reason, uploadedFiles);
      res.json({ success: true, data: result });
    } catch (error) {
      console.error('❌ Portal reject error:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/portal/timesheets/:id/pdf
   * Download the draft timesheet CSV
   */
  async downloadCSV(req, res) {
    try {
      const summary = await TimeEntriesSummary.findById(req.params.id);
      if (!summary) return res.status(404).json({ success: false, error: 'Timesheet not found' });
      if (summary.employee_id !== req.user.employee_id) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }

      const filePath = summary.timesheet_pdf_path;
      if (!filePath || !fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, error: 'Timesheet file not found' });
      }

      const fileName = path.basename(filePath);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      fs.createReadStream(filePath).pipe(res);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/portal/payslips
   * List all approved payslips for the logged-in employee
   */
  async getMyPayslips(req, res) {
    try {
      const payslips = await Payslip.findByEmployee(req.user.employee_id);
      res.json({ success: true, data: payslips });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/portal/payslips/:id/pdf
   * Download payslip PDF (must belong to logged-in employee)
   */
  async downloadPayslipPDF(req, res) {
    try {
      const payslip = await Payslip.findById(req.params.id);
      if (!payslip) return res.status(404).json({ success: false, error: 'Payslip not found' });
      if (payslip.employee_id !== req.user.employee_id) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }

      const filePath = payslip.pdf_path;
      if (!filePath || !fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, error: 'PDF not found' });
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${path.basename(filePath)}"`);
      fs.createReadStream(filePath).pipe(res);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * PUT /api/portal/profile
   * Employees update their own bank details and profile info
   */
  async updateProfile(req, res) {
    try {
      const allowed = [
        // Name parts (XCS local bank file)
        'first_name', 'last_name', 'middle_name',
        // Bank details
        'bank_name', 'bank_account_number', 'bank_account_name', 'bank_branch', 'bank_swift_code',
        // DFT international fields
        'remittance_type', 'beneficiary_code', 'beneficiary_address', 'bank_address',
        'country_of_destination', 'purpose_nature',
        'intermediary_bank_name', 'intermediary_bank_address', 'intermediary_bank_swift',
        'payee_tin', 'payee_zip_code', 'payee_foreign_address', 'payee_foreign_zip_code', 'tax_code',
      ];
      const updates = {};
      for (const key of allowed) {
        if (req.body[key] !== undefined) updates[key] = req.body[key] || null;
      }
      if (!Object.keys(updates).length) {
        return res.status(400).json({ success: false, error: 'No updatable fields provided' });
      }
      await Employee.update(req.user.employee_id, updates);
      const employee = await Employee.findById(req.user.employee_id);
      res.json({ success: true, data: employee });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/portal/change-password
   * Body: { currentPassword, newPassword }
   */
  async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ success: false, error: 'Both current and new password are required' });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ success: false, error: 'New password must be at least 6 characters' });
      }

      // Fetch full user row to get password_hash
      const userRow = await db.getOne('SELECT * FROM users WHERE id = ?', [req.user.id]);
      if (!userRow) return res.status(404).json({ success: false, error: 'User not found' });

      const valid = await User.verifyPassword(currentPassword, userRow.password_hash);
      if (!valid) {
        return res.status(400).json({ success: false, error: 'Current password is incorrect' });
      }

      await User.updatePassword(req.user.id, newPassword);
      res.json({ success: true, message: 'Password changed successfully' });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/portal/category-hours?periodId=X
   * Returns category hours for the logged-in employee only
   */
  async getCategoryHours(req, res) {
    try {
      const { periodId } = req.query;
      const result = await timesheetService.getCategoryHours(
        periodId ? parseInt(periodId) : null,
        req.user.employee_id
      );
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = new PortalController();
