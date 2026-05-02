'use strict';
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const db     = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'dahari-change-me';

async function login(req, res) {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required.' });

    const [rows] = await db.query('SELECT * FROM admin_users WHERE username = ?', [username]);
    if (!rows.length) return res.status(401).json({ error: 'Invalid credentials.' });

    const admin = rows[0];
    const valid = await bcrypt.compare(password, admin.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials.' });

    await db.query('UPDATE admin_users SET last_login = NOW() WHERE id = ?', [admin.id]);

    const token = jwt.sign(
      { adminId: admin.id, username: admin.username },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({ success: true, username: admin.username, token });
  } catch (err) {
    console.error('login error:', err);
    res.status(500).json({ error: 'Login failed.' });
  }
}

function logout(req, res) {
  res.json({ success: true });
}

function me(req, res) {
  res.json({ adminId: req.adminId, username: req.adminUsername });
}

async function changePassword(req, res) {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) return res.status(400).json({ error: 'Both passwords required.' });
    if (new_password.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters.' });

    const [rows] = await db.query('SELECT * FROM admin_users WHERE id = ?', [req.adminId]);
    const valid  = await bcrypt.compare(current_password, rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect.' });

    const hash = await bcrypt.hash(new_password, 12);
    await db.query('UPDATE admin_users SET password_hash = ? WHERE id = ?', [hash, req.adminId]);
    res.json({ message: 'Password changed successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to change password.' });
  }
}

module.exports = { login, logout, me, changePassword };
