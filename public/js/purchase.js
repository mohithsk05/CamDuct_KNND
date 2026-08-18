/**
 * purchase.js — Purchase Department logic (Tab switching, IGR, BPR & Abstract modules)
 * Includes 48-hour edit window control, locked entries handling, Admin unlock requests, and real-time sync.
 */

let currentUser = null;
let currentBranch = 'maalur';
let activeMainTab = 'po';
let activeSubTab = 'igr';

let currentIGREntries = [];
let currentBPREntries = [];
let editingIGRId = null;
let editingBPRId = null;

const EDIT_WINDOW_MS = 48 * 60 * 60 * 1000; // 48 hours in milliseconds

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const tabMonthFilters = {
  po: 'all',
  wo: 'all',
  igr: 'all',
  bpr: 'all',
  low_stock: 'all'
};

function getActiveTabKey() {
  if (activeMainTab === 'inventory') {
    return activeSubTab; // 'igr', 'bpr', 'abstract'
  }
  return activeMainTab; // 'po', 'wo', 'low_stock', 'attendence'
}

function updateMonthFilterVisibility() {
  const container = document.getElementById('month-filter-container');
  const select = document.getElementById('month-filter-select');
  if (!container) return;

  const currentKey = getActiveTabKey();

  // Hide month filter on Attendance main tab OR on Abstract subtab
  if (currentKey === 'attendence' || currentKey === 'abstract') {
    container.classList.add('hidden');
    container.style.display = 'none';
  } else {
    container.classList.remove('hidden');
    container.style.display = 'flex';

    if (select) {
      select.value = tabMonthFilters[currentKey] || 'all';
    }
  }
}

function getRealTimeMonth(dateStr) {
  if (!dateStr) return MONTH_NAMES[new Date().getMonth()];
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return MONTH_NAMES[new Date().getMonth()];
  return MONTH_NAMES[d.getMonth()];
}

function getEntryMonthName(item) {
  if (item.month && MONTH_NAMES.includes(item.month)) {
    return item.month;
  }
  if (item.date) {
    const d = new Date(item.date);
    if (!isNaN(d.getTime())) {
      return MONTH_NAMES[d.getMonth()];
    }
  }
  if (item.created_at) {
    const d = new Date(item.created_at);
    if (!isNaN(d.getTime())) {
      return MONTH_NAMES[d.getMonth()];
    }
  }
  return MONTH_NAMES[new Date().getMonth()];
}

function filterEntriesBySelectedMonth(entries, selectedMonth) {
  if (!selectedMonth || selectedMonth.toLowerCase() === 'all') {
    return entries;
  }
  return entries.filter(item => {
    const itemMonth = getEntryMonthName(item);
    return itemMonth.toLowerCase() === selectedMonth.toLowerCase();
  });
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

  updateMonthFilterVisibility();

  // Initial load
  await loadIGREntries();
  await loadBPREntries();
  await loadAbstractSummary();

  // Real-time periodic auto-refresh every 5 seconds to sync lock/unlock states dynamically
  setInterval(async () => {
    if (document.visibilityState === 'visible') {
      await loadIGREntries(true);
      await loadBPREntries(true);
    }
  }, 5000);
}

