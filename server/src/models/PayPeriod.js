const db = require('../database/connection');

/**
 * PayPeriod Model
 */
class PayPeriod {
  /**
   * Find period by ID
   */
  static async findById(id) {
    return db.getOne(
      'SELECT * FROM pay_periods WHERE id = ?',
      [id]
    );
  }

  /**
   * Get all periods
   */
  static async findAll(limit = 20, offset = 0) {
    const sql = `
      SELECT * FROM pay_periods 
      ORDER BY start_date DESC 
      LIMIT ? OFFSET ?
    `;
    return db.query(sql, [limit, offset]);
  }

  /**
   * Get current period
   */
  static async getCurrentPeriod() {
    const sql = `
      SELECT * FROM pay_periods 
      WHERE CURDATE() BETWEEN start_date AND end_date 
      ORDER BY start_date DESC 
      LIMIT 1
    `;
    return db.getOne(sql);
  }

  /**
   * Get period by date range
   */
  static async findByDateRange(startDate, endDate) {
    // Normalize to YYYY-MM-DD regardless of whether ISO datetime strings are passed
    const start = String(startDate).substring(0, 10);
    const end   = String(endDate).substring(0, 10);
    return db.getOne(
      'SELECT * FROM pay_periods WHERE start_date = ? AND end_date = ?',
      [start, end]
    );
  }

  /**
   * Create a new period (idempotent — returns existing if dates already exist)
   */
  static async create(data) {
    const start = String(data.start_date).substring(0, 10);
    const end   = String(data.end_date).substring(0, 10);

    // Check first to avoid hitting the unique constraint
    const existing = await this.findByDateRange(start, end);
    if (existing) return existing;

    const id = await db.insert('pay_periods', {
      period_name: data.period_name,
      start_date: start,
      end_date: end,
      status: data.status || 'open'
    });
    return this.findById(id);
  }

  /**
   * Update period status
   */
  static async updateStatus(id, status) {
    await db.update('pay_periods', { status }, 'id = ?', [id]);
    return this.findById(id);
  }

  /**
   * Get periods by status
   */
  static async findByStatus(status) {
    return db.query(
      'SELECT * FROM pay_periods WHERE status = ? ORDER BY start_date DESC',
      [status]
    );
  }

  /**
   * Get period with summaries
   */
  static async getWithSummaries(id) {
    const sql = `
      SELECT 
        pp.*,
        COUNT(tes.id) as total_employees,
        SUM(tes.total_hours) as total_hours,
        SUM(tes.gross_amount) as total_gross,
        SUM(CASE WHEN tes.approval_status = 'approved' THEN 1 ELSE 0 END) as approved_count,
        SUM(CASE WHEN tes.approval_status = 'pending' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN tes.approval_status = 'rejected' THEN 1 ELSE 0 END) as rejected_count
      FROM pay_periods pp
      LEFT JOIN time_entries_summary tes ON pp.id = tes.period_id
      WHERE pp.id = ?
      GROUP BY pp.id
    `;
    return db.getOne(sql, [id]);
  }

  /**
   * Create periods for a month
   */
  static async createMonthlyPeriods(year, month) {
    const firstHalfStart = new Date(year, month - 1, 1);
    const firstHalfEnd = new Date(year, month - 1, 15);
    const secondHalfStart = new Date(year, month - 1, 16);
    const secondHalfEnd = new Date(year, month, 0);

    const periods = [];

    // First half
    const firstHalf = await this.create({
      period_name: `Period ${month}/1-${month}/15/${year}`,
      start_date: firstHalfStart.toISOString().split('T')[0],
      end_date: firstHalfEnd.toISOString().split('T')[0],
      status: 'open'
    });
    periods.push(firstHalf);

    // Second half
    const secondHalf = await this.create({
      period_name: `Period ${month}/16-${month}/${secondHalfEnd.getDate()}/${year}`,
      start_date: secondHalfStart.toISOString().split('T')[0],
      end_date: secondHalfEnd.toISOString().split('T')[0],
      status: 'open'
    });
    periods.push(secondHalf);

    return periods;
  }

  /**
   * Update a period
   */
  static async update(id, data) {
    const fields = {};
    if (data.period_name !== undefined) fields.period_name = data.period_name;
    if (data.start_date !== undefined) fields.start_date = String(data.start_date).substring(0, 10);
    if (data.end_date !== undefined) fields.end_date = String(data.end_date).substring(0, 10);
    if (data.status !== undefined) fields.status = data.status;
    await db.update('pay_periods', fields, 'id = ?', [id]);
    return this.findById(id);
  }

  /**
   * Delete a period (and its summaries via FK cascade)
   */
  static async delete(id) {
    await db.remove('pay_periods', 'id = ?', [id]);
  }

  /**
   * Get or create current period
   */
  static async getOrCreateCurrentPeriod() {
    let period = await this.getCurrentPeriod();
    
    if (!period) {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const day = now.getDate();

      // Determine if first or second half of month
      const startDate = day <= 15 
        ? new Date(year, now.getMonth(), 1)
        : new Date(year, now.getMonth(), 16);
      const endDate = day <= 15
        ? new Date(year, now.getMonth(), 15)
        : new Date(year, now.getMonth() + 1, 0);

      const periodName = day <= 15
        ? `Period ${month}/1-${month}/15/${year}`
        : `Period ${month}/16-${month}/${endDate.getDate()}/${year}`;

      period = await this.create({
        period_name: periodName,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        status: 'open'
      });
    }

    return period;
  }
}

module.exports = PayPeriod;
