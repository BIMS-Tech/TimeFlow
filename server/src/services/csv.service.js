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
  /**
   * Resolve a writable output directory.
   * Cloud Run containers (K_SERVICE) have a read-only filesystem except /tmp,
   * so fall back there rather than failing on the bundled uploads dir.
   */
  _writableDir() {
    const serverless = !!(process.env.K_SERVICE || process.env.FUNCTION_NAME);
    const candidates = serverless
      ? ['/tmp/timeflow-reports']
      : [path.join(__dirname, '../../uploads'), '/tmp/timeflow-reports'];
    for (const dir of candidates) {
      try {
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.accessSync(dir, fs.constants.W_OK);
        return dir;
      } catch { /* try next */ }
    }
    throw new Error('No writable directory found for report output');
  }

  /**
   * Generate a payroll summary CSV for an arbitrary date range.
   * One row per payslip, grouped by employee, with a subtotal line per employee
   * and a grand-total line per currency (a range can span local + international
   * pay periods, whose amounts must not be added together).
   *
   * @param {Array}  payslips - rows from Payslip.findByDateRange
   * @param {Object} range    - { startDate: 'YYYY-MM-DD', endDate: 'YYYY-MM-DD' }
   */
  async generateRangeSummaryCSV(payslips, range) {
    const { toDateStr } = require('../utils/date');
    const outDir = this._writableDir();

    const defCur = process.env.CURRENCY || 'BDT';
    const minutesOf = (p) => p.total_minutes != null ? parseInt(p.total_minutes, 10) : hoursToMinutes(p.total_hours);
    const num = (n) => parseFloat(n) || 0;
    const amt = (n) => num(n).toFixed(2);

    // RFC4180 escaping — employee names and period names may contain commas.
    const esc = (v) => {
      const s = v === null || v === undefined ? '' : String(v);
      return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const line = (cells) => cells.map(esc).join(',');

    // Group by employee, preserving the query's name ordering.
    const groups = [];
    const byEmp  = new Map();
    payslips.forEach(p => {
      let g = byEmp.get(p.employee_id);
      if (!g) {
        g = { name: p.employee_name || '', code: p.emp_code || '', cur: p.currency || defCur,
              rows: [], minutes: 0, gross: 0, net: 0 };
        byEmp.set(p.employee_id, g);
        groups.push(g);
      }
      g.rows.push(p);
      g.minutes += minutesOf(p);
      g.gross   += num(p.gross_amount);
      g.net     += num(p.net_amount);
    });

    const totalsByCur = {};
    let grandMinutes = 0;
    payslips.forEach(p => {
      const cur = p.currency || defCur;
      if (!totalsByCur[cur]) totalsByCur[cur] = { gross: 0, net: 0 };
      totalsByCur[cur].gross += num(p.gross_amount);
      totalsByCur[cur].net   += num(p.net_amount);
      grandMinutes += minutesOf(p);
    });
    const currencies = Object.keys(totalsByCur).sort();

    const out = [];
    out.push(line(['PAYROLL SUMMARY REPORT']));
    out.push(line(['Range', `${range.startDate} to ${range.endDate}`]));
    out.push(line(['Generated', toDateStr(new Date())]));
    out.push(line(['Employees', groups.length]));
    out.push(line(['Payslips', payslips.length]));
    out.push(line(['Total Hours', formatHM(grandMinutes)]));
    out.push('');
    out.push(line(['Employee', 'Employee Code', 'Pay Period', 'Period Start', 'Period End',
                   'Payslip No.', 'Hours', 'Currency', 'Gross', 'Deductions', 'Net Pay', 'Status']));

    groups.forEach(g => {
      g.rows.forEach(p => {
        const gross = num(p.gross_amount);
        const net   = num(p.net_amount);
        const status = p.status || '';
        out.push(line([
          g.name, g.code,
          p.period_name || '',
          toDateStr(p.period_start), toDateStr(p.period_end),
          p.payslip_number || '',
          formatHM(minutesOf(p)),
          p.currency || defCur,
          amt(gross), amt(gross - net), amt(net),
          status.charAt(0).toUpperCase() + status.slice(1),
        ]));
      });
      out.push(line([
        `${g.name} — Subtotal`, g.code, '', '', '', '',
        formatHM(g.minutes), g.cur,
        amt(g.gross), amt(g.gross - g.net), amt(g.net), '',
      ]));
    });

    out.push('');
    currencies.forEach((cur, i) => {
      out.push(line([
        'GRAND TOTAL', '', '', '', '', '',
        i === 0 ? formatHM(grandMinutes) : '',
        cur,
        amt(totalsByCur[cur].gross),
        amt(totalsByCur[cur].gross - totalsByCur[cur].net),
        amt(totalsByCur[cur].net),
        '',
      ]));
    });

    const fileName = `PayrollSummary_${range.startDate}_to_${range.endDate}.csv`;
    const filePath = path.join(outDir, fileName);
    // BOM so Excel opens UTF-8 names correctly.
    fs.writeFileSync(filePath, '﻿' + out.join('\r\n') + '\r\n', 'utf8');

    return { fileName, filePath };
  }

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
