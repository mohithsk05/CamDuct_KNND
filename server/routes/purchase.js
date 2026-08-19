const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function getMonthNameFromDate(dateStr) {
  if (!dateStr) {
    return MONTH_NAMES[new Date().getMonth()];
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) {
    return MONTH_NAMES[new Date().getMonth()];
  }
  return MONTH_NAMES[d.getMonth()];
}

const EDIT_WINDOW_MS = 48 * 60 * 60 * 1000;

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function isEntryEditable(entry, user) {
  if (!entry || !user) return false;
  if (user.role !== 'purchase') return false;
  if (entry.is_unlocked) return true;

  const createdTime = new Date(entry.created_at || entry.date).getTime();
  if (isNaN(createdTime)) return true;
  const ageMs = Date.now() - createdTime;
  return ageMs <= EDIT_WINDOW_MS;
}

function ensureDbCollections() {
  if (!db.data) db.data = {};
  if (!db.data.purchase_po) db.data.purchase_po = [];
  if (!db.data.purchase_igr) db.data.purchase_igr = [];
  if (!db.data.purchase_bpr) db.data.purchase_bpr = [];
  if (!db.data.rate_enquiries) db.data.rate_enquiries = [];
  if (!db.data.notifications) db.data.notifications = [];
  if (!db.data.autoInc) db.data.autoInc = {};
  if (!db.data.autoInc.purchase_po) db.data.autoInc.purchase_po = 1;
  if (!db.data.autoInc.purchase_igr) db.data.autoInc.purchase_igr = 1;
  if (!db.data.autoInc.purchase_bpr) db.data.autoInc.purchase_bpr = 1;
  if (!db.data.autoInc.rate_enquiries) db.data.autoInc.rate_enquiries = 1;
  if (!db.data.autoInc.notifications) db.data.autoInc.notifications = 1;

  if (!db.data.purchase_materials || !db.data.purchase_materials.raw_materials || db.data.purchase_materials.raw_materials.length < 158 || !db.data.purchase_materials.tools || db.data.purchase_materials.tools.length < 85) {
    try {
      const fs = require('fs');
      const path = require('path');
      const seedPath = path.join(__dirname, '../materials_seed.json');
      if (fs.existsSync(seedPath)) {
        db.data.purchase_materials = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
        db.saveData();
      } else {
        db.data.purchase_materials = { raw_materials: [], consumable_items: [], electric_materials: [], tools: [] };
      }
    } catch (e) {
      console.error('Failed to load materials seed:', e);
      db.data.purchase_materials = { raw_materials: [], consumable_items: [], electric_materials: [], tools: [] };
    }
  }
}

// ─── IGR ROUTES ─────────────────────────────────────────────────────────────

// GET /api/purchase/igr?branch=...&month=...
router.get('/igr', auth, (req, res) => {
  try {
    ensureDbCollections();
    const branchArg = (req.query.branch || (req.user && req.user.branch) || 'maalur').toLowerCase();
    const monthArg = req.query.month;
    let list = db.data.purchase_igr.filter(item => (item.branch || 'maalur').toLowerCase() === branchArg);
    
    if (monthArg && monthArg.toLowerCase() !== 'all') {
      list = list.filter(item => {
        const m = item.month || getMonthNameFromDate(item.date);
        return (m || '').toLowerCase() === monthArg.toLowerCase();
      });
    }

    list.sort((a, b) => new Date(a.date || a.created_at) - new Date(b.date || b.created_at));
    
    const formatted = list.map((item, idx) => ({
      ...item,
      sl_no: idx + 1
    }));
    
    res.json(formatted);
  } catch (err) {
    console.error('Error fetching IGR:', err);
    res.status(500).json({ error: 'Failed to fetch IGR entries: ' + err.message });
  }
});

// POST /api/purchase/igr
router.post('/igr', auth, (req, res) => {
  try {
    ensureDbCollections();

    // Restrict creation strictly to purchase department users
    if (!req.user || req.user.role !== 'purchase') {
      return res.status(403).json({ error: 'Only Purchase Department users can create IGR entries' });
    }

    const {
      date,
      igr_no,
      invoice_no_date,
      supplier_name,
      description,
      material_value,
      transport,
      labour_charges,
      taxable_value,
      taxable_rate,
      igst,
      cgst,
      sgst,
      invoice_value,
      branch
    } = req.body;

    const targetBranch = (branch || req.query.branch || (req.user && req.user.branch) || 'maalur').toLowerCase();
    const entryDate = date || new Date().toISOString().split('T')[0];
    const realTimeMonth = getMonthNameFromDate(entryDate);

    const newEntry = {
      id: db.data.autoInc.purchase_igr++,
      month: realTimeMonth,
      date: entryDate,
      igr_no: igr_no ? String(igr_no).trim() : '',
      invoice_no_date: invoice_no_date ? String(invoice_no_date).trim() : '',
      supplier_name: supplier_name ? String(supplier_name).trim() : '',
      description: description ? String(description).trim() : '',
      material_value: parseFloat(material_value) || 0,
      transport: parseFloat(transport) || 0,
      labour_charges: parseFloat(labour_charges) || 0,
      taxable_value: parseFloat(taxable_value) || 0,
      taxable_rate: parseFloat(taxable_rate) || 0,
      igst: parseFloat(igst) || 0,
      cgst: parseFloat(cgst) || 0,
      sgst: parseFloat(sgst) || 0,
      invoice_value: parseFloat(invoice_value) || 0,
      branch: targetBranch,
      created_at: new Date().toISOString(),
      created_by: req.user ? req.user.id : null,
      is_unlocked: false,
      edit_requested: false
    };

    db.data.purchase_igr.push(newEntry);

    // Department-specific notifications for Admin and Manager
    const now = new Date().toISOString();
    const notifMsg = `🛒 New IGR Entry Added: Purchase Dept (${capitalize(targetBranch)}) added IGR Entry #${newEntry.igr_no || newEntry.id} (Supplier: ${newEntry.supplier_name || 'N/A'}, Value: ₹${newEntry.invoice_value.toLocaleString('en-IN')})`;

    db.data.notifications.push({
      id: db.data.autoInc.notifications++,
      sender_id: req.user ? req.user.id : 0,
      sender_name: req.user ? req.user.full_name : 'Purchase Dept',
      target_user_id: null,
      target_user_name: 'Admin',
      role: 'admin',
      dept: 'purchase',
      branch: targetBranch,
      type: 'purchase',
      entry_type: 'igr',
      entry_id: newEntry.id,
      message: notifMsg,
      validity: '1week',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      is_read: 0,
      created_at: now
    });

    db.data.notifications.push({
      id: db.data.autoInc.notifications++,
      sender_id: req.user ? req.user.id : 0,
      sender_name: req.user ? req.user.full_name : 'Purchase Dept',
      target_user_id: null,
      target_user_name: 'Manager',
      role: 'manager',
      dept: 'purchase',
      branch: targetBranch,
      type: 'purchase',
      entry_type: 'igr',
      entry_id: newEntry.id,
      message: notifMsg,
      validity: '1week',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      is_read: 0,
      created_at: now
    });

    db.saveData();

    res.status(201).json(newEntry);
  } catch (err) {
    console.error('Error creating IGR:', err);
    res.status(500).json({ error: 'Failed to save IGR entry: ' + err.message });
  }
});

