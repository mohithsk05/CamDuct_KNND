/**
 * purchase.js — Purchase Department logic (Tab switching, IGR, BPR & Abstract modules)
 */

let currentUser = null;
let currentBranch = 'maalur';
let activeMainTab = 'po';
let activeSubTab = 'igr';

let currentIGREntries = [];
let currentBPREntries = [];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function getRealTimeMonth(dateStr) {
  if (!dateStr) return MONTH_NAMES[new Date().getMonth()];
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return MONTH_NAMES[new Date().getMonth()];
  return MONTH_NAMES[d.getMonth()];
}

async function initPurchase() {
  const allowedRoles = ['purchase', 'admin', 'manager'];
  currentUser = requireAuth(allowedRoles);
  if (!currentUser) return;

  const urlBranch = new URLSearchParams(window.location.search).get('branch');
  const storedBranch = sessionStorage.getItem('active_branch');
  currentBranch = (urlBranch || storedBranch || currentUser.branch || 'maalur').toLowerCase();

  sessionStorage.setItem('active_branch', currentBranch);

  populateTopbar(currentUser);
  setupLogout();
  setupNotifications();

  const pill = document.getElementById('branch-pill-text');
  if (pill) pill.textContent = capitalize(currentBranch);

  applyRolePermissions();
  setupTopNavigation();
  setupPurchaseTabs();
  setupModalsAndCalculations();

  // Initial load
  await loadIGREntries();
  await loadBPREntries();
  await loadAbstractSummary();
}

/** Apply RBAC: "+ New Entry" buttons & editing only for Purchase department users */
function applyRolePermissions() {
  const isPurchaseUser = currentUser && currentUser.role === 'purchase';
  const openAddIGRBtn = document.getElementById('open-add-igr-btn');
  const openAddBPRBtn = document.getElementById('open-add-bpr-btn');

  if (!isPurchaseUser) {
    if (openAddIGRBtn) openAddIGRBtn.classList.add('hidden');
    if (openAddBPRBtn) openAddBPRBtn.classList.add('hidden');
  } else {
    if (openAddIGRBtn) openAddIGRBtn.classList.remove('hidden');
    if (openAddBPRBtn) openAddBPRBtn.classList.remove('hidden');
  }
}

function setupTopNavigation() {
  const backBtn = document.getElementById('back-btn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      if (currentUser && currentUser.role === 'admin') {
        window.location.href = `/admin-dashboard.html?branch=${currentBranch}`;
      } else if (currentUser && currentUser.role === 'manager') {
        window.location.href = '/manager-dashboard.html';
      } else {
        window.location.href = '/dept-dashboard.html';
      }
    });
  }

  const refreshBtn = document.getElementById('refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      const icon = refreshBtn.querySelector('.refresh-icon');
      if (icon) {
        icon.style.transform = 'rotate(360deg)';
        setTimeout(() => { icon.style.transform = 'rotate(0deg)'; }, 600);
      }
      await loadIGREntries();
      await loadBPREntries();
      await loadAbstractSummary();
      showToast('Purchase workspace refreshed', 'success');
    });
  }

  const refreshAbstractBtn = document.getElementById('refresh-abstract-btn');
  if (refreshAbstractBtn) {
    refreshAbstractBtn.addEventListener('click', async () => {
      await loadAbstractSummary();
      showToast('Abstract summary updated', 'info');
    });
  }
}

function setupPurchaseTabs() {
  const mainTabBtns = document.querySelectorAll('.purchase-tab-btn');
  const subTabBtns = document.querySelectorAll('.purchase-subtab-btn');
  const subtabsBar = document.getElementById('inventory-subtabs-bar');

  mainTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabKey = btn.dataset.tab;
      if (!tabKey) return;

      activeMainTab = tabKey;

      mainTabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      document.querySelectorAll('.purchase-content-panel').forEach(panel => {
        panel.classList.add('hidden');
      });

      const targetPanel = document.getElementById(`panel-${tabKey}`);
      if (targetPanel) {
        targetPanel.classList.remove('hidden');
      }

      if (tabKey === 'inventory') {
        subtabsBar && subtabsBar.classList.remove('hidden');
        switchInventorySubTab(activeSubTab);
      } else {
        subtabsBar && subtabsBar.classList.add('hidden');
      }
    });
  });

  subTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const subtabKey = btn.dataset.subtab;
      if (!subtabKey) return;

      switchInventorySubTab(subtabKey);
    });
  });
}

