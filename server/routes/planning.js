const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const auth = require('../middleware/auth');
const XLSX = require('xlsx');

// ─── File Storage ─────────────────────────────────────────────────────────
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ts = Date.now();
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${ts}_${safe}`);
  },
});

// Accept any file EXCEPT OTF Excel (block .otf extension)
const fileFilter = (req, file, cb) => {
  if (file.originalname.toLowerCase().endsWith('.otf')) {
    return cb(new Error('OTF files are not accepted'), false);
  }
  cb(null, true);
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 50 * 1024 * 1024 } });

// ─── Helper ───────────────────────────────────────────────────────────────
function notifyAdminAndManagers(projectId, branch, message) {
  // Notify admin
  db.prepare(`INSERT INTO notifications (role, branch, type, message, project_id) VALUES ('admin', NULL, 'planning', ?, ?)`).run(message, projectId);
  // Notify branch manager
  db.prepare(`INSERT INTO notifications (role, branch, type, message, project_id) VALUES ('manager', ?, 'planning', ?, ?)`).run(branch, message, projectId);
}

// ─── Routes ──────────────────────────────────────────────────────────────

// POST /api/planning/submit — Upload drawing & create project
router.post('/submit', auth, upload.single('drawing'), (req, res) => {
  try {
    const { job_no, customer_name, po_quantity } = req.body;
    const branch = req.user.branch || req.body.branch || 'maalur';

    if (!job_no || !customer_name || !po_quantity) {
      return res.status(400).json({ error: 'job_no, customer_name and po_quantity are required' });
    }

    // Check duplicate job_no within branch
    const existing = db.prepare('SELECT id FROM projects WHERE job_no = ? AND LOWER(branch) = LOWER(?)').get(job_no, branch);
    if (existing) return res.status(409).json({ error: 'Job number already exists for this branch' });

    const drawingPath = req.file ? req.file.filename : null;
    const drawingName = req.file ? req.file.originalname : null;

    const result = db.prepare(`
      INSERT INTO projects (job_no, branch, customer_name, po_quantity, po_items, drawing_path, drawing_name, status, submitted_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(job_no, branch.toLowerCase(), customer_name, parseFloat(po_quantity) || 0, req.body.po_items || null, drawingPath, drawingName, 'pending', req.user.id);

    const projectId = result.lastInsertRowid;
    notifyAdminAndManagers(
      projectId, branch,
      `New project submitted: Job #${job_no} by ${req.user.full_name} (${(branch || 'maalur').toUpperCase()})`
    );

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    res.json({ success: true, project });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/planning/projects — List projects (scoped by role/branch)
router.get('/projects', auth, (req, res) => {
  let projects;
  const userBranch = req.user.branch || req.query.branch;

  if (req.user.role === 'admin') {
    projects = db.prepare(`
      SELECT p.*, u.full_name AS submitted_by_name
      FROM projects p LEFT JOIN users u ON p.submitted_by = u.id
      ORDER BY p.created_at DESC
    `).all();
  } else if (req.user.role === 'manager' || req.user.role === 'planning') {
    projects = db.prepare(`
      SELECT p.*, u.full_name AS submitted_by_name
      FROM projects p LEFT JOIN users u ON p.submitted_by = u.id
      WHERE LOWER(p.branch) = LOWER(?)
      ORDER BY p.created_at DESC
    `).all(userBranch || 'maalur');
  } else {
    // Other department users see branch projects
    projects = db.prepare(`
      SELECT p.*, u.full_name AS submitted_by_name
      FROM projects p LEFT JOIN users u ON p.submitted_by = u.id
      WHERE LOWER(p.branch) = LOWER(?)
      ORDER BY p.created_at DESC
    `).all(userBranch || 'maalur');
  }
  res.json(projects);
});

// GET /api/planning/projects/:id — Single project details
router.get('/projects/:id', auth, (req, res) => {
  const project = db.prepare(`
    SELECT p.*, u.full_name AS submitted_by_name, r.full_name AS reviewed_by_name
    FROM projects p
    LEFT JOIN users u ON p.submitted_by = u.id
    LEFT JOIN users r ON p.reviewed_by = r.id
    WHERE p.id = ?
  `).get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  res.json(project);
});

// PATCH /api/planning/projects/:id/review — Approve/Reject/Revise (admin only)
router.patch('/projects/:id/review', auth, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only admin can review projects' });
  }
  const { action, remark } = req.body; // action: 'approved' | 'rejected' | 'revised'
  const validActions = ['approved', 'rejected', 'revised'];
  if (!validActions.includes(action)) {
    return res.status(400).json({ error: 'Invalid action' });
  }

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  db.prepare(`
    UPDATE projects SET status = ?, revise_remark = ?, reviewed_by = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(action, remark || null, req.user.id, req.params.id);

  // Notify the planning department of this branch
  const msg = action === 'approved'
    ? `✅ Job #${project.job_no} has been APPROVED.`
    : action === 'rejected'
      ? `❌ Job #${project.job_no} has been REJECTED.${remark ? ' Remark: ' + remark : ''}`
      : `🔄 Job #${project.job_no} requires REVISION.${remark ? ' Remark: ' + remark : ''}`;

  db.prepare(`INSERT INTO notifications (role, branch, type, message, project_id) VALUES ('planning', ?, 'review', ?, ?)`).run(project.branch, msg, project.id);

  const updated = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  res.json({ success: true, project: updated });
});

