const jwt = require('jsonwebtoken');
const User = require('../models/User');

class AuthController {
  async login(req, res) {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ success: false, error: 'Username and password are required' });
      }

      const user = await User.findByUsername(username) || await User.findByEmail(username);
      if (!user) {
        return res.status(401).json({ success: false, error: 'Invalid credentials' });
      }

      const isValid = await User.verifyPassword(password, user.password_hash);
      if (!isValid) {
        return res.status(401).json({ success: false, error: 'Invalid credentials' });
      }

      await User.updateLastLogin(user.id);

      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        process.env.JWT_SECRET || 'fallback_secret',
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      return res.json({
        success: true,
        data: {
          token,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            employee_id: user.employee_id || null
          }
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async me(req, res) {
    res.json({ success: true, data: req.user });
  }

  async logout(req, res) {
    // JWT is stateless — client removes the token
    res.json({ success: true, message: 'Logged out successfully' });
  }
}

module.exports = new AuthController();