// PUT /api/purchase/igr/:id — Edit IGR entry
router.put('/igr/:id', auth, (req, res) => {
  try {
    ensureDbCollections();
    const id = req.params.id;
    const entry = db.data.purchase_igr.find(item => String(item.id) === String(id));
    if (!entry) {
      return res.status(404).json({ error: 'IGR entry not found' });
    }

    if (!isEntryEditable(entry, req.user)) {
      return res.status(403).json({ error: 'Entry is locked (48-hour edit window has expired). Please request edit access from Admin.' });
    }

    const {
      date,
      igr_no,
      invoice_no_date,
      supplier_name,
      description,
      material_value,
      transport,
      labour_charges,
      taxable_value,
      taxable_rate,
      igst,
      cgst,
      sgst,
      invoice_value
    } = req.body;

    if (date) {
      entry.date = date;
      entry.month = getMonthNameFromDate(date);
    }
    if (igr_no !== undefined) entry.igr_no = String(igr_no).trim();
    if (invoice_no_date !== undefined) entry.invoice_no_date = String(invoice_no_date).trim();
    if (supplier_name !== undefined) entry.supplier_name = String(supplier_name).trim();
    if (description !== undefined) entry.description = String(description).trim();
    if (material_value !== undefined) entry.material_value = parseFloat(material_value) || 0;
    if (transport !== undefined) entry.transport = parseFloat(transport) || 0;
    if (labour_charges !== undefined) entry.labour_charges = parseFloat(labour_charges) || 0;
    if (taxable_value !== undefined) entry.taxable_value = parseFloat(taxable_value) || 0;
    if (taxable_rate !== undefined) entry.taxable_rate = parseFloat(taxable_rate) || 0;
    if (igst !== undefined) entry.igst = parseFloat(igst) || 0;
    if (cgst !== undefined) entry.cgst = parseFloat(cgst) || 0;
    if (sgst !== undefined) entry.sgst = parseFloat(sgst) || 0;
    if (invoice_value !== undefined) entry.invoice_value = parseFloat(invoice_value) || 0;

    entry.updated_at = new Date().toISOString();

    // Department-specific update notifications for Admin and Manager
    const now = new Date().toISOString();
    const updateNotifMsg = `🛒 IGR Entry Updated: Purchase Dept (${capitalize(entry.branch || 'maalur')}) updated IGR Entry #${entry.igr_no || entry.id} (Supplier: ${entry.supplier_name || 'N/A'}, Value: ₹${entry.invoice_value.toLocaleString('en-IN')})`;

    db.data.notifications.push({
      id: db.data.autoInc.notifications++,
      sender_id: req.user ? req.user.id : 0,
      sender_name: req.user ? req.user.full_name : 'Purchase Dept',
      target_user_id: null,
      target_user_name: 'Admin',
      role: 'admin',
      dept: 'purchase',
      branch: entry.branch || 'maalur',
      type: 'purchase',
      entry_type: 'igr',
      entry_id: entry.id,
      message: updateNotifMsg,
      validity: '1week',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      is_read: 0,
      created_at: now
    });

    db.data.notifications.push({
      id: db.data.autoInc.notifications++,
      sender_id: req.user ? req.user.id : 0,
      sender_name: req.user ? req.user.full_name : 'Purchase Dept',
      target_user_id: null,
      target_user_name: 'Manager',
      role: 'manager',
      dept: 'purchase',
      branch: entry.branch || 'maalur',
      type: 'purchase',
      entry_type: 'igr',
      entry_id: entry.id,
      message: updateNotifMsg,
      validity: '1week',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      is_read: 0,
      created_at: now
    });

    db.saveData();
    res.json(entry);
  } catch (err) {
    console.error('Error updating IGR:', err);
    res.status(500).json({ error: 'Failed to update IGR entry: ' + err.message });
  }
});

// POST /api/purchase/igr/:id/request-edit — Purchase Dept requests Admin edit access after 48h
router.post('/igr/:id/request-edit', auth, (req, res) => {
  try {
    ensureDbCollections();
    if (!req.user || req.user.role !== 'purchase') {
      return res.status(403).json({ error: 'Only Purchase Department users can request edit access' });
    }

    const id = req.params.id;
    const entry = db.data.purchase_igr.find(item => String(item.id) === String(id));
    if (!entry) {
      return res.status(404).json({ error: 'IGR entry not found' });
    }

    entry.edit_requested = true;
    entry.edit_requested_at = new Date().toISOString();

    const notifId = db.data.autoInc.notifications++;
    const now = new Date().toISOString();
    const notifMsg = `🛒 Edit Access Request: Purchase Dept (${capitalize(entry.branch || 'maalur')}) requested edit access for IGR Entry #${entry.igr_no || entry.id} (Supplier: ${entry.supplier_name || 'N/A'})`;

    db.data.notifications.push({
      id: notifId,
      sender_id: req.user.id,
      sender_name: req.user.full_name,
      target_user_id: null,
      target_user_name: 'Admin',
      role: 'admin',
      dept: 'purchase',
      branch: entry.branch || null,
      type: 'purchase_edit_request',
      entry_type: 'igr',
      entry_id: entry.id,
      message: notifMsg,
      validity: '1week',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      is_read: 0,
      created_at: now
    });

    db.data.notifications.push({
      id: db.data.autoInc.notifications++,
      sender_id: req.user.id,
      sender_name: req.user.full_name,
      target_user_id: null,
      target_user_name: 'Manager',
      role: 'manager',
      dept: 'purchase',
      branch: entry.branch || null,
      type: 'purchase_edit_request',
      entry_type: 'igr',
      entry_id: entry.id,
      message: notifMsg,
      validity: '1week',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      is_read: 0,
      created_at: now
    });

    db.saveData();
    res.json({ success: true, message: 'Edit access request sent to Admin in real time', entry });
  } catch (err) {
    console.error('Error requesting IGR edit access:', err);
    res.status(500).json({ error: 'Failed to request edit access: ' + err.message });
  }
});

// POST /api/purchase/igr/:id/unlock-edit — Admin grants edit access
router.post('/igr/:id/unlock-edit', auth, (req, res) => {
  try {
    ensureDbCollections();
    const isAdmin = req.user && (req.user.role === 'admin' || req.user.hasAdminPower);
    if (!isAdmin) {
      return res.status(403).json({ error: 'Only Admin users can grant edit access' });
    }

    const id = req.params.id;
    const entry = db.data.purchase_igr.find(item => String(item.id) === String(id));
    if (!entry) {
      return res.status(404).json({ error: 'IGR entry not found' });
    }

    entry.is_unlocked = true;
    entry.edit_requested = false;
    entry.unlocked_by = req.user.full_name;
    entry.unlocked_at = new Date().toISOString();

    const notifId = db.data.autoInc.notifications++;
    const now = new Date().toISOString();
    const notifMsg = `🔓 Edit Access Granted: Admin approved edit access for IGR Entry #${entry.igr_no || entry.id} (Supplier: ${entry.supplier_name || 'N/A'}). You can now edit this entry.`;

    db.data.notifications.push({
      id: notifId,
      sender_id: req.user.id,
      sender_name: req.user.full_name,
      target_user_id: null,
      target_user_name: 'Purchase Department',
      role: 'purchase',
      dept: 'purchase',
      branch: entry.branch || null,
      type: 'purchase_edit_unlocked',
      entry_type: 'igr',
      entry_id: entry.id,
      message: notifMsg,
      validity: '3day',
      expires_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      is_read: 0,
      created_at: now
    });

    db.data.notifications.push({
      id: db.data.autoInc.notifications++,
      sender_id: req.user.id,
      sender_name: req.user.full_name,
      target_user_id: null,
      target_user_name: 'Manager',
      role: 'manager',
      dept: 'purchase',
      branch: entry.branch || null,
      type: 'purchase_edit_unlocked',
      entry_type: 'igr',
      entry_id: entry.id,
      message: notifMsg,
      validity: '3day',
      expires_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      is_read: 0,
      created_at: now
    });

    db.saveData();
    res.json({ success: true, message: 'Edit access granted successfully', entry });
  } catch (err) {
    console.error('Error unlocking IGR edit access:', err);
    res.status(500).json({ error: 'Failed to unlock edit access: ' + err.message });
  }
});

