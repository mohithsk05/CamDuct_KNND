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

// GET /api/planning/next-job-no — Generate next sequence or reuse existing job number
router.get('/next-job-no', auth, (req, res) => {
  try {
    const branchParam = req.query.branch || req.headers['x-branch'];
    const branch = (branchParam || req.user.branch || 'maalur').toLowerCase();
    const project_name = (req.query.project_name || '').trim();
    const place = (req.query.place || '').trim();

    // If there's an existing project with same name and place in this branch, reuse its job number
    if (project_name && place) {
      const existing = db.prepare('SELECT job_no FROM projects WHERE LOWER(branch) = LOWER(?) AND LOWER(project_name) = LOWER(?) AND LOWER(place) = LOWER(?)').get(branch, project_name, place);
      if (existing && existing.job_no) {
        return res.json({ next_job_no: existing.job_no, is_existing: true });
      }
    }

    // Generate next sequential number for branch (HCD for haryana, CD for maalur)
    const prefix = branch === 'haryana' ? 'HCD' : 'CD';
    const yy = new Date().getFullYear().toString().slice(-2); // e.g. "26" for 2026
    const jobNoPattern = `${prefix}-KNND-${yy}-`;

    // Query projects strictly for this branch
    const projects = db.prepare('SELECT job_no FROM projects WHERE LOWER(branch) = ?').all(branch);
    let maxSeq = 0;
    (projects || []).forEach(p => {
      if (p.job_no && p.job_no.toLowerCase().startsWith(jobNoPattern.toLowerCase())) {
        const parts = p.job_no.split('-');
        const seq = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(seq) && seq > maxSeq) {
          maxSeq = seq;
        }
      }
    });

    const nextSeq = String(maxSeq + 1).padStart(3, '0');
    res.json({ next_job_no: `${jobNoPattern}${nextSeq}`, is_existing: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/planning/submit — Upload drawing & create project
router.post('/submit', auth, upload.single('drawing'), (req, res) => {
  try {
    const { job_no, customer_name, customer_type, project_name, place, zone, location, po_quantity } = req.body;
    const branch = req.user.branch || req.body.branch || 'maalur';

    if (!job_no || !customer_name || !customer_type || !project_name || !place || !zone || !location) {
      return res.status(400).json({ error: 'Job No, Customer Category, Customer Name, Project Name, Place, Zone, and Location are required' });
    }

    const drawingPath = req.file ? req.file.filename : null;
    const drawingName = req.file ? req.file.originalname : null;

    // KNND is auto-approved, Others is pending
    const status = customer_type === 'knnd' ? 'approved' : 'pending';

    const result = db.prepare(`
      INSERT INTO projects (job_no, branch, customer_name, customer_type, project_name, place, zone, location, po_quantity, po_items, drawing_path, drawing_name, status, submitted_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      job_no,
      branch.toLowerCase(),
      customer_name,
      customer_type,
      project_name,
      place,
      zone,
      location,
      parseFloat(po_quantity) || 0,
      req.body.po_items || null,
      drawingPath,
      drawingName,
      status,
      req.user.id
    );

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
  // ?branch= query param lets admin/manager pick which branch to view
  const queryBranch = req.query.branch ? req.query.branch.toLowerCase() : null;
  const userBranch = (queryBranch || req.user.branch || 'maalur').toLowerCase();

  if (req.user.role === 'admin' && req.user.hasAdminPower && req.user.branch) {
    // Elevated manager acting as admin: STRICTLY their own branch only
    const branch = req.user.branch.toLowerCase();
    projects = db.prepare('SELECT p.*, u.full_name AS submitted_by_name FROM projects p LEFT JOIN users u ON p.submitted_by = u.id WHERE LOWER(p.branch) = ? ORDER BY p.created_at DESC').all(branch);
  } else if (req.user.role === 'admin') {
    // True admin: filter strictly by ?branch= query param. If no branch is provided, return empty array (preventing accidental default branch leakage)
    if (queryBranch) {
      projects = db.prepare('SELECT p.*, u.full_name AS submitted_by_name FROM projects p LEFT JOIN users u ON p.submitted_by = u.id WHERE LOWER(p.branch) = ? ORDER BY p.created_at DESC').all(queryBranch);
    } else if (req.query.all === 'true') {
      projects = db.prepare('SELECT p.*, u.full_name AS submitted_by_name FROM projects p LEFT JOIN users u ON p.submitted_by = u.id ORDER BY p.created_at DESC').all();
    } else {
      projects = [];
    }
  } else {
    // Manager, planning, and all other dept roles: always scoped to their own branch
    projects = db.prepare(`
      SELECT p.*, u.full_name AS submitted_by_name
      FROM projects p LEFT JOIN users u ON p.submitted_by = u.id
      WHERE LOWER(p.branch) = ?
      ORDER BY p.created_at DESC
    `).all(userBranch);
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
  db.prepare(`INSERT INTO notifications (role, branch, type, message, project_id) VALUES ('manager', ?, 'planning', ?, ?)`).run(project.branch, msg, project.id);

  const updated = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  res.json({ success: true, project: updated });
});

// PATCH /api/planning/projects/:id/po — Update PO items (planning dept / admin)
router.patch('/projects/:id/po', auth, (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const { po_items } = req.body;
  if (!po_items) return res.status(400).json({ error: 'po_items are required' });

  let items;
  try {
    items = typeof po_items === 'string' ? JSON.parse(po_items) : po_items;
  } catch(e) {
    items = po_items;
  }

  const pi = JSON.stringify(items);
  const totalQty = items.length || 0;

  db.prepare('UPDATE projects SET po_items = ?, po_quantity = ?, updated_at = datetime(\'now\') WHERE id = ?')
    .run(pi, totalQty, req.params.id);

  const updated = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  res.json({ success: true, project: updated });
});

// PATCH /api/planning/projects/:id/quantities — Save billing & insulation qty (planning dept)
router.patch('/projects/:id/quantities', auth, upload.fields([
  { name: 'area_list', maxCount: 1 },
  { name: 'numbering_drawing', maxCount: 1 },
  { name: 'po_file', maxCount: 1 }
]), (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  if (project.status !== 'approved') {
    return res.status(400).json({ error: 'Project must be approved before setting quantities' });
  }

  const billing_items_raw = req.body.billing_items;
  const insulation_items_raw = req.body.insulation_items;
  const conversion_status = req.body.conversion_status;

  // Edit locking validation
  if (billing_items_raw !== undefined && project.billing_items && project.billing_items !== '[]') {
    return res.status(403).json({ error: 'Billing quantities are locked. Click "Request Edit" to modify.' });
  }
  if (insulation_items_raw !== undefined && project.insulation_items && project.insulation_items !== '[]') {
    return res.status(403).json({ error: 'Insulation quantities are locked. Click "Request Edit" to modify.' });
  }

  if (billing_items_raw !== undefined || conversion_status !== undefined) {
    let billing_items = [];
    if (billing_items_raw !== undefined) {
      try {
        billing_items = typeof billing_items_raw === 'string' ? JSON.parse(billing_items_raw) : billing_items_raw;
      } catch(e) {
        billing_items = billing_items_raw;
      }
    } else {
      try {
        billing_items = project.billing_items ? JSON.parse(project.billing_items) : [];
      } catch(e) { billing_items = []; }
    }

    const areaFile = req.files && req.files['area_list'] ? req.files['area_list'][0] : null;
    const numberingFile = req.files && req.files['numbering_drawing'] ? req.files['numbering_drawing'][0] : null;
    const poFile = req.files && req.files['po_file'] ? req.files['po_file'][0] : null;

    if (!project.area_list_path || !project.numbering_drawing_path) {
      if (!areaFile || !numberingFile) {
        return res.status(400).json({ error: 'Area List (.xlsx) and Numbering Drawing (.xlsx) are both mandatory.' });
      }
    }

    const realProject = db.data.projects.find(x => x.id == req.params.id);
    if (realProject) {
      if (areaFile) {
        realProject.area_list_path = `/uploads/${areaFile.filename}`;
        realProject.area_list_name = areaFile.originalname;
      }
      if (numberingFile) {
        realProject.numbering_drawing_path = `/uploads/${numberingFile.filename}`;
        realProject.numbering_drawing_name = numberingFile.originalname;
      }
      if (conversion_status !== undefined) {
        realProject.conversion_status = conversion_status;
      }
      if (poFile) {
        realProject.po_file_path = `/uploads/${poFile.filename}`;
        realProject.po_file_name = poFile.originalname;
      }
    }

    const bi = JSON.stringify(billing_items);
    const first = (Array.isArray(billing_items) && billing_items[0]) || {};
    db.prepare('UPDATE projects SET billing_items = ?, billing_qty = ?, billing_unit = ?, billing_rate = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run(bi, first.qty || null, first.unit || null, first.rate || null, req.params.id);
    db.saveData();
  }

  if (insulation_items_raw !== undefined) {
    let insulation_items;
    try {
      insulation_items = typeof insulation_items_raw === 'string' ? JSON.parse(insulation_items_raw) : insulation_items_raw;
    } catch(e) {
      insulation_items = insulation_items_raw;
    }

    const ii = JSON.stringify(insulation_items);
    const first = (Array.isArray(insulation_items) && insulation_items[0]) || {};
    db.prepare('UPDATE projects SET insulation_items = ?, insulation_qty = ?, insulation_unit = ?, insulation_rate = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run(ii, first.qty || null, first.unit || null, first.rate || null, req.params.id);
  }

  const updated = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  notifyAdminAndManagers(
    req.params.id, updated.branch,
    `Quantities updated: Billing/Insulation details saved for Job #${updated.job_no} (${(updated.branch || '').toUpperCase()})`
  );
  res.json({ success: true, project: updated });
});

// POST /api/planning/projects/:id/request-edit — Request edit permission from Admin
router.post('/projects/:id/request-edit', auth, (req, res) => {
  const { field } = req.body; // 'billing' or 'insulation' or 'all'
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const msg = `⚠️ Edit Request: Planning requested permission to edit ${field || 'quantity'} for Job #${project.job_no} (${(project.branch || '').toUpperCase()})`;
  db.prepare(`INSERT INTO notifications (role, branch, type, message, project_id) VALUES ('admin', NULL, 'planning', ?, ?)`).run(msg, project.id);
  db.prepare(`INSERT INTO notifications (role, branch, type, message, project_id) VALUES ('manager', ?, 'planning', ?, ?)`).run(project.branch, msg, project.id);

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
  db.prepare(`INSERT INTO notifications (role, branch, type, message, project_id) VALUES ('manager', ?, 'planning', ?, ?)`).run(
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
  if (!['admin', 'manager', 'planning'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  const { from, to, branch, customer_type, status } = req.query;
  let query = `SELECT p.*, u.full_name AS submitted_by_name FROM projects p LEFT JOIN users u ON p.submitted_by = u.id WHERE 1=1`;
  const params = [];
  if (from) { query += ' AND p.created_at >= ?'; params.push(from); }
  if (to) { query += ' AND p.created_at <= ?'; params.push(to + ' 23:59:59'); }
  if (branch) { query += ' AND LOWER(p.branch) = LOWER(?)'; params.push(branch); }
  if (req.user.role === 'manager' && req.user.branch) {
    query += ' AND LOWER(p.branch) = LOWER(?)'; params.push(req.user.branch);
  }
  if (customer_type && customer_type !== 'all') {
    query += ' AND LOWER(p.customer_type) = LOWER(?)'; params.push(customer_type);
  }
  if (status && status !== 'all') {
    if (status === 'accepted' || status === 'approved') {
      query += ' AND LOWER(p.status) = "approved"';
    } else if (status === 'rejected') {
      query += ' AND LOWER(p.status) != "approved"';
    }
  }
  query += ' ORDER BY p.created_at DESC';

  const rows = db.prepare(query).all(params);

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

// Handler for project revision resubmissions
const handleProjectRevision = (req, res) => {
  if (req.user.role !== 'planning' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only planning department can resubmit a revision' });
  }

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const { job_no, customer_name, customer_type, project_name, place, zone, location, po_quantity } = req.body;

  if (!job_no || !customer_name || !project_name || !place || !zone || !location) {
    return res.status(400).json({ error: 'All project fields are required' });
  }

  // If a new drawing file was uploaded, use it; otherwise keep existing
  const drawingPath = req.file ? req.file.filename : project.drawing_path;
  const drawingName = req.file ? req.file.originalname : project.drawing_name;

  db.prepare(`
    UPDATE projects SET
      job_no = ?, customer_name = ?, customer_type = ?, project_name = ?,
      place = ?, zone = ?, location = ?, po_quantity = ?, po_items = ?,
      drawing_path = ?, drawing_name = ?,
      status = 'pending', is_revised = 1, revise_remark = NULL,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    job_no, customer_name, customer_type || project.customer_type,
    project_name, place, zone, location,
    parseFloat(po_quantity) || project.po_quantity,
    req.body.po_items || project.po_items,
    drawingPath, drawingName,
    req.params.id
  );

  notifyAdminAndManagers(
    req.params.id, project.branch,
    `🔄 Revised project resubmitted for approval: Job #${job_no} (REVISED) by ${req.user.full_name} (${(project.branch || '').toUpperCase()})`
  );

  const updated = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  res.json({ success: true, project: updated });
};

// Support both PATCH and POST HTTP methods for revision endpoint
router.patch('/projects/:id/revise', auth, upload.single('drawing'), handleProjectRevision);
router.post('/projects/:id/revise', auth, upload.single('drawing'), handleProjectRevision);

// GET /api/planning/drawing/:filename — Serve uploaded drawing file
router.get('/drawing/:filename', auth, (req, res) => {
  const filePath = path.join(uploadsDir, req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
  res.sendFile(filePath);
});

module.exports = router;