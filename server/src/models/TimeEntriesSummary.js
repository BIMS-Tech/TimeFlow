const db = require('../database/connection');

/**
 * TimeEntriesSummary Model
 * Handles timesheet summaries with approval workflow
 */
class TimeEntriesSummary {
  /**
   * Find summary by ID
   */
  static async findById(id) {
    return db.getOne(
      'SELECT * FROM time_entries_summary WHERE id = ?',
      [id]
    );
  }

  /**
   * Find summary by Wrike task ID
   */
  /**
   * Find by employee and period
   */
  static async findByEmployeeAndPeriod(employeeId, periodId) {
    return db.getOne(
      'SELECT * FROM time_entries_summary WHERE employee_id = ? AND period_id = ?',
      [employeeId, periodId]
    );
  }

  /**
   * Get all summaries for a period
   */
  static async findByPeriod(periodId) {
    const sql = `
      SELECT tes.*, e.name as employee_name, e.email, e.employee_id as emp_code, e.department, e.currency
      FROM time_entries_summary tes
      JOIN employees e ON tes.employee_id = e.id
      WHERE tes.period_id = ?
      ORDER BY e.name
    `;
    return db.query(sql, [periodId]);
  }

  /**
   * Get summaries by approval status
   */
  static async findByStatus(status, limit = 50) {
    const sql = `
      SELECT tes.*, e.name as employee_name, e.email, e.currency,
             pp.period_name, pp.start_date, pp.end_date,
             DATEDIFF(NOW(), tes.updated_at) AS days_since_updated
      FROM time_entries_summary tes
      JOIN employees e ON tes.employee_id = e.id
      JOIN pay_periods pp ON tes.period_id = pp.id
      WHERE tes.approval_status = ?
      ORDER BY tes.updated_at DESC
      LIMIT ?
    `;
    return db.query(sql, [status, limit]);
  }

  /**
   * Get pending approvals
   */
  static async getPendingApprovals() {
    return this.findByStatus('pending');
  }

  /**
   * Get rejected timesheets (employee-initiated rejections)
   */
  static async getRejectedTimesheets() {
    return this.findByStatus('rejected');
  }

  /**
   * Count by status (for nav badges)
   */
  static async countByStatus(status) {
    const row = await db.getOne(
      `SELECT COUNT(*) as cnt FROM time_entries_summary WHERE approval_status = ?`,
      [status]
    );
    return row ? row.cnt : 0;
  }

  /**
   * Create or update summary
   */
  static async upsert(data) {
    const existing = await this.findByEmployeeAndPeriod(data.employee_id, data.period_id);
    
    if (existing) {
      await db.update('time_entries_summary', {
        total_hours: data.total_hours,
        regular_hours: data.regular_hours,
        overtime_hours: data.overtime_hours,
        hourly_rate: data.hourly_rate,
        gross_amount: data.gross_amount,
        net_amount: data.net_amount,
        updated_at: new Date()
      }, 'id = ?', [existing.id]);
      return this.findById(existing.id);
    } else {
      const id = await db.insert('time_entries_summary', {
        employee_id: data.employee_id,
        period_id: data.period_id,
        total_hours: data.total_hours,
        regular_hours: data.regular_hours || data.total_hours,
        overtime_hours: data.overtime_hours || 0,
        hourly_rate: data.hourly_rate,
        gross_amount: data.gross_amount,
        net_amount: data.net_amount || data.gross_amount,
        deductions: data.deductions || 0
      });
      return this.findById(id);
    }
  }

  /**
   * Set approval task ID
   */
  /**
   * Mark as pending (internal approval — no Wrike task)
   */
  static async markPendingApproval(id) {
    await db.update('time_entries_summary', {
      approval_status: 'pending',
      updated_at: new Date()
    }, 'id = ?', [id]);
    return this.findById(id);
  }

  /**
   * Get all summaries for an employee
   */
  static async findByEmployee(employeeId) {
    const sql = `
      SELECT tes.*, pp.period_name, pp.start_date, pp.end_date
      FROM time_entries_summary tes
      JOIN pay_periods pp ON tes.period_id = pp.id
      WHERE tes.employee_id = ?
      ORDER BY tes.created_at DESC
    `;
    return db.query(sql, [employeeId]);
  }

