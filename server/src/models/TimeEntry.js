const db = require('../database/connection');

/**
 * TimeEntry Model
 */
class TimeEntry {
  /**
   * Find entry by ID
   */
  static async findById(id) {
    return db.getOne(
      'SELECT * FROM time_entries WHERE id = ?',
      [id]
    );
  }

  /**
   * Get entries by employee
   */
  static async findByEmployee(employeeId, limit = 50) {
    return db.query(
      'SELECT * FROM time_entries WHERE employee_id = ? ORDER BY entry_date DESC LIMIT ?',
      [employeeId, limit]
    );
  }

  /**
   * Get entries by date range
   */
  static async findByDateRange(employeeId, startDate, endDate) {
    return db.query(
      `SELECT * FROM time_entries 
       WHERE employee_id = ? AND entry_date BETWEEN ? AND ? 
       ORDER BY entry_date ASC`,
      [employeeId, startDate, endDate]
    );
  }

  /**
   * Create a new time entry
   */
  static async create(data) {
    const id = await db.insert('time_entries', {
      employee_id: data.employee_id,
      entry_date: data.entry_date,
      start_time: data.start_time || null,
      end_time: data.end_time || null,
      hours_worked: data.hours_worked,
      task_description: data.task_description || null,
      project_name: data.project_name || null,
      wrike_task_id: data.wrike_task_id || null,
      source: data.source || 'manual'
    });
    return this.findById(id);
  }

  /**
   * Bulk create time entries
   */
  static async bulkCreate(entries) {
    const results = [];
    for (const entry of entries) {
      const created = await this.create(entry);
      results.push(created);
    }
    return results;
  }

  /**
   * Update a time entry
   */
  static async update(id, data) {
    await db.update('time_entries', data, 'id = ?', [id]);
    return this.findById(id);
  }

  /**
   * Delete a time entry
   */
  static async delete(id) {
    return db.remove('time_entries', 'id = ?', [id]);
  }

  /**
   * Delete entries by date range
   */
  static async deleteByDateRange(employeeId, startDate, endDate) {
    return db.remove(
      'time_entries',
      'employee_id = ? AND entry_date BETWEEN ? AND ?',
      [employeeId, startDate, endDate]
    );
  }

  /**
   * Get daily summary for a period
   */
  static async getDailySummary(employeeId, startDate, endDate) {
    const sql = `
      SELECT 
        entry_date,
        SUM(hours_worked) as total_hours,
        COUNT(*) as task_count,
        GROUP_CONCAT(DISTINCT project_name) as projects
      FROM time_entries
      WHERE employee_id = ? AND entry_date BETWEEN ? AND ?
      GROUP BY entry_date
      ORDER BY entry_date ASC
    `;
    return db.query(sql, [employeeId, startDate, endDate]);
  }

  /**
   * Get project breakdown for a period
   */
  static async getProjectBreakdown(employeeId, startDate, endDate) {
    const sql = `
      SELECT 
        project_name,
        SUM(hours_worked) as total_hours,
        COUNT(*) as task_count
      FROM time_entries
      WHERE employee_id = ? AND entry_date BETWEEN ? AND ?
      GROUP BY project_name
      ORDER BY total_hours DESC
    `;
    return db.query(sql, [employeeId, startDate, endDate]);
  }

  /**
   * Get total hours for a period
   */
  static async getTotalHours(employeeId, startDate, endDate) {
    const sql = `
      SELECT COALESCE(SUM(hours_worked), 0) as total_hours
      FROM time_entries
      WHERE employee_id = ? AND entry_date BETWEEN ? AND ?
    `;
    const result = await db.getOne(sql, [employeeId, startDate, endDate]);
    return result.total_hours;
  }

  /**
   * Check for a duplicate Wrike import entry.
   * Matches on employee + date + wrike source + the Wrike log ID stored in task_description prefix.
   */
  static async findDuplicate(employeeId, date, wrikeLogId) {
    return db.getOne(
      `SELECT id FROM time_entries
       WHERE employee_id = ? AND entry_date = ? AND source = 'wrike'
         AND task_description LIKE ?`,
      [employeeId, date, `[${wrikeLogId}]%`]
    );
  }

  /**
   * Import entries from external source
   */
  static async importFromSource(entries, source = 'import') {
    const results = [];
    for (const entry of entries) {
      // Check if entry already exists
      const existing = await db.getOne(
        `SELECT id FROM time_entries 
         WHERE employee_id = ? AND entry_date = ? AND wrike_task_id = ?`,
        [entry.employee_id, entry.entry_date, entry.wrike_task_id]
      );

      if (!existing) {
        const created = await this.create({
          ...entry,
          source
        });
        results.push(created);
      }
    }
    return results;
  }
}

module.exports = TimeEntry;
