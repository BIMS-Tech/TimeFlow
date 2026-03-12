const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

/**
 * PDF Generation Service
 * Generates Timesheet and Payslip PDFs
 */
class PDFService {
  constructor() {
    this.outputDir = path.join(__dirname, '../../uploads');
    
    // Ensure output directory exists
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Generate Timesheet PDF (Draft version with watermark) — absolute-coordinate layout
   */
  async generateTimesheetPDF(summary, employee, period, taskBreakdown = [], isDraft = true) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 0, autoFirstPage: true });

        const fileName = `Timesheet_${period.start_date}_${period.end_date}_${employee.name.replace(/\s+/g, '_')}.pdf`;
        const filePath = path.join(this.outputDir, fileName);
        const writeStream = fs.createWriteStream(filePath);
        doc.pipe(writeStream);

        const PAGE_W   = 595.28;
        const PAGE_H   = 841.89;
        const MARGIN   = 40;
        const CONTENT_W = PAGE_W - MARGIN * 2;
        const cur = employee.currency || process.env.CURRENCY || 'USD';
        const companyName = process.env.COMPANY_NAME || 'Company Name';

        // Numeric fields
        const hourlyRate    = parseFloat(summary.hourly_rate)    || 0;
        const totalHours    = parseFloat(summary.total_hours)    || 0;
        const regularHours  = parseFloat(summary.regular_hours)  || 0;
        const overtimeHours = parseFloat(summary.overtime_hours) || 0;
        const grossAmount   = parseFloat(summary.gross_amount)   || 0;
        const overtimeRate  = hourlyRate * 1.5;
        const money = (n) => `${cur} ${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

        // ── Helper: draw one page header ─────────────────────────────────────
        const drawPageHeader = () => {
          const statusColor = isDraft ? '#e74c3c' : '#27ae60';
          const statusLabel = isDraft ? 'DRAFT — PENDING APPROVAL' : 'APPROVED';

          // Dark header band
          doc.rect(0, 0, PAGE_W, 72).fill('#1a1a2e');
          doc.fontSize(18).font('Helvetica-Bold').fillColor('white')
             .text(companyName, MARGIN, 14, { width: CONTENT_W * 0.55 });
          doc.fontSize(9).font('Helvetica').fillColor('rgba(255,255,255,0.6)')
             .text('TIMESHEET', MARGIN, 40);

          // Status badge top-right
          doc.fontSize(8).font('Helvetica-Bold').fillColor(statusColor)
             .text(statusLabel, PAGE_W - MARGIN - 150, 18, { width: 150, align: 'right' });

          // Period name top-right
          doc.fontSize(9).font('Helvetica').fillColor('rgba(255,255,255,0.7)')
             .text(period.period_name, PAGE_W - MARGIN - 150, 34, { width: 150, align: 'right' });
        };

        // ── Page 1: header + info cards + hours tiles ─────────────────────────
        drawPageHeader();

        let y = 88;

        // Watermark for draft
        if (isDraft) {
          doc.save();
          doc.rotate(-45, { origin: [PAGE_W / 2, PAGE_H / 2] });
          doc.fontSize(70).font('Helvetica-Bold').fillColor('#e0e0e0', 0.12)
             .text('DRAFT', 0, PAGE_H / 2 - 35, { width: PAGE_W, align: 'center' });
          doc.restore();
        }

        // ── Employee + Period info cards ──────────────────────────────────────
        const CARD_W = CONTENT_W / 2 - 6;
        const CARD_H = 100;

        // Left: Employee
        doc.roundedRect(MARGIN, y, CARD_W, CARD_H, 5).fill('#f8fafc');
        doc.fontSize(7).font('Helvetica-Bold').fillColor('#94a3b8')
           .text('EMPLOYEE', MARGIN + 12, y + 10);
        doc.fontSize(12).font('Helvetica-Bold').fillColor('#1a1a2e')
           .text(employee.name, MARGIN + 12, y + 22, { width: CARD_W - 24, ellipsis: true });
        doc.fontSize(8).font('Helvetica').fillColor('#475569');
        const empLines = [
          `ID: ${employee.employee_id || '—'}`,
          `Dept: ${employee.department || '—'}`,
          `Position: ${employee.position || '—'}`,
          `Email: ${employee.email || '—'}`
        ];
        empLines.forEach((line, i) => {
          doc.text(line, MARGIN + 12, y + 40 + i * 13, { width: CARD_W - 24, ellipsis: true });
        });

        // Right: Period
        const rx = MARGIN + CARD_W + 12;
        doc.roundedRect(rx, y, CARD_W, CARD_H, 5).fill('#f8fafc');
        doc.fontSize(7).font('Helvetica-Bold').fillColor('#94a3b8')
           .text('PAY PERIOD', rx + 12, y + 10);
        doc.fontSize(12).font('Helvetica-Bold').fillColor('#1a1a2e')
           .text(period.period_name, rx + 12, y + 22, { width: CARD_W - 24, ellipsis: true });
        doc.fontSize(8).font('Helvetica').fillColor('#475569')
           .text(`From: ${this.formatDate(period.start_date)}`, rx + 12, y + 40)
           .text(`To:     ${this.formatDate(period.end_date)}`,   rx + 12, y + 53)
           .text(`Generated: ${this.formatDate(new Date())}`,     rx + 12, y + 66);

        y += CARD_H + 14;

        // ── Hours tiles (3 boxes) ─────────────────────────────────────────────
        const tileW = CONTENT_W / 3 - 5;
        const tiles = [
          ['Total Hours',    `${totalHours.toFixed(2)} hrs`],
          ['Regular Hours',  `${regularHours.toFixed(2)} hrs`],
          ['Overtime Hours', `${overtimeHours.toFixed(2)} hrs`],
        ];
        tiles.forEach(([label, value], i) => {
          const tx = MARGIN + i * (tileW + 7);
          doc.roundedRect(tx, y, tileW, 44, 5).fill('#f1f5f9');
          doc.fontSize(7).font('Helvetica').fillColor('#94a3b8').text(label, tx + 10, y + 8);
          doc.fontSize(13).font('Helvetica-Bold').fillColor('#1a1a2e').text(value, tx + 10, y + 22);
        });

        y += 44 + 14;

        // ── Payment summary row ───────────────────────────────────────────────
        const payTiles = [
          ['Hourly Rate',    money(hourlyRate)],
          overtimeHours > 0
            ? ['Overtime Rate', money(overtimeRate)]
            : ['Regular Pay',   money(regularHours * hourlyRate)],
          ['Gross Amount',   money(grossAmount)],
        ];
        payTiles.forEach(([label, value], i) => {
          const tx = MARGIN + i * (tileW + 7);
          doc.roundedRect(tx, y, tileW, 44, 5).fill(i === 2 ? '#1a1a2e' : '#f8fafc');
          doc.fontSize(7).font('Helvetica').fillColor(i === 2 ? 'rgba(255,255,255,0.6)' : '#94a3b8')
             .text(label, tx + 10, y + 8);
          doc.fontSize(13).font('Helvetica-Bold').fillColor(i === 2 ? '#a5f3a0' : '#1a1a2e')
             .text(value, tx + 10, y + 22);
        });

        y += 44 + 18;

        // ── Task Breakdown ────────────────────────────────────────────────────
        if (taskBreakdown && taskBreakdown.length > 0) {
          // Section label
          doc.fontSize(7).font('Helvetica-Bold').fillColor('#64748b')
             .text('TASK BREAKDOWN', MARGIN, y);
          doc.moveTo(MARGIN, y + 10).lineTo(PAGE_W - MARGIN, y + 10)
             .lineWidth(0.5).strokeColor('#e2e8f0').stroke();
          y += 16;

          // Column header row
          const ROW_H = 15;
          const COL = {
            date:    { x: MARGIN + 2,   w: 68  },
            task:    { x: MARGIN + 74,  w: 230 },
            project: { x: MARGIN + 308, w: 140 },
            hours:   { x: MARGIN + 452, w: 62  },
          };

          doc.rect(MARGIN, y, CONTENT_W, ROW_H).fill('#e2e8f0');
          doc.fontSize(7).font('Helvetica-Bold').fillColor('#334155');
          doc.text('Date',    COL.date.x,    y + 4, { width: COL.date.w });
          doc.text('Task',    COL.task.x,    y + 4, { width: COL.task.w });
          doc.text('Project', COL.project.x, y + 4, { width: COL.project.w });
          doc.text('Hours',   COL.hours.x,   y + 4, { width: COL.hours.w, align: 'right' });
          y += ROW_H;

          // Data rows
          taskBreakdown.forEach((task, idx) => {
            // New page if needed
            if (y + ROW_H > PAGE_H - 60) {
              doc.addPage({ size: 'A4', margin: 0 });
              if (isDraft) {
                doc.save();
                doc.rotate(-45, { origin: [PAGE_W / 2, PAGE_H / 2] });
                doc.fontSize(70).font('Helvetica-Bold').fillColor('#e0e0e0', 0.12)
                   .text('DRAFT', 0, PAGE_H / 2 - 35, { width: PAGE_W, align: 'center' });
                doc.restore();
              }
              drawPageHeader();
              y = 82;

              // Repeat column headers on new page
              doc.rect(MARGIN, y, CONTENT_W, ROW_H).fill('#e2e8f0');
              doc.fontSize(7).font('Helvetica-Bold').fillColor('#334155');
              doc.text('Date',    COL.date.x,    y + 4, { width: COL.date.w });
              doc.text('Task',    COL.task.x,    y + 4, { width: COL.task.w });
              doc.text('Project', COL.project.x, y + 4, { width: COL.project.w });
              doc.text('Hours',   COL.hours.x,   y + 4, { width: COL.hours.w, align: 'right' });
              y += ROW_H;
            }

            const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
            doc.rect(MARGIN, y, CONTENT_W, ROW_H).fill(bg);
            doc.fontSize(7).font('Helvetica').fillColor('#334155');
            doc.text(this.formatDateShort(task.task_date), COL.date.x,    y + 4, { width: COL.date.w,    ellipsis: true, lineBreak: false });
            doc.text(task.task_name    || '—',             COL.task.x,    y + 4, { width: COL.task.w,    ellipsis: true, lineBreak: false });
            doc.text(task.project_name || '—',             COL.project.x, y + 4, { width: COL.project.w, ellipsis: true, lineBreak: false });
            doc.text(parseFloat(task.hours).toFixed(2),    COL.hours.x,   y + 4, { width: COL.hours.w,   align: 'right',  lineBreak: false });
            y += ROW_H;
          });

          // Total row
          doc.rect(MARGIN, y, CONTENT_W, ROW_H + 2).fill('#1a1a2e');
          doc.fontSize(8).font('Helvetica-Bold').fillColor('white');
          doc.text('TOTAL', COL.date.x, y + 4, { width: 200 });
          doc.text(totalHours.toFixed(2), COL.hours.x, y + 4, { width: COL.hours.w, align: 'right' });
          y += ROW_H + 2;
        }

        // ── Footer ────────────────────────────────────────────────────────────
        const footerY = PAGE_H - 36;
        doc.moveTo(MARGIN, footerY).lineTo(PAGE_W - MARGIN, footerY)
           .lineWidth(0.5).strokeColor('#e2e8f0').stroke();
        const footerNote = isDraft ? 'Draft — Not for payment' : 'Approved for payment';
        doc.fontSize(7).font('Helvetica').fillColor('#94a3b8')
           .text(`${footerNote}  ·  Generated: ${this.formatDate(new Date())}`,
                 MARGIN, footerY + 8, { width: CONTENT_W, align: 'center' });

        doc.end();

        writeStream.on('finish', () => {
          resolve({ fileName, filePath, fileSize: fs.statSync(filePath).size });
        });
        writeStream.on('error', reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generate Final Payslip PDF (After approval) — clean single-page layout
   */
  async generatePayslipPDF(summary, employee, period, payslipNumber) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 0 });

        const fileName = `Payslip_${payslipNumber}_${employee.name.replace(/\s+/g, '_')}.pdf`;
        const filePath = path.join(this.outputDir, fileName);
        const writeStream = fs.createWriteStream(filePath);
        doc.pipe(writeStream);

        const cur = employee.currency || process.env.CURRENCY || 'USD';
        const companyName = process.env.COMPANY_NAME || 'Company Name';
        const PAGE_W = 595.28;
        const MARGIN = 40;
        const CONTENT_W = PAGE_W - MARGIN * 2;

        // ── Numeric fields ──────────────────────────────────────────────────
        const hourlyRate     = parseFloat(summary.hourly_rate)    || 0;
        const regularHours   = parseFloat(summary.regular_hours)  || 0;
        const overtimeHours  = parseFloat(summary.overtime_hours) || 0;
        const grossAmount    = parseFloat(summary.gross_amount)   || 0;
        const taxDed         = parseFloat(summary.tax_deductions)   || 0;
        const otherDed       = parseFloat(summary.other_deductions) || 0;
        const netAmount      = parseFloat(summary.net_amount)     || 0;
        const totalDed       = taxDed + otherDed;
        const overtimeRate   = hourlyRate * 1.5;
        const regularPay     = regularHours  * hourlyRate;
        const overtimePay    = overtimeHours * overtimeRate;

        const money = (n) => `${cur} ${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

        // ── Header band ─────────────────────────────────────────────────────
        doc.rect(0, 0, PAGE_W, 90).fill('#1a1a2e');
        doc.fontSize(22).font('Helvetica-Bold').fillColor('white')
           .text(companyName, MARGIN, 22, { width: CONTENT_W * 0.6 });
        doc.fontSize(10).font('Helvetica').fillColor('rgba(255,255,255,0.7)')
           .text('PAY SLIP', MARGIN, 52);

        // Payslip # on right side of header
        doc.fontSize(9).font('Helvetica').fillColor('rgba(255,255,255,0.6)')
           .text('Payslip No.', PAGE_W - MARGIN - 130, 28, { width: 130, align: 'right' });
        doc.fontSize(11).font('Helvetica-Bold').fillColor('white')
           .text(payslipNumber, PAGE_W - MARGIN - 130, 42, { width: 130, align: 'right' });

        let y = 108;

        // ── Employee & Period info cards side-by-side ───────────────────────
        const CARD_W = CONTENT_W / 2 - 8;
        const CARD_H = 110;

        // Left card: employee
        doc.roundedRect(MARGIN, y, CARD_W, CARD_H, 6).fill('#f8fafc');
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#94a3b8')
           .text('EMPLOYEE DETAILS', MARGIN + 14, y + 12);
        doc.fontSize(13).font('Helvetica-Bold').fillColor('#1a1a2e')
           .text(employee.name, MARGIN + 14, y + 26);
        doc.fontSize(9).font('Helvetica').fillColor('#475569')
           .text(`ID: ${employee.employee_id || '—'}`, MARGIN + 14, y + 46)
           .text(`Dept: ${employee.department || '—'}`, MARGIN + 14, y + 60)
           .text(`Position: ${employee.position || '—'}`, MARGIN + 14, y + 74)
           .text(`Email: ${employee.email || '—'}`, MARGIN + 14, y + 88);

        // Right card: period
        const rx = MARGIN + CARD_W + 16;
        doc.roundedRect(rx, y, CARD_W, CARD_H, 6).fill('#f8fafc');
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#94a3b8')
           .text('PAY PERIOD', rx + 14, y + 12);
        doc.fontSize(13).font('Helvetica-Bold').fillColor('#1a1a2e')
           .text(period.period_name, rx + 14, y + 26);
        doc.fontSize(9).font('Helvetica').fillColor('#475569')
           .text(`From: ${this.formatDate(period.start_date)}`, rx + 14, y + 46)
           .text(`To:     ${this.formatDate(period.end_date)}`, rx + 14, y + 60)
           .text(`Pay Date: ${this.formatDate(new Date())}`, rx + 14, y + 74);
        if (summary.approved_at) {
          doc.text(`Approved: ${this.formatDate(summary.approved_at)}`, rx + 14, y + 88);
        }

        y += CARD_H + 20;

        // ── Earnings table ──────────────────────────────────────────────────
        const drawSectionLabel = (label, yPos) => {
          doc.fontSize(8).font('Helvetica-Bold').fillColor('#64748b')
             .text(label, MARGIN, yPos);
          doc.moveTo(MARGIN, yPos + 12).lineTo(PAGE_W - MARGIN, yPos + 12)
             .lineWidth(0.5).strokeColor('#e2e8f0').stroke();
          return yPos + 18;
        };

        const drawTableRow = (label, hours, rate, amount, yPos, bold = false, shade = false) => {
          if (shade) doc.rect(MARGIN, yPos - 3, CONTENT_W, 18).fill('#f1f5f9');
          doc.fillColor(bold ? '#1a1a2e' : '#334155')
             .fontSize(9).font(bold ? 'Helvetica-Bold' : 'Helvetica');
          const C = [MARGIN + 4, MARGIN + 200, MARGIN + 320, MARGIN + 420];
          if (label)  doc.text(label,  C[0], yPos, { width: 190 });
          if (hours)  doc.text(hours,  C[1], yPos, { width: 110, align: 'right' });
          if (rate)   doc.text(rate,   C[2], yPos, { width: 95,  align: 'right' });
          if (amount) doc.text(amount, C[3], yPos, { width: 95,  align: 'right' });
          return yPos + 20;
        };

        // Earnings header
        y = drawSectionLabel('EARNINGS', y);
        y = drawTableRow('Description', 'Hours', 'Rate / hr', 'Amount', y, true);

        y = drawTableRow('Regular Hours',
          `${regularHours.toFixed(2)} hrs`,
          money(hourlyRate),
          money(regularPay),
          y, false, true);

        if (overtimeHours > 0) {
          y = drawTableRow('Overtime Hours',
            `${overtimeHours.toFixed(2)} hrs`,
            money(overtimeRate),
            money(overtimePay),
            y, false, false);
        }

        y += 4;
        doc.moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y).lineWidth(0.5).strokeColor('#cbd5e1').stroke();
        y += 8;
        y = drawTableRow('Gross Earnings', '', '', money(grossAmount), y, true, true);

        y += 16;

        // ── Deductions table ────────────────────────────────────────────────
        y = drawSectionLabel('DEDUCTIONS', y);
        y = drawTableRow('Description', '', '', 'Amount', y, true);

        y = drawTableRow('Tax Deductions',    '', '', money(taxDed),   y, false, true);
        y = drawTableRow('Other Deductions',  '', '', money(otherDed), y, false, false);

        y += 4;
        doc.moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y).lineWidth(0.5).strokeColor('#cbd5e1').stroke();
        y += 8;
        y = drawTableRow('Total Deductions', '', '', money(totalDed), y, true, true);

        y += 20;

        // ── Net Pay band ────────────────────────────────────────────────────
        doc.rect(MARGIN, y, CONTENT_W, 44).fill('#1a1a2e');
        doc.fontSize(11).font('Helvetica-Bold').fillColor('white')
           .text('NET PAY', MARGIN + 14, y + 14);
        doc.fontSize(16).font('Helvetica-Bold').fillColor('#a5f3a0')
           .text(money(netAmount), MARGIN, y + 12, { width: CONTENT_W - 14, align: 'right' });

        y += 44 + 20;

        // ── Summary row ─────────────────────────────────────────────────────
        const statW = CONTENT_W / 3;
        const stats = [
          ['Total Hours',   `${(regularHours + overtimeHours).toFixed(2)} hrs`],
          ['Hourly Rate',   money(hourlyRate)],
          ['Deductions',    money(totalDed)],
        ];
        stats.forEach(([label, value], i) => {
          const sx = MARGIN + i * statW;
          doc.rect(sx, y, statW - 8, 44).fill('#f8fafc');
          doc.fontSize(8).font('Helvetica').fillColor('#94a3b8').text(label, sx + 10, y + 8);
          doc.fontSize(11).font('Helvetica-Bold').fillColor('#1a1a2e').text(value, sx + 10, y + 22);
        });

        y += 44 + 20;

        // ── Footer ──────────────────────────────────────────────────────────
        doc.moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y).lineWidth(0.5).strokeColor('#e2e8f0').stroke();
        y += 10;
        doc.fontSize(8).font('Helvetica').fillColor('#94a3b8')
           .text('This is a computer-generated payslip and does not require a signature.', MARGIN, y, { width: CONTENT_W, align: 'center' })
           .text(`Generated on ${this.formatDate(new Date())}`, MARGIN, y + 12, { width: CONTENT_W, align: 'center' });

        doc.end();

        writeStream.on('finish', () => {
          resolve({ fileName, filePath, fileSize: fs.statSync(filePath).size });
        });
        writeStream.on('error', reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Add header to document
   */
  addHeader(doc, title) {
    doc.fontSize(20)
       .font('Helvetica-Bold')
       .text(title, { align: 'center' })
       .font('Helvetica')
       .moveDown(1);
  }

  /**
   * Add section title
   */
  addSection(doc, title) {
    doc.fontSize(11)
       .font('Helvetica-Bold')
       .fillColor('#2c3e50')
       .text(title, { underline: true })
       .font('Helvetica')
       .fillColor('black')
       .moveDown(0.5);
  }

  /**
   * Add info row
   */
  addInfoRow(doc, label, value) {
    doc.fontSize(10)
       .font('Helvetica-Bold')
       .text(label, 50, doc.y, { continued: true })
       .font('Helvetica')
       .text(` ${value}`);
  }

  /**
   * Add task breakdown table
   */
  addTaskTable(doc, tasks) {
    const tableTop = doc.y + 5;
    const col1 = 50;   // Date
    const col2 = 120;  // Task
    const col3 = 320;  // Project
    const col4 = 450;  // Hours

    // Table header
    doc.fontSize(8).font('Helvetica-Bold');
    doc.rect(50, tableTop - 5, 500, 18).fill('#ecf0f1');
    doc.fillColor('black');
    doc.text('Date', col1, tableTop);
    doc.text('Task', col2, tableTop);
    doc.text('Project', col3, tableTop);
    doc.text('Hours', col4, tableTop);
    doc.font('Helvetica');

    let y = tableTop + 20;

    tasks.forEach((task, index) => {
      // Alternate row colors
      if (index % 2 === 0) {
        doc.rect(50, y - 3, 500, 16).fill('#ffffff');
      } else {
        doc.rect(50, y - 3, 500, 16).fill('#f9f9f9');
      }
      doc.fillColor('black');

      doc.fontSize(8);
      doc.text(this.formatDate(task.task_date), col1, y);
      doc.text(task.task_name || 'N/A', col2, y, { width: 190 });
      doc.text(task.project_name || 'N/A', col3, y, { width: 120 });
      doc.text(task.hours.toFixed(2), col4, y);
      y += 16;
    });

    doc.y = y + 10;
  }

  /**
   * Add watermark
   */
  addWatermark(doc, text) {
    doc.save();
    doc.rotate(45, { origin: [300, 400] })
       .fontSize(60)
       .fillColor('#e0e0e0', 0.3)
       .text(text, 100, 350, { align: 'center' })
       .fillColor('black', 1);
    doc.restore();
  }

  /**
   * Add footer
   */
  addFooter(doc, text) {
    doc.fontSize(8)
       .fillColor('#999')
       .text(text, { align: 'center' })
       .text(`Generated on: ${this.formatDate(new Date())}`, { align: 'center' })
       .fillColor('black');
  }

  /**
   * Format date — long form (e.g. March 12, 2026)
   */
  formatDate(date) {
    if (!date) return 'N/A';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  /**
   * Format date — short form for table rows (e.g. Mar 12, 2026)
   */
  formatDateShort(date) {
    if (!date) return '—';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  /**
   * Delete a PDF file
   */
  deletePDF(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error deleting PDF:', error);
      return false;
    }
  }

  /**
   * Get PDF file stats
   */
  getPDFStats(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        return {
          exists: true,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime
        };
      }
      return { exists: false };
    } catch (error) {
      return { exists: false, error: error.message };
    }
  }
}

module.exports = new PDFService();
