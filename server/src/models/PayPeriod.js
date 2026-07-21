const db = require('../database/connection');

// Build a 'YYYY-MM-DD' string from integers WITHOUT any timezone round-trip.
// `new Date(y, m-1, d).toISOString()` converts local midnight to UTC, which on a
// UTC-plus machine shifts the date back a day (May 1 → "2026-04-30"), producing
// off-by-one pay-period ranges. Constructing the string directly avoids that.
const pad2 = (n) => String(n).padStart(2, '0');
const ymd = (year, month, day) => `${year}-${pad2(month)}-${pad2(day)}`;
// Last calendar day of a month (28–31); day 0 of next month, read via getDate() —
// the day count itself is timezone-independent.
const lastDayOfMonth = (year, month) => new Date(year, month, 0).getDate();

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
   * Get all periods, optionally filtered by type ('local' | 'foreign')
   */
  static async findAll(limit = 20, offset = 0, type = null) {
    const where = type ? 'WHERE period_type = ?' : '';
    const params = type ? [type, limit, offset] : [limit, offset];
    const sql = `SELECT * FROM pay_periods ${where} ORDER BY start_date DESC LIMIT ? OFFSET ?`;
    return db.query(sql, params);
  }

  /**
   * Get current period (any type)
   */
  static async getCurrentPeriod() {
    return db.getOne(
      'SELECT * FROM pay_periods WHERE CURDATE() BETWEEN start_date AND end_date ORDER BY start_date DESC LIMIT 1'
    );
  }

  /**
   * Get current period filtered by type ('local' | 'foreign')
   */
  static async getCurrentPeriodByType(type) {
    return db.getOne(
      'SELECT * FROM pay_periods WHERE CURDATE() BETWEEN start_date AND end_date AND period_type = ? ORDER BY start_date DESC LIMIT 1',
      [type]
    );
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
    const requestedType = data.period_type || 'local';

    // A period is unique by date range (DB enforces UNIQUE(start_date, end_date)).
    // If one already exists for these dates:
    //   - same type  → idempotent, return it
    //   - other type → reject clearly, since both cannot share the same dates
    const existing = await this.findByDateRange(start, end);
    if (existing) {
      const existingType = existing.period_type || 'local';
      if (existingType !== requestedType) {
        const label = (t) => (t === 'foreign' ? 'International' : 'Local');
        const err = new Error(
          `A ${label(existingType)} period ("${existing.period_name}") already exists for ${start} to ${end}. ` +
          `A Local and an International period can't share the same dates — edit that period's type or pick different dates.`
        );
        err.code = 'PERIOD_TYPE_CONFLICT';
        throw err;
      }
      return existing;
    }

    const id = await db.insert('pay_periods', {
      period_name: data.period_name,
      start_date: start,
      end_date: end,
      status: data.status || 'open',
      period_type: data.period_type || 'local'
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
    const lastDay = lastDayOfMonth(year, month);
    const periods = [];

    // First half: 1st – 15th
    const firstHalf = await this.create({
      period_name: `Period ${month}/1-${month}/15/${year}`,
      start_date: ymd(year, month, 1),
      end_date: ymd(year, month, 15),
      status: 'open',
      period_type: 'local'
    });
    periods.push(firstHalf);

    // Second half: 16th – end of month
    const secondHalf = await this.create({
      period_name: `Period ${month}/16-${month}/${lastDay}/${year}`,
      start_date: ymd(year, month, 16),
      end_date: ymd(year, month, lastDay),
      status: 'open',
      period_type: 'local'
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
    if (data.period_type !== undefined) fields.period_type = data.period_type;
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
   * Create a full-month foreign (international) pay period
   */
  static async createForeignMonthlyPeriod(year, month) {
    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return this.create({
      period_name: `${MONTHS[month - 1]} ${year} (International)`,
      start_date:  ymd(year, month, 1),
      end_date:    ymd(year, month, lastDayOfMonth(year, month)),
      status:      'open',
      period_type: 'foreign'
    });
  }

  /**
   * Record when a bank file type was downloaded for a period
   */
  static async markBankDownloaded(id, type) {
    const col = type === 'foreign' ? 'foreign_bank_downloaded_at' : 'local_bank_downloaded_at';
    await db.query(`UPDATE pay_periods SET ${col} = NOW() WHERE id = ?`, [id]);
    return this.findById(id);
  }

  /**
   * Mark a period as bank-uploaded by an admin user
   */
  static async markBankUploaded(id, userId) {
    await db.query(
      'UPDATE pay_periods SET bank_uploaded_at = NOW(), bank_uploaded_by = ? WHERE id = ?',
      [userId, id]
    );
    return this.findById(id);
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

      // Determine if first or second half of month (timezone-safe date strings)
      const lastDay = lastDayOfMonth(year, month);
      const startDate = day <= 15 ? ymd(year, month, 1)  : ymd(year, month, 16);
      const endDate   = day <= 15 ? ymd(year, month, 15) : ymd(year, month, lastDay);

      const periodName = day <= 15
        ? `Period ${month}/1-${month}/15/${year}`
        : `Period ${month}/16-${month}/${lastDay}/${year}`;

      period = await this.create({
        period_name: periodName,
        start_date: startDate,
        end_date: endDate,
        status: 'open'
      });
    }

    return period;
  }
}

module.exports = PayPeriod;
