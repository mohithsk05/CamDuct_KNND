const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'camduct_knnd_secret_2024';
const GATE_PASSWORD = 'camduct@2024';
const GATE_USERNAME = 'camduct';

// POST /api/auth/gate — Common gate login
router.post('/gate', (req, res) => {
  const { username, password } = req.body;
  if (
    username?.toLowerCase() === GATE_USERNAME &&
    password === GATE_PASSWORD
  ) {
    const token = jwt.sign({ type: 'gate' }, JWT_SECRET, { expiresIn: '12h' });
    return res.json({ success: true, token });
  }
  return res.status(401).json({ error: 'Invalid gate credentials' });
});

// POST /api/auth/login — Role-based login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const user = db
    .prepare('SELECT * FROM users WHERE username = ? AND role != ?')
    .get(username.trim(), 'gate');

  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  // Check if active admin authority is delegated to this user
  const authority = db.prepare('SELECT * FROM admin_authority').get();
  let userRole = user.role;
  let hasAdminPower = false;
  if (authority && authority.manager_id == user.id) {
    hasAdminPower = true;
    userRole = 'admin';
  }

  // Fetch granted power departments for department users
  let powerGrants = [];
  if (!['admin', 'manager'].includes(user.role)) {
    powerGrants = db
      .prepare(
        'SELECT granted_dept FROM power_grants WHERE granted_to_role = ? AND LOWER(granted_branch) = LOWER(?)'
      )
      .all(user.role, user.branch)
      .map((r) => r.granted_dept);
  }

  const payload = {
    id: user.id,
    username: user.username,
    role: userRole,
    branch: user.branch,
    full_name: user.full_name,
    hasAdminPower,
    powerGrants,
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' });
  res.json({ success: true, token, user: payload });
});

// GET /api/auth/me — Verify token and return user info
router.get('/me', require('../middleware/auth'), (req, res) => {
  const user = db.prepare('SELECT id, username, role, branch, full_name, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const authority = db.prepare('SELECT * FROM admin_authority').get();
  let userRole = user.role;
  let hasAdminPower = false;
  if (authority && authority.manager_id == user.id) {
    hasAdminPower = true;
    userRole = 'admin';
  }

  let powerGrants = [];
  if (!['admin', 'manager'].includes(user.role)) {
    powerGrants = db
      .prepare('SELECT granted_dept FROM power_grants WHERE granted_to_role = ? AND LOWER(granted_branch) = LOWER(?)')
      .all(user.role, user.branch)
      .map((r) => r.granted_dept);
  }
  res.json({ ...user, role: userRole, hasAdminPower, powerGrants });
});

module.exports = router;
