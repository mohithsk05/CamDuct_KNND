const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const bcrypt = require('bcryptjs');

// GET /api/users -- List users (admin all; elevated manager own branch; manager with grant own branch)
router.get('/', auth, (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const isManager = req.user.role === 'manager';
  const isElevatedManager = isAdmin && req.user.hasAdminPower;

  if (!isAdmin && !isManager) return res.status(403).json({ error: 'Not authorized' });

  // Elevated manager: return only their branch users
  if (isElevatedManager && req.user.branch) {
    const users = db.prepare("SELECT id, username, role, branch, full_name, created_at FROM users WHERE role != 'gate' AND branch = ? ORDER BY role").all(req.user.branch);
    return res.json({ maalur: [], haryana: [], admins: [], [req.user.branch]: users });
  }

  // Regular Manager: check users-view power grant for their branch
  if (isManager) {
    const grant = db.prepare('SELECT * FROM power_grants WHERE granted_to_role = ? AND granted_branch = ? AND granted_dept = ?').get('manager', req.user.branch, 'users');
    if (!grant) return res.status(403).json({ error: 'Users view not permitted for this branch manager. Contact Admin.' });
    const users = db.prepare("SELECT id, username, role, branch, full_name, created_at FROM users WHERE role != 'gate' AND branch = ? ORDER BY role").all(req.user.branch);
    return res.json({ [req.user.branch]: users });
  }

  // True Admin: return all users
  const users = db.prepare("SELECT id, username, role, branch, full_name, created_at FROM users WHERE role != 'gate' ORDER BY branch, role").all();
  const maalur = users.filter(u => u.branch === 'maalur');
  const haryana = users.filter(u => u.branch === 'haryana');
  const admins = users.filter(u => !u.branch);
  res.json({ maalur, haryana, admins });
});

