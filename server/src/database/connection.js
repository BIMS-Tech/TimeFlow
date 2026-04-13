const path = require('path');
// Load .env relative to this file so it works regardless of where Node is invoked from
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const mysql = require('mysql2/promise');

/**
 * Database connection pool configuration
 * mysql2 v3.x handles caching_sha2_password (MySQL 8.0+) natively — no authPlugins needed
 */
const dbHost = process.env.DB_HOST || 'localhost';
const isSocketPath = dbHost.startsWith('/');

const pool = mysql.createPool({
  // Cloud SQL on Cloud Run uses a Unix socket; local dev uses TCP host+port
  ...(isSocketPath ? { socketPath: dbHost } : { host: dbHost, port: parseInt(process.env.DB_PORT) || 3306 }),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'timesheet_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  timezone: '+00:00',
  charset: 'utf8mb4'
});

/**
 * Test database connection
 */
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Database connection established successfully');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

/**
 * Execute a query with parameters
 * @param {string} sql - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Array>} Query results
 */
async function query(sql, params = []) {
  const [results] = await pool.query(sql, params);
  return results;
}

/**
 * Get a single row
 * @param {string} sql - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Object|null>} Single row or null
 */
async function getOne(sql, params = []) {
  const results = await query(sql, params);
  return results.length > 0 ? results[0] : null;
}

/**
 * Insert a record and return the inserted ID
 * @param {string} table - Table name
 * @param {Object} data - Data to insert
 * @returns {Promise<number>} Inserted ID
 */
async function insert(table, data) {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const placeholders = keys.map(() => '?').join(', ');
  const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
  const result = await query(sql, values);
  return result.insertId;
}

/**
 * Update records
 * @param {string} table - Table name
 * @param {Object} data - Data to update
 * @param {string} where - WHERE clause
 * @param {Array} whereParams - WHERE parameters
 * @returns {Promise<number>} Number of affected rows
 */
async function update(table, data, where, whereParams = []) {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const setClause = keys.map(key => `${key} = ?`).join(', ');
  const sql = `UPDATE ${table} SET ${setClause} WHERE ${where}`;
  const result = await query(sql, [...values, ...whereParams]);
  return result.affectedRows;
}

/**
 * Delete records
 * @param {string} table - Table name
 * @param {string} where - WHERE clause
 * @param {Array} whereParams - WHERE parameters
 * @returns {Promise<number>} Number of affected rows
 */
async function remove(table, where, whereParams = []) {
  const sql = `DELETE FROM ${table} WHERE ${where}`;
  const result = await query(sql, whereParams);
  return result.affectedRows;
}

/**
 * Begin a transaction
 * @returns {Promise<Object>} Connection object for transaction
 */
async function beginTransaction() {
  const connection = await pool.getConnection();
  await connection.beginTransaction();
  return connection;
}

/**
 * Commit a transaction
 * @param {Object} connection - Connection object
 */
async function commitTransaction(connection) {
  await connection.commit();
  connection.release();
}

/**
 * Rollback a transaction
 * @param {Object} connection - Connection object
 */
async function rollbackTransaction(connection) {
  await connection.rollback();
  connection.release();
}

/**
 * Execute queries within a transaction
 * @param {Function} callback - Callback function receiving connection
 * @returns {Promise<any>} Callback result
 */
async function transaction(callback) {
  const connection = await beginTransaction();
  try {
    const result = await callback(connection);
    await commitTransaction(connection);
    return result;
  } catch (error) {
    await rollbackTransaction(connection);
    throw error;
  }
}

module.exports = {
  pool,
  testConnection,
  query,
  getOne,
  insert,
  update,
  remove,
  beginTransaction,
  commitTransaction,
  rollbackTransaction,
  transaction
};