// POST /api/purchase/igr/:id/lock-edit — Admin locks entry edit access
router.post('/igr/:id/lock-edit', auth, (req, res) => {
  try {
    ensureDbCollections();
    const isAdmin = req.user && (req.user.role === 'admin' || req.user.hasAdminPower);
    if (!isAdmin) {
      return res.status(403).json({ error: 'Only Admin users can lock edit access' });
    }

    const id = req.params.id;
    const entry = db.data.purchase_igr.find(item => String(item.id) === String(id));
    if (!entry) {
      return res.status(404).json({ error: 'IGR entry not found' });
    }

    entry.is_unlocked = false;
    entry.edit_requested = false;

    const notifMsg = `🔒 Edit Access Locked: Admin locked edit access for IGR Entry #${entry.igr_no || entry.id} (Supplier: ${entry.supplier_name || 'N/A'}).`;
    const now = new Date().toISOString();

    db.data.notifications.push({
      id: db.data.autoInc.notifications++,
      sender_id: req.user.id,
      sender_name: req.user.full_name,
      target_user_id: null,
      target_user_name: 'Purchase Department',
      role: 'purchase',
      dept: 'purchase',
      branch: entry.branch || null,
      type: 'purchase_edit_locked',
      entry_type: 'igr',
      entry_id: entry.id,
      message: notifMsg,
      validity: '3day',
      expires_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      is_read: 0,
      created_at: now
    });

    db.data.notifications.push({
      id: db.data.autoInc.notifications++,
      sender_id: req.user.id,
      sender_name: req.user.full_name,
      target_user_id: null,
      target_user_name: 'Manager',
      role: 'manager',
      dept: 'purchase',
      branch: entry.branch || null,
      type: 'purchase_edit_locked',
      entry_type: 'igr',
      entry_id: entry.id,
      message: notifMsg,
      validity: '3day',
      expires_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      is_read: 0,
      created_at: now
    });

    db.saveData();

    res.json({ success: true, message: 'Entry locked successfully', entry });
  } catch (err) {
    console.error('Error locking IGR entry:', err);
    res.status(500).json({ error: 'Failed to lock entry: ' + err.message });
  }
});

// DELETE /api/purchase/igr/:id
router.delete('/igr/:id', auth, (req, res) => {
  try {
    ensureDbCollections();
    if (!req.user || req.user.role !== 'purchase' && req.user.role !== 'admin' && !req.user.hasAdminPower) {
      return res.status(403).json({ error: 'Only Purchase Department users or Admin can delete IGR entries' });
    }

    const id = req.params.id;
    const idx = db.data.purchase_igr.findIndex(item => String(item.id) === String(id));
    if (idx === -1) {
      return res.status(404).json({ error: 'IGR entry not found' });
    }

    const deletedEntry = db.data.purchase_igr[idx];
    db.data.purchase_igr.splice(idx, 1);

    const notifMsg = `🗑️ IGR Entry Deleted: Purchase Dept (${capitalize(deletedEntry.branch || 'maalur')}) deleted IGR Entry #${deletedEntry.igr_no || deletedEntry.id} (Supplier: ${deletedEntry.supplier_name || 'N/A'})`;
    const now = new Date().toISOString();

    db.data.notifications.push({
      id: db.data.autoInc.notifications++,
      sender_id: req.user ? req.user.id : 0,
      sender_name: req.user ? req.user.full_name : 'Purchase Dept',
      target_user_id: null,
      target_user_name: 'Admin',
      role: 'admin',
      dept: 'purchase',
      branch: deletedEntry.branch || 'maalur',
      type: 'purchase',
      entry_type: 'igr',
      entry_id: deletedEntry.id,
      message: notifMsg,
      validity: '1week',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      is_read: 0,
      created_at: now
    });

    db.data.notifications.push({
      id: db.data.autoInc.notifications++,
      sender_id: req.user ? req.user.id : 0,
      sender_name: req.user ? req.user.full_name : 'Purchase Dept',
      target_user_id: null,
      target_user_name: 'Manager',
      role: 'manager',
      dept: 'purchase',
      branch: deletedEntry.branch || 'maalur',
      type: 'purchase',
      entry_type: 'igr',
      entry_id: deletedEntry.id,
      message: notifMsg,
      validity: '1week',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      is_read: 0,
      created_at: now
    });

    db.saveData();

    res.json({ success: true, message: 'IGR entry deleted' });
  } catch (err) {
    console.error('Error deleting IGR:', err);
    res.status(500).json({ error: 'Failed to delete IGR entry: ' + err.message });
  }
});

// ─── BPR ROUTES ─────────────────────────────────────────────────────────────

// GET /api/purchase/bpr?branch=...&month=...
router.get('/bpr', auth, (req, res) => {
  try {
    ensureDbCollections();
    const branchArg = (req.query.branch || (req.user && req.user.branch) || 'maalur').toLowerCase();
    const monthArg = req.query.month;
    let list = db.data.purchase_bpr.filter(item => (item.branch || 'maalur').toLowerCase() === branchArg);
    
    if (monthArg && monthArg.toLowerCase() !== 'all') {
      list = list.filter(item => {
        const m = item.month || getMonthNameFromDate(item.date);
        return (m || '').toLowerCase() === monthArg.toLowerCase();
      });
    }

    list.sort((a, b) => new Date(a.date || a.created_at) - new Date(b.date || b.created_at));
    
    const formatted = list.map((item, idx) => ({
      ...item,
      sl_no: idx + 1
    }));
    
    res.json(formatted);
  } catch (err) {
    console.error('Error fetching BPR:', err);
    res.status(500).json({ error: 'Failed to fetch BPR entries: ' + err.message });
  }
});

