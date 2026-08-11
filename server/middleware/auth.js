const jwt = require('jsonwebtoken');
const db = require('../db');
const JWT_SECRET = process.env.JWT_SECRET || 'camduct_knnd_secret_2024';

module.exports = function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: 'No token provided' });

  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Invalid token format' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;

    // Check if active admin authority is delegated to this user
    const authority = db.prepare('SELECT * FROM admin_authority').get();
    if (authority && authority.manager_id == req.user.id) {
      req.user.hasAdminPower = true;
      req.user.role = 'admin'; // Elevate role to admin
    } else {
      req.user.hasAdminPower = false;
    }

    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token expired or invalid' });
  }
};