function switchInventorySubTab(subtabKey) {
  activeSubTab = subtabKey;
  const subTabBtns = document.querySelectorAll('.purchase-subtab-btn');

  subTabBtns.forEach(b => {
    if (b.dataset.subtab === subtabKey) {
      b.classList.add('active');
    } else {
      b.classList.remove('active');
    }
  });

  document.querySelectorAll('.inventory-subpanel').forEach(subpanel => {
    subpanel.classList.add('hidden');
  });

  const targetSubpanel = document.getElementById(`subpanel-${subtabKey}`);
  if (targetSubpanel) {
    targetSubpanel.classList.remove('hidden');
  }

  if (subtabKey === 'abstract') {
    loadAbstractSummary();
  }
}

// ─── MODALS & CALCULATION LOGIC ─────────────────────────────────────────────

function setupModalsAndCalculations() {
  // Modal toggles for IGR
  const modalAddIGR = document.getElementById('modal-add-igr');
  const openAddIGRBtn = document.getElementById('open-add-igr-btn');
  const closeAddIGRBtn = document.getElementById('close-add-igr-modal');
  const cancelAddIGRBtn = document.getElementById('cancel-add-igr-modal');
  const saveIGRBtn = document.getElementById('save-igr-btn');

  if (openAddIGRBtn) {
    openAddIGRBtn.addEventListener('click', () => {
      resetIGRForm();
      const nextSl = currentIGREntries.length + 1;
      const slPreview = document.getElementById('igr-sl-no-preview');
      if (slPreview) slPreview.value = `#${nextSl}`;

      modalAddIGR && modalAddIGR.classList.remove('hidden');
    });
  }
  [closeAddIGRBtn, cancelAddIGRBtn].forEach(b => {
    b && b.addEventListener('click', () => modalAddIGR && modalAddIGR.classList.add('hidden'));
  });

  // Modal toggles for BPR
  const modalAddBPR = document.getElementById('modal-add-bpr');
  const openAddBPRBtn = document.getElementById('open-add-bpr-btn');
  const closeAddBPRBtn = document.getElementById('close-add-bpr-modal');
  const cancelAddBPRBtn = document.getElementById('cancel-add-bpr-modal');
  const saveBPRBtn = document.getElementById('save-bpr-btn');

  if (openAddBPRBtn) {
    openAddBPRBtn.addEventListener('click', () => {
      resetBPRForm();
      const nextSl = currentBPREntries.length + 1;
      const slPreview = document.getElementById('bpr-sl-no-preview');
      if (slPreview) slPreview.value = `#${nextSl}`;

      modalAddBPR && modalAddBPR.classList.remove('hidden');
    });
  }
  [closeAddBPRBtn, cancelAddBPRBtn].forEach(b => {
    b && b.addEventListener('click', () => modalAddBPR && modalAddBPR.classList.add('hidden'));
  });

  // Auto Calculations for IGR
  const igrDateInput = document.getElementById('igr-date');
  const igrMonthPreview = document.getElementById('igr-month-preview');
  if (igrDateInput) {
    igrDateInput.addEventListener('change', () => {
      if (igrMonthPreview) igrMonthPreview.value = getRealTimeMonth(igrDateInput.value);
    });
  }

  document.querySelectorAll('.igr-calc-trigger, #igr-tax-mode').forEach(el => {
    el.addEventListener('input', calculateIGRForm);
    el.addEventListener('change', calculateIGRForm);
  });
  document.querySelectorAll('.igr-val-trigger').forEach(el => {
    el.addEventListener('input', calculateIGRTotalOnly);
  });

  // Auto Calculations for BPR
  const bprDateInput = document.getElementById('bpr-date');
  const bprMonthPreview = document.getElementById('bpr-month-preview');
  if (bprDateInput) {
    bprDateInput.addEventListener('change', () => {
      if (bprMonthPreview) bprMonthPreview.value = getRealTimeMonth(bprDateInput.value);
    });
  }

  document.querySelectorAll('.bpr-calc-trigger, #bpr-tax-mode').forEach(el => {
    el.addEventListener('input', calculateBPRForm);
    el.addEventListener('change', calculateBPRForm);
  });
  document.querySelectorAll('.bpr-val-trigger').forEach(el => {
    el.addEventListener('input', calculateBPRTotalOnly);
  });

  // Save IGR
  if (saveIGRBtn) {
    saveIGRBtn.addEventListener('click', submitIGREntry);
  }

  // Save BPR
  if (saveBPRBtn) {
    saveBPRBtn.addEventListener('click', submitBPREntry);
  }
}