// PATCH /api/planning/projects/:id/quantities — Save billing & insulation qty (planning dept)
router.patch('/projects/:id/quantities', auth, (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  if (project.status !== 'approved') {
    return res.status(400).json({ error: 'Project must be approved before setting quantities' });
  }

  const { billing_items, insulation_items } = req.body;

  if (billing_items !== undefined) {
    const bi = JSON.stringify(billing_items);
    const first = (Array.isArray(billing_items) && billing_items[0]) || {};
    db.prepare('UPDATE projects SET billing_items = ?, billing_qty = ?, billing_unit = ?, billing_rate = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run(bi, first.qty || null, first.unit || null, first.rate || null, req.params.id);
  }
  if (insulation_items !== undefined) {
    const ii = JSON.stringify(insulation_items);
    const first = (Array.isArray(insulation_items) && insulation_items[0]) || {};
    db.prepare('UPDATE projects SET insulation_items = ?, insulation_qty = ?, insulation_unit = ?, insulation_rate = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run(ii, first.qty || null, first.unit || null, first.rate || null, req.params.id);
  }

  const updated = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  res.json({ success: true, project: updated });
});

// POST /api/planning/projects/:id/request-edit — Request edit permission from Admin
router.post('/projects/:id/request-edit', auth, (req, res) => {
  const { field } = req.body; // 'billing' or 'insulation' or 'all'
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const msg = `⚠️ Edit Request: Planning requested permission to edit ${field || 'quantity'} for Job #${project.job_no} (${(project.branch || '').toUpperCase()})`;
  db.prepare(`INSERT INTO notifications (role, branch, type, message, project_id) VALUES ('admin', NULL, 'planning', ?, ?)`).run(msg, project.id);

  res.json({ success: true, message: 'Edit request sent to Admin' });
});

// POST /api/planning/projects/:id/unlock-edit — Admin unlocks quantity edit
router.post('/projects/:id/unlock-edit', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const { field } = req.body;
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  if (field === 'billing') {
    db.prepare(`UPDATE projects SET billing_items = NULL, billing_qty = NULL, billing_unit = NULL, billing_rate = NULL, updated_at = datetime('now') WHERE id = ?`).run(project.id);
  } else if (field === 'insulation') {
    db.prepare(`UPDATE projects SET insulation_items = NULL, insulation_qty = NULL, insulation_unit = NULL, insulation_rate = NULL, updated_at = datetime('now') WHERE id = ?`).run(project.id);
  } else {
    db.prepare(`UPDATE projects SET billing_items = NULL, billing_qty = NULL, billing_unit = NULL, billing_rate = NULL, insulation_items = NULL, insulation_qty = NULL, insulation_unit = NULL, insulation_rate = NULL, updated_at = datetime('now') WHERE id = ?`).run(project.id);
  }

  db.prepare(`INSERT INTO notifications (role, branch, type, message, project_id) VALUES ('planning', ?, 'review', ?, ?)`).run(
    project.branch, `🔓 Admin unlocked quantity edit for Job #${project.job_no}`, project.id
  );

  res.json({ success: true, message: 'Quantities unlocked for edit' });
});

// GET /api/planning/download/:id — Download project details
router.get('/download/:id', auth, (req, res) => {
  const project = db.prepare(`
    SELECT p.*, u.full_name AS submitted_by_name, r.full_name AS reviewed_by_name
    FROM projects p
    LEFT JOIN users u ON p.submitted_by = u.id
    LEFT JOIN users r ON p.reviewed_by = r.id
    WHERE p.id = ?
  `).get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  res.json(project);
});

// GET /api/planning/export — Date-range Excel export with clean headings
router.get('/export', auth, (req, res) => {
  if (!['admin', 'manager'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  const { from, to, branch } = req.query;
  let query = `SELECT p.*, u.full_name AS submitted_by_name FROM projects p LEFT JOIN users u ON p.submitted_by = u.id WHERE 1=1`;
  const params = [];
  if (from) { query += ' AND p.created_at >= ?'; params.push(from); }
  if (to) { query += ' AND p.created_at <= ?'; params.push(to + ' 23:59:59'); }
  if (branch) { query += ' AND LOWER(p.branch) = LOWER(?)'; params.push(branch); }
  if (req.user.role === 'manager' && req.user.branch) {
    query += ' AND LOWER(p.branch) = LOWER(?)'; params.push(req.user.branch);
  }
  query += ' ORDER BY p.created_at DESC';

  // Helper to parse JSON items
  function parseItems(raw) {
    if (!raw) return [];
    try { const r = typeof raw === 'string' ? JSON.parse(raw) : raw; return Array.isArray(r) ? r : []; } catch { return []; }
  }

  const headers = [
    'Job No', 'Branch', 'Customer', 'PO Quantity', 'Status', 'Created Date',
    'Billing Product', 'Billing Qty', 'Billing Unit', 'Billing Rate (₹)', 'Billing Total (₹)',
    'Insulation Product', 'Insulation Qty', 'Insulation Unit', 'Insulation Rate (₹)', 'Insulation Total (₹)',
    'Submitted By', 'Revision Remark'
  ];

  const dataRows = [];
  rows.forEach(r => {
    const bi = parseItems(r.billing_items);
    const ii = parseItems(r.insulation_items);
    const maxLen = Math.max(1, bi.length, ii.length);

    for (let i = 0; i < maxLen; i++) {
      const b = bi[i] || {};
      const ins = ii[i] || {};
      const bTotal = b.qty && b.rate ? Number((b.qty * b.rate).toFixed(2)) : (b.qty ? b.qty : '—');
      const iTotal = ins.qty && ins.rate ? Number((ins.qty * ins.rate).toFixed(2)) : (ins.qty ? ins.qty : '—');
      dataRows.push([
        i === 0 ? r.job_no : '',
        i === 0 ? (r.branch || '').toUpperCase() : '',
        i === 0 ? r.customer_name : '',
        i === 0 ? r.po_quantity : '',
        i === 0 ? (r.status || '').toUpperCase() : '',
        i === 0 ? (r.created_at ? r.created_at.split('T')[0] : '—') : '',
        b.product || '—',
        b.qty ?? '—',
        b.unit || '—',
        b.rate ?? '—',
        bTotal,
        ins.product || '—',
        ins.qty ?? '—',
        ins.unit || '—',
        ins.rate ?? '—',
        iTotal,
        i === 0 ? (r.submitted_by_name || '—') : '',
        i === 0 ? (r.revise_remark || '—') : ''
      ]);
    }
  });

  const wsData = [headers, ...dataRows];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  ws['!cols'] = [
    { wch: 14 }, // Job No
    { wch: 12 }, // Branch
    { wch: 22 }, // Customer
    { wch: 13 }, // PO Qty
    { wch: 13 }, // Status
    { wch: 14 }, // Created Date
    { wch: 24 }, // Billing Product
    { wch: 12 }, // Billing Qty
    { wch: 12 }, // Billing Unit
    { wch: 14 }, // Billing Rate
    { wch: 16 }, // Billing Total
    { wch: 24 }, // Insulation Product
    { wch: 14 }, // Insulation Qty
    { wch: 14 }, // Insulation Unit
    { wch: 16 }, // Insulation Rate
    { wch: 18 }, // Insulation Total
    { wch: 20 }, // Submitted By
    { wch: 24 }  // Revision Remark
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Planning Summary');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Disposition', `attachment; filename=planning_export_${Date.now()}.xlsx`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);
});

// GET /api/planning/drawing/:filename — Serve uploaded drawing file
router.get('/drawing/:filename', auth, (req, res) => {
  const filePath = path.join(uploadsDir, req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
  res.sendFile(filePath);
});

module.exports = router;