// POST /api/users — Create new user (admin only)
router.post('/', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const { username, password, role, branch, full_name } = req.body;
  if (!username || !password || !role || !full_name) {
    return res.status(400).json({ error: 'username, password, role, full_name are required' });
  }
  try {
    const hashed = bcrypt.hashSync(password, 10);
    const result = db.prepare(`INSERT INTO users (username, password, role, branch, full_name) VALUES (?,?,?,?,?)`).run(username, hashed, role, branch || null, full_name);
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Username already exists' });
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/users/:id — Delete user (admin only)
router.delete('/:id', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// PATCH /api/users/:id/password — Change password (admin only)
router.patch('/:id/password', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Password required' });
  const hashed = bcrypt.hashSync(password, 10);
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashed, req.params.id);
  res.json({ success: true });
});

// ─── Power Grants ─────────────────────────────────────────────────────────

// GET /api/users/power-grants — List all power grants (authenticated users)
router.get('/power-grants', auth, (req, res) => {
  const grants = db.prepare(`
    SELECT pg.*, u.full_name AS granted_by_name
    FROM power_grants pg LEFT JOIN users u ON pg.granted_by = u.id
    ORDER BY pg.granted_branch, pg.granted_to_role
  `).all();
  res.json(grants);
});

// POST /api/users/power-grants — Grant department access (admin only)
router.post('/power-grants', auth, (req, res) => {
  if (req.user.role !== 'admin' && !req.user.hasAdminPower) return res.status(403).json({ error: 'Admin only' });
  const { granted_to_role, granted_branch, granted_dept } = req.body;
  if (!granted_to_role || !granted_branch || !granted_dept) {
    return res.status(400).json({ error: 'granted_to_role, granted_branch, granted_dept required' });
  }
  try {
    db.prepare(`
      INSERT OR IGNORE INTO power_grants (granted_to_role, granted_branch, granted_dept, granted_by)
      VALUES (?, ?, ?, ?)
    `).run(granted_to_role, granted_branch, granted_dept, req.user.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/users/power-grants/:id — Revoke power grant (admin only)
router.delete('/power-grants/:id', auth, (req, res) => {
  if (req.user.role !== 'admin' && !req.user.hasAdminPower) return res.status(403).json({ error: 'Admin only' });
  db.prepare('DELETE FROM power_grants WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// GET /api/users/recipients — List active users for notification recipient dropdown (authenticated users)
router.get('/recipients', auth, (req, res) => {
  const users = db.prepare(`
    SELECT id, username, role, branch, full_name
    FROM users WHERE role != 'gate'
    ORDER BY branch, full_name
  `).all();
  res.json(users);
});

// POST /api/users/send-notification — Send a custom notification to multiple recipients
router.post('/send-notification', auth, (req, res) => {
  let { recipient, recipients, message, validity, branch } = req.body;

  // Normalize recipients array
  if (!recipients) {
    if (recipient) recipients = [recipient];
    else return res.status(400).json({ error: 'At least one recipient is required' });
  }
  if (!Array.isArray(recipients)) recipients = [recipients];

  if (!message || !validity) {
    return res.status(400).json({ error: 'Message and validity duration are required' });
  }

  const validOptions = ['1day', '3day', '5day', '1week', '1month', '1year'];
  if (!validOptions.includes(validity)) {
    return res.status(400).json({ error: 'Invalid validity option' });
  }

  const mult = {
    '1day': 24 * 60 * 60 * 1000,
    '3day': 3 * 24 * 60 * 60 * 1000,
    '5day': 5 * 24 * 60 * 60 * 1000,
    '1week': 7 * 24 * 60 * 60 * 1000,
    '1month': 30 * 24 * 60 * 60 * 1000,
    '1year': 365 * 24 * 60 * 60 * 1000,
  };
  const durationMs = mult[validity] || mult['1day'];
  const expires_at = new Date(Date.now() + durationMs).toISOString();

  const targetBranch = branch ? branch.toLowerCase() : (req.user.branch ? req.user.branch.toLowerCase() : null);

  let insertedCount = 0;

  // Check if broadcast to ALL is selected
  if (recipients.includes('all')) {
    db.prepare(`
      INSERT INTO notifications (sender_id, sender_name, target_user_id, target_user_name, role, branch, type, message, validity, expires_at)
      VALUES (?, ?, 'all', NULL, 'all', ?, ?, ?, ?, ?)
    `).run(
      req.user.id,
      req.user.full_name,
      targetBranch,
      'custom',
      message,
      validity,
      expires_at
    );
    insertedCount++;
  } else {
    // Process each selected individual user ID
    for (const rId of recipients) {
      const uId = parseInt(rId);
      if (isNaN(uId)) continue;
      const targetUser = db.prepare('SELECT id, full_name, role, branch FROM users WHERE id = ?').get(uId);
      if (!targetUser) continue;

      db.prepare(`
        INSERT INTO notifications (sender_id, sender_name, target_user_id, target_user_name, role, branch, type, message, validity, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        req.user.id,
        req.user.full_name,
        targetUser.id,
        targetUser.full_name,
        targetUser.role,
        targetUser.branch,
        'custom',
        message,
        validity,
        expires_at
      );
      insertedCount++;
    }
  }

  res.json({ success: true, count: insertedCount });
});

// GET /api/users/notifications — Get notifications for current user (received or sent)
router.get('/notifications', auth, (req, res) => {
  const tab = req.query.tab || 'received';
  if (tab === 'sent') {
    const sentNotifs = db.prepare('SELECT * FROM notifications WHERE sender_id = ?').all(req.user.id);
    return res.json(sentNotifs);
  }
  const notifs = db.prepare(`
    SELECT * FROM notifications
  `).all(req.user.id, req.user.role, req.user.branch);

  // In received tab, exclude notifications sent by current user unless self-targeted
  const receivedNotifs = notifs.filter(n => String(n.sender_id) !== String(req.user.id) || String(n.target_user_id) === String(req.user.id));
  res.json(receivedNotifs);
});

// PATCH /api/users/notifications/:id/read — Mark notification as read
router.patch('/notifications/:id/read', auth, (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// PATCH /api/users/notifications/read-all — Mark all notifications as read
router.patch('/notifications/read-all', auth, (req, res) => {
  const userId = req.user.id;
  const userRole = req.user.role;
  const userBranch = req.user.branch ? req.user.branch.toLowerCase() : null;

  db.data.notifications.forEach(n => {
    let match = false;
    if (n.target_user_id == userId) match = true;
    else if (n.target_user_id === 'all' || n.role === 'all') {
      if (n.branch) {
        if (userRole === 'admin' || (userBranch && userBranch === n.branch.toLowerCase())) match = true;
      } else {
        match = true;
      }
    } else if (userRole === 'admin' && (n.role === 'admin' || (!n.role && !n.target_user_id))) {
      match = true;
    } else if (n.role && n.role === userRole) {
      if (!n.branch || !userBranch || n.branch.toLowerCase() === userBranch) {
        match = true;
      }
    }

    if (match) {
      n.is_read = 1;
    }
  });

  db.saveData();
  res.json({ success: true });
});

// ─── Admin Authority Routes ─────────────────────────────────────────────────

// GET /api/users/authority — Get current admin authority delegation status
router.get('/authority', auth, (req, res) => {
  const authority = db.prepare('SELECT * FROM admin_authority').get();
  res.json({ authority: authority || null });
});

// POST /api/users/authority/grant — Admin grants full power to a branch manager
router.post('/authority/grant', auth, (req, res) => {
  if (req.user.role !== 'admin' && !req.user.hasAdminPower) return res.status(403).json({ error: 'Admin only' });
  const { manager_id, branch } = req.body;

  let manager;
  if (manager_id) {
    manager = db.prepare('SELECT * FROM users WHERE id = ?').get(manager_id);
  } else if (branch) {
    manager = db.prepare('SELECT * FROM users WHERE role = ? AND LOWER(branch) = LOWER(?)').get('manager', branch);
  }

  if (!manager || manager.role !== 'manager') {
    return res.status(400).json({ error: 'Invalid manager user for branch' });
  }

  const granted_at = new Date().toISOString();
  db.prepare('REPLACE INTO admin_authority (manager_id, manager_name, manager_role, branch, granted_at) VALUES (?,?,?,?,?)').run(
    manager.id, manager.full_name, manager.role, manager.branch, granted_at
  );

  // Send notification to the manager
  db.prepare(`
    INSERT INTO notifications (sender_id, sender_name, target_user_id, target_user_name, role, branch, type, message, validity, expires_at)
    VALUES (?, ?, ?, ?, 'manager', ?, 'system', ?, '1day', NULL)
  `).run(
    0, 'Admin / Owner', manager.id, manager.full_name, manager.branch,
    `🔑 You have been granted FULL ADMIN AUTHORITY by Admin. All admin powers are now active on your account. Use the Revert button to return authority to Admin.`
  );

  res.json({ success: true, message: `Admin authority granted to ${manager.full_name}` });
});

// POST /api/users/authority/revert — Manager (or Admin) reverts admin power back to Admin
router.post('/authority/revert', auth, (req, res) => {
  const authority = db.prepare('SELECT * FROM admin_authority').get();
  if (!authority) return res.status(400).json({ error: 'No active authority delegation' });

  // Only the holding manager or admin can revert
  const isHolder = req.user.id == authority.manager_id;
  const isAdmin = req.user.role === 'admin';
  if (!isHolder && !isAdmin) return res.status(403).json({ error: 'Not authorized to revert' });

  const managerName = authority.manager_name;
  db.prepare('DELETE FROM admin_authority').run();

  // Notify the admin
  db.prepare(`
    INSERT INTO notifications (sender_id, sender_name, target_user_id, target_user_name, role, branch, type, message, validity, expires_at)
    VALUES (?, ?, NULL, NULL, 'admin', NULL, 'system', ?, '1day', NULL)
  `).run(
    0, 'System',
    `🔄 Admin authority has been reverted by ${managerName}. Full admin power restored to Admin / Owner.`
  );

  res.json({ success: true, message: 'Admin authority reverted to Admin' });
});

module.exports = router;