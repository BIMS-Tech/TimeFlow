const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

/**
 * Initialize the database by parsing and executing schema.sql statement by statement.
 * DELIMITER // is a MySQL CLI-only directive — mysql2 doesn't support it.
 * We parse the file ourselves: DELIMITER // blocks are split by //, everything
 * else is split by ;. Each statement is executed individually.
 */
async function initializeDatabase() {
  let connection;

  try {
    // Connect without specifying a database so we can CREATE it first
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || ''
    });

    console.log('🔗 Connected to MySQL server...');

    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    console.log('📄 Executing database schema...');

    const statements = parseSQL(schema);
    let executed = 0;

    for (const stmt of statements) {
      try {
        await connection.query(stmt);
        executed++;
      } catch (err) {
        // Skip "object already exists" errors so the script is idempotent
        if (
          err.code === 'ER_TABLE_EXISTS_ERROR' ||   // table already exists
          err.code === 'ER_SP_ALREADY_EXISTS' ||     // stored procedure already exists
          err.code === 'ER_TRG_ALREADY_EXISTS' ||    // trigger already exists
          err.errno === 1304 ||                       // procedure already exists
          err.errno === 1359                          // trigger already exists
        ) {
          // silently skip — already created on a previous run
        } else {
          throw err;
        }
      }
    }

    console.log(`✅ Schema applied (${executed} statements executed)`);
    console.log('📊 Database and tables created/updated');

    await createDefaultAdmin(connection);
    await createSamplePayPeriods(connection);

    console.log('\n🎉 Database initialization complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

/**
 * Parse a SQL file into individual executable statements.
 *
 * Strategy:
 *   - Split on DELIMITER // → separates plain SQL from procedure/trigger blocks
 *   - Inside each procedure/trigger block, split on // to get individual statements
 *   - After the closing DELIMITER ; any remaining plain SQL is split on ;
 */
function parseSQL(sql) {
  const statements = [];

  // Split at every "DELIMITER //" line
  const sections = sql.split(/^DELIMITER\s+\/\//im);

  sections.forEach((section, index) => {
    if (index === 0) {
      // First chunk: plain SQL only — split on semicolons
      splitBySemicolon(section, statements);
    } else {
      // Each subsequent chunk looks like:
      //   <procedures/triggers ending with //>
      //   DELIMITER ;
      //   <optional plain SQL>
      const halves = section.split(/^DELIMITER\s+;/im);

      // halves[0] = the procedure/trigger bodies, separated by //
      halves[0].split('//').forEach(block => {
        const trimmed = block.trim();
        if (trimmed) statements.push(trimmed);
      });

      // halves[1] = any plain SQL that follows the closing DELIMITER ;
      if (halves[1]) {
        splitBySemicolon(halves[1], statements);
      }
    }
  });

  return statements;
}

/**
 * Split a plain SQL string on ; and push non-empty statements.
 */
function splitBySemicolon(sql, statements) {
  sql.split(';').forEach(part => {
    // Remove single-line comments, then check if anything real remains
    const meaningful = part.replace(/--[^\n]*/g, '').trim();
    if (meaningful) {
      statements.push(part.trim());
    }
  });
}

/**
 * Create default admin user
 */
async function createDefaultAdmin(connection) {
  const bcrypt = require('bcryptjs');
  const defaultPassword = bcrypt.hashSync('dam@bims', 10);

  try {
    await connection.query(
      `INSERT IGNORE INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)`,
      ['dam', 'dam@bims.tech', defaultPassword, 'admin']
    );
    console.log('👤 Default admin user ready (email: dam@bims.tech)');
  } catch (error) {
    console.log('ℹ️  Admin user already exists');
  }
}

/**
 * Create sample pay periods for the current month
 */
async function createSamplePayPeriods(connection) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const firstHalfStart  = new Date(year, month, 1).toISOString().split('T')[0];
  const firstHalfEnd    = new Date(year, month, 15).toISOString().split('T')[0];
  const secondHalfStart = new Date(year, month, 16).toISOString().split('T')[0];
  const secondHalfEnd   = new Date(year, month + 1, 0);
  const lastDay         = secondHalfEnd.getDate();
  const secondHalfEndStr = secondHalfEnd.toISOString().split('T')[0];

  try {
    await connection.query(
      `INSERT IGNORE INTO pay_periods (period_name, start_date, end_date, status) VALUES
         (?, ?, ?, 'open'),
         (?, ?, ?, 'open')`,
      [
        `Period ${month + 1}/1-${month + 1}/15/${year}`,   firstHalfStart,  firstHalfEnd,
        `Period ${month + 1}/16-${month + 1}/${lastDay}/${year}`, secondHalfStart, secondHalfEndStr
      ]
    );
    console.log('📅 Sample pay periods ready for current month');
  } catch (error) {
    console.log('ℹ️  Pay periods already exist');
  }
}

initializeDatabase();
