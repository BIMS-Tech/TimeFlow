const fs = require('fs');
const path = require('path');
const { formatHM, hoursToMinutes } = require('../utils/time');

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
    const sumMin = (m, h) => summary[m] != null ? parseInt(summary[m], 10) : hoursToMinutes(summary[h]);
    lines.push(`Total Hours,${formatHM(sumMin('total_minutes', 'total_hours'))}`);
    lines.push(`Regular Hours,${formatHM(sumMin('regular_minutes', 'regular_hours'))}`);
    lines.push(`Overtime Hours,${formatHM(sumMin('overtime_minutes', 'overtime_hours'))}`);
    lines.push(`Hourly Rate,${parseFloat(summary.hourly_rate || 0).toFixed(2)}`);
    lines.push(`Gross Amount,${parseFloat(summary.gross_amount || 0).toFixed(2)}`);
    lines.push('');

    // ── Task breakdown ────────────────────────────────────────────────────────
    lines.push('TASK BREAKDOWN');
    lines.push('Date,Task,Project,Hours (h:mm),Description');

    const sorted = [...(taskBreakdown || [])].sort((a, b) =>
      String(a.task_date).localeCompare(String(b.task_date))
    );

    for (const task of sorted) {
      lines.push([
        this._formatDate(task.task_date),
        this._escape(task.task_name || ''),
        this._escape(task.project_name || ''),
        formatHM(task.minutes != null ? task.minutes : hoursToMinutes(task.hours)),
        this._escape(task.description || ''),
      ].join(','));
    }

    lines.push('');
    lines.push(`TOTAL,,,,${formatHM(sumMin('total_minutes', 'total_hours'))}`);

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

  /**
   * Generate a payslip summary workbook (.xlsx) for a period.
   * Mirrors the columns/totals of the summary PDF.
   * @returns {{ filePath, fileName }}
   */
  async generateSummaryXLSX(payslips, period) {
    const XLSX = require('xlsx');
    const uploadsDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

    const cur = (payslips[0] && payslips[0].currency) || process.env.CURRENCY || 'BDT';
    const typeLabel = period.period_type === 'foreign' ? 'International' : 'Local';
    const num = (n) => Number(parseFloat(n || 0).toFixed(2));

    const totalMinutes = payslips.reduce((s, p) => s + (p.total_minutes != null ? parseInt(p.total_minutes, 10) : hoursToMinutes(p.total_hours)), 0);
    const totalGross = payslips.reduce((s, p) => s + (parseFloat(p.gross_amount) || 0), 0);
    const totalNet   = payslips.reduce((s, p) => s + (parseFloat(p.net_amount)   || 0), 0);

    // Build sheet as an array-of-arrays so we can include a title block + totals
    const rows = [];
    rows.push(['PAYSLIP SUMMARY REPORT']);
    rows.push(['Period', period.period_name]);
    rows.push(['Dates', `${this._formatDate(period.start_date)} to ${this._formatDate(period.end_date)}`]);
    rows.push(['Type', typeLabel]);
    rows.push(['Currency', cur]);
    rows.push([]);
    rows.push(['Employees', payslips.length, 'Total Hours', formatHM(totalMinutes), 'Total Gross', num(totalGross), 'Total Net', num(totalNet)]);
    rows.push([]);
    rows.push(['#', 'Payslip No.', 'Employee', 'Hours (h:mm)', 'Gross', 'Net Pay', 'Status']);

    payslips.forEach((p, idx) => {
      rows.push([
        idx + 1,
        p.payslip_number || '',
        p.employee_name || '',
        formatHM(p.total_minutes != null ? parseInt(p.total_minutes, 10) : hoursToMinutes(p.total_hours)),
        num(p.gross_amount),
        num(p.net_amount),
        (p.status || '').charAt(0).toUpperCase() + (p.status || '').slice(1),
      ]);
    });

    rows.push(['', '', 'TOTAL', formatHM(totalMinutes), num(totalGross), num(totalNet), '']);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 5 }, { wch: 18 }, { wch: 28 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 12 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Payslip Summary');

    const safePeriod = (period.period_name || 'period').replace(/[^a-zA-Z0-9-]/g, '_');
    const fileName = `PayslipSummary_${safePeriod}.xlsx`;
    const filePath = path.join(uploadsDir, fileName);
    XLSX.writeFile(wb, filePath);

    return { fileName, filePath };
  }
}

module.exports = new CsvService();
