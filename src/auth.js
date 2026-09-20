'use strict';

const jwt = require('jsonwebtoken');
const config = require('./config');
const db = require('./db');

function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    config.jwtSecret,
    { expiresIn: '7d' }
  );
}

function verifyToken(token) {
  try {
    return jwt.verify(token, config.jwtSecret);
  } catch {
    return null;
  }
}

function getTokenFromReq(req) {
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) return h.slice(7);
  return null;
}

/** Require a valid JWT; sets req.user (from db so role changes apply). */
function requireAuth(req, res, next) {
  const payload = verifyToken(getTokenFromReq(req));
  if (!payload) return res.status(401).json({ error: 'Authentication required' });
  const user = db.findUserById(payload.sub);
  if (!user) return res.status(401).json({ error: 'Account no longer exists' });
  req.user = user;
  next();
}

/** Require admin role. */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

module.exports = { signToken, verifyToken, requireAuth, requireAdmin, getTokenFromReq };