function resetIGRForm() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('igr-date').value = today;
  document.getElementById('igr-month-preview').value = getRealTimeMonth(today);
  document.getElementById('igr-no').value = '';
  document.getElementById('igr-invoice-no-date').value = '';
  document.getElementById('igr-supplier-name').value = '';
  document.getElementById('igr-description').value = '';
  document.getElementById('igr-material-value').value = '';
  document.getElementById('igr-transport').value = '';
  document.getElementById('igr-labour-charges').value = '';
  document.getElementById('igr-taxable-value').value = '';
  document.getElementById('igr-tax-mode').value = 'igst18';
  document.getElementById('igr-igst').value = '';
  document.getElementById('igr-cgst').value = '';
  document.getElementById('igr-sgst').value = '';
  document.getElementById('igr-invoice-value').value = '';
}

function calculateIGRForm() {
  const mat = parseFloat(document.getElementById('igr-material-value').value) || 0;
  const tr = parseFloat(document.getElementById('igr-transport').value) || 0;
  const lab = parseFloat(document.getElementById('igr-labour-charges').value) || 0;

  const taxableEl = document.getElementById('igr-taxable-value');
  let taxable = mat + tr + lab;

  if (taxableEl.value !== '' && document.activeElement === taxableEl) {
    taxable = parseFloat(taxableEl.value) || 0;
  } else {
    taxableEl.value = taxable > 0 ? taxable.toFixed(2) : '';
  }

  const taxMode = document.getElementById('igr-tax-mode').value;
  let igst = 0, cgst = 0, sgst = 0;

  if (taxMode === 'igst18') {
    igst = taxable * 0.18;
    document.getElementById('igr-igst').value = igst > 0 ? igst.toFixed(2) : '0.00';
    document.getElementById('igr-cgst').value = '0.00';
    document.getElementById('igr-sgst').value = '0.00';
  } else if (taxMode === 'cgst9_sgst9') {
    cgst = taxable * 0.09;
    sgst = taxable * 0.09;
    document.getElementById('igr-igst').value = '0.00';
    document.getElementById('igr-cgst').value = cgst > 0 ? cgst.toFixed(2) : '0.00';
    document.getElementById('igr-sgst').value = sgst > 0 ? sgst.toFixed(2) : '0.00';
  }

  calculateIGRTotalOnly();
}

function calculateIGRTotalOnly() {
  const taxable = parseFloat(document.getElementById('igr-taxable-value').value) || 0;
  const igst = parseFloat(document.getElementById('igr-igst').value) || 0;
  const cgst = parseFloat(document.getElementById('igr-cgst').value) || 0;
  const sgst = parseFloat(document.getElementById('igr-sgst').value) || 0;

  const total = taxable + igst + cgst + sgst;
  document.getElementById('igr-invoice-value').value = total > 0 ? total.toFixed(2) : '';
}

function resetBPRForm() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('bpr-date').value = today;
  document.getElementById('bpr-month-preview').value = getRealTimeMonth(today);
  document.getElementById('bpr-no').value = '';
  document.getElementById('bpr-contractor-name').value = '';
  document.getElementById('bpr-job-work').value = '';
  document.getElementById('bpr-supplier').value = '';
  document.getElementById('bpr-invoice-no-date').value = '';
  document.getElementById('bpr-particulars').value = '';
  document.getElementById('bpr-description').value = '';
  document.getElementById('bpr-taxable-value').value = '';
  document.getElementById('bpr-tax-mode').value = 'igst18';
  document.getElementById('bpr-igst').value = '';
  document.getElementById('bpr-cgst').value = '';
  document.getElementById('bpr-sgst').value = '';
  document.getElementById('bpr-invoice-value').value = '';
  document.getElementById('bpr-remarks').value = '';
}

function calculateBPRForm() {
  const taxableEl = document.getElementById('bpr-taxable-value');
  const taxable = parseFloat(taxableEl.value) || 0;

  const taxMode = document.getElementById('bpr-tax-mode').value;
  let igst = 0, cgst = 0, sgst = 0;

  if (taxMode === 'igst18') {
    igst = taxable * 0.18;
    document.getElementById('bpr-igst').value = igst > 0 ? igst.toFixed(2) : '0.00';
    document.getElementById('bpr-cgst').value = '0.00';
    document.getElementById('bpr-sgst').value = '0.00';
  } else if (taxMode === 'cgst9_sgst9') {
    cgst = taxable * 0.09;
    sgst = taxable * 0.09;
    document.getElementById('bpr-igst').value = '0.00';
    document.getElementById('bpr-cgst').value = cgst > 0 ? cgst.toFixed(2) : '0.00';
    document.getElementById('bpr-sgst').value = sgst > 0 ? sgst.toFixed(2) : '0.00';
  }

  calculateBPRTotalOnly();
}

