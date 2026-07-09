const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Import routes and services
const routes = require('./routes');
const db = require('./database/connection');

// Create Express app
const app = express();

// ============================================
// MIDDLEWARE
// ============================================

// Security headers
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(morgan('combined'));

// Static files for uploaded PDFs
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ============================================
// ROUTES
// ============================================

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API routes
app.use('/api', routes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Timesheet & Payslip Management API',
    version: '1.0.0',
    endpoints: {
      api: '/api',
      health: '/health',
      dashboard: '/api/dashboard',
      employees: '/api/employees',
      timesheet: '/api/timesheet',
      webhooks: '/api/webhooks'
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ============================================
// SERVER STARTUP
// ============================================

const PORT = process.env.PORT || 5000;

async function runMigrations() {
  const migrations = [
    `ALTER TABLE employees ADD COLUMN employment_type ENUM('full_time','part_time','contractor') NOT NULL DEFAULT 'full_time'`,
    `ALTER TABLE employees ADD COLUMN hire_category ENUM('local','foreign') NOT NULL DEFAULT 'local'`,
    `ALTER TABLE employees ADD COLUMN bank_name VARCHAR(255) DEFAULT NULL`,
    `ALTER TABLE employees ADD COLUMN bank_account_number VARCHAR(100) DEFAULT NULL`,
    `ALTER TABLE employees ADD COLUMN bank_account_name VARCHAR(255) DEFAULT NULL`,
    `ALTER TABLE employees ADD COLUMN bank_branch VARCHAR(255) DEFAULT NULL`,
    `ALTER TABLE employees ADD COLUMN bank_swift_code VARCHAR(50) DEFAULT NULL`,
    // Name parts for XCS local bank file
    `ALTER TABLE employees ADD COLUMN first_name VARCHAR(100) DEFAULT NULL`,
    `ALTER TABLE employees ADD COLUMN last_name VARCHAR(100) DEFAULT NULL`,
    `ALTER TABLE employees ADD COLUMN middle_name VARCHAR(100) DEFAULT NULL`,
    // International DFT bank file fields
    `ALTER TABLE employees ADD COLUMN remittance_type VARCHAR(50) DEFAULT NULL`,
    `ALTER TABLE employees ADD COLUMN beneficiary_code VARCHAR(50) DEFAULT NULL`,
    `ALTER TABLE employees ADD COLUMN beneficiary_address TEXT DEFAULT NULL`,
    `ALTER TABLE employees ADD COLUMN bank_address VARCHAR(255) DEFAULT NULL`,
    `ALTER TABLE employees ADD COLUMN country_of_destination VARCHAR(100) DEFAULT NULL`,
    `ALTER TABLE employees ADD COLUMN purpose_nature VARCHAR(255) DEFAULT NULL`,
    `ALTER TABLE employees ADD COLUMN intermediary_bank_name VARCHAR(255) DEFAULT NULL`,
    `ALTER TABLE employees ADD COLUMN intermediary_bank_address VARCHAR(255) DEFAULT NULL`,
    `ALTER TABLE employees ADD COLUMN intermediary_bank_swift VARCHAR(50) DEFAULT NULL`,
    `ALTER TABLE employees ADD COLUMN payee_tin VARCHAR(50) DEFAULT NULL`,
    `ALTER TABLE employees ADD COLUMN payee_zip_code VARCHAR(20) DEFAULT NULL`,
    `ALTER TABLE employees ADD COLUMN payee_foreign_address VARCHAR(255) DEFAULT NULL`,
    `ALTER TABLE employees ADD COLUMN payee_foreign_zip_code VARCHAR(20) DEFAULT NULL`,
    `ALTER TABLE employees ADD COLUMN tax_code VARCHAR(50) DEFAULT NULL`,
    // Wrike timelog category name stored on import
    `ALTER TABLE time_entries ADD COLUMN category VARCHAR(255) DEFAULT NULL`,
    // Period type: local (15-day) vs foreign (monthly)
    `ALTER TABLE pay_periods ADD COLUMN period_type ENUM('local','foreign') NOT NULL DEFAULT 'local'`,
    // Seed admin user (INSERT IGNORE skips silently if email already exists)
    `INSERT IGNORE INTO users (username, email, password_hash, role, is_active) VALUES ('dam', 'dam@bims.tech', '$2a$10$o/Mq7JOam81/UrSQn6T91ei1RrYVgAqn4HVboXCkzlJ1GBaue5.UG', 'admin', 1)`,

    // Philippine payroll deduction fields
    `ALTER TABLE employees ADD COLUMN employee_type ENUM('FTE-LCL','FTE-INTL','PTE-WB','PTE-WOB','PTE-INTL','PB-LCL','PB-INTL') DEFAULT NULL`,
    `ALTER TABLE employees ADD COLUMN sss_number VARCHAR(20) DEFAULT NULL`,
    `ALTER TABLE employees ADD COLUMN philhealth_number VARCHAR(20) DEFAULT NULL`,
    `ALTER TABLE employees ADD COLUMN pagibig_number VARCHAR(20) DEFAULT NULL`,
    `ALTER TABLE time_entries_summary ADD COLUMN sss_ee DECIMAL(12,2) DEFAULT 0`,
    `ALTER TABLE time_entries_summary ADD COLUMN sss_mpf DECIMAL(12,2) DEFAULT 0`,
    `ALTER TABLE time_entries_summary ADD COLUMN philhealth_ee DECIMAL(12,2) DEFAULT 0`,
    `ALTER TABLE time_entries_summary ADD COLUMN pagibig_ee DECIMAL(12,2) DEFAULT 0`,
    `ALTER TABLE time_entries_summary ADD COLUMN bir_tax DECIMAL(12,2) DEFAULT 0`,
    `ALTER TABLE payslips ADD COLUMN sss_ee DECIMAL(12,2) DEFAULT 0`,
    `ALTER TABLE payslips ADD COLUMN sss_mpf DECIMAL(12,2) DEFAULT 0`,
    `ALTER TABLE payslips ADD COLUMN philhealth_ee DECIMAL(12,2) DEFAULT 0`,
    `ALTER TABLE payslips ADD COLUMN pagibig_ee DECIMAL(12,2) DEFAULT 0`,
    `ALTER TABLE payslips ADD COLUMN bir_tax DECIMAL(12,2) DEFAULT 0`,

    // Async payroll job queue
    `CREATE TABLE IF NOT EXISTS payroll_jobs (
      id VARCHAR(36) NOT NULL,
      type VARCHAR(50) NOT NULL DEFAULT 'submit',
      status ENUM('queued','processing','done','failed') NOT NULL DEFAULT 'queued',
      payload JSON NOT NULL,
      progress JSON DEFAULT NULL,
      result JSON DEFAULT NULL,
      error TEXT DEFAULT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_pj_status (status),
      INDEX idx_pj_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    // Add progress column to existing payroll_jobs tables (no-op if just created above)
    `ALTER TABLE payroll_jobs ADD COLUMN progress JSON DEFAULT NULL`,
    // Employee address (local employees)
    `ALTER TABLE employees ADD COLUMN employee_address TEXT DEFAULT NULL`,
    // Add Independent Contractor to employee_type enum
    `ALTER TABLE employees MODIFY COLUMN employee_type ENUM('FTE-LCL','FTE-INTL','PTE-WB','PTE-WOB','PTE-INTL','PB-LCL','PB-INTL','IC') DEFAULT NULL`,
    // Split IC into IC-LCL (local) and IC-INTL (international); migrate existing 'IC' rows to IC-LCL
    `ALTER TABLE employees MODIFY COLUMN employee_type ENUM('FTE-LCL','FTE-INTL','PTE-WB','PTE-WOB','PTE-INTL','PB-LCL','PB-INTL','IC','IC-LCL','IC-INTL') DEFAULT NULL`,
    `UPDATE employees SET employee_type = 'IC-LCL' WHERE employee_type = 'IC'`,
    `ALTER TABLE employees MODIFY COLUMN employee_type ENUM('FTE-LCL','FTE-INTL','PTE-WB','PTE-WOB','PTE-INTL','PB-LCL','PB-INTL','IC-LCL','IC-INTL') DEFAULT NULL`,
    // Cash advance deduction column for summaries and payslips
    `ALTER TABLE time_entries_summary ADD COLUMN cash_advance DECIMAL(12,2) DEFAULT 0`,
    `ALTER TABLE payslips ADD COLUMN cash_advance DECIMAL(12,2) DEFAULT 0`,
    // Timesheet verification table
    `CREATE TABLE IF NOT EXISTS timesheet_verifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      employee_id INT NOT NULL,
      period_id INT NOT NULL,
      verified_hours DECIMAL(10,2) DEFAULT NULL,
      cash_advance DECIMAL(12,2) DEFAULT 0,
      status ENUM('pending','verified','rejected') NOT NULL DEFAULT 'pending',
      notes TEXT DEFAULT NULL,
      verified_at TIMESTAMP NULL DEFAULT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_tv_emp_period (employee_id, period_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

    // Multi-role user system (initial)
    `ALTER TABLE users MODIFY COLUMN role ENUM('super_admin','admin','hr','accountant','viewer') DEFAULT 'viewer'`,
    // Upgrade the seed admin user to super_admin
    `UPDATE users SET role = 'super_admin' WHERE username = 'dam' AND email = 'dam@bims.tech' AND role = 'admin'`,

    // Revised role structure: super_admin | hr | payroll_officer
    // Step 1: expand enum to include payroll_officer so UPDATE below won't fail
    `ALTER TABLE users MODIFY COLUMN role ENUM('super_admin','admin','hr','accountant','viewer','payroll_officer') DEFAULT 'payroll_officer'`,
    // Step 2: remap obsolete roles
    `UPDATE users SET role = 'hr' WHERE role = 'admin'`,
    `UPDATE users SET role = 'payroll_officer' WHERE role IN ('accountant', 'viewer')`,
    // Step 3: contract enum to final 3-role set
    `ALTER TABLE users MODIFY COLUMN role ENUM('super_admin','hr','payroll_officer') DEFAULT 'payroll_officer'`,

    // Add employee role for portal-linked users
    `ALTER TABLE users MODIFY COLUMN role ENUM('super_admin','hr','payroll_officer','employee') DEFAULT 'payroll_officer'`,
    `UPDATE users SET role = 'employee' WHERE employee_id IS NOT NULL AND role != 'employee'`,

    // Convert role column from ENUM to VARCHAR to support accounting_manager and future roles
    `ALTER TABLE users MODIFY COLUMN role VARCHAR(50) NOT NULL DEFAULT 'payroll_officer'`,

    // Payslip release flow: released_at timestamp + widen status to VARCHAR
    `ALTER TABLE payslips ADD COLUMN released_at DATETIME NULL DEFAULT NULL`,
    `ALTER TABLE payslips MODIFY COLUMN status VARCHAR(20) NOT NULL DEFAULT 'generated'`,

    // Bank upload tracking per period
    `ALTER TABLE pay_periods ADD COLUMN bank_uploaded_at DATETIME NULL DEFAULT NULL`,
    `ALTER TABLE pay_periods ADD COLUMN bank_uploaded_by INT NULL DEFAULT NULL`,
    `ALTER TABLE pay_periods ADD COLUMN local_bank_downloaded_at DATETIME NULL DEFAULT NULL`,
    `ALTER TABLE pay_periods ADD COLUMN foreign_bank_downloaded_at DATETIME NULL DEFAULT NULL`,

    // ── Exact time: integer minutes become the source of truth ──────────────────
    // Wrike records whole minutes; 1 min = 0.01666…h cannot be stored exactly in a
    // DECIMAL column, so DECIMAL(5,2) silently rounded (biased up) on every write.
    // Backfilling ROUND(hours*60) is LOSSLESS: minute spacing (0.0167h) exceeds the
    // 0.01 rounding bucket, so each stored value maps back to exactly one minute.
    `ALTER TABLE time_entries ADD COLUMN minutes_worked INT NULL DEFAULT NULL`,
    `UPDATE time_entries SET minutes_worked = ROUND(hours_worked * 60) WHERE minutes_worked IS NULL`,
    `ALTER TABLE time_entries MODIFY COLUMN hours_worked DECIMAL(10,4) NOT NULL`,

    `ALTER TABLE time_entries_summary ADD COLUMN total_minutes INT NULL DEFAULT NULL`,
    `ALTER TABLE time_entries_summary ADD COLUMN regular_minutes INT NULL DEFAULT NULL`,
    `ALTER TABLE time_entries_summary ADD COLUMN overtime_minutes INT NULL DEFAULT NULL`,
    `UPDATE time_entries_summary SET total_minutes = ROUND(total_hours * 60) WHERE total_minutes IS NULL`,
    `UPDATE time_entries_summary SET regular_minutes = ROUND(regular_hours * 60) WHERE regular_minutes IS NULL`,
    `UPDATE time_entries_summary SET overtime_minutes = ROUND(overtime_hours * 60) WHERE overtime_minutes IS NULL`,
    `ALTER TABLE time_entries_summary MODIFY COLUMN total_hours DECIMAL(10,4) NOT NULL DEFAULT 0`,
    `ALTER TABLE time_entries_summary MODIFY COLUMN regular_hours DECIMAL(10,4) DEFAULT 0`,
    `ALTER TABLE time_entries_summary MODIFY COLUMN overtime_hours DECIMAL(10,4) DEFAULT 0`,

    `ALTER TABLE task_breakdown ADD COLUMN minutes INT NULL DEFAULT NULL`,
    `UPDATE task_breakdown SET minutes = ROUND(hours * 60) WHERE minutes IS NULL`,
    `ALTER TABLE task_breakdown MODIFY COLUMN hours DECIMAL(10,4) NOT NULL`,

    `ALTER TABLE payslips ADD COLUMN total_minutes INT NULL DEFAULT NULL`,
    `UPDATE payslips SET total_minutes = ROUND(total_hours * 60) WHERE total_minutes IS NULL`,
    `ALTER TABLE payslips MODIFY COLUMN total_hours DECIMAL(10,4) NOT NULL`,

    `ALTER TABLE timesheet_verifications ADD COLUMN verified_minutes INT NULL DEFAULT NULL`,
    `UPDATE timesheet_verifications SET verified_minutes = ROUND(verified_hours * 60) WHERE verified_minutes IS NULL AND verified_hours IS NOT NULL`,
  ];
  for (const sql of migrations) {
    try {
      await db.query(sql);
    } catch (e) {
      if (!e.message.includes('Duplicate column') && !e.message.includes('already exists')) {
        console.warn('⚠️  Migration warning:', e.message);
      }
    }
  }
  console.log('✅ Database migrations applied');
}

async function startServer() {
  try {
    // Test database connection
    console.log('🔗 Connecting to database...');
    const dbConnected = await db.testConnection();

    if (!dbConnected) {
      console.error('❌ Failed to connect to database. Exiting...');
      process.exit(1);
    }

    // Run schema migrations
    console.log('🔄 Running migrations...');
    await runMigrations();

    // Resume any jobs that were queued/processing before the last restart
    const jobWorker = require('./services/job-worker.service');
    await jobWorker.drainQueued();

    // Start HTTP server
    app.listen(PORT, () => {
      console.log('\n========================================');
      console.log('🚀 Timesheet & Payslip Management System');
      console.log('========================================');
      console.log(`📡 Server running on port ${PORT}`);
      console.log(`🌐 API: http://localhost:${PORT}/api`);
      console.log(`📊 Dashboard: http://localhost:${PORT}/api/dashboard`);
      console.log(`🔗 Health: http://localhost:${PORT}/health`);
      console.log('========================================\n');
    });

  } catch (error) {
    console.error('❌ Server startup failed:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n🛑 SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n🛑 SIGINT received. Shutting down gracefully...');
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start the server
startServer();

module.exports = app;
