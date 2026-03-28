const db = require('../database/connection');

/**
 * Employee Model
 */
class Employee {
  /**
   * Find employee by ID
   */
  static async findById(id) {
    return db.getOne(
      'SELECT * FROM employees WHERE id = ?',
      [id]
    );
  }

  /**
   * Find employee by employee_id
   */
  static async findByEmployeeId(employeeId) {
    return db.getOne(
      'SELECT * FROM employees WHERE employee_id = ?',
      [employeeId]
    );
  }

  /**
   * Find employee by email
   */
  static async findByEmail(email) {
    return db.getOne(
      'SELECT * FROM employees WHERE email = ?',
      [email]
    );
  }

  /**
   * Find employee by Wrike user ID
   */
  static async findByWrikeUserId(wrikeUserId) {
    return db.getOne(
      'SELECT * FROM employees WHERE wrike_user_id = ?',
      [wrikeUserId]
    );
  }

  /**
   * Get all active employees
   */
  static async findAll(activeOnly = true) {
    const where = activeOnly ? 'WHERE e.is_active = TRUE' : '';
    const sql = `
      SELECT e.*,
             u.id        AS portal_user_id,
             u.username  AS portal_username,
             u.is_active AS portal_active
      FROM employees e
      LEFT JOIN users u ON u.employee_id = e.id
      ${where}
      ORDER BY e.name
    `;
    return db.query(sql);
  }

  /**
   * Create a new employee
   */
  static async create(data) {
    const id = await db.insert('employees', {
      employee_id: data.employee_id,
      name: data.name,
      email: data.email,
      department: data.department || null,
      position: data.position || null,
      hourly_rate: data.hourly_rate || 500.00,
      currency: data.currency || 'USD',
      employment_type: data.employment_type || 'full_time',
      hire_category: data.hire_category || 'local',
      // Name parts (for XCS local bank file)
      first_name: data.first_name || null,
      last_name: data.last_name || null,
      middle_name: data.middle_name || null,
      // Bank details
      bank_name: data.bank_name || null,
      bank_account_number: data.bank_account_number || null,
      bank_account_name: data.bank_account_name || null,
      bank_branch: data.bank_branch || null,
      bank_swift_code: data.bank_swift_code || null,
      // International DFT fields
      remittance_type: data.remittance_type || null,
      beneficiary_code: data.beneficiary_code || null,
      beneficiary_address: data.beneficiary_address || null,
      bank_address: data.bank_address || null,
      wrike_user_id: data.wrike_user_id || null,
      hire_date: data.hire_date || null,
      is_active: data.is_active !== undefined ? data.is_active : true
    });
    return this.findById(id);
  }

  /**
   * Update an employee
   */
  static async update(id, data) {
    await db.update('employees', data, 'id = ?', [id]);
    return this.findById(id);
  }

  /**
   * Delete an employee
   */
  static async delete(id) {
    return db.remove('employees', 'id = ?', [id]);
  }

  /**
   * Get employee with statistics
   */
  static async getWithStats(id) {
    const sql = `
      SELECT 
        e.*,
        COUNT(DISTINCT tes.id) as total_periods,
        SUM(tes.total_hours) as total_hours_worked,
        SUM(tes.gross_amount) as total_earnings
      FROM employees e
      LEFT JOIN time_entries_summary tes ON e.id = tes.employee_id
      WHERE e.id = ?
      GROUP BY e.id
    `;
    return db.getOne(sql, [id]);
  }
}

module.exports = Employee;
