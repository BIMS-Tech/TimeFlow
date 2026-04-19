const db = require('../database/connection');
const { v4: uuidv4 } = require('uuid');

/**
 * Payslip Model
 */
class Payslip {
  /**
   * Find payslip by ID
   */
  static async findById(id) {
    return db.getOne(
      'SELECT * FROM payslips WHERE id = ?',
      [id]
    );
  }

  /**
   * Find payslip by payslip number
   */
  static async findByPayslipNumber(payslipNumber) {
    return db.getOne(
      'SELECT * FROM payslips WHERE payslip_number = ?',
      [payslipNumber]
    );
  }

  /**
   * Find payslip by summary ID
   */
  static async findBySummaryId(summaryId) {
    return db.getOne(
      'SELECT * FROM payslips WHERE summary_id = ?',
      [summaryId]
    );
  }

  /**
   * Get payslips by employee
   */
  static async findByEmployee(employeeId, limit = 20) {
    const sql = `
      SELECT p.*, pp.period_name, pp.start_date, pp.end_date
      FROM payslips p
      JOIN pay_periods pp ON p.period_id = pp.id
      WHERE p.employee_id = ?
      ORDER BY p.generated_at DESC
      LIMIT ?
    `;
    return db.query(sql, [employeeId, limit]);
  }

  /**
   * Get payslips by period
   */
  static async findByPeriod(periodId) {
    const sql = `
      SELECT p.*, e.name as employee_name, e.employee_id as emp_code, e.email, e.currency
      FROM payslips p
      JOIN employees e ON p.employee_id = e.id
      WHERE p.period_id = ?
      ORDER BY e.name
    `;
    return db.query(sql, [periodId]);
  }

  /**
   * Generate a new payslip number
   */
  static async generatePayslipNumber() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    
    // Get count for this month
    const count = await db.getOne(`
      SELECT COUNT(*) as count FROM payslips
      WHERE YEAR(generated_at) = ? AND MONTH(generated_at) = ?
    `, [year, month]);
    
    const sequence = String(count.count + 1).padStart(4, '0');
    return `PAY-${year}${month}-${sequence}`;
  }

  /**
   * Create a new payslip
   */
  static async create(data) {
    const payslipNumber = data.payslip_number || await this.generatePayslipNumber();
    
    const id = await db.insert('payslips', {
      summary_id: data.summary_id,
      payslip_number: payslipNumber,
      employee_id: data.employee_id,
      period_id: data.period_id,
      total_hours: data.total_hours,
      hourly_rate: data.hourly_rate,
      gross_amount: data.gross_amount,
      tax_deductions: data.tax_deductions || 0,
      other_deductions: data.other_deductions || 0,
      net_amount: data.net_amount,
      pdf_path: data.pdf_path || null,
      status: 'generated'
    });
    return this.findById(id);
  }

  /**
   * Update payslip status
   */
  static async updateStatus(id, status) {
    const updateData = { status };
    if (status === 'paid') updateData.paid_at = new Date();
    await db.update('payslips', updateData, 'id = ?', [id]);
    return this.findById(id);
  }

  /**
   * Get payslip with full details
   */
  static async getWithDetails(id) {
    const sql = `
      SELECT 
        p.*,
        e.employee_id as emp_code,
        e.name as employee_name,
        e.email,
        e.department,
        e.position,
        e.currency,
        pp.period_name,
        pp.start_date,
        pp.end_date,
        tes.approval_status,
        tes.approved_at
      FROM payslips p
      JOIN employees e ON p.employee_id = e.id
      JOIN pay_periods pp ON p.period_id = pp.id
      LEFT JOIN time_entries_summary tes ON p.summary_id = tes.id
      WHERE p.id = ?
    `;
    return db.getOne(sql, [id]);
  }

  /**
   * Get payslips by status
   */
  static async findByStatus(status) {
    const sql = `
      SELECT p.*, e.name as employee_name, e.email, e.currency, pp.period_name
      FROM payslips p
      JOIN employees e ON p.employee_id = e.id
      JOIN pay_periods pp ON p.period_id = pp.id
      WHERE p.status = ?
      ORDER BY p.generated_at DESC
    `;
    return db.query(sql, [status]);
  }

  /**
   * Get statistics
   */
  static async getStatistics(periodId = null) {
    let sql = `
      SELECT
        COUNT(*) as total_payslips,
        SUM(CASE WHEN status = 'generated' THEN 1 ELSE 0 END) as generated_count,
        SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_count
      FROM payslips
    `;
    if (periodId) {
      sql += ' WHERE period_id = ?';
      return db.getOne(sql, [periodId]);
    }
    return db.getOne(sql);
  }

  /**
   * Get net amounts grouped by currency
   */
  static async getNetByCurrency(periodId = null) {
    let sql = `
      SELECT e.currency, SUM(p.net_amount) as total_net
      FROM payslips p
      JOIN employees e ON p.employee_id = e.id
    `;
    const params = [];
    if (periodId) { sql += ' WHERE p.period_id = ?'; params.push(periodId); }
    sql += ' GROUP BY e.currency ORDER BY e.currency';
    return db.query(sql, params);
  }

  /**
   * Delete payslip
   */
  static async delete(id) {
    return db.remove('payslips', 'id = ?', [id]);
  }
}

module.exports = Payslip;
