const jwt = require('jsonwebtoken');
const User = require('../models/User');

async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    // Also accept ?token= for inline PDF viewing (browser can't set headers for <iframe>/<embed>)
    const queryToken = req.query.token;

    if (!authHeader && !queryToken) {
      return res.status(401).json({ success: false, error: 'No token provided' });
    }

    const token = queryToken || (authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null);
    if (!token) {
      return res.status(401).json({ success: false, error: 'No token provided' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ success: false, error: 'User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}

module.exports = authMiddleware;
