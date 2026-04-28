const db = require('../database/connection');
const { getHireCategory } = require('../services/payroll-deductions.service');

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
    const employeeType   = data.employee_type || null;
    const derivedCategory = employeeType ? getHireCategory(employeeType) : null;
    const id = await db.insert('employees', {
      employee_id: data.employee_id,
      name: data.name,
      email: data.email,
      department: data.department || null,
      position: data.position || null,
      hourly_rate: data.hourly_rate || 500.00,
      currency: data.currency || 'USD',
      employee_type: employeeType,
      employment_type: data.employment_type || 'full_time',
      hire_category: derivedCategory || data.hire_category || 'local',
      sss_number: data.sss_number || null,
      philhealth_number: data.philhealth_number || null,
      pagibig_number: data.pagibig_number || null,
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
      country_of_destination: data.country_of_destination || null,
      purpose_nature: data.purpose_nature || null,
      intermediary_bank_name: data.intermediary_bank_name || null,
      intermediary_bank_address: data.intermediary_bank_address || null,
      intermediary_bank_swift: data.intermediary_bank_swift || null,
      payee_tin: data.payee_tin || null,
      payee_zip_code: data.payee_zip_code || null,
      payee_foreign_address: data.payee_foreign_address || null,
      payee_foreign_zip_code: data.payee_foreign_zip_code || null,
      tax_code: data.tax_code || null,
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
    const updateData = { ...data };
    if (updateData.employee_type) {
      updateData.hire_category = getHireCategory(updateData.employee_type);
    }
    await db.update('employees', updateData, 'id = ?', [id]);
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
