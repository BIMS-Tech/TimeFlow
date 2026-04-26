const Employee = require('../models/Employee');
const User = require('../models/User');
const cache = require('../services/cache.service');

const invalidateEmployeeCache = () => {
  cache.invalidatePattern('db:employees:*').catch(() => {});
  cache.del('db:dashboard').catch(() => {});
};

/**
 * Employee Controller
 * Handles employee-related API endpoints
 */
class EmployeeController {
  /**
   * Get all employees
   * GET /api/employees
   */
  async getAll(req, res) {
    try {
      const { activeOnly } = req.query;
      const employees = await Employee.findAll(activeOnly !== 'false');
      res.json({
        success: true,
        data: employees
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get employee by ID
   * GET /api/employees/:id
   */
  async getById(req, res) {
    try {
      const employee = await Employee.getWithStats(req.params.id);
      if (!employee) {
        return res.status(404).json({
          success: false,
          error: 'Employee not found'
        });
      }
      res.json({
        success: true,
        data: employee
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Create new employee
   * POST /api/employees
   */
  async create(req, res) {
    try {
      const { employee_id, name, email, department, position, hourly_rate, currency, wrike_user_id, hire_date } = req.body;

      // Validate required fields
      if (!employee_id || !name || !email) {
        return res.status(400).json({
          success: false,
          error: 'employee_id, name, and email are required'
        });
      }

      // Check if employee_id or email already exists
      const existingById = await Employee.findByEmployeeId(employee_id);
      if (existingById) {
        return res.status(400).json({
          success: false,
          error: 'Employee ID already exists'
        });
      }

      const existingByEmail = await Employee.findByEmail(email);
      if (existingByEmail) {
        return res.status(400).json({
          success: false,
          error: 'Email already exists'
        });
      }

      const employee = await Employee.create(req.body);

      // Auto-create portal login for this employee
      let portalAccount = null;
      const tempPassword = `${employee_id}@${new Date().getFullYear()}`;
      const username = (email.split('@')[0]).replace(/[^a-z0-9_]/gi, '').toLowerCase() || employee_id.toLowerCase();
      try {
        // Check if username is taken; append employee_id suffix if so
        const existingUser = await User.findByUsername(username);
        const finalUsername = existingUser ? `${username}_${employee_id.toLowerCase()}` : username;
        // Use portal-only email if the employee's email is already taken by another account
        const emailTaken = await User.findByEmailAny(email);
        const portalEmail = emailTaken ? `${employee_id.toLowerCase()}@portal.local` : email;
        portalAccount = await User.create({
          username: finalUsername,
          email: portalEmail,
          password: tempPassword,
          role: 'viewer',        // uses viewer role; employee_id link identifies portal users
          employee_id: employee.id
        });
      } catch (userErr) {
        console.warn('⚠️  Could not create portal account for employee:', userErr.message);
      }

      invalidateEmployeeCache();
      res.status(201).json({
        success: true,
        data: employee,
        portalAccount: portalAccount ? {
          username: portalAccount.username,
          tempPassword,
          note: 'Share these credentials with the employee. They should change the password after first login.'
        } : null
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Update employee
   * PUT /api/employees/:id
   */
  async update(req, res) {
    try {
      const employee = await Employee.findById(req.params.id);
      if (!employee) {
        return res.status(404).json({
          success: false,
          error: 'Employee not found'
        });
      }

      const updated = await Employee.update(req.params.id, req.body);
      invalidateEmployeeCache();
      res.json({
        success: true,
        data: updated
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Delete employee
   * DELETE /api/employees/:id
   */
  async delete(req, res) {
    try {
      const employee = await Employee.findById(req.params.id);
      if (!employee) {
        return res.status(404).json({
          success: false,
          error: 'Employee not found'
        });
      }

      await Employee.delete(req.params.id);
      invalidateEmployeeCache();
      res.json({
        success: true,
        message: 'Employee deleted successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Deactivate employee
   * POST /api/employees/:id/deactivate
   */
  async deactivate(req, res) {
    try {
      const employee = await Employee.findById(req.params.id);
      if (!employee) {
        return res.status(404).json({
          success: false,
          error: 'Employee not found'
        });
      }

      const updated = await Employee.update(req.params.id, { is_active: false });
      res.json({
        success: true,
        data: updated
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Activate employee
   * POST /api/employees/:id/activate
   */
  async activate(req, res) {
    try {
      const employee = await Employee.findById(req.params.id);
      if (!employee) {
        return res.status(404).json({
          success: false,
          error: 'Employee not found'
        });
      }

      const updated = await Employee.update(req.params.id, { is_active: true });
      res.json({
        success: true,
        data: updated
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get employee timesheet history
   * GET /api/employees/:id/timesheets
   */
  async getTimesheets(req, res) {
    try {
      const { limit } = req.query;
      const db = require('../database/connection');
      
      const timesheets = await db.query(`
        SELECT tes.*, pp.period_name, pp.start_date, pp.end_date
        FROM time_entries_summary tes
        JOIN pay_periods pp ON tes.period_id = pp.id
        WHERE tes.employee_id = ?
        ORDER BY pp.start_date DESC
        LIMIT ?
      `, [req.params.id, parseInt(limit) || 20]);

      res.json({
        success: true,
        data: timesheets
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Create portal account for an existing employee who doesn't have one
   * POST /api/employees/:id/create-portal-account
   */
  async createPortalAccount(req, res) {
    try {
      const employee = await Employee.findById(req.params.id);
      if (!employee) return res.status(404).json({ success: false, error: 'Employee not found' });

      // Check if a portal account already exists for this employee
      const existingByEmpId = await User.findByEmployeeId(employee.id);
      if (existingByEmpId) return res.status(400).json({ success: false, error: 'Portal account already exists for this employee' });

      const tempPassword = `${employee.employee_id}@${new Date().getFullYear()}`;
      const baseUsername = (employee.email.split('@')[0]).replace(/[^a-z0-9_]/gi, '').toLowerCase() || employee.employee_id.toLowerCase();
      const existingUsername = await User.findByUsername(baseUsername);
      const finalUsername = existingUsername ? `${baseUsername}_${employee.employee_id.toLowerCase()}` : baseUsername;

      // If the employee's email is already used by another account, use a portal-only email
      const userWithSameEmail = await User.findByEmailAny(employee.email);
      const portalEmail = userWithSameEmail
        ? `${employee.employee_id.toLowerCase()}@portal.local`
        : employee.email;

      const user = await User.create({
        username: finalUsername,
        email: portalEmail,
        password: tempPassword,
        role: 'viewer',
        employee_id: employee.id
      });

      res.json({
        success: true,
        data: {
          username: user.username,
          tempPassword,
          note: 'Share these credentials with the employee. They should change the password after first login.'
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Revoke portal access for an employee's linked user account
   * POST /api/employees/:id/revoke-access
   */
  async revokeAccess(req, res) {
    try {
      const employee = await Employee.findById(req.params.id);
      if (!employee) return res.status(404).json({ success: false, error: 'Employee not found' });

      const user = await User.findByEmployeeId(employee.id);
      if (!user) return res.status(404).json({ success: false, error: 'No portal account found for this employee' });

      await User.setActive(user.id, false);
      res.json({ success: true, message: 'Portal access revoked' });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Restore portal access for an employee's linked user account
   * POST /api/employees/:id/restore-access
   */
  async restoreAccess(req, res) {
    try {
      const employee = await Employee.findById(req.params.id);
      if (!employee) return res.status(404).json({ success: false, error: 'Employee not found' });

      const user = await User.findByEmployeeId(employee.id);
      if (!user) return res.status(404).json({ success: false, error: 'No portal account found for this employee' });

      await User.setActive(user.id, true);
      res.json({ success: true, message: 'Portal access restored' });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Reset portal password for an employee's linked user account
   * POST /api/employees/:id/reset-password
   */
  async resetPassword(req, res) {
    try {
      const employee = await Employee.findById(req.params.id);
      if (!employee) return res.status(404).json({ success: false, error: 'Employee not found' });

      const user = await User.findByEmployeeId(employee.id);
      if (!user) return res.status(404).json({ success: false, error: 'No portal account found for this employee' });

      const newPassword = `${employee.employee_id}@${new Date().getFullYear()}`;
      await User.updatePassword(user.id, newPassword);

      res.json({
        success: true,
        data: {
          username: user.username,
          newPassword,
          note: 'Share these new credentials with the employee.'
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Get portal account info for an employee
   * GET /api/employees/:id/portal-account
   */
  async getPortalAccount(req, res) {
    try {
      const employee = await Employee.findById(req.params.id);
      if (!employee) return res.status(404).json({ success: false, error: 'Employee not found' });

      const user = await User.findByEmployeeId(employee.id);
      res.json({ success: true, data: user || null });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Get employee payslips
   * GET /api/employees/:id/payslips
   */
  async getPayslips(req, res) {
    try {
      const Payslip = require('../models/Payslip');
      const payslips = await Payslip.findByEmployee(req.params.id);
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
}

module.exports = new EmployeeController();
