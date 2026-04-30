'use strict';

function requireAdmin(req, res, next) {
  if (req.session && req.session.adminId) return next();
  return res.status(401).json({ error: 'Unauthorised. Please log in.' });
}

module.exports = { requireAdmin };
