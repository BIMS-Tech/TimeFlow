const db = require('../database/connection');
const User = require('../models/User');
const {
  PAGES, FLAGS, ROLE_PAGES, ROLE_FLAGS,
  resolvePermissions, sanitizeOverride,
} = require('../utils/permissions');

const ALLOWED_ROLES = ['super_admin', 'hr', 'payroll_officer', 'accounting_manager', 'timekeeper', 'employee'];
// Roles that HR is allowed to create/manage (cannot manage peers or superiors)
const HR_MANAGEABLE_ROLES = ['payroll_officer'];

class AdminController {
  async listUsers(req, res) {
    try {
      const users = await User.findAll();
      // Expose the effective set alongside a flag for whether it was customised,
      // so the Users screen can show "Custom" against overridden accounts.
      const data = users.map(u => {
        const { permissions, ...rest } = u;
        return { ...rest, permissions: resolvePermissions(u) };
      });
      res.json({ success: true, data });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/admin/permissions/catalog
   * The pages and flags a super admin can toggle, plus the per-role defaults,
   * so the UI never hard-codes a second copy of this list.
   */
  async permissionCatalog(req, res) {
    res.json({ success: true, data: { pages: PAGES, flags: FLAGS, rolePages: ROLE_PAGES, roleFlags: ROLE_FLAGS } });
  }

  /**
   * PUT /api/admin/users/:id/permissions
   * Body: { pages: string[], flags: { hide_amounts: boolean } } to override,
   * or { reset: true } to fall back to the user's role defaults.
   */
  async updatePermissions(req, res) {
    try {
      const { id } = req.params;
      const target = await User.findById(id);
      if (!target) return res.status(404).json({ success: false, error: 'User not found' });

      // Super admins always keep full access; resolvePermissions ignores any
      // override for them, so storing one would only be misleading.
      if (target.role === 'super_admin') {
        return res.status(400).json({ success: false, error: 'A super admin always has full access and cannot be restricted' });
      }

      const override = req.body?.reset ? null : sanitizeOverride(req.body);
      const user = await User.updatePermissions(id, override);
      const { permissions, ...rest } = user;
      res.json({ success: true, data: { ...rest, permissions: resolvePermissions(user) } });
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
      if (req.user.role === 'hr' && !HR_MANAGEABLE_ROLES.includes(role)) {
        return res.status(403).json({ success: false, error: 'HR can only create Payroll Officer accounts' });
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
      if (req.user.role === 'hr') {
        const target = await User.findById(id);
        if (target && !HR_MANAGEABLE_ROLES.includes(target.role)) {
          return res.status(403).json({ success: false, error: 'HR can only manage Payroll Officer accounts' });
        }
        if (role && !HR_MANAGEABLE_ROLES.includes(role)) {
          return res.status(403).json({ success: false, error: 'HR can only assign the Payroll Officer role' });
        }
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
      if (req.user.role === 'hr') {
        const target = await User.findById(id);
        if (target && !HR_MANAGEABLE_ROLES.includes(target.role)) {
          return res.status(403).json({ success: false, error: 'HR can only reset passwords for Payroll Officer accounts' });
        }
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
      if (req.user.role === 'hr' && !HR_MANAGEABLE_ROLES.includes(target.role)) {
        return res.status(403).json({ success: false, error: 'HR can only deactivate Payroll Officer accounts' });
      }

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

  async deleteUser(req, res) {
    try {
      const { id } = req.params;
      if (String(req.user.id) === String(id)) {
        return res.status(400).json({ success: false, error: 'You cannot delete your own account' });
      }
      const target = await User.findById(id);
      if (!target) return res.status(404).json({ success: false, error: 'User not found' });
      if (target.role === 'super_admin') {
        const superAdmins = await db.query("SELECT id FROM users WHERE role = 'super_admin'");
        if (superAdmins.length <= 1) {
          return res.status(400).json({ success: false, error: 'Cannot delete the last Super Admin' });
        }
      }
      await db.query('DELETE FROM users WHERE id = ?', [id]);
      res.json({ success: true, message: 'User deleted' });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = new AdminController();
