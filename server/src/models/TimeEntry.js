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
      category: data.category || null,
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
   * Fetch all Wrike-sourced entries for a set of employees within a date range in one query.
   * Returns a Map keyed by `${employee_id}|${wrikeLogId}` → ARRAY of matching rows
   * ({ id, employee_id, hours_worked, category }), where the Wrike log ID is parsed
   * from the `[logId]` prefix of task_description.
   *
   * The value is an array (not a single row) on purpose: the same Wrike log can have
   * been imported into MULTIPLE rows by earlier buggy imports. The reconciler needs to
   * see every copy so it can keep one and delete the duplicates.
   */
  static async getWrikeEntryMap(employeeIds, startDate, endDate) {
    const map = new Map();
    if (!employeeIds.length) return map;

    const placeholders = employeeIds.map(() => '?').join(',');
    const rows = await db.query(
      `SELECT id, employee_id, hours_worked, category, task_description
       FROM time_entries
       WHERE source = 'wrike'
         AND employee_id IN (${placeholders})
         AND entry_date >= ? AND entry_date <= ?
       ORDER BY id ASC`,
      [...employeeIds, startDate, endDate]
    );

    for (const r of rows) {
      const match = (r.task_description || '').match(/^\[([^\]]+)\]/);
      if (!match) continue;
      const key = `${r.employee_id}|${match[1]}`;
      const entry = {
        id: r.id,
        employee_id: r.employee_id,
        hours_worked: parseFloat(r.hours_worked) || 0,
        category: r.category,
      };
      const bucket = map.get(key);
      if (bucket) bucket.push(entry);
      else map.set(key, [entry]);
    }
    return map;
  }

  /**
   * Bulk-insert time entries using chunked multi-row INSERTs (one round-trip per chunk).
   * Returns the number of rows inserted.
   */
  static async bulkInsert(entries, chunkSize = 500) {
    if (!entries.length) return 0;

    const cols = [
      'employee_id', 'entry_date', 'start_time', 'end_time', 'hours_worked',
      'task_description', 'project_name', 'wrike_task_id', 'category', 'source',
    ];
    const rowPlaceholder = `(${cols.map(() => '?').join(',')})`;

    let inserted = 0;
    for (let i = 0; i < entries.length; i += chunkSize) {
      const chunk = entries.slice(i, i + chunkSize);
      const values = [];
      for (const e of chunk) {
        values.push(
          e.employee_id, e.entry_date, e.start_time || null, e.end_time || null,
          e.hours_worked, e.task_description || null, e.project_name || null,
          e.wrike_task_id || null, e.category || null, e.source || 'wrike'
        );
      }
      const sql = `INSERT INTO time_entries (${cols.join(',')}) VALUES ${chunk.map(() => rowPlaceholder).join(',')}`;
      const result = await db.query(sql, values);
      inserted += result.affectedRows || chunk.length;
    }
    return inserted;
  }

  /**
   * Delete entries by a list of IDs, using chunked IN () deletes.
   * Returns the number of rows removed.
   */
  static async deleteByIds(ids, chunkSize = 500) {
    if (!ids.length) return 0;
    let removed = 0;
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      const result = await db.query(
        `DELETE FROM time_entries WHERE id IN (${chunk.map(() => '?').join(',')})`,
        chunk
      );
      removed += result.affectedRows || 0;
    }
    return removed;
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