/** Apply RBAC: "+ New Entry" buttons & editing only for Purchase department users or Admins */
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

  const monthSelect = document.getElementById('month-filter-select');
  if (monthSelect) {
    monthSelect.addEventListener('change', async () => {
      const activeKey = getActiveTabKey();
      tabMonthFilters[activeKey] = monthSelect.value;

      if (activeKey === 'igr') {
        await loadIGREntries();
      } else if (activeKey === 'bpr') {
        await loadBPREntries();
      } else {
        updateTabMonthNotices();
      }

      const monthLabel = monthSelect.value === 'all' ? 'All Months' : monthSelect.value;
      showToast(`Filtered ${activeKey.toUpperCase()} tab by ${monthLabel}`, 'info');
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
        updateMonthFilterVisibility();
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

  updateMonthFilterVisibility();

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

  // Save / Update IGR
  if (saveIGRBtn) {
    saveIGRBtn.addEventListener('click', submitIGREntry);
  }

  // Save / Update BPR
  if (saveBPRBtn) {
    saveBPRBtn.addEventListener('click', submitBPREntry);
  }
}

function resetIGRForm() {
  editingIGRId = null;
  const title = document.getElementById('igr-modal-title');
  const saveBtn = document.getElementById('save-igr-btn');
  if (title) title.textContent = 'New IGR Entry (Inward Goods Receipt)';
  if (saveBtn) saveBtn.textContent = 'Save IGR Entry';

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

function setElValue(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

function resetBPRForm() {
  editingBPRId = null;
  const title = document.getElementById('bpr-modal-title');
  const saveBtn = document.getElementById('save-bpr-btn');
  if (title) title.textContent = 'New BPR Entry';
  if (saveBtn) saveBtn.textContent = 'Save BPR Entry';

  const today = new Date().toISOString().split('T')[0];
  setElValue('bpr-date', today);
  setElValue('bpr-month-preview', getRealTimeMonth(today));
  setElValue('bpr-no', '');
  setElValue('bpr-contractor-name', '');
  setElValue('bpr-job-work', '');
  setElValue('bpr-supplier', '');
  setElValue('bpr-invoice-no-date', '');
  setElValue('bpr-particulars', '');
  setElValue('bpr-description', '');
  setElValue('bpr-taxable-value', '');
  setElValue('bpr-tax-mode', 'igst18');
  setElValue('bpr-igst', '');
  setElValue('bpr-cgst', '');
  setElValue('bpr-sgst', '');
  setElValue('bpr-invoice-value', '');
  setElValue('bpr-remarks', '');
}

function calculateBPRForm() {
  const taxableEl = document.getElementById('bpr-taxable-value');
  const taxable = taxableEl ? parseFloat(taxableEl.value) || 0 : 0;

  const taxModeEl = document.getElementById('bpr-tax-mode');
  const taxMode = taxModeEl ? taxModeEl.value : 'igst18';
  let igst = 0, cgst = 0, sgst = 0;

  if (taxMode === 'igst18') {
    igst = taxable * 0.18;
    setElValue('bpr-igst', igst > 0 ? igst.toFixed(2) : '0.00');
    setElValue('bpr-cgst', '0.00');
    setElValue('bpr-sgst', '0.00');
  } else if (taxMode === 'cgst9_sgst9') {
    cgst = taxable * 0.09;
    sgst = taxable * 0.09;
    setElValue('bpr-igst', '0.00');
    setElValue('bpr-cgst', cgst > 0 ? cgst.toFixed(2) : '0.00');
    setElValue('bpr-sgst', sgst > 0 ? sgst.toFixed(2) : '0.00');
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

// ─── 48-HOUR EDIT STATUS & ACTIONS RENDERER ────────────────────────────────

// ─── 48-HOUR EDIT STATUS & ACTIONS RENDERER ────────────────────────────────

function renderIGRActionsHtml(item) {
  const isPurchaseUser = currentUser && currentUser.role === 'purchase';
  const isAdminUser = currentUser && (currentUser.role === 'admin' || currentUser.hasAdminPower);
  const isManagerUser = currentUser && currentUser.role === 'manager';

  if (!isPurchaseUser && !isAdminUser && !isManagerUser) return '';

  const createdTime = new Date(item.created_at || item.date).getTime();
  const now = Date.now();
  const ageMs = now - createdTime;
  const isWithin48h = !isNaN(createdTime) && ageMs <= EDIT_WINDOW_MS;
  const hoursLeft = isWithin48h ? Math.ceil((EDIT_WINDOW_MS - ageMs) / (1000 * 60 * 60)) : 0;

  // Manager View: Action column shows ONLY the real-time status/time badge (nothing else)
  if (isManagerUser) {
    if (item.is_unlocked) {
      return `
        <div style="display:flex; align-items:center; justify-content:flex-start;">
          <span style="display:inline-block; padding:4px 10px; border-radius:12px; background:#dcfce7; color:#15803d; font-size:0.75rem; font-weight:600; white-space:nowrap;">🔓 Unlocked</span>
        </div>
      `;
    }
    if (item.edit_requested) {
      return `
        <div style="display:flex; align-items:center; justify-content:flex-start;">
          <span style="display:inline-block; padding:4px 10px; border-radius:12px; background:#fef3c7; color:#b45309; font-size:0.75rem; font-weight:600; white-space:nowrap;">⏳ Requested</span>
        </div>
      `;
    }
    if (isWithin48h) {
      return `
        <div style="display:flex; align-items:center; justify-content:flex-start;">
          <span style="display:inline-block; padding:4px 10px; border-radius:12px; background:#e0e7ff; color:#3730a3; font-size:0.75rem; font-weight:600; white-space:nowrap;">⏱️ ${hoursLeft}h left</span>
        </div>
      `;
    }
    return `
      <div style="display:flex; align-items:center; justify-content:flex-start;">
        <span style="display:inline-block; padding:4px 10px; border-radius:12px; background:#f3f4f6; color:#4b5563; font-size:0.75rem; font-weight:600; white-space:nowrap;">🔒 Locked</span>
      </div>
    `;
  }

  // Admin View: NO Edit or Delete options. Admin ONLY sees status/time badge (e.g. 31h left), or Approve Edit button if edit is requested by Purchase.
  if (isAdminUser) {
    if (item.edit_requested) {
      return `
        <div style="display:flex; align-items:center; gap:6px; flex-wrap:nowrap;">
          <span style="display:inline-block; padding:4px 10px; border-radius:12px; background:#fef3c7; color:#b45309; font-size:0.75rem; font-weight:600; white-space:nowrap;">⏳ Edit Requested</span>
          <button class="btn btn-warning btn-sm" onclick="approveUnlockEntry('igr', ${item.id})" style="padding:3px 10px; font-size:0.75rem; background:#f59e0b; color:#fff; border:none; border-radius:6px; white-space:nowrap; cursor:pointer;">Approve Edit</button>
        </div>
      `;
    }
    if (item.is_unlocked) {
      return `
        <div style="display:flex; align-items:center; gap:6px; flex-wrap:nowrap;">
          <span style="display:inline-block; padding:4px 10px; border-radius:12px; background:#dcfce7; color:#15803d; font-size:0.75rem; font-weight:600; white-space:nowrap;">🔓 Unlocked</span>
          <button class="btn btn-outline btn-sm" onclick="lockEntry('igr', ${item.id})" style="padding:3px 8px; font-size:0.75rem; white-space:nowrap; cursor:pointer;">Lock</button>
        </div>
      `;
    }
    return `
      <div style="display:flex; align-items:center; justify-content:flex-start;">
        <span style="display:inline-block; padding:4px 10px; border-radius:12px; background:${isWithin48h ? '#e0e7ff' : '#f3f4f6'}; color:${isWithin48h ? '#3730a3' : '#4b5563'}; font-size:0.75rem; font-weight:600; white-space:nowrap;">${isWithin48h ? `⏱️ ${hoursLeft}h left` : '🔒 Locked'}</span>
      </div>
    `;
  }

  // Purchase Department user: Neat inline layout with Edit/Delete options when within 48h or unlocked
  if (item.is_unlocked) {
    return `
      <div style="display:flex; align-items:center; gap:6px; flex-wrap:nowrap;">
        <span style="display:inline-block; padding:4px 8px; border-radius:12px; background:#dcfce7; color:#15803d; font-size:0.75rem; font-weight:600; white-space:nowrap;">🔓 Unlocked</span>
        <button class="btn btn-primary btn-sm" onclick="openEditIGRModal(${item.id})" style="padding:3px 8px; font-size:0.75rem; white-space:nowrap;">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteIGREntry(${item.id})" style="padding:3px 8px; font-size:0.75rem; white-space:nowrap;">Delete</button>
      </div>
    `;
  }

  if (isWithin48h) {
    return `
      <div style="display:flex; align-items:center; gap:6px; flex-wrap:nowrap;">
        <span style="display:inline-block; padding:4px 8px; border-radius:12px; background:#e0e7ff; color:#3730a3; font-size:0.75rem; font-weight:600; white-space:nowrap;" title="Editable within 48h of creation">⏱️ ${hoursLeft}h left</span>
        <button class="btn btn-primary btn-sm" onclick="openEditIGRModal(${item.id})" style="padding:3px 8px; font-size:0.75rem; white-space:nowrap;">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteIGREntry(${item.id})" style="padding:3px 8px; font-size:0.75rem; white-space:nowrap;">Delete</button>
      </div>
    `;
  }

  if (item.edit_requested) {
    return `
      <div style="display:flex; align-items:center; gap:6px; flex-wrap:nowrap;">
        <span style="display:inline-block; padding:4px 10px; border-radius:12px; background:#fef3c7; color:#b45309; font-size:0.75rem; font-weight:600; white-space:nowrap;">⏳ Requested (Pending Admin)</span>
      </div>
    `;
  }

  return `
    <div style="display:flex; align-items:center; gap:6px; flex-wrap:nowrap;">
      <span style="display:inline-block; padding:4px 8px; border-radius:12px; background:#fee2e2; color:#991b1b; font-size:0.75rem; font-weight:600; white-space:nowrap;">🔒 Locked</span>
      <button class="btn btn-warning btn-sm" onclick="requestEditAccess('igr', ${item.id})" style="padding:3px 10px; font-size:0.75rem; background:#f59e0b; color:#fff; border:none; border-radius:6px; white-space:nowrap; cursor:pointer;">Request Edit</button>
    </div>
  `;
}

function renderBPRActionsHtml(item) {
  const isPurchaseUser = currentUser && currentUser.role === 'purchase';
  const isAdminUser = currentUser && (currentUser.role === 'admin' || currentUser.hasAdminPower);
  const isManagerUser = currentUser && currentUser.role === 'manager';

  if (!isPurchaseUser && !isAdminUser && !isManagerUser) return '';

  const createdTime = new Date(item.created_at || item.date).getTime();
  const now = Date.now();
  const ageMs = now - createdTime;
  const isWithin48h = !isNaN(createdTime) && ageMs <= EDIT_WINDOW_MS;
  const hoursLeft = isWithin48h ? Math.ceil((EDIT_WINDOW_MS - ageMs) / (1000 * 60 * 60)) : 0;

  // Manager View: Action column shows ONLY the real-time status/time badge (nothing else)
  if (isManagerUser) {
    if (item.is_unlocked) {
      return `
        <div style="display:flex; align-items:center; justify-content:flex-start;">
          <span style="display:inline-block; padding:4px 10px; border-radius:12px; background:#dcfce7; color:#15803d; font-size:0.75rem; font-weight:600; white-space:nowrap;">🔓 Unlocked</span>
        </div>
      `;
    }
    if (item.edit_requested) {
      return `
        <div style="display:flex; align-items:center; justify-content:flex-start;">
          <span style="display:inline-block; padding:4px 10px; border-radius:12px; background:#fef3c7; color:#b45309; font-size:0.75rem; font-weight:600; white-space:nowrap;">⏳ Requested</span>
        </div>
      `;
    }
    if (isWithin48h) {
      return `
        <div style="display:flex; align-items:center; justify-content:flex-start;">
          <span style="display:inline-block; padding:4px 10px; border-radius:12px; background:#e0e7ff; color:#3730a3; font-size:0.75rem; font-weight:600; white-space:nowrap;">⏱️ ${hoursLeft}h left</span>
        </div>
      `;
    }
    return `
      <div style="display:flex; align-items:center; justify-content:flex-start;">
        <span style="display:inline-block; padding:4px 10px; border-radius:12px; background:#f3f4f6; color:#4b5563; font-size:0.75rem; font-weight:600; white-space:nowrap;">🔒 Locked</span>
      </div>
    `;
  }

  // Admin View: NO Edit or Delete options. Admin ONLY sees status/time badge (e.g. 31h left), or Approve Edit button if edit is requested by Purchase.
  if (isAdminUser) {
    if (item.edit_requested) {
      return `
        <div style="display:flex; align-items:center; gap:6px; flex-wrap:nowrap;">
          <span style="display:inline-block; padding:4px 10px; border-radius:12px; background:#fef3c7; color:#b45309; font-size:0.75rem; font-weight:600; white-space:nowrap;">⏳ Edit Requested</span>
          <button class="btn btn-warning btn-sm" onclick="approveUnlockEntry('bpr', ${item.id})" style="padding:3px 10px; font-size:0.75rem; background:#f59e0b; color:#fff; border:none; border-radius:6px; white-space:nowrap; cursor:pointer;">Approve Edit</button>
        </div>
      `;
    }
    if (item.is_unlocked) {
      return `
        <div style="display:flex; align-items:center; gap:6px; flex-wrap:nowrap;">
          <span style="display:inline-block; padding:4px 10px; border-radius:12px; background:#dcfce7; color:#15803d; font-size:0.75rem; font-weight:600; white-space:nowrap;">🔓 Unlocked</span>
          <button class="btn btn-outline btn-sm" onclick="lockEntry('bpr', ${item.id})" style="padding:3px 8px; font-size:0.75rem; white-space:nowrap; cursor:pointer;">Lock</button>
        </div>
      `;
    }
    return `
      <div style="display:flex; align-items:center; justify-content:flex-start;">
        <span style="display:inline-block; padding:4px 10px; border-radius:12px; background:${isWithin48h ? '#e0e7ff' : '#f3f4f6'}; color:${isWithin48h ? '#3730a3' : '#4b5563'}; font-size:0.75rem; font-weight:600; white-space:nowrap;">${isWithin48h ? `⏱️ ${hoursLeft}h left` : '🔒 Locked'}</span>
      </div>
    `;
  }

  // Purchase Department user: Neat inline layout with Edit/Delete options when within 48h or unlocked
  if (item.is_unlocked) {
    return `
      <div style="display:flex; align-items:center; gap:6px; flex-wrap:nowrap;">
        <span style="display:inline-block; padding:4px 8px; border-radius:12px; background:#dcfce7; color:#15803d; font-size:0.75rem; font-weight:600; white-space:nowrap;">🔓 Unlocked</span>
        <button class="btn btn-primary btn-sm" onclick="openEditBPRModal(${item.id})" style="padding:3px 8px; font-size:0.75rem; white-space:nowrap;">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteBPREntry(${item.id})" style="padding:3px 8px; font-size:0.75rem; white-space:nowrap;">Delete</button>
      </div>
    `;
  }

  if (isWithin48h) {
    return `
      <div style="display:flex; align-items:center; gap:6px; flex-wrap:nowrap;">
        <span style="display:inline-block; padding:4px 8px; border-radius:12px; background:#e0e7ff; color:#3730a3; font-size:0.75rem; font-weight:600; white-space:nowrap;" title="Editable within 48h of creation">⏱️ ${hoursLeft}h left</span>
        <button class="btn btn-primary btn-sm" onclick="openEditBPRModal(${item.id})" style="padding:3px 8px; font-size:0.75rem; white-space:nowrap;">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteBPREntry(${item.id})" style="padding:3px 8px; font-size:0.75rem; white-space:nowrap;">Delete</button>
      </div>
    `;
  }

  if (item.edit_requested) {
    return `
      <div style="display:flex; align-items:center; gap:6px; flex-wrap:nowrap;">
        <span style="display:inline-block; padding:4px 10px; border-radius:12px; background:#fef3c7; color:#b45309; font-size:0.75rem; font-weight:600; white-space:nowrap;">⏳ Requested (Pending Admin)</span>
      </div>
    `;
  }

  return `
    <div style="display:flex; align-items:center; gap:6px; flex-wrap:nowrap;">
      <span style="display:inline-block; padding:4px 8px; border-radius:12px; background:#fee2e2; color:#991b1b; font-size:0.75rem; font-weight:600; white-space:nowrap;">🔒 Locked</span>
      <button class="btn btn-warning btn-sm" onclick="requestEditAccess('bpr', ${item.id})" style="padding:3px 10px; font-size:0.75rem; background:#f59e0b; color:#fff; border:none; border-radius:6px; white-space:nowrap; cursor:pointer;">Request Edit</button>
    </div>
  `;
}

// ─── IGR CRUD ─────────────────────────────────────────────────────────────

async function loadIGREntries(silent = false) {
  const tbody = document.getElementById('igr-table-body');
  if (!tbody) return;

  const isPurchaseUser = currentUser && currentUser.role === 'purchase';
  const isAdminUser = currentUser && (currentUser.role === 'admin' || currentUser.hasAdminPower);
  const isManagerUser = currentUser && currentUser.role === 'manager';
  const showActions = isPurchaseUser || isAdminUser || isManagerUser;

  const thAction = document.getElementById('th-igr-actions');
  if (thAction) {
    if (showActions) thAction.classList.remove('hidden');
    else thAction.classList.add('hidden');
  }

  const selectedMonth = tabMonthFilters['igr'] || 'all';

  try {
    const res = await apiFetch(`/purchase/igr?branch=${currentBranch}&month=${selectedMonth}`);
    if (!res || !res.ok) throw new Error('Failed to load IGR entries');
    const data = await res.json();

    const filteredData = filterEntriesBySelectedMonth(data || [], selectedMonth);
    currentIGREntries = filteredData;

    if (!filteredData || filteredData.length === 0) {
      const colSpan = showActions ? 17 : 16;
      const monthText = selectedMonth === 'all' ? '' : ` for <strong>${escapeHtml(selectedMonth)}</strong>`;
      const msg = isPurchaseUser
        ? `No IGR entries recorded yet${monthText}. Click <strong>"New IGR Entry"</strong> to add an entry.`
        : `No IGR entries recorded yet${monthText} by the Purchase Department.`;
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

    tbody.innerHTML = filteredData.map((item, idx) => `
      <tr>
        <td style="font-weight:700; color:#991b1b; text-align:center;">${idx + 1}</td>
        <td style="font-weight:600; color:#991b1b;">${escapeHtml(item.month || getRealTimeMonth(item.date))}</td>
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
        ${showActions ? `<td>${renderIGRActionsHtml(item)}</td>` : ''}
      </tr>
    `).join('');
  } catch (err) {
    if (!silent) showToast(`Error loading IGR: ${err.message}`, 'error');
  }
}

function openEditIGRModal(id) {
  const item = currentIGREntries.find(x => String(x.id) === String(id));
  if (!item) return;

  editingIGRId = id;
  const modal = document.getElementById('modal-add-igr');
  const title = document.getElementById('igr-modal-title');
  const saveBtn = document.getElementById('save-igr-btn');

  if (title) title.textContent = `Edit IGR Entry (#${item.sl_no})`;
  if (saveBtn) saveBtn.textContent = 'Update IGR Entry';

  const slPreview = document.getElementById('igr-sl-no-preview');
  if (slPreview) slPreview.value = `#${item.sl_no}`;

  document.getElementById('igr-date').value = item.date ? item.date.split('T')[0] : '';
  document.getElementById('igr-month-preview').value = item.month || getRealTimeMonth(item.date);
  document.getElementById('igr-no').value = item.igr_no || '';
  document.getElementById('igr-invoice-no-date').value = item.invoice_no_date || '';
  document.getElementById('igr-supplier-name').value = item.supplier_name || '';
  document.getElementById('igr-description').value = item.description || '';
  document.getElementById('igr-material-value').value = item.material_value || '';
  document.getElementById('igr-transport').value = item.transport || '';
  document.getElementById('igr-labour-charges').value = item.labour_charges || '';
  document.getElementById('igr-taxable-value').value = item.taxable_value || '';
  document.getElementById('igr-igst').value = item.igst || '';
  document.getElementById('igr-cgst').value = item.cgst || '';
  document.getElementById('igr-sgst').value = item.sgst || '';
  document.getElementById('igr-invoice-value').value = item.invoice_value || '';

  modal && modal.classList.remove('hidden');
}

async function submitIGREntry() {
  const isPurchaseUser = currentUser && currentUser.role === 'purchase';
  const isAdminUser = currentUser && (currentUser.role === 'admin' || currentUser.hasAdminPower);

  if (!isPurchaseUser && !isAdminUser) {
    showToast('Only Purchase Department users or Admin can save IGR entries', 'error');
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
  saveBtn.textContent = editingIGRId ? 'Updating...' : 'Saving...';

  try {
    const isEdit = editingIGRId !== null;
    const url = isEdit ? `/purchase/igr/${editingIGRId}` : '/purchase/igr';
    const method = isEdit ? 'PUT' : 'POST';

    const res = await apiFetch(url, {
      method,
      body: JSON.stringify(payload)
    });
    if (!res || !res.ok) {
      const err = res ? await res.json().catch(() => ({})) : {};
      throw new Error(err.error || `Server error (${res ? res.status : 'No response'})`);
    }

    showToast(isEdit ? 'IGR Entry updated successfully' : 'IGR Entry created successfully', 'success');
    document.getElementById('modal-add-igr').classList.add('hidden');
    resetIGRForm();
    await loadIGREntries();
    await loadAbstractSummary();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = editingIGRId ? 'Update IGR Entry' : 'Save IGR Entry';
  }
}

async function deleteIGREntry(id) {
  const isPurchaseUser = currentUser && currentUser.role === 'purchase';
  const isAdminUser = currentUser && (currentUser.role === 'admin' || currentUser.hasAdminPower);

  if (!isPurchaseUser && !isAdminUser) {
    showToast('Only Purchase Department users or Admin can delete IGR entries', 'error');
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

async function loadBPREntries(silent = false) {
  const tbody = document.getElementById('bpr-table-body');
  if (!tbody) return;

  const isPurchaseUser = currentUser && currentUser.role === 'purchase';
  const isAdminUser = currentUser && (currentUser.role === 'admin' || currentUser.hasAdminPower);
  const isManagerUser = currentUser && currentUser.role === 'manager';
  const showActions = isPurchaseUser || isAdminUser || isManagerUser;

  const thAction = document.getElementById('th-bpr-actions');
  if (thAction) {
    if (showActions) thAction.classList.remove('hidden');
    else thAction.classList.add('hidden');
  }

  const selectedMonth = tabMonthFilters['bpr'] || 'all';

  try {
    const res = await apiFetch(`/purchase/bpr?branch=${currentBranch}&month=${selectedMonth}`);
    if (!res || !res.ok) throw new Error('Failed to load BPR entries');
    const data = await res.json();

    const filteredData = filterEntriesBySelectedMonth(data || [], selectedMonth);
    currentBPREntries = filteredData;

    if (!filteredData || filteredData.length === 0) {
      const colSpan = showActions ? 18 : 17;
      const monthText = selectedMonth === 'all' ? '' : ` for <strong>${escapeHtml(selectedMonth)}</strong>`;
      const msg = isPurchaseUser
        ? `No BPR entries recorded yet${monthText}. Click <strong>"New BPR Entry"</strong> to add an entry.`
        : `No BPR entries recorded yet${monthText} by the Purchase Department.`;
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

    tbody.innerHTML = filteredData.map((item, idx) => `
      <tr>
        <td style="font-weight:700; color:#991b1b; text-align:center;">${idx + 1}</td>
        <td style="font-weight:600; color:#991b1b;">${escapeHtml(item.month || getRealTimeMonth(item.date))}</td>
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
        ${showActions ? `<td>${renderBPRActionsHtml(item)}</td>` : ''}
      </tr>
    `).join('');
  } catch (err) {
    if (!silent) showToast(`Error loading BPR: ${err.message}`, 'error');
  }
}

function openEditBPRModal(id) {
  const item = currentBPREntries.find(x => String(x.id) === String(id));
  if (!item) return;

  editingBPRId = id;
  const modal = document.getElementById('modal-add-bpr');
  const title = document.getElementById('bpr-modal-title');
  const saveBtn = document.getElementById('save-bpr-btn');

  if (title) title.textContent = `Edit BPR Entry (#${item.sl_no})`;
  if (saveBtn) saveBtn.textContent = 'Update BPR Entry';

  const slPreview = document.getElementById('bpr-sl-no-preview');
  if (slPreview) slPreview.value = `#${item.sl_no}`;

  document.getElementById('bpr-date').value = item.date ? item.date.split('T')[0] : '';
  document.getElementById('bpr-month-preview').value = item.month || getRealTimeMonth(item.date);
  document.getElementById('bpr-no').value = item.bpr_no || '';
  document.getElementById('bpr-contractor-name').value = item.contractor_name || '';
  document.getElementById('bpr-job-work').value = item.job_work || '';
  document.getElementById('bpr-supplier').value = item.supplier || '';
  document.getElementById('bpr-invoice-no-date').value = item.invoice_no_date || '';
  document.getElementById('bpr-particulars').value = item.particulars || '';
  document.getElementById('bpr-description').value = item.description || '';
  document.getElementById('bpr-taxable-value').value = item.taxable_value || '';
  document.getElementById('bpr-igst').value = item.igst || '';
  document.getElementById('bpr-cgst').value = item.cgst || '';
  document.getElementById('bpr-sgst').value = item.sgst || '';
  document.getElementById('bpr-invoice-value').value = item.invoice_value || '';
  document.getElementById('bpr-remarks').value = item.remarks || '';

  modal && modal.classList.remove('hidden');
}

async function submitBPREntry() {
  const isPurchaseUser = currentUser && currentUser.role === 'purchase';
  const isAdminUser = currentUser && (currentUser.role === 'admin' || currentUser.hasAdminPower);

  if (!isPurchaseUser && !isAdminUser) {
    showToast('Only Purchase Department users or Admin can save BPR entries', 'error');
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
  saveBtn.textContent = editingBPRId ? 'Updating...' : 'Saving...';

  try {
    const isEdit = editingBPRId !== null;
    const url = isEdit ? `/purchase/bpr/${editingBPRId}` : '/purchase/bpr';
    const method = isEdit ? 'PUT' : 'POST';

    const res = await apiFetch(url, {
      method,
      body: JSON.stringify(payload)
    });
    if (!res || !res.ok) {
      const err = res ? await res.json().catch(() => ({})) : {};
      throw new Error(err.error || `Server error (${res ? res.status : 'No response'})`);
    }

    showToast(isEdit ? 'BPR Entry updated successfully' : 'BPR Entry created successfully', 'success');
    document.getElementById('modal-add-bpr').classList.add('hidden');
    resetBPRForm();
    await loadBPREntries();
    await loadAbstractSummary();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = editingBPRId ? 'Update BPR Entry' : 'Save BPR Entry';
  }
}

async function deleteBPREntry(id) {
  const isPurchaseUser = currentUser && currentUser.role === 'purchase';
  const isAdminUser = currentUser && (currentUser.role === 'admin' || currentUser.hasAdminPower);

  if (!isPurchaseUser && !isAdminUser) {
    showToast('Only Purchase Department users or Admin can delete BPR entries', 'error');
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

// ─── REQUEST & UNLOCK HANDLERS ──────────────────────────────────────────────

async function requestEditAccess(type, id) {
  if (currentUser && currentUser.role !== 'purchase') {
    showToast('Only Purchase Department users can request edit access', 'error');
    return;
  }
  try {
    const res = await apiFetch(`/purchase/${type}/${id}/request-edit`, { method: 'POST' });
    if (!res || !res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to request edit access');
    }
    showToast('Edit access request sent to Admin in real time', 'success');
    if (type === 'igr') await loadIGREntries();
    else await loadBPREntries();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function approveUnlockEntry(type, id) {
  const isAdminUser = currentUser && (currentUser.role === 'admin' || currentUser.hasAdminPower);
  if (!isAdminUser) {
    showToast('Only Admin users can grant edit access', 'error');
    return;
  }
  try {
    const res = await apiFetch(`/purchase/${type}/${id}/unlock-edit`, { method: 'POST' });
    if (!res || !res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to unlock entry');
    }
    showToast('Edit access granted to Purchase Department', 'success');
    if (type === 'igr') await loadIGREntries();
    else await loadBPREntries();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function lockEntry(type, id) {
  const isAdminUser = currentUser && (currentUser.role === 'admin' || currentUser.hasAdminPower);
  if (!isAdminUser) {
    showToast('Only Admin users can lock entries', 'error');
    return;
  }
  try {
    const res = await apiFetch(`/purchase/${type}/${id}/lock-edit`, { method: 'POST' });
    if (!res || !res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to lock entry');
    }
    showToast('Entry edit access locked', 'info');
    if (type === 'igr') await loadIGREntries();
    else await loadBPREntries();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Bind handlers to global window object for inline table button onclick events
window.openEditIGRModal = openEditIGRModal;
window.openEditBPRModal = openEditBPRModal;
window.deleteIGREntry = deleteIGREntry;
window.deleteBPREntry = deleteBPREntry;
window.requestEditAccess = requestEditAccess;
window.approveUnlockEntry = approveUnlockEntry;
window.lockEntry = lockEntry;

function updateTabMonthNotices() {
  const currentKey = getActiveTabKey();
  const selectedMonth = tabMonthFilters[currentKey] || 'all';
  const monthText = selectedMonth === 'all' ? 'All Months' : selectedMonth;
  document.querySelectorAll('.purchase-placeholder-box').forEach(box => {
    let notice = box.querySelector('.month-filter-notice');
    if (!notice) {
      notice = document.createElement('div');
      notice.className = 'month-filter-notice';
      notice.style.marginTop = '12px';
      notice.style.fontSize = '0.82rem';
      notice.style.fontWeight = '600';
      notice.style.color = '#4338ca';
      notice.style.background = '#e0e7ff';
      notice.style.padding = '4px 12px';
      notice.style.borderRadius = '12px';
      notice.style.display = 'inline-block';
      box.appendChild(notice);
    }
    notice.textContent = `📅 Month Filter: ${monthText}`;
  });
}

// ─── ABSTRACT SUMMARY MODULE ────────────────────────────────────────────────

let currentAbstractYear = 2026;

function populateAbstractYearDropdown() {
  const select = document.getElementById('abstract-year-select');
  if (!select) return;
  if (select.children.length === 0) {
    const fragment = document.createDocumentFragment();
    for (let y = 2026; y <= 2076; y++) {
      const opt = document.createElement('option');
      opt.value = y;
      opt.textContent = y;
      fragment.appendChild(opt);
    }
    select.appendChild(fragment);

    select.addEventListener('change', () => {
      currentAbstractYear = parseInt(select.value, 10);
      loadAbstractSummary();
      showToast(`Abstract summary updated for year ${currentAbstractYear}`, 'info');
    });
  }

  select.value = currentAbstractYear;
}

async function loadAbstractSummary() {
  populateAbstractYearDropdown();
  const igrBody = document.getElementById('abstract-igr-tbody');
  const bprBody = document.getElementById('abstract-bpr-tbody');

  if (!igrBody || !bprBody) return;

  igrBody.innerHTML = `<tr><td colspan="2" style="text-align:center; padding:16px; color:var(--text-muted);"><span class="spinner"></span> Loading ${currentAbstractYear} abstract...</td></tr>`;
  bprBody.innerHTML = `<tr><td colspan="2" style="text-align:center; padding:16px; color:var(--text-muted);"><span class="spinner"></span> Loading ${currentAbstractYear} abstract...</td></tr>`;

  try {
    const res = await apiFetch(`/purchase/abstract?branch=${currentBranch}&year=${currentAbstractYear}&_t=${Date.now()}`);
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
        <td>Grand Total (${currentAbstractYear})</td>
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
        <td>Grand Total (${currentAbstractYear})</td>
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