// POST /api/purchase/bpr
router.post('/bpr', auth, (req, res) => {
  try {
    ensureDbCollections();

    // Restrict creation strictly to purchase department users
    if (!req.user || req.user.role !== 'purchase') {
      return res.status(403).json({ error: 'Only Purchase Department users can create BPR entries' });
    }

    const {
      date,
      bpr_no,
      contractor_name,
      job_work,
      supplier,
      invoice_no_date,
      particulars,
      description,
      taxable_value,
      taxable_rate,
      igst,
      cgst,
      sgst,
      invoice_value,
      remarks,
      branch
    } = req.body;

    const targetBranch = (branch || req.query.branch || (req.user && req.user.branch) || 'maalur').toLowerCase();
    const entryDate = date || new Date().toISOString().split('T')[0];
    const realTimeMonth = getMonthNameFromDate(entryDate);

    const newEntry = {
      id: db.data.autoInc.purchase_bpr++,
      month: realTimeMonth,
      date: entryDate,
      bpr_no: bpr_no ? String(bpr_no).trim() : '',
      contractor_name: contractor_name ? String(contractor_name).trim() : '',
      job_work: job_work ? String(job_work).trim() : '',
      supplier: supplier ? String(supplier).trim() : '',
      invoice_no_date: invoice_no_date ? String(invoice_no_date).trim() : '',
      particulars: particulars ? String(particulars).trim() : '',
      description: description ? String(description).trim() : '',
      taxable_value: parseFloat(taxable_value) || 0,
      taxable_rate: parseFloat(taxable_rate) || 0,
      igst: parseFloat(igst) || 0,
      cgst: parseFloat(cgst) || 0,
      sgst: parseFloat(sgst) || 0,
      invoice_value: parseFloat(invoice_value) || 0,
      remarks: remarks ? String(remarks).trim() : '',
      branch: targetBranch,
      created_at: new Date().toISOString(),
      created_by: req.user ? req.user.id : null,
      is_unlocked: false,
      edit_requested: false
    };

    db.data.purchase_bpr.push(newEntry);

    // Department-specific notifications for Admin and Manager
    const now = new Date().toISOString();
    const notifMsg = `🔄 New BPR Entry Added: Purchase Dept (${capitalize(targetBranch)}) added BPR Entry #${newEntry.bpr_no || newEntry.id} (Contractor: ${newEntry.contractor_name || 'N/A'}, Value: ₹${newEntry.invoice_value.toLocaleString('en-IN')})`;

    db.data.notifications.push({
      id: db.data.autoInc.notifications++,
      sender_id: req.user ? req.user.id : 0,
      sender_name: req.user ? req.user.full_name : 'Purchase Dept',
      target_user_id: null,
      target_user_name: 'Admin',
      role: 'admin',
      dept: 'purchase',
      branch: targetBranch,
      type: 'purchase',
      entry_type: 'bpr',
      entry_id: newEntry.id,
      message: notifMsg,
      validity: '1week',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      is_read: 0,
      created_at: now
    });

    db.data.notifications.push({
      id: db.data.autoInc.notifications++,
      sender_id: req.user ? req.user.id : 0,
      sender_name: req.user ? req.user.full_name : 'Purchase Dept',
      target_user_id: null,
      target_user_name: 'Manager',
      role: 'manager',
      dept: 'purchase',
      branch: targetBranch,
      type: 'purchase',
      entry_type: 'bpr',
      entry_id: newEntry.id,
      message: notifMsg,
      validity: '1week',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      is_read: 0,
      created_at: now
    });

    db.saveData();

    res.status(201).json(newEntry);
  } catch (err) {
    console.error('Error creating BPR:', err);
    res.status(500).json({ error: 'Failed to save BPR entry: ' + err.message });
  }
});

// PUT /api/purchase/bpr/:id — Edit BPR entry
router.put('/bpr/:id', auth, (req, res) => {
  try {
    ensureDbCollections();
    const id = req.params.id;
    const entry = db.data.purchase_bpr.find(item => String(item.id) === String(id));
    if (!entry) {
      return res.status(404).json({ error: 'BPR entry not found' });
    }

    if (!isEntryEditable(entry, req.user)) {
      return res.status(403).json({ error: 'Entry is locked (48-hour edit window has expired). Please request edit access from Admin.' });
    }

    const {
      date,
      bpr_no,
      contractor_name,
      job_work,
      supplier,
      invoice_no_date,
      particulars,
      description,
      taxable_value,
      taxable_rate,
      igst,
      cgst,
      sgst,
      invoice_value,
      remarks
    } = req.body;

    if (date) {
      entry.date = date;
      entry.month = getMonthNameFromDate(date);
    }
    if (bpr_no !== undefined) entry.bpr_no = String(bpr_no).trim();
    if (contractor_name !== undefined) entry.contractor_name = String(contractor_name).trim();
    if (job_work !== undefined) entry.job_work = String(job_work).trim();
    if (supplier !== undefined) entry.supplier = String(supplier).trim();
    if (invoice_no_date !== undefined) entry.invoice_no_date = String(invoice_no_date).trim();
    if (particulars !== undefined) entry.particulars = String(particulars).trim();
    if (description !== undefined) entry.description = String(description).trim();
    if (taxable_value !== undefined) entry.taxable_value = parseFloat(taxable_value) || 0;
    if (taxable_rate !== undefined) entry.taxable_rate = parseFloat(taxable_rate) || 0;
    if (igst !== undefined) entry.igst = parseFloat(igst) || 0;
    if (cgst !== undefined) entry.cgst = parseFloat(cgst) || 0;
    if (sgst !== undefined) entry.sgst = parseFloat(sgst) || 0;
    if (invoice_value !== undefined) entry.invoice_value = parseFloat(invoice_value) || 0;
    if (remarks !== undefined) entry.remarks = String(remarks).trim();

    entry.updated_at = new Date().toISOString();

    // Department-specific update notifications for Admin and Manager
    const now = new Date().toISOString();
    const updateNotifMsg = `🔄 BPR Entry Updated: Purchase Dept (${capitalize(entry.branch || 'maalur')}) updated BPR Entry #${entry.bpr_no || entry.id} (Contractor: ${entry.contractor_name || 'N/A'}, Value: ₹${entry.invoice_value.toLocaleString('en-IN')})`;

    db.data.notifications.push({
      id: db.data.autoInc.notifications++,
      sender_id: req.user ? req.user.id : 0,
      sender_name: req.user ? req.user.full_name : 'Purchase Dept',
      target_user_id: null,
      target_user_name: 'Admin',
      role: 'admin',
      dept: 'purchase',
      branch: entry.branch || 'maalur',
      type: 'purchase',
      entry_type: 'bpr',
      entry_id: entry.id,
      message: updateNotifMsg,
      validity: '1week',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      is_read: 0,
      created_at: now
    });

    db.data.notifications.push({
      id: db.data.autoInc.notifications++,
      sender_id: req.user ? req.user.id : 0,
      sender_name: req.user ? req.user.full_name : 'Purchase Dept',
      target_user_id: null,
      target_user_name: 'Manager',
      role: 'manager',
      dept: 'purchase',
      branch: entry.branch || 'maalur',
      type: 'purchase',
      entry_type: 'bpr',
      entry_id: entry.id,
      message: updateNotifMsg,
      validity: '1week',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      is_read: 0,
      created_at: now
    });

    db.saveData();
    res.json(entry);
  } catch (err) {
    console.error('Error updating BPR:', err);
    res.status(500).json({ error: 'Failed to update BPR entry: ' + err.message });
  }
});

// POST /api/purchase/bpr/:id/request-edit — Purchase Dept requests Admin edit access after 48h
router.post('/bpr/:id/request-edit', auth, (req, res) => {
  try {
    ensureDbCollections();
    if (!req.user || req.user.role !== 'purchase') {
      return res.status(403).json({ error: 'Only Purchase Department users can request edit access' });
    }

    const id = req.params.id;
    const entry = db.data.purchase_bpr.find(item => String(item.id) === String(id));
    if (!entry) {
      return res.status(404).json({ error: 'BPR entry not found' });
    }

    entry.edit_requested = true;
    entry.edit_requested_at = new Date().toISOString();

    const notifId = db.data.autoInc.notifications++;
    const now = new Date().toISOString();
    const notifMsg = `🛒 Edit Access Request: Purchase Dept (${capitalize(entry.branch || 'maalur')}) requested edit access for BPR Entry #${entry.bpr_no || entry.id} (Contractor: ${entry.contractor_name || 'N/A'})`;

    db.data.notifications.push({
      id: notifId,
      sender_id: req.user.id,
      sender_name: req.user.full_name,
      target_user_id: null,
      target_user_name: 'Admin',
      role: 'admin',
      dept: 'purchase',
      branch: entry.branch || null,
      type: 'purchase_edit_request',
      entry_type: 'bpr',
      entry_id: entry.id,
      message: notifMsg,
      validity: '1week',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      is_read: 0,
      created_at: now
    });

    db.data.notifications.push({
      id: db.data.autoInc.notifications++,
      sender_id: req.user.id,
      sender_name: req.user.full_name,
      target_user_id: null,
      target_user_name: 'Manager',
      role: 'manager',
      dept: 'purchase',
      branch: entry.branch || null,
      type: 'purchase_edit_request',
      entry_type: 'bpr',
      entry_id: entry.id,
      message: notifMsg,
      validity: '1week',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      is_read: 0,
      created_at: now
    });

    db.saveData();
    res.json({ success: true, message: 'Edit access request sent to Admin in real time', entry });
  } catch (err) {
    console.error('Error requesting BPR edit access:', err);
    res.status(500).json({ error: 'Failed to request edit access: ' + err.message });
  }
});

