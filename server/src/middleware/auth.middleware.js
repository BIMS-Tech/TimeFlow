const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { resolvePermissions, redactAmounts, MONEY_KEYS } = require('../utils/permissions');

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
    req.permissions = resolvePermissions(user);
    next();
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }
    next();
  };
}

/**
 * Page gate. Passes when the user has at least one of the given pages enabled,
 * whether from their role defaults or a super admin's per-user override.
 */
function requirePage(...pageKeys) {
  return (req, res, next) => {
    const allowed = req.permissions?.pages || [];
    if (pageKeys.some(k => allowed.includes(k))) return next();
    return res.status(403).json({ success: false, error: 'This page is not enabled for your account' });
  };
}

/**
 * Blocks endpoints that exist only to hand over money — payslip PDFs, payroll
 * summaries, bank files — for a user whose amounts are hidden. Redacting the
 * fields is not enough when the whole document is the amount.
 */
function denyIfAmountsHidden(req, res, next) {
  if (req.permissions?.flags?.hide_amounts) {
    return res.status(403).json({ success: false, error: 'Amounts are hidden for your account' });
  }
  next();
}

/**
 * Drops money-bearing keys from a request body for users whose amounts are
 * hidden. Without this, their client reads back a redacted (null) rate and
 * submits it again on save, silently wiping the real value.
 */
function stripMoneyFromBody(req, res, next) {
  if (req.permissions?.flags?.hide_amounts && req.body && typeof req.body === 'object') {
    for (const key of Object.keys(req.body)) {
      if (MONEY_KEYS.has(key)) delete req.body[key];
    }
  }
  next();
}

/**
 * Strips every money-bearing key from JSON responses for users whose amounts
 * are hidden, so the restriction holds even against a direct API call.
 */
function redactAmountsMiddleware(req, res, next) {
  if (!req.permissions?.flags?.hide_amounts) return next();
  const sendJson = res.json.bind(res);
  res.json = (body) => sendJson(redactAmounts(body));
  next();
}

module.exports = authMiddleware;
module.exports.requireRole = requireRole;
module.exports.requirePage = requirePage;
module.exports.denyIfAmountsHidden = denyIfAmountsHidden;
module.exports.stripMoneyFromBody = stripMoneyFromBody;
module.exports.redactAmountsMiddleware = redactAmountsMiddleware;
