const db = require('../database/connection');
const { hoursToMinutes, minutesToHours } = require('../utils/time');

function toDateStr(val) {
  if (!val) return '';
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(val).substring(0, 10);
}

class VerificationController {
  /**
   * GET /api/verifications/period/:periodId
   * Returns all active employees with actual hours + verification status for a period
   */
  async getForPeriod(req, res) {
    try {
      const { periodId } = req.params;

      const period = await db.getOne('SELECT * FROM pay_periods WHERE id = ?', [periodId]);
      if (!period) return res.status(404).json({ success: false, error: 'Period not found' });

      const startDate = toDateStr(period.start_date);
      const endDate   = toDateStr(period.end_date);

      // Filter employees to match the period type
      const isForeign = period.period_type === 'foreign';
      const employees = await db.query(
        `SELECT id, employee_id, name, department, position, hourly_rate, currency, hire_category, employee_type
         FROM employees
         WHERE is_active = 1
           AND (hire_category = ? OR (? = 'local' AND hire_category IS NULL))
         ORDER BY name`,
        [isForeign ? 'foreign' : 'local', isForeign ? 'foreign' : 'local']
      );

      // Sum exact integer minutes — never decimal hours
      const hoursRows = await db.query(
        `SELECT employee_id, SUM(minutes_worked) as total_minutes
         FROM time_entries WHERE entry_date >= ? AND entry_date <= ?
         GROUP BY employee_id`,
        [startDate, endDate]
      );
      const minutesMap = {};
      hoursRows.forEach(r => { minutesMap[r.employee_id] = parseInt(r.total_minutes, 10) || 0; });

      const verifications = await db.query(
        'SELECT * FROM timesheet_verifications WHERE period_id = ?',
        [periodId]
      );
      const verMap = {};
      verifications.forEach(v => { verMap[v.employee_id] = v; });

      const data = employees.map(emp => {
        const minutes = minutesMap[emp.id] || 0;
        return {
          employee: emp,
          actual_minutes: minutes,
          actual_hours: minutesToHours(minutes), // derived, display only
          verification: verMap[emp.id] || null,
          status: verMap[emp.id]?.status || 'pending',
        };
      });

      res.json({ success: true, data, period });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/verifications/upsert
   * Create or update a verification record for one employee + period
   */
  async upsert(req, res) {
    try {
      const { employee_id, period_id, verified_hours, verified_minutes, cash_advance, status, notes } = req.body;
      if (!employee_id || !period_id) {
        return res.status(400).json({ success: false, error: 'employee_id and period_id are required' });
      }

      // Minutes authoritative; accept legacy verified_hours from older clients.
      const verifiedMinutes = verified_minutes !== undefined && verified_minutes !== null
        ? Math.round(Number(verified_minutes))
        : (verified_hours !== undefined && verified_hours !== null ? hoursToMinutes(verified_hours) : undefined);

      const existing = await db.getOne(
        'SELECT id FROM timesheet_verifications WHERE employee_id = ? AND period_id = ?',
        [employee_id, period_id]
      );

      const verifiedAt = status === 'verified' ? new Date() : (status === 'pending' || status === 'rejected' ? null : undefined);

      if (existing) {
        const updates = { updated_at: new Date() };
        if (verifiedMinutes !== undefined) {
          updates.verified_minutes = verifiedMinutes;
          updates.verified_hours   = minutesToHours(verifiedMinutes); // derived
        }
        if (cash_advance  !== undefined) updates.cash_advance  = parseFloat(cash_advance) || 0;
        if (status        !== undefined) updates.status        = status;
        if (notes         !== undefined) updates.notes         = notes;
        if (verifiedAt    !== undefined) updates.verified_at   = verifiedAt;

        const setClause = Object.keys(updates).map(k => `${k} = ?`).join(', ');
        await db.query(
          `UPDATE timesheet_verifications SET ${setClause} WHERE employee_id = ? AND period_id = ?`,
          [...Object.values(updates), employee_id, period_id]
        );
      } else {
        await db.query(
          `INSERT INTO timesheet_verifications
            (employee_id, period_id, verified_minutes, verified_hours, cash_advance, status, notes, verified_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            employee_id, period_id,
            verifiedMinutes !== undefined ? verifiedMinutes : null,
            verifiedMinutes !== undefined ? minutesToHours(verifiedMinutes) : null,
            parseFloat(cash_advance) || 0,
            status || 'pending',
            notes || null,
            status === 'verified' ? new Date() : null,
          ]
        );
      }

      const record = await db.getOne(
        'SELECT * FROM timesheet_verifications WHERE employee_id = ? AND period_id = ?',
        [employee_id, period_id]
      );
      res.json({ success: true, data: record });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/verifications/bulk
   * Bulk-verify or bulk-reject a list of employees for a period
   */
  async bulk(req, res) {
    try {
      const { period_id, employee_ids, status } = req.body;
      if (!period_id || !employee_ids?.length || !status) {
        return res.status(400).json({ success: false, error: 'period_id, employee_ids, and status are required' });
      }

      const verifiedAt = status === 'verified' ? new Date() : null;

      for (const employee_id of employee_ids) {
        const existing = await db.getOne(
          'SELECT id FROM timesheet_verifications WHERE employee_id = ? AND period_id = ?',
          [employee_id, period_id]
        );
        if (existing) {
          await db.query(
            'UPDATE timesheet_verifications SET status = ?, verified_at = ?, updated_at = NOW() WHERE employee_id = ? AND period_id = ?',
            [status, verifiedAt, employee_id, period_id]
          );
        } else {
          await db.query(
            'INSERT INTO timesheet_verifications (employee_id, period_id, status, verified_at) VALUES (?, ?, ?, ?)',
            [employee_id, period_id, status, verifiedAt]
          );
        }
      }

      res.json({ success: true, message: `Bulk ${status} applied to ${employee_ids.length} employees` });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/verifications/status?periodId=X&employeeIds=1,2,3
   * Quick status check — returns { [employeeId]: 'pending'|'verified'|'rejected' }
   */
  async getStatus(req, res) {
    try {
      const { periodId, employeeIds } = req.query;
      if (!periodId) return res.status(400).json({ success: false, error: 'periodId is required' });

      let rows;
      if (employeeIds) {
        const ids = employeeIds.split(',').map(Number).filter(Boolean);
        rows = await db.query(
          `SELECT employee_id, status, verified_minutes, verified_hours, cash_advance FROM timesheet_verifications WHERE period_id = ? AND employee_id IN (${ids.map(() => '?').join(',')})`,
          [periodId, ...ids]
        );
      } else {
        rows = await db.query(
          'SELECT employee_id, status, verified_minutes, verified_hours, cash_advance FROM timesheet_verifications WHERE period_id = ?',
          [periodId]
        );
      }

      const statusMap = {};
      rows.forEach(r => { statusMap[r.employee_id] = { status: r.status, verified_minutes: r.verified_minutes, verified_hours: r.verified_hours, cash_advance: r.cash_advance }; });
      res.json({ success: true, data: statusMap });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = new VerificationController();
