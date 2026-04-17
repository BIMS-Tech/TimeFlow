const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mysql = require('mysql2/promise');

async function runMigrations() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'timesheet_db'
    });

    console.log('🔗 Connected to database...');

    const migrations = [
      {
        name: 'add_currency_to_employees',
        check: `SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'employees' AND COLUMN_NAME = 'currency'`,
        sql: `ALTER TABLE employees ADD COLUMN currency VARCHAR(10) NOT NULL DEFAULT 'USD' AFTER hourly_rate`
      },
      {
        name: 'add_rejection_files_to_time_entries_summary',
        check: `SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'time_entries_summary' AND COLUMN_NAME = 'rejection_files'`,
        sql: `ALTER TABLE time_entries_summary ADD COLUMN rejection_files TEXT NULL AFTER rejection_reason`
      },
      {
        name: 'drop_drive_fields_from_time_entries_summary',
        check: `SELECT IF(COUNT(*) > 0, 0, 1) AS cnt FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'time_entries_summary' AND COLUMN_NAME = 'drive_file_id'`,
        sql: `ALTER TABLE time_entries_summary
              DROP COLUMN drive_file_id,
              DROP COLUMN drive_file_url,
              DROP COLUMN approval_task_id`
      },
      {
        name: 'drop_drive_fields_from_payslips',
        check: `SELECT IF(COUNT(*) > 0, 0, 1) AS cnt FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payslips' AND COLUMN_NAME = 'drive_file_id'`,
        sql: `ALTER TABLE payslips
              DROP COLUMN drive_file_id,
              DROP COLUMN drive_file_url,
              DROP COLUMN uploaded_at,
              DROP COLUMN sent_at`
      },
      {
        name: 'drop_wrike_webhook_logs_table',
        check: `SELECT IF(COUNT(*) > 0, 0, 1) AS cnt FROM INFORMATION_SCHEMA.TABLES
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'wrike_webhook_logs'`,
        sql: `DROP TABLE wrike_webhook_logs`
      },
      {
        name: 'add_dft_fields_country_purpose_to_employees',
        check: `SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'employees' AND COLUMN_NAME = 'country_of_destination'`,
        sql: `ALTER TABLE employees
              ADD COLUMN country_of_destination VARCHAR(100) DEFAULT NULL AFTER bank_address,
              ADD COLUMN purpose_nature VARCHAR(255) DEFAULT NULL AFTER country_of_destination,
              ADD COLUMN intermediary_bank_name VARCHAR(255) DEFAULT NULL AFTER purpose_nature,
              ADD COLUMN intermediary_bank_address VARCHAR(255) DEFAULT NULL AFTER intermediary_bank_name,
              ADD COLUMN intermediary_bank_swift VARCHAR(50) DEFAULT NULL AFTER intermediary_bank_address,
              ADD COLUMN payee_tin VARCHAR(50) DEFAULT NULL AFTER intermediary_bank_swift,
              ADD COLUMN payee_zip_code VARCHAR(20) DEFAULT NULL AFTER payee_tin,
              ADD COLUMN payee_foreign_address VARCHAR(255) DEFAULT NULL AFTER payee_zip_code,
              ADD COLUMN payee_foreign_zip_code VARCHAR(20) DEFAULT NULL AFTER payee_foreign_address,
              ADD COLUMN tax_code VARCHAR(50) DEFAULT NULL AFTER payee_foreign_zip_code`
      }
    ];

    for (const migration of migrations) {
      const [rows] = await connection.query(migration.check);
      if (rows[0].cnt === 0) {
        await connection.query(migration.sql);
        console.log(`✅ Migration applied: ${migration.name}`);
      } else {
        console.log(`⏭️  Already applied: ${migration.name}`);
      }
    }

    console.log('\n🎉 All migrations complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

runMigrations();