// POST /api/purchase/bpr/:id/unlock-edit — Admin grants edit access
router.post('/bpr/:id/unlock-edit', auth, (req, res) => {
  try {
    ensureDbCollections();
    const isAdmin = req.user && (req.user.role === 'admin' || req.user.hasAdminPower);
    if (!isAdmin) {
      return res.status(403).json({ error: 'Only Admin users can grant edit access' });
    }

    const id = req.params.id;
    const entry = db.data.purchase_bpr.find(item => String(item.id) === String(id));
    if (!entry) {
      return res.status(404).json({ error: 'BPR entry not found' });
    }

    entry.is_unlocked = true;
    entry.edit_requested = false;
    entry.unlocked_by = req.user.full_name;
    entry.unlocked_at = new Date().toISOString();

    const notifId = db.data.autoInc.notifications++;
    const now = new Date().toISOString();
    const notifMsg = `🔓 Edit Access Granted: Admin approved edit access for BPR Entry #${entry.bpr_no || entry.id} (Contractor: ${entry.contractor_name || 'N/A'}). You can now edit this entry.`;

    db.data.notifications.push({
      id: notifId,
      sender_id: req.user.id,
      sender_name: req.user.full_name,
      target_user_id: null,
      target_user_name: 'Purchase Department',
      role: 'purchase',
      dept: 'purchase',
      branch: entry.branch || null,
      type: 'purchase_edit_unlocked',
      entry_type: 'bpr',
      entry_id: entry.id,
      message: notifMsg,
      validity: '3day',
      expires_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      is_read: 0,
      created_at: now
    });

    db.data.notifications.push({
      id: db.data.autoInc.notifications++,
      sender_id: req.user.id,
      sender_name: req.user.full_name,
      target_user_id: null,
      target_user_name: 'Manager',
      role: 'manager',
      dept: 'purchase',
      branch: entry.branch || null,
      type: 'purchase_edit_unlocked',
      entry_type: 'bpr',
      entry_id: entry.id,
      message: notifMsg,
      validity: '3day',
      expires_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      is_read: 0,
      created_at: now
    });

    db.saveData();
    res.json({ success: true, message: 'Edit access granted successfully', entry });
  } catch (err) {
    console.error('Error unlocking BPR edit access:', err);
    res.status(500).json({ error: 'Failed to unlock edit access: ' + err.message });
  }
});

// POST /api/purchase/bpr/:id/lock-edit — Admin locks entry edit access
router.post('/bpr/:id/lock-edit', auth, (req, res) => {
  try {
    ensureDbCollections();
    const isAdmin = req.user && (req.user.role === 'admin' || req.user.hasAdminPower);
    if (!isAdmin) {
      return res.status(403).json({ error: 'Only Admin users can lock edit access' });
    }

    const id = req.params.id;
    const entry = db.data.purchase_bpr.find(item => String(item.id) === String(id));
    if (!entry) {
      return res.status(404).json({ error: 'BPR entry not found' });
    }

    entry.is_unlocked = false;
    entry.edit_requested = false;

    const notifMsg = `🔒 Edit Access Locked: Admin locked edit access for BPR Entry #${entry.bpr_no || entry.id} (Contractor: ${entry.contractor_name || 'N/A'}).`;
    const now = new Date().toISOString();

    db.data.notifications.push({
      id: db.data.autoInc.notifications++,
      sender_id: req.user.id,
      sender_name: req.user.full_name,
      target_user_id: null,
      target_user_name: 'Purchase Department',
      role: 'purchase',
      dept: 'purchase',
      branch: entry.branch || null,
      type: 'purchase_edit_locked',
      entry_type: 'bpr',
      entry_id: entry.id,
      message: notifMsg,
      validity: '3day',
      expires_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      is_read: 0,
      created_at: now
    });

    db.data.notifications.push({
      id: db.data.autoInc.notifications++,
      sender_id: req.user.id,
      sender_name: req.user.full_name,
      target_user_id: null,
      target_user_name: 'Manager',
      role: 'manager',
      dept: 'purchase',
      branch: entry.branch || null,
      type: 'purchase_edit_locked',
      entry_type: 'bpr',
      entry_id: entry.id,
      message: notifMsg,
      validity: '3day',
      expires_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      is_read: 0,
      created_at: now
    });

    db.saveData();

    res.json({ success: true, message: 'Entry locked successfully', entry });
  } catch (err) {
    console.error('Error locking BPR entry:', err);
    res.status(500).json({ error: 'Failed to lock entry: ' + err.message });
  }
});

// DELETE /api/purchase/bpr/:id
router.delete('/bpr/:id', auth, (req, res) => {
  try {
    ensureDbCollections();
    if (!req.user || req.user.role !== 'purchase') {
      return res.status(403).json({ error: 'Only Purchase Department users can delete BPR entries' });
    }

    const id = req.params.id;
    const idx = db.data.purchase_bpr.findIndex(item => String(item.id) === String(id));
    if (idx === -1) {
      return res.status(404).json({ error: 'BPR entry not found' });
    }

    const deletedEntry = db.data.purchase_bpr[idx];
    db.data.purchase_bpr.splice(idx, 1);

    const notifMsg = `🗑️ BPR Entry Deleted: Purchase Dept (${capitalize(deletedEntry.branch || 'maalur')}) deleted BPR Entry #${deletedEntry.bpr_no || deletedEntry.id} (Contractor: ${deletedEntry.contractor_name || 'N/A'})`;
    const now = new Date().toISOString();

    db.data.notifications.push({
      id: db.data.autoInc.notifications++,
      sender_id: req.user ? req.user.id : 0,
      sender_name: req.user ? req.user.full_name : 'Purchase Dept',
      target_user_id: null,
      target_user_name: 'Admin',
      role: 'admin',
      dept: 'purchase',
      branch: deletedEntry.branch || 'maalur',
      type: 'purchase',
      entry_type: 'bpr',
      entry_id: deletedEntry.id,
      message: notifMsg,
      validity: '1week',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      is_read: 0,
      created_at: now
    });

    db.data.notifications.push({
      id: db.data.autoInc.notifications++,
      sender_id: req.user ? req.user.id : 0,
      sender_name: req.user ? req.user.full_name : 'Purchase Dept',
      target_user_id: null,
      target_user_name: 'Manager',
      role: 'manager',
      dept: 'purchase',
      branch: deletedEntry.branch || 'maalur',
      type: 'purchase',
      entry_type: 'bpr',
      entry_id: deletedEntry.id,
      message: notifMsg,
      validity: '1week',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      is_read: 0,
      created_at: now
    });

    db.saveData();

    res.json({ success: true, message: 'BPR entry deleted' });
  } catch (err) {
    console.error('Error deleting BPR:', err);
    res.status(500).json({ error: 'Failed to delete BPR entry: ' + err.message });
  }
});

