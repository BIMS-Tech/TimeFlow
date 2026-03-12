const fs = require('fs');
const path = require('path');

/**
 * CSV Service
 * Generates timesheet CSV files for the approval flow
 */
class CsvService {
  /**
   * Generate a timesheet CSV file (replaces the draft PDF)
   * @returns {{ filePath, fileName }}
   */
  async generateTimesheetCSV(summary, employee, period, taskBreakdown) {
    const uploadsDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

    const safeName = (employee.name || 'employee').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safePeriod = (period.period_name || 'period').replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `Timesheet_${safeName}_${safePeriod}_${Date.now()}.csv`;
    const filePath = path.join(uploadsDir, fileName);

    const currency = employee.currency || process.env.CURRENCY || '';
    const lines = [];

    // ── Header block ──────────────────────────────────────────────────────────
    lines.push('TIMESHEET REPORT');
    lines.push('');
    lines.push(`Employee Name,${this._escape(employee.name)}`);
    lines.push(`Employee ID,${this._escape(employee.employee_id || '')}`);
    lines.push(`Department,${this._escape(employee.department || '')}`);
    lines.push(`Position,${this._escape(employee.position || '')}`);
    lines.push(`Period,${this._escape(period.period_name)}`);
    lines.push(`Start Date,${this._formatDate(period.start_date)}`);
    lines.push(`End Date,${this._formatDate(period.end_date)}`);
    lines.push(`Currency,${currency}`);
    lines.push('');

    // ── Summary block ─────────────────────────────────────────────────────────
    lines.push('SUMMARY');
    lines.push(`Total Hours,${parseFloat(summary.total_hours || 0).toFixed(2)}`);
    lines.push(`Regular Hours,${parseFloat(summary.regular_hours || 0).toFixed(2)}`);
    lines.push(`Overtime Hours,${parseFloat(summary.overtime_hours || 0).toFixed(2)}`);
    lines.push(`Hourly Rate,${parseFloat(summary.hourly_rate || 0).toFixed(2)}`);
    lines.push(`Gross Amount,${parseFloat(summary.gross_amount || 0).toFixed(2)}`);
    lines.push('');

    // ── Task breakdown ────────────────────────────────────────────────────────
    lines.push('TASK BREAKDOWN');
    lines.push('Date,Task,Project,Hours,Description');

    const sorted = [...(taskBreakdown || [])].sort((a, b) =>
      String(a.task_date).localeCompare(String(b.task_date))
    );

    for (const task of sorted) {
      lines.push([
        this._formatDate(task.task_date),
        this._escape(task.task_name || ''),
        this._escape(task.project_name || ''),
        parseFloat(task.hours || 0).toFixed(2),
        this._escape(task.description || ''),
      ].join(','));
    }

    lines.push('');
    lines.push(`TOTAL,,,,${parseFloat(summary.total_hours || 0).toFixed(2)}`);

    fs.writeFileSync(filePath, lines.join('\r\n'), 'utf8');
    console.log(`📊 Timesheet CSV generated: ${fileName}`);

    return { filePath, fileName };
  }

  /** Escape a value for CSV — wrap in quotes if it contains comma/quote/newline */
  _escape(val) {
    const s = String(val ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }

  _formatDate(d) {
    if (!d) return '';
    return String(d).substring(0, 10);
  }
}

module.exports = new CsvService();
