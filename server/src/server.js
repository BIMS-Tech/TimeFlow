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
      result JSON DEFAULT NULL,
      error TEXT DEFAULT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_pj_status (status),
      INDEX idx_pj_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
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