// ─── ABSTRACT ROUTE ─────────────────────────────────────────────────────────

function getEntryYear(item) {
  if (!item) return 2026;
  if (item.year && !isNaN(parseInt(item.year, 10))) {
    return parseInt(item.year, 10);
  }
  const dateStr = item.date || item.created_at;
  if (dateStr) {
    const s = String(dateStr).trim();
    // 1. Matches 4-digit year at start (YYYY-MM-DD or YYYY/MM/DD)
    const matchStart = s.match(/^(\d{4})/);
    if (matchStart) return parseInt(matchStart[1], 10);

    // 2. Matches 4-digit year at end (DD-MM-YYYY or DD/MM/YYYY)
    const matchEnd = s.match(/(\d{4})$/);
    if (matchEnd) return parseInt(matchEnd[1], 10);

    // 3. Matches any 20xx or 21xx 4-digit sequence
    const matchAny = s.match(/(20\d{2}|21\d{2})/);
    if (matchAny) return parseInt(matchAny[1], 10);

    const d = new Date(s);
    if (!isNaN(d.getFullYear())) return d.getFullYear();
  }
  return 2026;
}

// GET /api/purchase/abstract?branch=...&month=...&year=...
router.get('/abstract', auth, (req, res) => {
  try {
    ensureDbCollections();
    const branchArg = (req.query.branch || (req.user && req.user.branch) || 'maalur').toLowerCase();
    const monthArg = req.query.month;
    const yearArg = req.query.year ? parseInt(req.query.year, 10) : null;
    
    let igrList = db.data.purchase_igr.filter(item => (item.branch || 'maalur').toLowerCase() === branchArg);
    let bprList = db.data.purchase_bpr.filter(item => (item.branch || 'maalur').toLowerCase() === branchArg);

    if (yearArg && !isNaN(yearArg)) {
      igrList = igrList.filter(item => getEntryYear(item) === yearArg);
      bprList = bprList.filter(item => getEntryYear(item) === yearArg);
    }

    let calendarMonths = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    
    const igrTotalsByMonth = {};
    const bprTotalsByMonth = {};

    calendarMonths.forEach(m => {
      igrTotalsByMonth[m] = 0;
      bprTotalsByMonth[m] = 0;
    });

    let igrGrandTotal = 0;
    igrList.forEach(item => {
      const val = parseFloat(item.invoice_value) || 0;
      const m = item.month || getMonthNameFromDate(item.date);
      if (igrTotalsByMonth[m] !== undefined) {
        igrTotalsByMonth[m] += val;
      } else {
        igrTotalsByMonth[m] = val;
      }
      igrGrandTotal += val;
    });

    let bprGrandTotal = 0;
    bprList.forEach(item => {
      const val = parseFloat(item.invoice_value) || 0;
      const m = item.month || getMonthNameFromDate(item.date);
      if (bprTotalsByMonth[m] !== undefined) {
        bprTotalsByMonth[m] += val;
      } else {
        bprTotalsByMonth[m] = val;
      }
      bprGrandTotal += val;
    });

    if (monthArg && monthArg.toLowerCase() !== 'all') {
      calendarMonths = calendarMonths.filter(m => m.toLowerCase() === monthArg.toLowerCase());
    }

    const igr_summary = calendarMonths.map(month => ({
      month,
      total_value: igrTotalsByMonth[month] || 0
    }));

    const bpr_summary = calendarMonths.map(month => ({
      month,
      total_value: bprTotalsByMonth[month] || 0
    }));

    res.json({
      igr_summary,
      igr_grand_total: igrGrandTotal,
      bpr_summary,
      bpr_grand_total: bprGrandTotal
    });
  } catch (err) {
    console.error('Error generating abstract:', err);
    res.status(500).json({ error: 'Failed to generate abstract: ' + err.message });
  }
});

