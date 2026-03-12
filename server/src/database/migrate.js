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
