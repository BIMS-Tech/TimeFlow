const db = require('../database/connection');
const bcrypt = require('bcryptjs');

class User {
  static async findByUsername(username) {
    return db.getOne(
      'SELECT * FROM users WHERE username = ? AND is_active = TRUE',
      [username]
    );
  }

  static async findByEmail(email) {
    return db.getOne(
      'SELECT * FROM users WHERE email = ? AND is_active = TRUE',
      [email]
    );
  }

  static async findByEmailAny(email) {
    return db.getOne(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );
  }

  static async linkToEmployee(id, employeeId) {
    await db.update('users', { employee_id: employeeId }, 'id = ?', [id]);
    return this.findById(id);
  }

  static async findById(id) {
    return db.getOne(
      'SELECT id, username, email, role, employee_id, is_active, last_login, created_at FROM users WHERE id = ?',
      [id]
    );
  }

  static async updateLastLogin(id) {
    await db.update('users', { last_login: new Date() }, 'id = ?', [id]);
  }

  static async verifyPassword(plainPassword, hash) {
    return bcrypt.compare(plainPassword, hash);
  }

  static async create({ username, email, password, role, employee_id }) {
    const hash = await bcrypt.hash(password, 12);
    const id = await db.insert('users', {
      username,
      email,
      password_hash: hash,
      role: role || 'viewer',
      employee_id: employee_id || null,
      is_active: true
    });
    return this.findById(id);
  }

  static async findByEmployeeId(employeeId) {
    return db.getOne(
      'SELECT id, username, email, role, employee_id, is_active FROM users WHERE employee_id = ?',
      [employeeId]
    );
  }

  static async updatePassword(id, newPassword) {
    const hash = await bcrypt.hash(newPassword, 12);
    await db.update('users', { password_hash: hash }, 'id = ?', [id]);
    return this.findById(id);
  }

  static async setActive(id, isActive) {
    await db.update('users', { is_active: isActive }, 'id = ?', [id]);
    return this.findById(id);
  }
}

module.exports = User;