// GET /api/purchase/export — Export Purchase data as CSV
router.get('/export', auth, (req, res) => {
  try {
    ensureDbCollections();
    const branchArg = (req.query.branch || (req.user && req.user.branch) || 'maalur').toLowerCase();
    const igrList = db.data.purchase_igr.filter(item => (item.branch || 'maalur').toLowerCase() === branchArg);
    const bprList = db.data.purchase_bpr.filter(item => (item.branch || 'maalur').toLowerCase() === branchArg);

    let csv = 'Type,SL NO,Month,Date,Doc No,Invoice No/Date,Party Name,Description,Taxable Value,Invoice Value\n';
    igrList.forEach((item, idx) => {
      csv += `IGR,${idx + 1},"${item.month || ''}","${item.date || ''}","${item.igr_no || ''}","${item.invoice_no_date || ''}","${item.supplier_name || ''}","${(item.description || '').replace(/"/g, '""')}",${item.taxable_value || 0},${item.invoice_value || 0}\n`;
    });
    bprList.forEach((item, idx) => {
      csv += `BPR,${idx + 1},"${item.month || ''}","${item.date || ''}","${item.bpr_no || ''}","${item.invoice_no_date || ''}","${item.contractor_name || ''}","${(item.description || '').replace(/"/g, '""')}",${item.taxable_value || 0},${item.invoice_value || 0}\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=purchase_report_${branchArg}_${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: 'Failed to export purchase data: ' + err.message });
  }
});

// ─── PO (PURCHASE ORDER) ROUTES ──────────────────────────────────────────────

// Helper function to auto-assign unit based on Raw Material name
function computeUnitForRawMaterial(rawMaterial) {
  if (!rawMaterial) return "No's";
  const name = rawMaterial.toString();
  if (/gsm|ss|alu|ms|bucket|stretch|rod/i.test(name)) return "Kg's";
  if (/thermal|acou/i.test(name)) return "Sqmt";
  if (/tape|bubble/i.test(name)) return "Roll";
  if (/gasket|jtr/i.test(name)) return "Rmt";
  if (/cleats|tube|bracket|corner|handle|gear|bush/i.test(name)) return "No's";
  return "No's";
}

// GET /api/purchase/po?branch=...&month=...
router.get('/po', auth, (req, res) => {
  try {
    ensureDbCollections();
    const branchArg = (req.query.branch || (req.user && req.user.branch) || 'maalur').toLowerCase();
    const monthArg = req.query.month;
    let list = db.data.purchase_po.filter(item => (item.branch || 'maalur').toLowerCase() === branchArg);

    if (monthArg && monthArg.toLowerCase() !== 'all') {
      list = list.filter(item => {
        const m = item.month || getMonthNameFromDate(item.date);
        return (m || '').toLowerCase() === monthArg.toLowerCase();
      });
    }

    list.sort((a, b) => new Date(a.date || a.created_at) - new Date(b.date || b.created_at));

    const formatted = list.map((item, idx) => ({
      ...item,
      sl_no: idx + 1,
      is_editable: isEntryEditable(item, req.user)
    }));

    res.json(formatted);
  } catch (err) {
    console.error('Error fetching PO entries:', err);
    res.status(500).json({ error: 'Failed to fetch PO entries: ' + err.message });
  }
});

// POST /api/purchase/po
router.post('/po', auth, (req, res) => {
  try {
    ensureDbCollections();

    if (!req.user || (req.user.role !== 'purchase' && req.user.role !== 'admin')) {
      return res.status(403).json({ error: 'Only Purchase Department users or Admin can create PO entries' });
    }

    const {
      date,
      po_no,
      po_date,
      supplier,
      make,
      inv_no,
      igr_no,
      raw_material,
      unit,
      qty,
      rate,
      cgst,
      sgst,
      igst,
      trans_as_invoice,
      branch
    } = req.body;

    const parsedQty = parseFloat(qty) || 0;
    const parsedRate = parseFloat(rate) || 0;
    const parsedBasic = parsedQty * parsedRate;

    const parsedCgst = parseFloat(cgst) || 0;
    const parsedSgst = parseFloat(sgst) || 0;
    const parsedIgst = parseFloat(igst) || 0;
    const parsedTrans = parseFloat(trans_as_invoice) || 0;

    const computedUnit = unit || computeUnitForRawMaterial(raw_material);
    const transPerUnit = parsedQty > 0 ? (parsedTrans / parsedQty) : 0;
    const total = parsedBasic + parsedCgst + parsedSgst + parsedIgst + parsedTrans;

    const newId = db.data.autoInc.purchase_po++;
    const targetBranch = (branch || req.user.branch || 'maalur').toLowerCase();
    const entryDate = date || new Date().toISOString().split('T')[0];
    const month = getMonthNameFromDate(entryDate);

    const newEntry = {
      id: newId,
      branch: targetBranch,
      month,
      date: entryDate,
      po_no: po_no || '—',
      po_date: po_date || entryDate,
      supplier: supplier || '—',
      make: make || '—',
      inv_no: inv_no || '—',
      igr_no: igr_no || '—',
      raw_material: raw_material || '—',
      unit: computedUnit,
      qty: parsedQty,
      rate: parsedRate,
      basic: parsedBasic,
      cgst: parsedCgst,
      sgst: parsedSgst,
      igst: parsedIgst,
      trans_as_invoice: parsedTrans,
      trans_per_unit: transPerUnit,
      total: total,
      created_by: req.user.username || req.user.name,
      created_at: new Date().toISOString(),
      is_unlocked: false
    };

    db.data.purchase_po.push(newEntry);
    db.saveData();

    res.status(201).json(newEntry);
  } catch (err) {
    console.error('Error creating PO entry:', err);
    res.status(500).json({ error: 'Failed to create PO entry: ' + err.message });
  }
});

// PUT /api/purchase/po/:id
router.put('/po/:id', auth, (req, res) => {
  try {
    ensureDbCollections();
    const id = parseInt(req.params.id, 10);
    const entry = db.data.purchase_po.find(x => x.id === id);

    if (!entry) {
      return res.status(404).json({ error: 'PO entry not found' });
    }

    if (!isEntryEditable(entry, req.user) && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Editing window closed (48h limit). Request unlock from admin.' });
    }

    const {
      date,
      po_no,
      po_date,
      supplier,
      make,
      inv_no,
      igr_no,
      raw_material,
      unit,
      qty,
      rate,
      cgst,
      sgst,
      igst,
      trans_as_invoice
    } = req.body;

    if (date !== undefined) entry.date = date;
    if (date) entry.month = getMonthNameFromDate(date);
    if (po_no !== undefined) entry.po_no = po_no;
    if (po_date !== undefined) entry.po_date = po_date;
    if (supplier !== undefined) entry.supplier = supplier;
    if (make !== undefined) entry.make = make;
    if (inv_no !== undefined) entry.inv_no = inv_no;
    if (igr_no !== undefined) entry.igr_no = igr_no;
    if (raw_material !== undefined) {
      entry.raw_material = raw_material;
      entry.unit = unit || computeUnitForRawMaterial(raw_material);
    }
    if (unit !== undefined) entry.unit = unit;

    if (qty !== undefined) entry.qty = parseFloat(qty) || 0;
    if (rate !== undefined) entry.rate = parseFloat(rate) || 0;
    entry.basic = entry.qty * entry.rate;

    if (cgst !== undefined) entry.cgst = parseFloat(cgst) || 0;
    if (sgst !== undefined) entry.sgst = parseFloat(sgst) || 0;
    if (igst !== undefined) entry.igst = parseFloat(igst) || 0;
    if (trans_as_invoice !== undefined) entry.trans_as_invoice = parseFloat(trans_as_invoice) || 0;

    entry.trans_per_unit = entry.qty > 0 ? (entry.trans_as_invoice / entry.qty) : 0;
    entry.total = entry.basic + entry.cgst + entry.sgst + entry.igst + entry.trans_as_invoice;
    entry.updated_at = new Date().toISOString();

    db.saveData();
    res.json(entry);
  } catch (err) {
    console.error('Error updating PO entry:', err);
    res.status(500).json({ error: 'Failed to update PO entry: ' + err.message });
  }
});

// DELETE /api/purchase/po/:id
router.delete('/po/:id', auth, (req, res) => {
  try {
    ensureDbCollections();
    const id = parseInt(req.params.id, 10);
    const idx = db.data.purchase_po.findIndex(x => x.id === id);

    if (idx === -1) {
      return res.status(404).json({ error: 'PO entry not found' });
    }

    const entry = db.data.purchase_po[idx];
    db.data.purchase_po.splice(idx, 1);
    db.saveData();
    res.json({ message: 'PO entry deleted successfully' });
  } catch (err) {
    console.error('Error deleting PO entry:', err);
    res.status(500).json({ error: 'Failed to delete PO entry: ' + err.message });
  }
});

// POST /api/purchase/po/:id/request-edit — Purchase Dept requests Admin edit access after 48h
router.post('/po/:id/request-edit', auth, (req, res) => {
  try {
    ensureDbCollections();
    if (!req.user || req.user.role !== 'purchase') {
      return res.status(403).json({ error: 'Only Purchase Department users can request edit access' });
    }

    const id = req.params.id;
    const entry = db.data.purchase_po.find(item => String(item.id) === String(id));
    if (!entry) {
      return res.status(404).json({ error: 'PO entry not found' });
    }

    entry.edit_requested = true;
    entry.edit_requested_at = new Date().toISOString();

    const notifId = db.data.autoInc.notifications++;
    const now = new Date().toISOString();
    const notifMsg = `🛒 Edit Access Request: Purchase Dept (${capitalize(entry.branch || 'maalur')}) requested edit access for PO Entry #${entry.po_no || entry.id} (Supplier: ${entry.supplier || 'N/A'})`;

    db.data.notifications.push({
      id: notifId,
      sender_id: req.user.id,
      sender_name: req.user.full_name,
      target_user_id: null,
      target_user_name: 'Admin',
      role: 'admin',
      dept: 'purchase',
      branch: entry.branch || null,
      type: 'purchase_edit_request',
      entry_type: 'po',
      entry_id: entry.id,
      message: notifMsg,
      validity: '1week',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      is_read: 0,
      created_at: now
    });

    db.saveData();
    res.json({ success: true, message: 'Edit access request sent to Admin in real time', entry });
  } catch (err) {
    console.error('Error requesting PO edit access:', err);
    res.status(500).json({ error: 'Failed to request edit access: ' + err.message });
  }
});

// POST /api/purchase/po/:id/unlock-edit — Admin grants edit access
router.post('/po/:id/unlock-edit', auth, (req, res) => {
  try {
    ensureDbCollections();
    const isAdmin = req.user && (req.user.role === 'admin' || req.user.hasAdminPower);
    if (!isAdmin) {
      return res.status(403).json({ error: 'Only Admin users can grant edit access' });
    }

    const id = req.params.id;
    const entry = db.data.purchase_po.find(item => String(item.id) === String(id));
    if (!entry) {
      return res.status(404).json({ error: 'PO entry not found' });
    }

    entry.is_unlocked = true;
    entry.edit_requested = false;
    entry.unlocked_by = req.user.full_name;
    entry.unlocked_at = new Date().toISOString();

    db.saveData();
    res.json({ success: true, message: 'PO entry unlocked successfully', entry });
  } catch (err) {
    console.error('Error unlocking PO entry:', err);
    res.status(500).json({ error: 'Failed to unlock PO entry: ' + err.message });
  }
});

// POST /api/purchase/po/:id/lock-edit — Admin locks entry back
router.post('/po/:id/lock-edit', auth, (req, res) => {
  try {
    ensureDbCollections();
    const isAdmin = req.user && (req.user.role === 'admin' || req.user.hasAdminPower);
    if (!isAdmin) {
      return res.status(403).json({ error: 'Only Admin users can lock entries' });
    }

    const id = req.params.id;
    const entry = db.data.purchase_po.find(item => String(item.id) === String(id));
    if (!entry) {
      return res.status(404).json({ error: 'PO entry not found' });
    }

    entry.is_unlocked = false;
    entry.edit_requested = false;

    db.saveData();
    res.json({ success: true, message: 'PO entry locked successfully', entry });
  } catch (err) {
    console.error('Error locking PO entry:', err);
    res.status(500).json({ error: 'Failed to lock PO entry: ' + err.message });
  }
});
// ─── MATERIALS ROUTES ────────────────────────────────────────────────────────

// GET /api/purchase/materials — Fetch all materials dataset
router.get('/materials', auth, (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const seedPath = path.join(__dirname, '../materials_seed.json');
    
    if (fs.existsSync(seedPath)) {
      const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
      if (!db.data.purchase_materials || 
          !db.data.purchase_materials.raw_materials || 
          db.data.purchase_materials.raw_materials.length === 0) {
        db.data.purchase_materials = seed;
        db.saveData();
      }
    }
    res.json(db.data.purchase_materials || { raw_materials: [], consumable_items: [], electric_materials: [], tools: [] });
  } catch (err) {
    console.error('Error fetching materials:', err);
    res.status(500).json({ error: 'Failed to fetch materials: ' + err.message });
  }
});

// PUT /api/purchase/materials/:category/:id — Update quantity and UOM for material item
router.put('/materials/:category/:id', auth, (req, res) => {
  try {
    ensureDbCollections();
    const { category, id } = req.params;
    const { qty, uom } = req.body;

    if (!db.data.purchase_materials || !db.data.purchase_materials[category]) {
      return res.status(404).json({ error: 'Invalid materials category: ' + category });
    }

    const items = db.data.purchase_materials[category];
    const item = items.find(i => String(i.id) === String(id));

    if (!item) {
      return res.status(404).json({ error: 'Material item not found' });
    }

    if (qty !== undefined) {
      const parsedQty = parseFloat(qty);
      if (!isNaN(parsedQty)) item.qty = parsedQty;
    }

    if (uom !== undefined && String(uom).trim()) {
      item.uom = String(uom).trim();
      if (category === 'raw_materials') {
        item.displayed_unit = String(uom).trim();
      }
    }

    item.updated_at = new Date().toISOString();
    item.updated_by = req.user ? (req.user.full_name || req.user.username || 'Purchase Dept') : 'Purchase Dept';

    // Create notifications for Admin and Manager
    const categoryName = category.replace('_', ' ');
    const notifMsg = `[Materials Update] ${item.updated_by} updated ${categoryName} item "${item.name}": Qty = ${item.qty}, UOM = ${item.uom}`;

    if (!db.data.notifications) db.data.notifications = [];
    if (!db.data.autoInc) db.data.autoInc = {};
    if (!db.data.autoInc.notifications) db.data.autoInc.notifications = 1;

    const senderId = req.user ? (req.user.id || req.user.username || 1) : 1;

    // 1. Notify Admin
    db.data.notifications.push({
      id: db.data.autoInc.notifications++,
      role: 'admin',
      branch: null,
      type: 'materials_update',
      message: notifMsg,
      sender_id: senderId,
      sender_name: item.updated_by,
      is_read: 0,
      created_at: new Date().toISOString()
    });

    // 2. Notify Manager
    db.data.notifications.push({
      id: db.data.autoInc.notifications++,
      role: 'manager',
      branch: req.user && req.user.branch ? req.user.branch.toLowerCase() : 'maalur',
      type: 'materials_update',
      message: notifMsg,
      sender_id: senderId,
      sender_name: item.updated_by,
      is_read: 0,
      created_at: new Date().toISOString()
    });

    db.saveData();
    res.json({ success: true, message: 'Material updated successfully', item });
  } catch (err) {
    console.error('Error updating material:', err);
    res.status(500).json({ error: 'Failed to update material: ' + err.message });
  }
});

// POST /api/purchase/materials/enquiry — Save a new rate enquiry
router.post('/materials/enquiry', auth, (req, res) => {
  try {
    ensureDbCollections();
    const { material_name, supplier_name, supplier_email, message } = req.body;

    if (!material_name || !supplier_name || !message) {
      return res.status(400).json({ error: 'Material name, supplier name, and message are required' });
    }

    const role = (req.user ? (req.user.role || 'purchase') : 'purchase').toLowerCase();
    const userId = req.user ? (req.user.id || req.user.username || 1) : 1;
    const userName = req.user ? (req.user.full_name || req.user.username || 'User') : 'User';

    const enquiry = {
      id: db.data.autoInc.rate_enquiries++,
      material_name: String(material_name).trim(),
      supplier_name: String(supplier_name).trim(),
      supplier_email: String(supplier_email || '').trim(),
      message: String(message).trim(),
      sent_by_role: role,
      sent_by_user_id: userId,
      sent_by_user_name: userName,
      branch: req.user && req.user.branch ? req.user.branch.toLowerCase() : 'maalur',
      created_at: new Date().toISOString()
    };

    db.data.rate_enquiries.push(enquiry);
    db.saveData();

    res.json({ success: true, message: 'Rate enquiry sent and recorded successfully', enquiry });
  } catch (err) {
    console.error('Error saving rate enquiry:', err);
    res.status(500).json({ error: 'Failed to save rate enquiry: ' + err.message });
  }
});

// GET /api/purchase/materials/enquiries — Fetch sent rate enquiries with role filters
router.get('/materials/enquiries', auth, (req, res) => {
  try {
    ensureDbCollections();
    const userRole = (req.user ? (req.user.role || 'purchase') : 'purchase').toLowerCase();
    const targetRole = req.query.role ? req.query.role.toLowerCase() : null;

    let list = db.data.rate_enquiries || [];

    if (userRole === 'admin') {
      if (targetRole === 'myself') {
        list = list.filter(e => e.sent_by_role === 'admin');
      } else if (targetRole === 'manager') {
        list = list.filter(e => e.sent_by_role === 'manager');
      } else if (targetRole === 'purchase') {
        list = list.filter(e => e.sent_by_role === 'purchase');
      }
    } else if (userRole === 'manager') {
      list = list.filter(e => e.sent_by_role === 'manager');
    } else {
      list = list.filter(e => e.sent_by_role === 'purchase');
    }

    list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.json(list);
  } catch (err) {
    console.error('Error fetching rate enquiries:', err);
    res.status(500).json({ error: 'Failed to fetch rate enquiries: ' + err.message });
  }
});

module.exports = router;
