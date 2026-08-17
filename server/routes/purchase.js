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

function ensureDbCollections() {
  if (!db.data) db.data = {};
  if (!db.data.purchase_igr) db.data.purchase_igr = [];
  if (!db.data.purchase_bpr) db.data.purchase_bpr = [];
  if (!db.data.autoInc) db.data.autoInc = {};
  if (!db.data.autoInc.purchase_igr) db.data.autoInc.purchase_igr = 1;
  if (!db.data.autoInc.purchase_bpr) db.data.autoInc.purchase_bpr = 1;
}

// ─── IGR ROUTES ─────────────────────────────────────────────────────────────

// GET /api/purchase/igr?branch=...
router.get('/igr', auth, (req, res) => {
  try {
    ensureDbCollections();
    const branchArg = (req.query.branch || (req.user && req.user.branch) || 'maalur').toLowerCase();
    const list = db.data.purchase_igr.filter(item => (item.branch || 'maalur').toLowerCase() === branchArg);
    
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
      created_by: req.user ? req.user.id : null
    };

    db.data.purchase_igr.push(newEntry);
    db.saveData();

    res.status(201).json(newEntry);
  } catch (err) {
    console.error('Error creating IGR:', err);
    res.status(500).json({ error: 'Failed to save IGR entry: ' + err.message });
  }
});

// DELETE /api/purchase/igr/:id
router.delete('/igr/:id', auth, (req, res) => {
  try {
    ensureDbCollections();
    if (!req.user || req.user.role !== 'purchase') {
      return res.status(403).json({ error: 'Only Purchase Department users can delete IGR entries' });
    }

    const id = req.params.id;
    const idx = db.data.purchase_igr.findIndex(item => String(item.id) === String(id));
    if (idx === -1) {
      return res.status(404).json({ error: 'IGR entry not found' });
    }

    db.data.purchase_igr.splice(idx, 1);
    db.saveData();

    res.json({ success: true, message: 'IGR entry deleted' });
  } catch (err) {
    console.error('Error deleting IGR:', err);
    res.status(500).json({ error: 'Failed to delete IGR entry: ' + err.message });
  }
});

// ─── BPR ROUTES ─────────────────────────────────────────────────────────────

// GET /api/purchase/bpr?branch=...
router.get('/bpr', auth, (req, res) => {
  try {
    ensureDbCollections();
    const branchArg = (req.query.branch || (req.user && req.user.branch) || 'maalur').toLowerCase();
    const list = db.data.purchase_bpr.filter(item => (item.branch || 'maalur').toLowerCase() === branchArg);
    
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
      created_by: req.user ? req.user.id : null
    };

    db.data.purchase_bpr.push(newEntry);
    db.saveData();

    res.status(201).json(newEntry);
  } catch (err) {
    console.error('Error creating BPR:', err);
    res.status(500).json({ error: 'Failed to save BPR entry: ' + err.message });
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

    db.data.purchase_bpr.splice(idx, 1);
    db.saveData();

    res.json({ success: true, message: 'BPR entry deleted' });
  } catch (err) {
    console.error('Error deleting BPR:', err);
    res.status(500).json({ error: 'Failed to delete BPR entry: ' + err.message });
  }
});

// ─── ABSTRACT ROUTE ─────────────────────────────────────────────────────────

// GET /api/purchase/abstract?branch=...
router.get('/abstract', auth, (req, res) => {
  try {
    ensureDbCollections();
    const branchArg = (req.query.branch || (req.user && req.user.branch) || 'maalur').toLowerCase();
    
    const igrList = db.data.purchase_igr.filter(item => (item.branch || 'maalur').toLowerCase() === branchArg);
    const bprList = db.data.purchase_bpr.filter(item => (item.branch || 'maalur').toLowerCase() === branchArg);

    const calendarMonths = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    
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

module.exports = router;
