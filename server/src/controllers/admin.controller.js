const db = require('../database/connection');
const User = require('../models/User');

const ALLOWED_ROLES = ['super_admin', 'admin', 'hr', 'accountant', 'viewer'];

class AdminController {
  async listUsers(req, res) {
    try {
      const users = await User.findAll();
      res.json({ success: true, data: users });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async createUser(req, res) {
    try {
      const { username, email, password, role } = req.body;
      if (!username || !email || !password || !role) {
        return res.status(400).json({ success: false, error: 'username, email, password, and role are required' });
      }
      if (!ALLOWED_ROLES.includes(role)) {
        return res.status(400).json({ success: false, error: 'Invalid role' });
      }
      if (password.length < 6) {
        return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
      }

      const existingEmail = await User.findByEmailAny(email);
      if (existingEmail) return res.status(409).json({ success: false, error: 'Email already in use' });

      const existingUsername = await db.getOne('SELECT id FROM users WHERE username = ?', [username]);
      if (existingUsername) return res.status(409).json({ success: false, error: 'Username already taken' });

      const user = await User.create({ username, email, password, role });
      res.status(201).json({ success: true, data: user });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async updateUser(req, res) {
    try {
      const { id } = req.params;
      const { username, email, role } = req.body;

      if (String(req.user.id) === String(id) && role && role !== req.user.role) {
        return res.status(400).json({ success: false, error: 'You cannot change your own role' });
      }
      if (role && !ALLOWED_ROLES.includes(role)) {
        return res.status(400).json({ success: false, error: 'Invalid role' });
      }

      const user = await User.updateProfile(id, { username, email, role });
      res.json({ success: true, data: user });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async resetPassword(req, res) {
    try {
      const { id } = req.params;
      const { password } = req.body;
      if (!password || password.length < 6) {
        return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
      }
      await User.updatePassword(id, password);
      res.json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async deactivateUser(req, res) {
    try {
      const { id } = req.params;
      if (String(req.user.id) === String(id)) {
        return res.status(400).json({ success: false, error: 'You cannot deactivate your own account' });
      }
      const target = await User.findById(id);
      if (!target) return res.status(404).json({ success: false, error: 'User not found' });

      if (target.role === 'super_admin') {
        const activeSuperAdmins = await db.query(
          "SELECT id FROM users WHERE role = 'super_admin' AND is_active = 1"
        );
        if (activeSuperAdmins.length <= 1) {
          return res.status(400).json({ success: false, error: 'Cannot deactivate the last active Super Admin' });
        }
      }

      const user = await User.setActive(id, false);
      res.json({ success: true, data: user });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async activateUser(req, res) {
    try {
      const { id } = req.params;
      const user = await User.setActive(id, true);
      res.json({ success: true, data: user });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = new AdminController();