  /**
   * Mark as approved
   */
  static async markApproved(id, approvedBy = null) {
    await db.update('time_entries_summary', {
      approval_status: 'approved',
      approved_at: new Date(),
      approved_by: approvedBy
    }, 'id = ?', [id]);
    return this.findById(id);
  }

  /**
   * Mark as rejected
   */
  static async markRejected(id, reason = null, rejectionFiles = null) {
    await db.update('time_entries_summary', {
      approval_status: 'rejected',
      rejection_reason: reason,
      rejection_files: rejectionFiles ? JSON.stringify(rejectionFiles) : null,
      updated_at: new Date()
    }, 'id = ?', [id]);
    return this.findById(id);
  }

  /**
   * Reset to pending (for re-submission)
   */
  static async resetToPending(id) {
    await db.update('time_entries_summary', {
      approval_status: 'pending',
      rejection_reason: null,
      updated_at: new Date()
    }, 'id = ?', [id]);
    return this.findById(id);
  }

  /**
   * Update file paths
   */
  static async updateFilePaths(id, paths) {
    await db.update('time_entries_summary', paths, 'id = ?', [id]);
    return this.findById(id);
  }

  /**
   * Get summary with full details
   */
  static async getWithDetails(id) {
    const sql = `
      SELECT
        tes.*,
        e.employee_id AS emp_code,
        e.name as employee_name,
        e.email,
        e.department,
        e.position,
        e.currency,
        pp.period_name,
        pp.start_date,
        pp.end_date,
        pp.status as period_status
      FROM time_entries_summary tes
      JOIN employees e ON tes.employee_id = e.id
      JOIN pay_periods pp ON tes.period_id = pp.id
      WHERE tes.id = ?
    `;
    return db.getOne(sql, [id]);
  }

  /**
   * Get task breakdown for a summary
   */
  static async getTaskBreakdown(summaryId) {
    return db.query(
      'SELECT * FROM task_breakdown WHERE summary_id = ? ORDER BY task_date',
      [summaryId]
    );
  }

  /**
   * Save task breakdown
   */
  static async saveTaskBreakdown(summaryId, tasks) {
    // Clear existing breakdown
    await db.remove('task_breakdown', 'summary_id = ?', [summaryId]);
    
    // Insert new breakdown
    for (const task of tasks) {
      await db.insert('task_breakdown', {
        summary_id: summaryId,
        task_date: task.task_date,
        task_name: task.task_name ? task.task_name.substring(0, 255) : null,
        project_name: task.project_name ? task.project_name.substring(0, 255) : null,
        hours: task.hours,
        description: task.description,
        wrike_task_id: task.wrike_task_id
      });
    }
  }

  /**
   * Get statistics (counts + total hours, currency-neutral)
   */
  static async getStatistics(periodId = null) {
    let sql = `
      SELECT
        COUNT(*) as total_summaries,
        SUM(total_hours) as total_hours,
        SUM(CASE WHEN approval_status = 'approved' THEN 1 ELSE 0 END) as approved_count,
        SUM(CASE WHEN approval_status = 'pending' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN approval_status = 'rejected' THEN 1 ELSE 0 END) as rejected_count
      FROM time_entries_summary
    `;
    if (periodId) {
      sql += ' WHERE period_id = ?';
      return db.getOne(sql, [periodId]);
    }
    return db.getOne(sql);
  }

  /**
   * Get gross amounts grouped by currency
   */
  static async getGrossByCurrency(periodId = null) {
    let sql = `
      SELECT e.currency, SUM(tes.gross_amount) as total_gross
      FROM time_entries_summary tes
      JOIN employees e ON tes.employee_id = e.id
    `;
    const params = [];
    if (periodId) { sql += ' WHERE tes.period_id = ?'; params.push(periodId); }
    sql += ' GROUP BY e.currency ORDER BY e.currency';
    return db.query(sql, params);
  }

  /**
   * Get summaries needing approval reminder
   */
  static async getNeedingReminder(daysPending = 3) {
    const sql = `
      SELECT tes.*, e.name as employee_name, e.email, pp.period_name
      FROM time_entries_summary tes
      JOIN employees e ON tes.employee_id = e.id
      JOIN pay_periods pp ON tes.period_id = pp.id
      WHERE tes.approval_status = 'pending'
      AND DATEDIFF(NOW(), tes.created_at) >= ?
      ORDER BY tes.created_at ASC
    `;
    return db.query(sql, [daysPending]);
  }
}

module.exports = TimeEntriesSummary;