function calculateBPRTotalOnly() {
  const taxable = parseFloat(document.getElementById('bpr-taxable-value').value) || 0;
  const igst = parseFloat(document.getElementById('bpr-igst').value) || 0;
  const cgst = parseFloat(document.getElementById('bpr-cgst').value) || 0;
  const sgst = parseFloat(document.getElementById('bpr-sgst').value) || 0;

  const total = taxable + igst + cgst + sgst;
  document.getElementById('bpr-invoice-value').value = total > 0 ? total.toFixed(2) : '';
}

// ─── IGR CRUD ─────────────────────────────────────────────────────────────

async function loadIGREntries() {
  const tbody = document.getElementById('igr-table-body');
  if (!tbody) return;

  const isPurchaseUser = currentUser && currentUser.role === 'purchase';
  const thAction = document.getElementById('th-igr-actions');
  if (thAction) {
    if (isPurchaseUser) thAction.classList.remove('hidden');
    else thAction.classList.add('hidden');
  }

  try {
    const res = await apiFetch(`/purchase/igr?branch=${currentBranch}`);
    if (!res || !res.ok) throw new Error('Failed to load IGR entries');
    const data = await res.json();
    currentIGREntries = data || [];

    if (!data || data.length === 0) {
      const colSpan = isPurchaseUser ? 17 : 16;
      const msg = isPurchaseUser 
        ? 'No IGR entries recorded yet. Click <strong>"New IGR Entry"</strong> to add an entry.'
        : 'No IGR entries recorded yet by the Purchase Department.';
      tbody.innerHTML = `
        <tr>
          <td colspan="${colSpan}" style="text-align:center; padding:36px 12px; color:var(--text-muted);">
            <div style="font-size:1.8rem; margin-bottom:6px;">📦</div>
            ${msg}
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = data.map(item => `
      <tr>
        <td style="font-weight:700; color:#991b1b; text-align:center;">${item.sl_no}</td>
        <td style="font-weight:600; color:#991b1b;">${escapeHtml(item.month)}</td>
        <td>${formatDate(item.date)}</td>
        <td style="font-weight:600; color:var(--accent);">${escapeHtml(item.igr_no || '—')}</td>
        <td>${escapeHtml(item.invoice_no_date || '—')}</td>
        <td><strong>${escapeHtml(item.supplier_name || '—')}</strong></td>
        <td>${escapeHtml(item.description || '—')}</td>
        <td>₹${item.material_value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        <td>₹${item.transport.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        <td>₹${item.labour_charges.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        <td style="font-weight:600;">₹${item.taxable_value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        <td>${(item.taxable_rate * 100).toFixed(0)}%</td>
        <td>₹${item.igst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        <td>₹${item.cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        <td>₹${item.sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        <td style="font-weight:700; color:var(--success);">₹${item.invoice_value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        ${isPurchaseUser ? `<td>
          <button class="btn btn-danger btn-sm" onclick="deleteIGREntry(${item.id})" style="padding:2px 8px; font-size:0.72rem;">Delete</button>
        </td>` : ''}
      </tr>
    `).join('');
  } catch (err) {
    showToast(`Error loading IGR: ${err.message}`, 'error');
  }
}

async function submitIGREntry() {
  if (currentUser && currentUser.role !== 'purchase') {
    showToast('Only Purchase Department users can create IGR entries', 'error');
    return;
  }

  const saveBtn = document.getElementById('save-igr-btn');
  const date = document.getElementById('igr-date').value;
  const igr_no = document.getElementById('igr-no').value.trim();
  const supplier_name = document.getElementById('igr-supplier-name').value.trim();

  if (!date) {
    showToast('Please select a Date', 'error');
    return;
  }

  const payload = {
    date,
    igr_no: igr_no || '—',
    invoice_no_date: document.getElementById('igr-invoice-no-date').value.trim(),
    supplier_name: supplier_name || '—',
    description: document.getElementById('igr-description').value.trim(),
    material_value: parseFloat(document.getElementById('igr-material-value').value) || 0,
    transport: parseFloat(document.getElementById('igr-transport').value) || 0,
    labour_charges: parseFloat(document.getElementById('igr-labour-charges').value) || 0,
    taxable_value: parseFloat(document.getElementById('igr-taxable-value').value) || 0,
    taxable_rate: document.getElementById('igr-tax-mode').value === 'custom' ? 0 : 0.18,
    igst: parseFloat(document.getElementById('igr-igst').value) || 0,
    cgst: parseFloat(document.getElementById('igr-cgst').value) || 0,
    sgst: parseFloat(document.getElementById('igr-sgst').value) || 0,
    invoice_value: parseFloat(document.getElementById('igr-invoice-value').value) || 0,
    branch: currentBranch
  };

  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving...';

  try {
    const res = await apiFetch('/purchase/igr', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (!res || !res.ok) {
      const err = res ? await res.json().catch(() => ({})) : {};
      throw new Error(err.error || `Server error (${res ? res.status : 'No response'})`);
    }

    showToast('IGR Entry created successfully', 'success');
    document.getElementById('modal-add-igr').classList.add('hidden');
    await loadIGREntries();
    await loadAbstractSummary();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save IGR Entry';
  }
}

async function deleteIGREntry(id) {
  if (currentUser && currentUser.role !== 'purchase') {
    showToast('Only Purchase Department users can delete IGR entries', 'error');
    return;
  }

  if (!confirm('Are you sure you want to delete this IGR entry?')) return;
  try {
    const res = await apiFetch(`/purchase/igr/${id}`, { method: 'DELETE' });
    if (!res || !res.ok) throw new Error('Failed to delete IGR entry');
    showToast('IGR Entry deleted', 'info');
    await loadIGREntries();
    await loadAbstractSummary();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ─── BPR CRUD ─────────────────────────────────────────────────────────────

async function loadBPREntries() {
  const tbody = document.getElementById('bpr-table-body');
  if (!tbody) return;

  const isPurchaseUser = currentUser && currentUser.role === 'purchase';
  const thAction = document.getElementById('th-bpr-actions');
  if (thAction) {
    if (isPurchaseUser) thAction.classList.remove('hidden');
    else thAction.classList.add('hidden');
  }

  try {
    const res = await apiFetch(`/purchase/bpr?branch=${currentBranch}`);
    if (!res || !res.ok) throw new Error('Failed to load BPR entries');
    const data = await res.json();
    currentBPREntries = data || [];

    if (!data || data.length === 0) {
      const colSpan = isPurchaseUser ? 18 : 17;
      const msg = isPurchaseUser 
        ? 'No BPR entries recorded yet. Click <strong>"New BPR Entry"</strong> to add an entry.'
        : 'No BPR entries recorded yet by the Purchase Department.';
      tbody.innerHTML = `
        <tr>
          <td colspan="${colSpan}" style="text-align:center; padding:36px 12px; color:var(--text-muted);">
            <div style="font-size:1.8rem; margin-bottom:6px;">📑</div>
            ${msg}
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = data.map(item => `
      <tr>
        <td style="font-weight:700; color:#991b1b; text-align:center;">${item.sl_no}</td>
        <td style="font-weight:600; color:#991b1b;">${escapeHtml(item.month)}</td>
        <td>${formatDate(item.date)}</td>
        <td style="font-weight:600; color:var(--accent);">${escapeHtml(item.bpr_no || '—')}</td>
        <td><strong>${escapeHtml(item.contractor_name || '—')}</strong></td>
        <td>${escapeHtml(item.job_work || '—')}</td>
        <td>${escapeHtml(item.supplier || '—')}</td>
        <td>${escapeHtml(item.invoice_no_date || '—')}</td>
        <td>${escapeHtml(item.particulars || '—')}</td>
        <td>${escapeHtml(item.description || '—')}</td>
        <td style="font-weight:600;">₹${item.taxable_value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        <td>${(item.taxable_rate * 100).toFixed(0)}%</td>
        <td>₹${item.igst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        <td>₹${item.cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        <td>₹${item.sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        <td style="font-weight:700; color:var(--success);">₹${item.invoice_value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        <td style="color:var(--text-muted); font-size:0.78rem;">${escapeHtml(item.remarks || '—')}</td>
        ${isPurchaseUser ? `<td>
          <button class="btn btn-danger btn-sm" onclick="deleteBPREntry(${item.id})" style="padding:2px 8px; font-size:0.72rem;">Delete</button>
        </td>` : ''}
      </tr>
    `).join('');
  } catch (err) {
    showToast(`Error loading BPR: ${err.message}`, 'error');
  }
}

async function submitBPREntry() {
  if (currentUser && currentUser.role !== 'purchase') {
    showToast('Only Purchase Department users can create BPR entries', 'error');
    return;
  }

  const saveBtn = document.getElementById('save-bpr-btn');
  const date = document.getElementById('bpr-date').value;
  const bpr_no = document.getElementById('bpr-no').value.trim();

  if (!date) {
    showToast('Please select a Date', 'error');
    return;
  }

  const payload = {
    date,
    bpr_no: bpr_no || '—',
    contractor_name: document.getElementById('bpr-contractor-name').value.trim(),
    job_work: document.getElementById('bpr-job-work').value.trim(),
    supplier: document.getElementById('bpr-supplier').value.trim(),
    invoice_no_date: document.getElementById('bpr-invoice-no-date').value.trim(),
    particulars: document.getElementById('bpr-particulars').value.trim(),
    description: document.getElementById('bpr-description').value.trim(),
    taxable_value: parseFloat(document.getElementById('bpr-taxable-value').value) || 0,
    taxable_rate: document.getElementById('bpr-tax-mode').value === 'custom' ? 0 : 0.18,
    igst: parseFloat(document.getElementById('bpr-igst').value) || 0,
    cgst: parseFloat(document.getElementById('bpr-cgst').value) || 0,
    sgst: parseFloat(document.getElementById('bpr-sgst').value) || 0,
    invoice_value: parseFloat(document.getElementById('bpr-invoice-value').value) || 0,
    remarks: document.getElementById('bpr-remarks').value.trim(),
    branch: currentBranch
  };

  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving...';

  try {
    const res = await apiFetch('/purchase/bpr', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (!res || !res.ok) {
      const err = res ? await res.json().catch(() => ({})) : {};
      throw new Error(err.error || `Server error (${res ? res.status : 'No response'})`);
    }

    showToast('BPR Entry created successfully', 'success');
    document.getElementById('modal-add-bpr').classList.add('hidden');
    await loadBPREntries();
    await loadAbstractSummary();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save BPR Entry';
  }
}

async function deleteBPREntry(id) {
  if (currentUser && currentUser.role !== 'purchase') {
    showToast('Only Purchase Department users can delete BPR entries', 'error');
    return;
  }

  if (!confirm('Are you sure you want to delete this BPR entry?')) return;
  try {
    const res = await apiFetch(`/purchase/bpr/${id}`, { method: 'DELETE' });
    if (!res || !res.ok) throw new Error('Failed to delete BPR entry');
    showToast('BPR Entry deleted', 'info');
    await loadBPREntries();
    await loadAbstractSummary();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ─── ABSTRACT SUMMARY MODULE ────────────────────────────────────────────────

async function loadAbstractSummary() {
  const igrBody = document.getElementById('abstract-igr-tbody');
  const bprBody = document.getElementById('abstract-bpr-tbody');

  if (!igrBody || !bprBody) return;

  try {
    const res = await apiFetch(`/purchase/abstract?branch=${currentBranch}`);
    if (!res || !res.ok) throw new Error('Failed to load Abstract summary');
    const data = await res.json();

    const { igr_summary, igr_grand_total, bpr_summary, bpr_grand_total } = data;

    // Render IGR Abstract
    igrBody.innerHTML = (igr_summary || []).map(row => `
      <tr>
        <td><strong>${escapeHtml(row.month)}</strong></td>
        <td style="text-align:right; font-family:monospace; font-weight:600;">
          ₹${row.total_value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </td>
      </tr>
    `).join('') + `
      <tr class="grand-total-row">
        <td>Grand Total</td>
        <td style="text-align:right; font-family:monospace;">
          ₹${(igr_grand_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </td>
      </tr>
    `;

    // Render BPR Abstract
    bprBody.innerHTML = (bpr_summary || []).map(row => `
      <tr>
        <td><strong>${escapeHtml(row.month)}</strong></td>
        <td style="text-align:right; font-family:monospace; font-weight:600;">
          ₹${row.total_value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </td>
      </tr>
    `).join('') + `
      <tr class="grand-total-row">
        <td>Grand Total</td>
        <td style="text-align:right; font-family:monospace;">
          ₹${(bpr_grand_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </td>
      </tr>
    `;

  } catch (err) {
    showToast(`Error loading Abstract: ${err.message}`, 'error');
  }
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  initPurchase();
});
