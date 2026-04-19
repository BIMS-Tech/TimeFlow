const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

/**
 * PDF Generation Service
 * Generates Timesheet and Payslip PDFs
 */
const LOGO_PATH = path.join(__dirname, '../assets/logo.png');
const HAS_LOGO  = fs.existsSync(LOGO_PATH);

class PDFService {
  constructor() {
    // K_SERVICE is set by Cloud Run; those containers have a read-only FS except /tmp
    const serverless = !!(process.env.K_SERVICE || process.env.FUNCTION_NAME);
    this.outputDir = serverless
      ? '/tmp/timeflow-pdfs'
      : path.join(__dirname, '../../uploads');
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
    console.log(`[PDF] outputDir: ${this.outputDir}`);
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
          const isOvertimeTile = i === 2 && overtimeHours > 0;
          doc.roundedRect(tx, y, tileW, 44, 5).fill(isOvertimeTile ? '#fef3c7' : '#f1f5f9');
          doc.fontSize(7).font('Helvetica')
             .fillColor(isOvertimeTile ? '#b45309' : '#94a3b8')
             .text(label, tx + 10, y + 8);
          doc.fontSize(13).font('Helvetica-Bold')
             .fillColor(isOvertimeTile ? '#92400e' : '#1a1a2e')
             .text(value, tx + 10, y + 22);
          if (isOvertimeTile) {
            doc.fontSize(6).font('Helvetica-Bold').fillColor('#d97706')
               .text('EXTRA TIME', tx + tileW - 58, y + 8, { width: 50, align: 'right' });
          }
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
   * Generate Final Payslip PDF — BIMS payslip design
   */
  async generatePayslipPDF(summary, employee, period, payslipNumber) {
    return new Promise((resolve, reject) => {
      try {
        // ── Numeric fields ──────────────────────────────────────────────────
        const hourlyRate    = parseFloat(employee.hourly_rate || summary.hourly_rate) || 0;
        const regularHours  = parseFloat(summary.regular_hours)   || 0;
        const overtimeHours = parseFloat(summary.overtime_hours)  || 0;
        const grossAmount   = parseFloat(summary.gross_amount)    || 0;
        const taxDed        = parseFloat(summary.tax_deductions)  || 0;
        const otherDed      = parseFloat(summary.other_deductions)|| 0;
        const deductions    = parseFloat(summary.deductions)      || 0;
        const netAmount     = parseFloat(summary.net_amount)      || grossAmount;
        const totalDed      = taxDed + otherDed + deductions;
        const overtimeRate  = hourlyRate * 1.5;
        const regularPay    = regularHours  * hourlyRate;
        const overtimePay   = overtimeHours * overtimeRate;
        const totalHours    = regularHours + overtimeHours;
        const fmt2 = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        // ── Layout constants ────────────────────────────────────────────────
        const PAGE_W    = 595.28;
        const MARGIN    = 45;
        const CW        = PAGE_W - MARGIN * 2;   // 505.28
        const ROW_H     = 20;                    // standard row
        const ROW_H2    = 30;                    // tall row (wrapping text)
        const HDR_H     = 28;                    // header row height for earnings table
        const FONT_SZ   = 8.5;
        const HDR_BG    = '#bed8ea';
        const SECTION_C = '#1a56a0';
        const BORDER_C  = '#aaaaaa';
        const TEXT_C    = '#1a1a1a';
        const BOLD_BG   = '#dce8f0';
        const DATA_FONT = 'Courier';
        const HDR_FONT  = 'Helvetica-Bold';

        const logoPath   = LOGO_PATH;
        const hasLogo    = HAS_LOGO;
        const hasBankName = !!(employee.bank_name);
        const hasBankAcct = !!(employee.bank_account_number);
        const bankRows   = (hasBankName ? 1 : 0) + (hasBankAcct ? 1 : 0);

        // ── Pre-calculate total content height for dynamic page size ────────
        const LOGO_H      = hasLogo ? 70 : 34;
        const ADDR_H      = 14 + 14;                // address + website
        const STRIP_H     = 24;
        const GAP_AFTER_LOGO = 14;
        const T1_H        = ROW_H + ROW_H2;         // header + tall data row
        const T2_H        = ROW_H + ROW_H;
        const T3_H        = ROW_H + ROW_H;
        const EARN_H      = HDR_H + (9 + 1) * ROW_H;// header + 9 rows + total
        const NETPAY_H    = ROW_H;
        const BANK_H      = bankRows * ROW_H + (bankRows > 0 ? 10 : 0);
        const FOOTER_H    = 26;
        const SECTIONS_GAPS = 8 + 8 + 12 + 17 + 12 + 17 + 14; // gaps between sections

        const CONTENT_H = STRIP_H + LOGO_H + ADDR_H + GAP_AFTER_LOGO +
                          T1_H + 8 + T2_H + 8 + T3_H + SECTIONS_GAPS +
                          EARN_H + NETPAY_H + BANK_H + FOOTER_H;

        const PAGE_H    = CONTENT_H + 40;           // 20pt top pad + 20pt bottom pad
        const TOP_PAD   = 20;

        // ── Create document with fitted page height ─────────────────────────
        const doc = new PDFDocument({ size: [PAGE_W, PAGE_H], margin: 0 });

        const fileName = `Payslip_${payslipNumber}_${employee.name.replace(/\s+/g, '_')}.pdf`;
        const filePath = path.join(this.outputDir, fileName);
        const writeStream = fs.createWriteStream(filePath);
        doc.pipe(writeStream);

        // ── Helper: draw a bordered cell ─────────────────────────────────────
        const cell = (x, cy, w, h, bg, text, opts = {}) => {
          if (bg) doc.rect(x, cy, w, h).fill(bg);
          doc.rect(x, cy, w, h).lineWidth(0.4).strokeColor(BORDER_C).stroke();
          if (text !== null && text !== undefined && String(text) !== '') {
            const fz     = opts.fontSize  || FONT_SZ;
            const font   = opts.font      || DATA_FONT;
            const align  = opts.align     || 'left';
            const color  = opts.color     || TEXT_C;
            const pad    = opts.pad       !== undefined ? opts.pad : 5;
            const wrap   = opts.wrap      || false;
            // Vertically center single-line; top-align when wrapping
            const ty     = wrap ? cy + 5 : cy + Math.max(2, (h - fz * 1.25) / 2);
            doc.fontSize(fz).font(font).fillColor(color)
               .text(String(text), x + pad, ty, { width: w - pad * 2, align, lineBreak: wrap });
          }
        };

        // ── Helper: header row (fixed height, centered, wrap-safe) ───────────
        const hdrRow = (x, cy, cols, h = ROW_H) => {
          let cx = x;
          for (const c of cols) {
            cell(cx, cy, c.w, h, HDR_BG, c.label, {
              font: HDR_FONT, fontSize: FONT_SZ,
              align: c.align || 'center',
              wrap: true,   // allow wrapping so long labels don't overflow
              pad: 4,
            });
            cx += c.w;
          }
          return cy + h;
        };

        // ── Helper: data row ─────────────────────────────────────────────────
        const dataRow = (x, cy, cols, vals, opts = {}) => {
          const h  = opts.h    || ROW_H;
          const bg = opts.bold ? BOLD_BG : 'white';
          let cx = x;
          for (let i = 0; i < cols.length; i++) {
            cell(cx, cy, cols[i].w, h, bg, vals[i] ?? '', {
              font:   opts.bold ? HDR_FONT : DATA_FONT,
              fontSize: FONT_SZ,
              align:  cols[i].dataAlign || 'left',
              color:  TEXT_C,
              wrap:   opts.wrap || false,
              pad:    5,
            });
            cx += cols[i].w;
          }
          return cy + h;
        };

        // ── Helper: section heading ──────────────────────────────────────────
        const section = (cy, label) => {
          doc.fontSize(12).font(HDR_FONT).fillColor(SECTION_C)
             .text(label, MARGIN, cy);
          return cy + 17;
        };

        // ════════════════════════════════════════════════════════════════════
        // RENDER
        // ════════════════════════════════════════════════════════════════════
        const now      = new Date();
        const yyyymmdd = now.toISOString().slice(0, 10).replace(/-/g, '');
        const ymCode   = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
        const tplRef   = `${yyyymmdd} BIMS Payroll Template v${ymCode}`;

        // ── Template strip ───────────────────────────────────────────────────
        doc.fontSize(7).font('Helvetica').fillColor('#555555')
           .text(tplRef, MARGIN, TOP_PAD, { width: CW * 0.65, lineBreak: false });
        doc.fontSize(7).font(HDR_FONT).fillColor('#555555')
           .text('PAYSLIP', MARGIN, TOP_PAD, { width: CW, align: 'right' });

        let y = TOP_PAD + 14;

        // ── Logo ─────────────────────────────────────────────────────────────
        if (hasLogo) {
          const logoW = 170;
          doc.image(logoPath, (PAGE_W - logoW) / 2, y, { width: logoW });
          y += LOGO_H;
        } else {
          doc.fontSize(22).font(HDR_FONT).fillColor('#1a3a6b')
             .text('BIMS Technologies, Inc.', MARGIN, y, { width: CW, align: 'center' });
          y += LOGO_H;
        }

        // ── Address & website ────────────────────────────────────────────────
        const companyAddress = process.env.COMPANY_ADDRESS || '17F Skyrise 4B, W Geonzon St, Cebu IT Park, Lahug, Cebu City, Cebu, Philippines 6000';
        const companyWebsite = process.env.COMPANY_WEBSITE || 'bims.tech';

        doc.fontSize(8.5).font('Helvetica').fillColor(TEXT_C)
           .text(companyAddress, MARGIN, y, { width: CW, align: 'center', lineBreak: false });
        y += 14;
        doc.fontSize(8.5).font('Helvetica').fillColor(SECTION_C)
           .text(companyWebsite, MARGIN, y, { width: CW, align: 'center', lineBreak: false });
        y += GAP_AFTER_LOGO;

        // ── Table 1 — Employee info ──────────────────────────────────────────
        const empType = employee.employment_type === 'contractor' ? 'FREELANCE'
                      : employee.employment_type === 'part_time'  ? 'PART TIME'
                      : 'FULL TIME';
        const payDate = summary.approved_at
          ? this.formatDate(summary.approved_at)
          : this.formatDate(now);

        // Col widths must sum to CW (505)
        const t1 = [
          { label: 'Name',       w: 150, dataAlign: 'center' },
          { label: 'ID No.',     w: 55,  dataAlign: 'center' },
          { label: 'Pay Period', w: 90,  dataAlign: 'center' },
          { label: 'Pay Date',   w: 135, dataAlign: 'center' },
          { label: 'Payment',    w: 75,  dataAlign: 'center' },
        ];
        y = hdrRow(MARGIN, y, t1, ROW_H);
        // Use tall row + wrap so long period names (e.g. "March Full Month") don't clip
        y = dataRow(MARGIN, y, t1, [
          employee.name,
          employee.employee_id || '',
          period.period_name,
          payDate,
          'Bank Transfer',
        ], { h: ROW_H2, wrap: true });
        y += 8;

        // ── Table 2 — Position ───────────────────────────────────────────────
        const t2 = [
          { label: 'Position',      w: 200, dataAlign: 'center' },
          { label: 'Department',    w: 165, dataAlign: 'center' },
          { label: 'Employee Type', w: 140, dataAlign: 'center' },
        ];
        y = hdrRow(MARGIN, y, t2, ROW_H);
        y = dataRow(MARGIN, y, t2, [
          employee.position   || '',
          employee.department || '',
          empType,
        ]);
        y += 8;

        // ── Table 3 — Pay summary ────────────────────────────────────────────
        const t3 = [
          { label: 'Gross Pay',     w: 130, dataAlign: 'right' },
          { label: 'Deductions',    w: 115, dataAlign: 'right' },
          { label: 'Taxes',         w: 115, dataAlign: 'right' },
          { label: 'Take-Home Pay', w: 145, dataAlign: 'right' },
        ];
        y = hdrRow(MARGIN, y, t3, ROW_H);
        y = dataRow(MARGIN, y, t3, [
          fmt2(grossAmount),
          fmt2(totalDed),
          fmt2(taxDed),
          fmt2(netAmount),
        ]);
        y += 12;

        // ── Earnings section ─────────────────────────────────────────────────
        y = section(y, 'Earnings');

        // Widths sum to 505: 200+85+80+75+65
        const tE = [
          { label: 'Pay Description', w: 200, dataAlign: 'left'  },
          { label: '',                w: 85,  dataAlign: 'left'  },
          { label: 'Pay Rate',        w: 80,  dataAlign: 'right' },
          { label: 'Hours',           w: 75,  dataAlign: 'right' },
          { label: 'Paycheck\nTotal', w: 65,  dataAlign: 'right' },
        ];
        // Use taller header so "Paycheck Total" has room without overlapping
        y = hdrRow(MARGIN, y, tE, HDR_H);

        const earningsRows = [
          ['Regular',           '', fmt2(hourlyRate),  fmt2(regularHours),  fmt2(regularPay)  ],
          ['Overtime',          '', fmt2(overtimeRate), fmt2(overtimeHours), fmt2(overtimePay) ],
          ['Communication',     '', '', '', ''],
          ['Medical Allowance', '', '', '', ''],
          ['Bonus/Non-Taxable', '', '', '', ''],
          ['Allowance',         '', '', '', ''],
          ['Incentives',        '', '', '', ''],
          ['Adjustment',        '', '', '', ''],
          ['Tax Refund',        '', '', '', ''],
        ];
        for (const row of earningsRows) {
          y = dataRow(MARGIN, y, tE, row);
        }
        y = dataRow(MARGIN, y, tE, [
          'Total Earnings', '',
          fmt2(grossAmount),
          fmt2(totalHours),
          fmt2(grossAmount),
        ], { bold: true });
        y += 12;

        // ── Net Pay section ──────────────────────────────────────────────────
        y = section(y, 'Net Pay');

        cell(MARGIN,            y, CW - 65, ROW_H, HDR_BG, 'Total Net Pay',
          { font: HDR_FONT, fontSize: FONT_SZ, align: 'left' });
        cell(MARGIN + CW - 65,  y, 65,      ROW_H, HDR_BG, fmt2(netAmount),
          { font: HDR_FONT, fontSize: FONT_SZ, align: 'right' });
        y += ROW_H + 14;

        // ── Bank details ─────────────────────────────────────────────────────
        if (hasBankName || hasBankAcct) {
          const bL = 260, bR = CW - bL;
          if (hasBankName) {
            cell(MARGIN,       y, bL, ROW_H, 'white', 'Bank Name',        { font: DATA_FONT, fontSize: FONT_SZ });
            cell(MARGIN + bL,  y, bR, ROW_H, 'white', employee.bank_name, { font: DATA_FONT, fontSize: FONT_SZ, align: 'right' });
            y += ROW_H;
          }
          if (hasBankAcct) {
            cell(MARGIN,       y, bL, ROW_H, 'white', 'Account Number/Swift Account',  { font: DATA_FONT, fontSize: FONT_SZ });
            cell(MARGIN + bL,  y, bR, ROW_H, 'white', employee.bank_account_number,    { font: DATA_FONT, fontSize: FONT_SZ, align: 'right' });
            y += ROW_H;
          }
          y += 10;
        }

        // ── Footer ───────────────────────────────────────────────────────────
        doc.moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y).lineWidth(0.4).strokeColor('#cccccc').stroke();
        y += 8;
        doc.fontSize(7).font('Helvetica').fillColor('#888888')
           .text('This is a computer-generated payslip and does not require a signature.',
                 MARGIN, y, { width: CW, align: 'center' });

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
