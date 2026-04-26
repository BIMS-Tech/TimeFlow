const db = require('../database/connection');
const { v4: uuidv4 } = require('uuid');

// Serialises payslip number generation within a single process instance.
// Prevents two parallel bulk-generation jobs from reading the same COUNT
// and producing the same sequence number (ER_DUP_ENTRY on insert).
let _seqLock = Promise.resolve();
function withSeqLock(fn) {
  const next = _seqLock.then(fn);
  // Always advance the lock even if fn rejects, so the queue never jams.
  _seqLock = next.catch(() => {});
  return next;
}

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
   * Generate a unique payslip number for the current month.
   * Uses MAX of existing sequences (not COUNT) so gaps from deletions
   * never cause collisions, and must be called inside withSeqLock.
   */
  static async _nextPayslipNumber() {
    const date = new Date();
    const year  = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const prefix = `PAY-${year}${month}-`;

    const row = await db.getOne(
      `SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(payslip_number, '-', -1) AS UNSIGNED)), 0) + 1 AS next_seq
       FROM payslips WHERE payslip_number LIKE ?`,
      [`${prefix}%`]
    );
    return `${prefix}${String(row.next_seq).padStart(4, '0')}`;
  }

  static async generatePayslipNumber() {
    return withSeqLock(() => this._nextPayslipNumber());
  }

  /**
   * Create a new payslip.
   * Serialises number generation with withSeqLock and retries up to 5 times
   * on ER_DUP_ENTRY so cross-instance races (multiple Cloud Run pods) also
   * resolve cleanly without surfacing an error to the caller.
   */
  static async create(data) {
    const MAX_ATTEMPTS = 5;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const payslipNumber = await withSeqLock(() => this._nextPayslipNumber());
      try {
        const id = await db.insert('payslips', {
          summary_id:       data.summary_id,
          payslip_number:   payslipNumber,
          employee_id:      data.employee_id,
          period_id:        data.period_id,
          total_hours:      data.total_hours,
          hourly_rate:      data.hourly_rate,
          gross_amount:     data.gross_amount,
          tax_deductions:   data.tax_deductions   || 0,
          other_deductions: data.other_deductions || 0,
          net_amount:       data.net_amount,
          pdf_path:         data.pdf_path || null,
          status:           'generated'
        });
        return this.findById(id);
      } catch (err) {
        const isDup = err.code === 'ER_DUP_ENTRY' && err.message.includes('payslip_number');
        if (isDup && attempt < MAX_ATTEMPTS) {
          console.warn(`[Payslip] Duplicate payslip number ${payslipNumber} on attempt ${attempt}, retrying…`);
          continue;
        }
        throw err;
      }
    }
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
   * Get payslip counts split by period_type (local vs foreign)
   */
  static async getTypeStats() {
    return db.getOne(`
      SELECT
        SUM(CASE WHEN pp.period_type = 'foreign' THEN 1 ELSE 0 END) AS foreign_count,
        SUM(CASE WHEN pp.period_type = 'local' OR pp.period_type IS NULL THEN 1 ELSE 0 END) AS local_count
      FROM payslips p
      LEFT JOIN pay_periods pp ON p.period_id = pp.id
    `);
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
   * Update arbitrary fields on a payslip
   */
  static async update(id, data) {
    const allowed = ['pdf_path', 'status', 'paid_at', 'total_hours', 'hourly_rate', 'gross_amount', 'tax_deductions', 'other_deductions', 'net_amount'];
    const fields = {};
    for (const key of allowed) {
      if (data[key] !== undefined) fields[key] = data[key];
    }
    if (Object.keys(fields).length) await db.update('payslips', fields, 'id = ?', [id]);
    return this.findById(id);
  }

  /**
   * Delete payslip
   */
  static async delete(id) {
    return db.remove('payslips', 'id = ?', [id]);
  }
}

module.exports = Payslip;
