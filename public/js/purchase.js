/**
 * purchase.js — Purchase Department logic (Tab switching, IGR, BPR & Abstract modules)
 * Includes 48-hour edit window control, locked entries handling, Admin unlock requests, and real-time sync.
 */

let currentUser = null;
let currentBranch = 'maalur';
let activeMainTab = 'po';
let activeSubTab = 'igr';

let currentPOEntries = [];
let currentIGREntries = [];
let currentBPREntries = [];
let editingPOId = null;
let editingIGRId = null;
let editingBPRId = null;

const EDIT_WINDOW_MS = 48 * 60 * 60 * 1000; // 48 hours in milliseconds

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const PREDEFINED_MAKES = [
  "JSW", "AMNS", "Uttam", "TATA", "XLPE", "Neoprene", "Urja", "K Flex",
  "Thermobreak", "Supreme", "Airofoam", "Armaflex", "Armasound", "Aerocell",
  "Superlon", "Boss GP 122", "Sealant Tube", "Paramount"
];

const PREDEFINED_RAW_MATERIALS = [
  "120gsm 26G", "120gsm 24G", "120gsm 22G", "120gsm 20G", "120gsm 18G", "120gsm 16G",
  "180gsm 26G", "180gsm 24G", "180gsm 22G", "180gsm 20G", "180gsm 18G", "180gsm 16G",
  "275gsm 26G", "275gsm 24G", "275gsm 22G", "275gsm 20G", "275gsm 18G", "275gsm 16G",
  "120gsm Slit 26G", "120gsm Slit 24G", "120gsm Slit 22G", "120gsm Slit 20G", "120gsm Slit 18G",
  "H Bracket", "Neoprene Gasket", "XLPE Gasket", "Cleats", "Corner 32mm", "Corner 25mm",
  "Sealant Tube", "Silicon Tube", "Sealant Bucket",
  "Alu. 0.8mm", "Alu. 1mm", "Alu. 1.2mm", "Alu. Rod 10mm",
  "SS 22G", "SS 20G", "SS 18G", "SS 16G",
  "Insu Kflex Thermal 6mm", "Insu Kflex Thermal 9mm", "Insu Kflex Thermal 13mm", "Insu Kflex Thermal 16mm", "Insu Kflex Thermal 19mm", "Insu Kflex Thermal 25mm", "Insu Kflex Thermal 32mm",
  "Insu Kflex Thermal 6mm Al. Foil", "Insu Kflex Thermal 9mm Al. Foil", "Insu Kflex Thermal 13mm Al. Foil", "Insu Kflex Thermal 16mm Al. Foil", "Insu Kflex Thermal 19mm Al. Foil",
  "Insu Kflex 10mm Acou.", "Insu Kflex 15mm Acou.", "Insu Thermal Tape",
  "Insu Supreme Thermal 9mm", "Insu Supreme Thermal 13mm", "Insu Supreme Thermal 16mm", "Insu Supreme Thermal 13mm Al. Foil", "Insu Supreme Thermal 19mm Al. Foil", "Insu Supreme Thermal 25mm Al. Foil", "Insu Supreme 10mm Acou.", "Insu Supreme 15mm Acou.",
  "Insu Airofoam Thermal 19mm Al. Foil",
  "Insu Armaflex Thermal 6mm", "Insu Armaflex Thermal 25mm", "Insu Armaflex Thermal 19mm Al. Foil", "Insu Armaflex Thermal 25mm Al. Foil",
  "Insu Armasound Acou. 10mm", "Insu Armasound Acou. 15mm", "Insu Armasound Acou. 25mm",
  "Insu Aerocell Thermal 16mm", "Insu Aerocell Thermal 32mm (GC-CLOTH)", "Insu Aerocell Acou. 15mm",
  "Bubble Wrap", "Stretch Film", "MS Angle 25x25x5mm", "8 mm JTR", "10 mm JTR", "Gasket XLPE 10mm", "Bright Rod 8mm", "Bright Rod 10mm", "VCD Handle 20g", "Gear 150 Dia", "Inner Bush", "Outer Bush"
];

const PREDEFINED_SUPPLIERS = [
  "AD-ART & Press Fabs",
  "Aloukik Agencies",
  "Amba Aluminium Pvt Ltd",
  "Ananth Technodes",
  "Asta Engineering Solutions",
  "AVK Industrial Supplies",
  "BIG C Technologies Pvt Ltd",
  "Blue Volt Services",
  "Cauvery Petrochemicals Pvt. Ltd",
  "D G Faabs (P) Ltd",
  "HAFA Hoists Pvt Ltd",
  "Hardware Junction",
  "Harsh Enterprises",
  "HR PRECISIONS",
  "Hydro Ion Pure Systems",
  "Industrial Marketing",
  "Izzy Agencies",
  "J.R & Co.,",
  "Jindal Aluminium Limited",
  "JK Powder Coating",
  "JR & Co",
  "Kothari Metals",
  "LR Multi Speciality Products",
  "Mandot Inc",
  "Meenakshi Steel Corporation",
  "Mulrich Fabrics",
  "Munot Agencies",
  "Neha Graphics",
  "NEW Mataji Electricals",
  "NS Industrial Hardware",
  "Orient Eco Systems Pvt Ltd",
  "PSI Global",
  "SG Engineering",
  "Shree Jashraj Insulation",
  "Shri Rupana Industrial Suppliers",
  "Siddhi Kabel Corporation Pvt Ltd",
  "Slider Bags Bengaluru Pvt Ltd",
  "Sneha Enterprise Self Adhesive Tapes",
  "Sri Arihant Industries",
  "Sri Vasavi Adhesive Tapes Pvt Ltd",
  "Superin",
  "Thanu Enterprises",
  "Truecon Enterprises",
  "Urja Sealant Pvt Ltd",
  "Weld Phile Technology",
  "Steel Center",
  "Cresco Industrial Products Pvt Ltd",
  "Tooling Ocean",
  "The Supreme Industries Limited"
];

let customMakes = JSON.parse(localStorage.getItem('custom_makes_list') || '[]');
let customRawMaterials = JSON.parse(localStorage.getItem('custom_raw_materials_list') || '[]');

function getUnitForRawMaterial(rawMaterialName) {
  if (!rawMaterialName) return "No's";
  const name = rawMaterialName.toString();
  if (/gsm|ss|alu|ms|bucket|stretch|rod/i.test(name)) return "Kg's";
  if (/thermal|acou/i.test(name)) return "Sqmt";
  if (/tape|bubble/i.test(name)) return "Roll";
  if (/gasket|jtr/i.test(name)) return "Rmt";
  if (/cleats|tube|bracket|corner|handle|gear|bush/i.test(name)) return "No's";
  return "No's";
}

function saveCustomMake(name) {
  if (!name || !name.trim()) return;
  const trimmed = name.trim();
  if (trimmed === '—' || trimmed === '-') return;
  if (!customMakes.some(m => m.toLowerCase() === trimmed.toLowerCase()) && 
      !PREDEFINED_MAKES.some(m => m.toLowerCase() === trimmed.toLowerCase())) {
    customMakes.push(trimmed);
    localStorage.setItem('custom_makes_list', JSON.stringify(customMakes));
  }
}

function saveCustomRawMaterial(name) {
  if (!name || !name.trim()) return;
  const trimmed = name.trim();
  if (trimmed === '—' || trimmed === '-') return;
  if (!customRawMaterials.some(r => r.toLowerCase() === trimmed.toLowerCase()) && 
      !PREDEFINED_RAW_MATERIALS.some(r => r.toLowerCase() === trimmed.toLowerCase())) {
    customRawMaterials.push(trimmed);
    localStorage.setItem('custom_raw_materials_list', JSON.stringify(customRawMaterials));
  }
}

let customSuppliers = JSON.parse(localStorage.getItem('custom_suppliers_list') || '[]');

function saveCustomSupplier(name) {
  if (!name || !name.trim()) return;
  const trimmed = name.trim();
  if (trimmed === '—' || trimmed === '-') return;
  if (!customSuppliers.some(s => s.toLowerCase() === trimmed.toLowerCase()) && 
      !PREDEFINED_SUPPLIERS.some(s => s.toLowerCase() === trimmed.toLowerCase())) {
    customSuppliers.push(trimmed);
    localStorage.setItem('custom_suppliers_list', JSON.stringify(customSuppliers));
  }
}

function populateMakeDropdowns() {
  const makeSelect = document.getElementById('po-make-select');
  const datalistEl = document.getElementById('make-datalist-options');
  if (!makeSelect && !datalistEl) return;

  const makeSet = new Set();
  PREDEFINED_MAKES.forEach(m => makeSet.add(m));
  customMakes.forEach(m => makeSet.add(m));

  if (Array.isArray(currentPOEntries)) {
    currentPOEntries.forEach(item => {
      if (item.make && item.make.trim() && item.make !== '—') {
        makeSet.add(item.make.trim());
      }
    });
  }

  const sortedMakes = Array.from(makeSet).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

  if (datalistEl) {
    datalistEl.innerHTML = sortedMakes.map(m => `<option value="${escapeHtml(m)}"></option>`).join('');
  }

  if (makeSelect) {
    const currVal = makeSelect.value;
    let html = '<option value="">Select Make...</option>';
    html += '<option value="__add_new__" style="font-weight:700; color:var(--accent);">➕ Add New Make...</option>';
    sortedMakes.forEach(m => {
      html += `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`;
    });
    makeSelect.innerHTML = html;
    if (currVal && Array.from(makeSelect.options).some(o => o.value === currVal)) {
      makeSelect.value = currVal;
    }
  }
}

function populateRawMaterialDropdowns() {
  const rmSelect = document.getElementById('po-raw-material-select');
  const datalistEl = document.getElementById('rawmaterial-datalist-options');
  if (!rmSelect && !datalistEl) return;

  const rmSet = new Set();
  PREDEFINED_RAW_MATERIALS.forEach(r => rmSet.add(r));
  customRawMaterials.forEach(r => rmSet.add(r));

  if (Array.isArray(currentPOEntries)) {
    currentPOEntries.forEach(item => {
      if (item.raw_material && item.raw_material.trim() && item.raw_material !== '—') {
        rmSet.add(item.raw_material.trim());
      }
    });
  }

  const sortedRM = Array.from(rmSet).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

  if (datalistEl) {
    datalistEl.innerHTML = sortedRM.map(r => `<option value="${escapeHtml(r)}"></option>`).join('');
  }

  if (rmSelect) {
    const currVal = rmSelect.value;
    let html = '<option value="">Select Raw Material...</option>';
    html += '<option value="__add_new__" style="font-weight:700; color:var(--accent);">➕ Add New Raw Material...</option>';
    sortedRM.forEach(r => {
      html += `<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`;
    });
    rmSelect.innerHTML = html;
    if (currVal && Array.from(rmSelect.options).some(o => o.value === currVal)) {
      rmSelect.value = currVal;
    }
  }
}

function populateSupplierDropdowns() {
  const exportSelect = document.getElementById('export-supplier-select');
  const subpanelSelect = document.getElementById('supplier-subpanel-select');
  const poSupplierSelect = document.getElementById('po-supplier-select');
  const datalistEl = document.getElementById('supplier-datalist-options');

  const supplierSet = new Set();
  PREDEFINED_SUPPLIERS.forEach(s => supplierSet.add(s));
  customSuppliers.forEach(s => supplierSet.add(s));

  if (Array.isArray(currentPOEntries)) {
    currentPOEntries.forEach(item => {
      if (item.supplier && item.supplier.trim() && item.supplier !== '—') {
        supplierSet.add(item.supplier.trim());
      }
    });
  }

  if (Array.isArray(currentIGREntries)) {
    currentIGREntries.forEach(item => {
      if (item.supplier_name && item.supplier_name.trim() && item.supplier_name !== '—') {
        supplierSet.add(item.supplier_name.trim());
      }
    });
  }

  if (Array.isArray(currentBPREntries)) {
    currentBPREntries.forEach(item => {
      if (item.supplier && item.supplier.trim() && item.supplier !== '—') {
        supplierSet.add(item.supplier.trim());
      }
    });
  }

  const sortedSuppliers = Array.from(supplierSet).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

  if (datalistEl) {
    datalistEl.innerHTML = sortedSuppliers.map(s => `<option value="${escapeHtml(s)}"></option>`).join('');
  }

  [exportSelect, subpanelSelect, poSupplierSelect].forEach(selectEl => {
    if (!selectEl) return;
    const currVal = selectEl.value;

    let html = selectEl === poSupplierSelect ? '<option value="">Select Supplier...</option>' : '<option value="all">All Suppliers</option>';
    html += '<option value="__add_new__" style="font-weight:700; color:var(--accent);">➕ Add New Supplier...</option>';

    sortedSuppliers.forEach(s => {
      html += `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`;
    });

    selectEl.innerHTML = html;

    if (currVal && Array.from(selectEl.options).some(o => o.value === currVal)) {
      selectEl.value = currVal;
    }
  });
}

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
  setupMaterialsSubTabs();
  setupModalsAndCalculations();

  updateMonthFilterVisibility();

  // Initial load
  await loadPOEntries();
  await loadIGREntries();
  await loadBPREntries();
  await loadAbstractSummary();
  await loadMaterialsData();

  // Real-time periodic auto-refresh every 5 seconds to sync lock/unlock states dynamically
  setInterval(async () => {
    if (document.visibilityState === 'visible') {
      await loadPOEntries(true);
      await loadIGREntries(true);
      await loadBPREntries(true);
      if (activeMainTab === 'materials') {
        await loadMaterialsData(true);
      }
    }
  }, 5000);
}

/** Apply RBAC: "+ New Entry" buttons & editing only for Purchase department users or Admins */
function applyRolePermissions() {
  const isPurchaseUser = currentUser && currentUser.role === 'purchase';
  const openAddPOBtn = document.getElementById('open-add-po-btn');
  const openAddIGRBtn = document.getElementById('open-add-igr-btn');
  const openAddBPRBtn = document.getElementById('open-add-bpr-btn');

  if (!isPurchaseUser) {
    if (openAddPOBtn) openAddPOBtn.classList.add('hidden');
    if (openAddIGRBtn) openAddIGRBtn.classList.add('hidden');
    if (openAddBPRBtn) openAddBPRBtn.classList.add('hidden');
  } else {
    if (openAddPOBtn) openAddPOBtn.classList.remove('hidden');
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
      await loadPOEntries();
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

      if (activeKey === 'po') {
        await loadPOEntries();
      } else if (activeKey === 'igr') {
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

  const exportSupplierSelect = document.getElementById('export-supplier-select');
  if (exportSupplierSelect) {
    exportSupplierSelect.addEventListener('change', () => {
      if (exportSupplierSelect.value === '__add_new__') {
        const newSupplier = prompt('Enter new Supplier Name to add to the system:');
        if (newSupplier && newSupplier.trim()) {
          const cleanName = newSupplier.trim();
          saveCustomSupplier(cleanName);
          populateSupplierDropdowns();
          exportSupplierSelect.value = cleanName;
          showToast(`Added new supplier "${cleanName}"`, 'success');
        } else {
          exportSupplierSelect.value = 'all';
        }
      }

      const activeKey = getActiveTabKey();
      if (activeKey === 'igr') {
        loadIGREntries(true);
      } else if (activeKey === 'bpr') {
        loadBPREntries(true);
      }
    });
  }

  const subpanelSupplierSelect = document.getElementById('supplier-subpanel-select');
  if (subpanelSupplierSelect) {
    subpanelSupplierSelect.addEventListener('change', () => {
      if (exportSupplierSelect) exportSupplierSelect.value = subpanelSupplierSelect.value;
      loadSupplierView();
    });
  }

  const exportBtn = document.getElementById('export-excel-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', exportInventoryToExcel);
  }
}

function setupPurchaseTabs() {
  const mainTabBtns = document.querySelectorAll('.purchase-tab-btn');
  const subTabBtns = document.querySelectorAll('.purchase-subtab-btn');
  const subtabsBar = document.getElementById('inventory-subtabs-bar');
  const materialsSubtabsBar = document.getElementById('materials-subtabs-bar');

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
        materialsSubtabsBar && materialsSubtabsBar.classList.add('hidden');
        switchInventorySubTab(activeSubTab);
      } else if (tabKey === 'materials') {
        subtabsBar && subtabsBar.classList.add('hidden');
        materialsSubtabsBar && materialsSubtabsBar.classList.remove('hidden');
        loadMaterialsData(true);
        switchMaterialsSubTab(activeMaterialsSubTab);
      } else {
        subtabsBar && subtabsBar.classList.add('hidden');
        materialsSubtabsBar && materialsSubtabsBar.classList.add('hidden');
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
  // Modal toggles for PO
  const modalAddPO = document.getElementById('modal-add-po');
  const openAddPOBtn = document.getElementById('open-add-po-btn');
  const closeAddPOBtn = document.getElementById('close-add-po-modal');
  const cancelAddPOBtn = document.getElementById('cancel-add-po-modal');
  const savePOBtn = document.getElementById('save-po-btn');

  if (openAddPOBtn) {
    openAddPOBtn.addEventListener('click', openAddPOModal);
  }
  [closeAddPOBtn, cancelAddPOBtn].forEach(b => {
    b && b.addEventListener('click', () => modalAddPO && modalAddPO.classList.add('hidden'));
  });
  if (savePOBtn) {
    savePOBtn.addEventListener('click', submitPOEntry);
  }

  // Auto Calculations & Unit Assignments for PO
  const poDateInput = document.getElementById('po-date');
  const poMonthPreview = document.getElementById('po-month-preview');
  if (poDateInput) {
    poDateInput.addEventListener('change', () => {
      if (poMonthPreview) poMonthPreview.value = getRealTimeMonth(poDateInput.value);
    });
  }

  const poRMSelect = document.getElementById('po-raw-material-select');
  if (poRMSelect) {
    poRMSelect.addEventListener('change', () => {
      if (poRMSelect.value === '__add_new__') {
        const newRM = prompt('Enter new Raw Material Name to add to the system:');
        if (newRM && newRM.trim()) {
          const cleanName = newRM.trim();
          saveCustomRawMaterial(cleanName);
          populateRawMaterialDropdowns();
          poRMSelect.value = cleanName;
          showToast(`Added new raw material "${cleanName}"`, 'success');
        } else {
          poRMSelect.value = '';
        }
      }
      const unitPreview = document.getElementById('po-unit-preview');
      if (unitPreview) {
        unitPreview.value = poRMSelect.value ? getUnitForRawMaterial(poRMSelect.value) : '';
      }
    });
  }

  const poMakeSelect = document.getElementById('po-make-select');
  if (poMakeSelect) {
    poMakeSelect.addEventListener('change', () => {
      if (poMakeSelect.value === '__add_new__') {
        const newMake = prompt('Enter new Make Brand to add to the system:');
        if (newMake && newMake.trim()) {
          const cleanName = newMake.trim();
          saveCustomMake(cleanName);
          populateMakeDropdowns();
          poMakeSelect.value = cleanName;
          showToast(`Added new make "${cleanName}"`, 'success');
        } else {
          poMakeSelect.value = '';
        }
      }
    });
  }

  const poSupplierSelect = document.getElementById('po-supplier-select');
  if (poSupplierSelect) {
    poSupplierSelect.addEventListener('change', () => {
      if (poSupplierSelect.value === '__add_new__') {
        const newSupplier = prompt('Enter new Supplier Name to add to the system:');
        if (newSupplier && newSupplier.trim()) {
          const cleanName = newSupplier.trim();
          saveCustomSupplier(cleanName);
          populateSupplierDropdowns();
          poSupplierSelect.value = cleanName;
          showToast(`Added new supplier "${cleanName}"`, 'success');
        } else {
          poSupplierSelect.value = '';
        }
      }
    });
  }

  document.querySelectorAll('.po-calc-trigger').forEach(el => {
    el.addEventListener('input', recalculatePOModalFields);
    el.addEventListener('change', recalculatePOModalFields);
  });
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

// ─── PO (PURCHASE ORDER) DATA MODULE ─────────────────────────────────────────

async function loadPOEntries(silent = false) {
  const tbody = document.getElementById('po-tbody');
  if (!tbody) return;

  if (!silent && currentPOEntries.length === 0) {
    tbody.innerHTML = `<tr><td colspan="21" style="text-align:center; padding:24px; color:var(--text-muted);"><span class="spinner"></span> Loading Purchase Order records...</td></tr>`;
  }

  try {
    const selectedMonth = tabMonthFilters['po'] || 'all';
    const res = await apiFetch(`/purchase/po?branch=${currentBranch}&month=${selectedMonth}&_t=${Date.now()}`);
    if (!res || !res.ok) throw new Error('Failed to load PO entries');
    const data = await res.json();
    currentPOEntries = data || [];

    populateMakeDropdowns();
    populateRawMaterialDropdowns();
    populateSupplierDropdowns();

    const selectedSupplier = document.getElementById('export-supplier-select')?.value || 'all';
    let filteredEntries = [...currentPOEntries];

    if (selectedSupplier !== 'all') {
      const sLower = selectedSupplier.toLowerCase();
      filteredEntries = filteredEntries.filter(item => item.supplier && item.supplier.toLowerCase().includes(sLower));
    }

    // Update Stat Cards
    const countEl = document.getElementById('po-stat-count');
    const basicEl = document.getElementById('po-stat-basic-val');
    const gstEl = document.getElementById('po-stat-gst-val');
    const totalEl = document.getElementById('po-stat-total-val');

    let totBasic = 0, totGst = 0, totGrand = 0;
    filteredEntries.forEach(item => {
      totBasic += (item.basic || 0);
      totGst += ((item.cgst || 0) + (item.sgst || 0) + (item.igst || 0));
      totGrand += (item.total || 0);
    });

    if (countEl) countEl.textContent = filteredEntries.length;
    if (basicEl) basicEl.textContent = `₹${totBasic.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    if (gstEl) gstEl.textContent = `₹${totGst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    if (totalEl) totalEl.textContent = `₹${totGrand.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

    if (filteredEntries.length === 0) {
      tbody.innerHTML = `<tr><td colspan="21" style="text-align:center; padding:24px; color:var(--text-muted);">No PO entries found for ${capitalize(currentBranch)} (${selectedMonth})</td></tr>`;
      return;
    }

    const showActions = currentUser && (currentUser.role === 'purchase' || currentUser.role === 'admin');

    tbody.innerHTML = filteredEntries.map((item, idx) => `
      <tr>
        <td style="font-weight:700; color:var(--text-primary); text-align:center;">${idx + 1}</td>
        <td style="font-weight:600;">${escapeHtml(item.month || getRealTimeMonth(item.date))}</td>
        <td>${formatDate(item.date)}</td>
        <td style="font-weight:600; color:var(--accent);">${escapeHtml(item.po_no || '—')}</td>
        <td>${formatDate(item.po_date)}</td>
        <td><strong>${escapeHtml(item.supplier || '—')}</strong></td>
        <td>${escapeHtml(item.make || '—')}</td>
        <td>${escapeHtml(item.inv_no || '—')}</td>
        <td>${escapeHtml(item.igr_no || '—')}</td>
        <td><strong>${escapeHtml(item.raw_material || '—')}</strong></td>
        <td style="font-weight:600; text-align:center;">${escapeHtml(item.unit || getUnitForRawMaterial(item.raw_material))}</td>
        <td style="text-align:right;">${(item.qty || 0).toLocaleString('en-IN')}</td>
        <td style="text-align:right;">₹${(item.rate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        <td style="text-align:right; font-weight:600;">₹${(item.basic || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        <td style="text-align:right;">₹${(item.cgst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        <td style="text-align:right;">₹${(item.sgst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        <td style="text-align:right;">₹${(item.igst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        <td style="text-align:right;">₹${(item.trans_as_invoice || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        <td style="text-align:right; font-weight:600;">₹${(item.trans_per_unit || 0).toLocaleString('en-IN', { minimumFractionDigits: 4 })}</td>
        <td style="text-align:right; font-weight:700; color:var(--text-primary);">₹${(item.total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        ${showActions ? `<td>${renderPOActionsHtml(item)}</td>` : '<td>—</td>'}
      </tr>
    `).join('');
  } catch (err) {
    if (!silent) showToast(`Error loading PO: ${err.message}`, 'error');
  }
}

function renderPOActionsHtml(item) {
  const isPurchaseUser = currentUser && currentUser.role === 'purchase';
  const isAdminUser = currentUser && (currentUser.role === 'admin' || currentUser.hasAdminPower);
  const isManagerUser = currentUser && currentUser.role === 'manager';

  if (!isPurchaseUser && !isAdminUser && !isManagerUser) return '—';

  const createdTime = new Date(item.created_at || item.date).getTime();
  const now = Date.now();
  const ageMs = now - createdTime;
  const isWithin48h = !isNaN(createdTime) && ageMs <= EDIT_WINDOW_MS;
  const hoursLeft = isWithin48h ? Math.ceil((EDIT_WINDOW_MS - ageMs) / (1000 * 60 * 60)) : 0;

  // Manager View: Action column shows ONLY real-time status badge (no edit/delete)
  if (isManagerUser) {
    if (item.is_unlocked) {
      return `<span style="display:inline-block; padding:4px 10px; border-radius:12px; background:#dcfce7; color:#15803d; font-size:0.75rem; font-weight:600; white-space:nowrap;">🔓 Unlocked</span>`;
    }
    if (item.edit_requested) {
      return `<span style="display:inline-block; padding:4px 10px; border-radius:12px; background:#fef3c7; color:#b45309; font-size:0.75rem; font-weight:600; white-space:nowrap;">⏳ Requested</span>`;
    }
    if (isWithin48h) {
      return `<span style="display:inline-block; padding:4px 10px; border-radius:12px; background:#e0e7ff; color:#3730a3; font-size:0.75rem; font-weight:600; white-space:nowrap;">⏱️ ${hoursLeft}h left</span>`;
    }
    return `<span style="display:inline-block; padding:4px 10px; border-radius:12px; background:#f3f4f6; color:#4b5563; font-size:0.75rem; font-weight:600; white-space:nowrap;">🔒 Locked</span>`;
  }

  // Admin View: NO Edit or Delete buttons! Admin only sees status or Approve Edit button if requested by Purchase.
  if (isAdminUser) {
    if (item.edit_requested) {
      return `
        <div style="display:flex; align-items:center; gap:6px; flex-wrap:nowrap;">
          <span style="display:inline-block; padding:4px 10px; border-radius:12px; background:#fef3c7; color:#b45309; font-size:0.75rem; font-weight:600; white-space:nowrap;">⏳ Edit Requested</span>
          <button class="btn btn-warning btn-sm" onclick="approveUnlockEntry('po', ${item.id})" style="padding:3px 10px; font-size:0.75rem; background:#f59e0b; color:#fff; border:none; border-radius:6px; white-space:nowrap; cursor:pointer;">Approve Edit</button>
        </div>
      `;
    }
    if (item.is_unlocked) {
      return `
        <div style="display:flex; align-items:center; gap:6px; flex-wrap:nowrap;">
          <span style="display:inline-block; padding:4px 10px; border-radius:12px; background:#dcfce7; color:#15803d; font-size:0.75rem; font-weight:600; white-space:nowrap;">🔓 Unlocked</span>
          <button class="btn btn-outline btn-sm" onclick="lockEntry('po', ${item.id})" style="padding:3px 8px; font-size:0.75rem; white-space:nowrap; cursor:pointer;">Lock</button>
        </div>
      `;
    }
    return `
      <div style="display:flex; align-items:center; justify-content:flex-start;">
        <span style="display:inline-block; padding:4px 10px; border-radius:12px; background:${isWithin48h ? '#e0e7ff' : '#f3f4f6'}; color:${isWithin48h ? '#3730a3' : '#4b5563'}; font-size:0.75rem; font-weight:600; white-space:nowrap;">${isWithin48h ? `⏱️ ${hoursLeft}h left` : '🔒 Locked'}</span>
      </div>
    `;
  }

  // Purchase Department User View: Text Edit/Delete options when within 48h or unlocked
  if (item.is_unlocked) {
    return `
      <div style="display:flex; align-items:center; gap:6px; flex-wrap:nowrap;">
        <span style="display:inline-block; padding:4px 8px; border-radius:12px; background:#dcfce7; color:#15803d; font-size:0.75rem; font-weight:600; white-space:nowrap;">🔓 Unlocked</span>
        <button class="btn btn-primary btn-sm" onclick="openEditPOModal(${item.id})" style="padding:3px 8px; font-size:0.75rem; white-space:nowrap;">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deletePOEntry(${item.id})" style="padding:3px 8px; font-size:0.75rem; white-space:nowrap;">Delete</button>
      </div>
    `;
  }

  if (isWithin48h) {
    return `
      <div style="display:flex; align-items:center; gap:6px; flex-wrap:nowrap;">
        <span style="display:inline-block; padding:4px 8px; border-radius:12px; background:#e0e7ff; color:#3730a3; font-size:0.75rem; font-weight:600; white-space:nowrap;" title="Editable within 48h of creation">⏱️ ${hoursLeft}h left</span>
        <button class="btn btn-primary btn-sm" onclick="openEditPOModal(${item.id})" style="padding:3px 8px; font-size:0.75rem; white-space:nowrap;">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deletePOEntry(${item.id})" style="padding:3px 8px; font-size:0.75rem; white-space:nowrap;">Delete</button>
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
      <button class="btn btn-warning btn-sm" onclick="requestEditAccess('po', ${item.id})" style="padding:3px 10px; font-size:0.75rem; background:#f59e0b; color:#fff; border:none; border-radius:6px; white-space:nowrap; cursor:pointer;">Request Edit</button>
    </div>
  `;
}

function openAddPOModal() {
  editingPOId = null;
  resetPOForm();

  const nextSl = currentPOEntries.length + 1;
  const slPreview = document.getElementById('po-sl-no-preview');
  if (slPreview) slPreview.value = `#${nextSl}`;

  const title = document.getElementById('po-modal-title');
  const saveBtn = document.getElementById('save-po-btn');
  if (title) title.textContent = 'New PO Entry';
  if (saveBtn) saveBtn.textContent = 'Save PO Entry';

  const today = new Date().toISOString().split('T')[0];
  const dateInput = document.getElementById('po-date');
  if (dateInput) dateInput.value = today;

  const poDateInput = document.getElementById('po-date-input');
  if (poDateInput) poDateInput.value = today;

  const monthPreview = document.getElementById('po-month-preview');
  if (monthPreview) monthPreview.value = getRealTimeMonth(today);

  populateMakeDropdowns();
  populateRawMaterialDropdowns();
  populateSupplierDropdowns();

  const modal = document.getElementById('modal-add-po');
  modal && modal.classList.remove('hidden');
}

function resetPOForm() {
  editingPOId = null;
  ['po-no', 'po-inv-no', 'po-igr-no', 'po-qty', 'po-rate', 'po-basic-preview', 'po-cgst', 'po-sgst', 'po-igst', 'po-trans-as-invoice', 'po-trans-unit-preview', 'po-total-preview'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  ['po-supplier-select', 'po-make-select', 'po-raw-material-select'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const unitEl = document.getElementById('po-unit-preview');
  if (unitEl) unitEl.value = '';
}

function recalculatePOModalFields() {
  const qty = parseFloat(document.getElementById('po-qty')?.value) || 0;
  const rate = parseFloat(document.getElementById('po-rate')?.value) || 0;
  const basic = qty * rate;

  const basicEl = document.getElementById('po-basic-preview');
  if (basicEl) basicEl.value = basic.toFixed(2);

  const cgst = parseFloat(document.getElementById('po-cgst')?.value) || 0;
  const sgst = parseFloat(document.getElementById('po-sgst')?.value) || 0;
  const igst = parseFloat(document.getElementById('po-igst')?.value) || 0;
  const trans = parseFloat(document.getElementById('po-trans-as-invoice')?.value) || 0;

  const transUnit = qty > 0 ? (trans / qty) : 0;
  const transUnitEl = document.getElementById('po-trans-unit-preview');
  if (transUnitEl) transUnitEl.value = transUnit.toFixed(4);

  const grandTotal = basic + cgst + sgst + igst + trans;
  const totalEl = document.getElementById('po-total-preview');
  if (totalEl) totalEl.value = grandTotal.toFixed(2);
}

async function submitPOEntry() {
  const isPurchaseUser = currentUser && currentUser.role === 'purchase';
  const isAdminUser = currentUser && (currentUser.role === 'admin' || currentUser.hasAdminPower);

  if (!isPurchaseUser && !isAdminUser) {
    showToast('Only Purchase Department users or Admin can save PO entries', 'error');
    return;
  }

  const saveBtn = document.getElementById('save-po-btn');
  const date = document.getElementById('po-date').value;
  const po_no = document.getElementById('po-no').value.trim();
  const raw_material = document.getElementById('po-raw-material-select').value.trim();
  const supplier = document.getElementById('po-supplier-select').value.trim();
  const make = document.getElementById('po-make-select').value.trim();

  if (!date) {
    showToast('Please select a Date', 'error');
    return;
  }

  const unit = document.getElementById('po-unit-preview').value || getUnitForRawMaterial(raw_material);

  const payload = {
    date,
    po_no: po_no || '—',
    po_date: document.getElementById('po-date-input').value || date,
    supplier: supplier || '—',
    make: make || '—',
    inv_no: document.getElementById('po-inv-no').value.trim(),
    igr_no: document.getElementById('po-igr-no').value.trim(),
    raw_material: raw_material || '—',
    unit,
    qty: parseFloat(document.getElementById('po-qty').value) || 0,
    rate: parseFloat(document.getElementById('po-rate').value) || 0,
    cgst: parseFloat(document.getElementById('po-cgst').value) || 0,
    sgst: parseFloat(document.getElementById('po-sgst').value) || 0,
    igst: parseFloat(document.getElementById('po-igst').value) || 0,
    trans_as_invoice: parseFloat(document.getElementById('po-trans-as-invoice').value) || 0,
    branch: currentBranch
  };

  saveBtn.disabled = true;
  saveBtn.textContent = editingPOId ? 'Updating...' : 'Saving...';

  try {
    const isEdit = editingPOId !== null;
    const url = isEdit ? `/purchase/po/${editingPOId}` : '/purchase/po';
    const method = isEdit ? 'PUT' : 'POST';

    const res = await apiFetch(url, {
      method,
      body: JSON.stringify(payload)
    });

    if (!res || !res.ok) {
      const err = res ? await res.json().catch(() => ({})) : {};
      throw new Error(err.error || `Server error (${res ? res.status : 'No response'})`);
    }

    if (make) saveCustomMake(make);
    if (raw_material) saveCustomRawMaterial(raw_material);
    if (supplier) saveCustomSupplier(supplier);

    showToast(isEdit ? 'PO Entry updated successfully' : 'PO Entry created successfully', 'success');
    document.getElementById('modal-add-po').classList.add('hidden');
    resetPOForm();
    await loadPOEntries();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = editingPOId ? 'Update PO Entry' : 'Save PO Entry';
  }
}

function openEditPOModal(id) {
  const item = currentPOEntries.find(x => String(x.id) === String(id));
  if (!item) return;

  editingPOId = id;
  populateMakeDropdowns();
  populateRawMaterialDropdowns();
  populateSupplierDropdowns();

  const modal = document.getElementById('modal-add-po');
  const title = document.getElementById('po-modal-title');
  const saveBtn = document.getElementById('save-po-btn');

  if (title) title.textContent = `Edit PO Entry (#${item.sl_no})`;
  if (saveBtn) saveBtn.textContent = 'Update PO Entry';

  const slPreview = document.getElementById('po-sl-no-preview');
  if (slPreview) slPreview.value = `#${item.sl_no}`;

  document.getElementById('po-date').value = item.date ? item.date.split('T')[0] : '';
  document.getElementById('po-month-preview').value = item.month || getRealTimeMonth(item.date);
  document.getElementById('po-no').value = item.po_no || '';
  document.getElementById('po-date-input').value = item.po_date ? item.po_date.split('T')[0] : '';
  document.getElementById('po-supplier-select').value = item.supplier || '';
  document.getElementById('po-make-select').value = item.make || '';
  document.getElementById('po-inv-no').value = item.inv_no || '';
  document.getElementById('po-igr-no').value = item.igr_no || '';
  document.getElementById('po-raw-material-select').value = item.raw_material || '';
  document.getElementById('po-unit-preview').value = item.unit || getUnitForRawMaterial(item.raw_material);
  document.getElementById('po-qty').value = item.qty || '';
  document.getElementById('po-rate').value = item.rate || '';
  document.getElementById('po-basic-preview').value = (item.basic || 0).toFixed(2);
  document.getElementById('po-cgst').value = item.cgst || '';
  document.getElementById('po-sgst').value = item.sgst || '';
  document.getElementById('po-igst').value = item.igst || '';
  document.getElementById('po-trans-as-invoice').value = item.trans_as_invoice || '';
  document.getElementById('po-trans-unit-preview').value = (item.trans_per_unit || 0).toFixed(4);
  document.getElementById('po-total-preview').value = (item.total || 0).toFixed(2);

  modal && modal.classList.remove('hidden');
}

async function deletePOEntry(id) {
  if (!confirm('Are you sure you want to delete this PO entry?')) return;
  try {
    const res = await apiFetch(`/purchase/po/${id}`, { method: 'DELETE' });
    if (!res || !res.ok) {
      const err = res ? await res.json().catch(() => ({})) : {};
      throw new Error(err.error || 'Failed to delete PO entry');
    }
    showToast('PO entry deleted successfully', 'success');
    await loadPOEntries();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

window.openEditPOModal = openEditPOModal;
window.deletePOEntry = deletePOEntry;

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
    populateSupplierDropdowns();

    const supplierSelect = document.getElementById('export-supplier-select');
    const selectedSupplier = supplierSelect ? supplierSelect.value : 'all';

    let displayData = filteredData;
    if (selectedSupplier !== 'all') {
      const sLower = selectedSupplier.toLowerCase();
      displayData = filteredData.filter(item => item.supplier_name && item.supplier_name.toLowerCase().includes(sLower));
    }

    if (!displayData || displayData.length === 0) {
      const colSpan = showActions ? 17 : 16;
      const monthText = selectedMonth === 'all' ? '' : ` for <strong>${escapeHtml(selectedMonth)}</strong>`;
      const suppText = selectedSupplier === 'all' ? '' : ` for supplier <strong>"${escapeHtml(selectedSupplier)}"</strong>`;
      const msg = isPurchaseUser
        ? `No IGR entries recorded yet${monthText}${suppText}. Click <strong>"New IGR Entry"</strong> to add an entry.`
        : `No IGR entries recorded yet${monthText}${suppText} by the Purchase Department.`;
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

    tbody.innerHTML = displayData.map((item, idx) => `
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

    if (supplier_name) saveCustomSupplier(supplier_name);
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
    populateSupplierDropdowns();

    const supplierSelect = document.getElementById('export-supplier-select');
    const selectedSupplier = supplierSelect ? supplierSelect.value : 'all';

    let displayData = filteredData;
    if (selectedSupplier !== 'all') {
      const sLower = selectedSupplier.toLowerCase();
      displayData = filteredData.filter(item => item.supplier && item.supplier.toLowerCase().includes(sLower));
    }

    if (!displayData || displayData.length === 0) {
      const colSpan = showActions ? 18 : 17;
      const monthText = selectedMonth === 'all' ? '' : ` for <strong>${escapeHtml(selectedMonth)}</strong>`;
      const suppText = selectedSupplier === 'all' ? '' : ` for supplier <strong>"${escapeHtml(selectedSupplier)}"</strong>`;
      const msg = isPurchaseUser
        ? `No BPR entries recorded yet${monthText}${suppText}. Click <strong>"New BPR Entry"</strong> to add an entry.`
        : `No BPR entries recorded yet${monthText}${suppText} by the Purchase Department.`;
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

    tbody.innerHTML = displayData.map((item, idx) => `
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

    if (payload.supplier) saveCustomSupplier(payload.supplier);
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

// ─── SUPPLIER VIEW MODULE ───────────────────────────────────────────────────

function loadSupplierView() {
  populateSupplierDropdowns();
  const subpanelSelect = document.getElementById('supplier-subpanel-select');
  const exportSelect = document.getElementById('export-supplier-select');
  const selectedSupplier = subpanelSelect ? subpanelSelect.value : (exportSelect ? exportSelect.value : 'all');

  const statName = document.getElementById('supplier-stat-name');
  const statIgrCount = document.getElementById('supplier-stat-igr-count');
  const statBprCount = document.getElementById('supplier-stat-bpr-count');
  const statTotalVal = document.getElementById('supplier-stat-total-val');

  if (statName) statName.textContent = selectedSupplier === 'all' ? 'All Suppliers' : selectedSupplier;

  let igrMatches = [...(currentIGREntries || [])];
  let bprMatches = [...(currentBPREntries || [])];

  if (selectedSupplier !== 'all') {
    const sLower = selectedSupplier.toLowerCase();
    igrMatches = igrMatches.filter(item => item.supplier_name && item.supplier_name.toLowerCase().includes(sLower));
    bprMatches = bprMatches.filter(item => item.supplier && item.supplier.toLowerCase().includes(sLower));
  }

  if (statIgrCount) statIgrCount.textContent = igrMatches.length;
  if (statBprCount) statBprCount.textContent = bprMatches.length;

  let totalValue = 0;
  igrMatches.forEach(item => totalValue += (item.invoice_value || 0));
  bprMatches.forEach(item => totalValue += (item.invoice_value || 0));
  if (statTotalVal) statTotalVal.textContent = `₹${totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  // Render IGR rows for supplier subpanel
  const igrTbody = document.getElementById('supplier-igr-tbody');
  if (igrTbody) {
    if (igrMatches.length === 0) {
      igrTbody.innerHTML = `<tr><td colspan="12" style="text-align:center; padding:20px; color:var(--text-muted);">No IGR entries recorded for ${escapeHtml(selectedSupplier)}</td></tr>`;
    } else {
      igrTbody.innerHTML = igrMatches.map((item, idx) => `
        <tr>
          <td style="font-weight:700; color:#991b1b; text-align:center;">${idx + 1}</td>
          <td>${escapeHtml(item.month || getRealTimeMonth(item.date))}</td>
          <td>${formatDate(item.date)}</td>
          <td style="font-weight:600; color:var(--accent);">${escapeHtml(item.igr_no || '—')}</td>
          <td>${escapeHtml(item.invoice_no_date || '—')}</td>
          <td><strong>${escapeHtml(item.supplier_name || '—')}</strong></td>
          <td>${escapeHtml(item.description || '—')}</td>
          <td>₹${(item.taxable_value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          <td>₹${(item.igst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          <td>₹${(item.cgst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          <td>₹${(item.sgst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          <td style="font-weight:700; color:var(--success);">₹${(item.invoice_value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        </tr>
      `).join('');
    }
  }

  // Render BPR rows for supplier subpanel
  const bprTbody = document.getElementById('supplier-bpr-tbody');
  if (bprTbody) {
    if (bprMatches.length === 0) {
      bprTbody.innerHTML = `<tr><td colspan="13" style="text-align:center; padding:20px; color:var(--text-muted);">No BPR entries recorded for ${escapeHtml(selectedSupplier)}</td></tr>`;
    } else {
      bprTbody.innerHTML = bprMatches.map((item, idx) => `
        <tr>
          <td style="font-weight:700; color:#991b1b; text-align:center;">${idx + 1}</td>
          <td>${escapeHtml(item.month || getRealTimeMonth(item.date))}</td>
          <td>${formatDate(item.date)}</td>
          <td style="font-weight:600; color:var(--accent);">${escapeHtml(item.bpr_no || '—')}</td>
          <td>${escapeHtml(item.contractor_name || '—')}</td>
          <td><strong>${escapeHtml(item.supplier || '—')}</strong></td>
          <td>${escapeHtml(item.invoice_no_date || '—')}</td>
          <td>${escapeHtml(item.particulars || '—')}</td>
          <td>₹${(item.taxable_value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          <td>₹${(item.igst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          <td>₹${(item.cgst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          <td>₹${(item.sgst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          <td style="font-weight:700; color:var(--success);">₹${(item.invoice_value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        </tr>
      `).join('');
    }
  }
}

// ─── EXCEL (.XLSX) CALENDAR & SUPPLIER EXPORT ─────────────────────────────

async function exportInventoryToExcel() {
  if (typeof XLSX === 'undefined') {
    showToast('Excel export engine is initializing... Please try again in a moment.', 'warning');
    return;
  }

  const fromDateInput = document.getElementById('export-from-date');
  const toDateInput = document.getElementById('export-to-date');
  const supplierSelect = document.getElementById('export-supplier-select');

  const fromDate = fromDateInput ? fromDateInput.value.trim() : '';
  const toDate = toDateInput ? toDateInput.value.trim() : '';
  const selectedSupplier = supplierSelect ? supplierSelect.value.trim() : 'all';

  const wb = XLSX.utils.book_new();

  const parts = [];
  if (selectedSupplier !== 'all') parts.push(selectedSupplier.replace(/[^a-zA-Z0-9]/g, '_'));
  if (fromDate || toDate) parts.push(`${fromDate || 'Start'}_to_${toDate || 'End'}`);
  const filterTag = parts.length > 0 ? parts.join('_') : 'All_Records';

  if (activeMainTab === 'po') {
    let entries = [...currentPOEntries];

    if (fromDate || toDate) {
      entries = entries.filter(item => {
        const d = item.date ? item.date.split('T')[0] : '';
        if (!d) return false;
        if (fromDate && d < fromDate) return false;
        if (toDate && d > toDate) return false;
        return true;
      });
    } else {
      const selectedMonth = tabMonthFilters['po'] || 'all';
      if (selectedMonth && selectedMonth.toLowerCase() !== 'all') {
        entries = filterEntriesBySelectedMonth(entries, selectedMonth);
      }
    }

    if (selectedSupplier !== 'all') {
      const sLower = selectedSupplier.toLowerCase();
      entries = entries.filter(item => item.supplier && item.supplier.toLowerCase().includes(sLower));
    }

    if (!entries || entries.length === 0) {
      const suppText = selectedSupplier !== 'all' ? ` for supplier "${selectedSupplier}"` : '';
      showToast(`No PO entries found${suppText}.`, 'warning');
      return;
    }

    const headers = [
      'SI NO', 'MONTH', 'DATE', 'PO NO', 'PO DATE', 'SUPPLIER ', 'MAKE', 'INV NO', 'IGR NO',
      'RAW MATERIAL', 'UNIT', 'QTY', 'Rate', 'BASIC', 'CGST ', 'SGST', 'IGST',
      'TRANS. AS INVOICE', 'TRANS./UNIT', 'TOTAL'
    ];

    let totBasic = 0, totCgst = 0, totSgst = 0, totIgst = 0, totTrans = 0, totGrand = 0;
    const rows = [headers];

    entries.forEach((item, idx) => {
      const basic = item.basic || 0;
      const cgst = item.cgst || 0;
      const sgst = item.sgst || 0;
      const igst = item.igst || 0;
      const trans = item.trans_as_invoice || 0;
      const total = item.total || 0;

      totBasic += basic;
      totCgst += cgst;
      totSgst += sgst;
      totIgst += igst;
      totTrans += trans;
      totGrand += total;

      rows.push([
        idx + 1,
        item.month || getRealTimeMonth(item.date),
        item.date ? item.date.split('T')[0] : '—',
        item.po_no || '—',
        item.po_date ? item.po_date.split('T')[0] : '—',
        item.supplier || '—',
        item.make || '—',
        item.inv_no || '—',
        item.igr_no || '—',
        item.raw_material || '—',
        item.unit || getUnitForRawMaterial(item.raw_material),
        item.qty || 0,
        item.rate || 0,
        basic,
        cgst,
        sgst,
        igst,
        trans,
        item.trans_per_unit || 0,
        total
      ]);
    });

    rows.push([
      'TOTAL', '', '', '', '', '', '', '', '', '', '', '', '',
      totBasic, totCgst, totSgst, totIgst, totTrans, '', totGrand
    ]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [
      { wch: 8 },  { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 12 },
      { wch: 24 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 28 },
      { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 14 },
      { wch: 14 }, { wch: 14 }, { wch: 20 }, { wch: 16 }, { wch: 20 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'PO Production Sheet');
    const filename = `PO_Production_Sheet_${capitalize(currentBranch)}_${filterTag}.xlsx`;
    XLSX.writeFile(wb, filename);
    showToast(`Downloaded PO Production Sheet Excel (${entries.length} entries)`, 'success');
    return;
  }

  if (activeSubTab === 'igr') {
    let entries = [...currentIGREntries];

    // Date range filter
    if (fromDate || toDate) {
      entries = entries.filter(item => {
        const d = item.date ? item.date.split('T')[0] : '';
        if (!d) return false;
        if (fromDate && d < fromDate) return false;
        if (toDate && d > toDate) return false;
        return true;
      });
    } else {
      const selectedMonth = tabMonthFilters['igr'] || 'all';
      if (selectedMonth && selectedMonth.toLowerCase() !== 'all') {
        entries = filterEntriesBySelectedMonth(entries, selectedMonth);
      }
    }

    // Supplier filter
    if (selectedSupplier !== 'all') {
      const sLower = selectedSupplier.toLowerCase();
      entries = entries.filter(item => item.supplier_name && item.supplier_name.toLowerCase().includes(sLower));
    }

    if (!entries || entries.length === 0) {
      const suppText = selectedSupplier !== 'all' ? ` for supplier "${selectedSupplier}"` : '';
      const msg = (fromDate || toDate)
        ? `No IGR entries found between ${fromDate || 'Start'} and ${toDate || 'End'}${suppText}.`
        : `No IGR entries found${suppText}.`;
      showToast(msg, 'warning');
      return;
    }

    const headers = [
      'SL NO', 'MONTH', 'DATE', 'IGR NO', 'INVOICE NO & DATE', 'SUPPLIER NAME',
      'DESCRIPTION', 'MATERIAL VALUE (₹)', 'TRANSPORT (₹)', 'LABOUR CHARGES (₹)',
      'TAXABLE VALUE (₹)', 'TAX RATE (%)', 'IGST (₹)', 'CGST (₹)', 'SGST (₹)', 'INVOICE VALUE (₹)'
    ];

    let totMat = 0, totTr = 0, totLab = 0, totTaxable = 0, totIgst = 0, totCgst = 0, totSgst = 0, totInv = 0;
    const rows = [headers];

    entries.forEach((item, idx) => {
      const mat = item.material_value || 0;
      const tr = item.transport || 0;
      const lab = item.labour_charges || 0;
      const tax = item.taxable_value || 0;
      const igst = item.igst || 0;
      const cgst = item.cgst || 0;
      const sgst = item.sgst || 0;
      const inv = item.invoice_value || 0;

      totMat += mat;
      totTr += tr;
      totLab += lab;
      totTaxable += tax;
      totIgst += igst;
      totCgst += cgst;
      totSgst += sgst;
      totInv += inv;

      rows.push([
        idx + 1,
        item.month || getRealTimeMonth(item.date),
        item.date ? item.date.split('T')[0] : '—',
        item.igr_no || '—',
        item.invoice_no_date || '—',
        item.supplier_name || '—',
        item.description || '—',
        mat,
        tr,
        lab,
        tax,
        ((item.taxable_rate || 0) * 100).toFixed(0) + '%',
        igst,
        cgst,
        sgst,
        inv
      ]);
    });

    rows.push([
      'TOTAL', '', '', '', '', '', 'Grand Total',
      totMat, totTr, totLab, totTaxable, '', totIgst, totCgst, totSgst, totInv
    ]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [
      { wch: 8 },  { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 20 },
      { wch: 24 }, { wch: 30 }, { wch: 18 }, { wch: 14 }, { wch: 18 },
      { wch: 18 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 20 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'IGR Inventory');
    const filename = `IGR_Inventory_${capitalize(currentBranch)}_${filterTag}.xlsx`;
    XLSX.writeFile(wb, filename);
    showToast(`Downloaded IGR Excel (${entries.length} entries)`, 'success');

  } else if (activeSubTab === 'bpr') {
    let entries = [...currentBPREntries];

    if (fromDate || toDate) {
      entries = entries.filter(item => {
        const d = item.date ? item.date.split('T')[0] : '';
        if (!d) return false;
        if (fromDate && d < fromDate) return false;
        if (toDate && d > toDate) return false;
        return true;
      });
    } else {
      const selectedMonth = tabMonthFilters['bpr'] || 'all';
      if (selectedMonth && selectedMonth.toLowerCase() !== 'all') {
        entries = filterEntriesBySelectedMonth(entries, selectedMonth);
      }
    }

    if (selectedSupplier !== 'all') {
      const sLower = selectedSupplier.toLowerCase();
      entries = entries.filter(item => item.supplier && item.supplier.toLowerCase().includes(sLower));
    }

    if (!entries || entries.length === 0) {
      const suppText = selectedSupplier !== 'all' ? ` for supplier "${selectedSupplier}"` : '';
      const msg = (fromDate || toDate)
        ? `No BPR entries found between ${fromDate || 'Start'} and ${toDate || 'End'}${suppText}.`
        : `No BPR entries found${suppText}.`;
      showToast(msg, 'warning');
      return;
    }

    const headers = [
      'SL NO', 'MONTH', 'DATE', 'BPR NO', 'CONTRACTOR NAME', 'JOB WORK',
      'SUPPLIER', 'INVOICE NO & DATE', 'PARTICULARS', 'DESCRIPTION',
      'TAXABLE VALUE (₹)', 'TAX RATE (%)', 'IGST (₹)', 'CGST (₹)', 'SGST (₹)',
      'INVOICE VALUE (₹)', 'REMARKS'
    ];

    let totTaxable = 0, totIgst = 0, totCgst = 0, totSgst = 0, totInv = 0;
    const rows = [headers];

    entries.forEach((item, idx) => {
      const tax = item.taxable_value || 0;
      const igst = item.igst || 0;
      const cgst = item.cgst || 0;
      const sgst = item.sgst || 0;
      const inv = item.invoice_value || 0;

      totTaxable += tax;
      totIgst += igst;
      totCgst += cgst;
      totSgst += sgst;
      totInv += inv;

      rows.push([
        idx + 1,
        item.month || getRealTimeMonth(item.date),
        item.date ? item.date.split('T')[0] : '—',
        item.bpr_no || '—',
        item.contractor_name || '—',
        item.job_work || '—',
        item.supplier || '—',
        item.invoice_no_date || '—',
        item.particulars || '—',
        item.description || '—',
        tax,
        ((item.taxable_rate || 0) * 100).toFixed(0) + '%',
        igst,
        cgst,
        sgst,
        inv,
        item.remarks || '—'
      ]);
    });

    rows.push([
      'TOTAL', '', '', '', '', '', '', '', '', 'Grand Total',
      totTaxable, '', totIgst, totCgst, totSgst, totInv, ''
    ]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [
      { wch: 8 },  { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 22 },
      { wch: 20 }, { wch: 22 }, { wch: 20 }, { wch: 20 }, { wch: 28 },
      { wch: 18 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
      { wch: 20 }, { wch: 24 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'BPR Inventory');
    const filename = `BPR_Inventory_${capitalize(currentBranch)}_${filterTag}.xlsx`;
    XLSX.writeFile(wb, filename);
    showToast(`Downloaded BPR Excel (${entries.length} entries)`, 'success');

  } else if (activeSubTab === 'supplier' || activeSubTab === 'abstract') {
    let igrEntries = [...(currentIGREntries || [])];
    let bprEntries = [...(currentBPREntries || [])];

    if (fromDate || toDate) {
      igrEntries = igrEntries.filter(item => {
        const d = item.date ? item.date.split('T')[0] : '';
        if (!d) return false;
        if (fromDate && d < fromDate) return false;
        if (toDate && d > toDate) return false;
        return true;
      });
      bprEntries = bprEntries.filter(item => {
        const d = item.date ? item.date.split('T')[0] : '';
        if (!d) return false;
        if (fromDate && d < fromDate) return false;
        if (toDate && d > toDate) return false;
        return true;
      });
    }

    if (selectedSupplier !== 'all') {
      const sLower = selectedSupplier.toLowerCase();
      igrEntries = igrEntries.filter(item => item.supplier_name && item.supplier_name.toLowerCase().includes(sLower));
      bprEntries = bprEntries.filter(item => item.supplier && item.supplier.toLowerCase().includes(sLower));
    }

    if (igrEntries.length === 0 && bprEntries.length === 0) {
      const suppText = selectedSupplier !== 'all' ? ` for supplier "${selectedSupplier}"` : '';
      showToast(`No inventory data found${suppText} for the selected criteria.`, 'warning');
      return;
    }

    if (igrEntries.length > 0) {
      const headers = [
        'SL NO', 'MONTH', 'DATE', 'IGR NO', 'INVOICE NO & DATE', 'SUPPLIER NAME',
        'DESCRIPTION', 'MATERIAL VALUE (₹)', 'TRANSPORT (₹)', 'LABOUR CHARGES (₹)',
        'TAXABLE VALUE (₹)', 'TAX RATE (%)', 'IGST (₹)', 'CGST (₹)', 'SGST (₹)', 'INVOICE VALUE (₹)'
      ];
      let totMat = 0, totTr = 0, totLab = 0, totTaxable = 0, totIgst = 0, totCgst = 0, totSgst = 0, totInv = 0;
      const rows = [headers];
      igrEntries.forEach((item, idx) => {
        totMat += item.material_value || 0;
        totTr += item.transport || 0;
        totLab += item.labour_charges || 0;
        totTaxable += item.taxable_value || 0;
        totIgst += item.igst || 0;
        totCgst += item.cgst || 0;
        totSgst += item.sgst || 0;
        totInv += item.invoice_value || 0;

        rows.push([
          idx + 1, item.month || getRealTimeMonth(item.date), item.date ? item.date.split('T')[0] : '—',
          item.igr_no || '—', item.invoice_no_date || '—', item.supplier_name || '—',
          item.description || '—', item.material_value || 0, item.transport || 0,
          item.labour_charges || 0, item.taxable_value || 0,
          ((item.taxable_rate || 0) * 100).toFixed(0) + '%',
          item.igst || 0, item.cgst || 0, item.sgst || 0, item.invoice_value || 0
        ]);
      });
      rows.push(['TOTAL', '', '', '', '', '', 'Grand Total', totMat, totTr, totLab, totTaxable, '', totIgst, totCgst, totSgst, totInv]);
      const wsIgr = XLSX.utils.aoa_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, wsIgr, 'IGR Entries');
    }

    if (bprEntries.length > 0) {
      const headers = [
        'SL NO', 'MONTH', 'DATE', 'BPR NO', 'CONTRACTOR NAME', 'JOB WORK',
        'SUPPLIER', 'INVOICE NO & DATE', 'PARTICULARS', 'DESCRIPTION',
        'TAXABLE VALUE (₹)', 'TAX RATE (%)', 'IGST (₹)', 'CGST (₹)', 'SGST (₹)',
        'INVOICE VALUE (₹)', 'REMARKS'
      ];
      let totTaxable = 0, totIgst = 0, totCgst = 0, totSgst = 0, totInv = 0;
      const rows = [headers];
      bprEntries.forEach((item, idx) => {
        totTaxable += item.taxable_value || 0;
        totIgst += item.igst || 0;
        totCgst += item.cgst || 0;
        totSgst += item.sgst || 0;
        totInv += item.invoice_value || 0;

        rows.push([
          idx + 1, item.month || getRealTimeMonth(item.date), item.date ? item.date.split('T')[0] : '—',
          item.bpr_no || '—', item.contractor_name || '—', item.job_work || '—',
          item.supplier || '—', item.invoice_no_date || '—', item.particulars || '—',
          item.description || '—', item.taxable_value || 0,
          ((item.taxable_rate || 0) * 100).toFixed(0) + '%',
          item.igst || 0, item.cgst || 0, item.sgst || 0, item.invoice_value || 0,
          item.remarks || '—'
        ]);
      });
      rows.push(['TOTAL', '', '', '', '', '', '', '', '', 'Grand Total', totTaxable, '', totIgst, totCgst, totSgst, totInv, '']);
      const wsBpr = XLSX.utils.aoa_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, wsBpr, 'BPR Entries');
    }

    const filename = `Supplier_Data_${capitalize(currentBranch)}_${filterTag}.xlsx`;
    XLSX.writeFile(wb, filename);
    showToast(`Downloaded Supplier Excel (${igrEntries.length + bprEntries.length} total entries)`, 'success');
  }
}

window.exportInventoryToExcel = exportInventoryToExcel;

// ─── MATERIALS MODULE LOGIC ──────────────────────────────────────────────────
let materialsData = { raw_materials: [], consumable_items: [], electric_materials: [], tools: [] };
let activeMaterialsSubTab = 'raw_materials';

async function fetchWithAuth(url, options = {}) {
  const token = (typeof getToken === 'function' ? getToken() : null) || sessionStorage.getItem('auth_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  
  return fetch(url, { ...options, headers });
}

async function loadMaterialsData(silent = false) {
  try {
    const res = await fetchWithAuth('/api/purchase/materials');
    if (res && res.ok) {
      const data = await res.json();
      if (data && typeof data === 'object') {
        materialsData = {
          raw_materials: data.raw_materials || [],
          consumable_items: data.consumable_items || [],
          electric_materials: data.electric_materials || [],
          tools: data.tools || []
        };
      }
    }
  } catch (err) {
    console.error('Error fetching materials data:', err);
    if (!silent && typeof showToast === 'function') {
      showToast('Failed to load materials data', 'error');
    }
  } finally {
    renderAllMaterialsTables();
  }
}

function renderAllMaterialsTables() {
  renderRawMaterialsTable();
  renderConsumableItemsTable();
  renderElectricMaterialsTable();
  renderToolsTable();
}

function setupMaterialsSubTabs() {
  const materialsSubTabBtns = document.querySelectorAll('.materials-subtab-btn');
  materialsSubTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const subtabKey = btn.dataset.subtab;
      if (!subtabKey) return;
      switchMaterialsSubTab(subtabKey);
    });
  });

  // Setup search input listeners
  const rawSearch = document.getElementById('raw-materials-search');
  if (rawSearch) {
    rawSearch.addEventListener('input', () => renderRawMaterialsTable());
  }

  const conSearch = document.getElementById('consumable-search');
  if (conSearch) {
    conSearch.addEventListener('input', () => renderConsumableItemsTable());
  }

  const eleSearch = document.getElementById('electric-search');
  if (eleSearch) {
    eleSearch.addEventListener('input', () => renderElectricMaterialsTable());
  }

  const toolSearch = document.getElementById('tools-search');
  if (toolSearch) {
    toolSearch.addEventListener('input', () => renderToolsTable());
  }

  // Setup Modal listeners
  const closeModalBtn = document.getElementById('close-update-material-modal');
  const cancelModalBtn = document.getElementById('cancel-update-material-modal');
  const saveModalBtn = document.getElementById('save-update-material-btn');
  const modalBackdrop = document.getElementById('modal-update-material');

  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', () => modalBackdrop.classList.add('hidden'));
  }

  if (cancelModalBtn) {
    cancelModalBtn.addEventListener('click', () => modalBackdrop.classList.add('hidden'));
  }

  if (saveModalBtn) {
    saveModalBtn.addEventListener('click', saveMaterialUpdate);
  }

  // Setup click delegation for edit buttons
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-update-item');
    if (btn) {
      const category = btn.dataset.category;
      const id = btn.dataset.id;
      if (category && id) {
        openUpdateMaterialModal(category, id);
      }
    }
  });
}

function switchMaterialsSubTab(subtabKey) {
  activeMaterialsSubTab = subtabKey;
  const materialsSubTabBtns = document.querySelectorAll('.materials-subtab-btn');
  materialsSubTabBtns.forEach(b => {
    b.classList.toggle('active', b.dataset.subtab === subtabKey);
  });

  document.querySelectorAll('.materials-subpanel').forEach(panel => {
    panel.classList.add('hidden');
  });

  const targetPanel = document.getElementById(`materials-subpanel-${subtabKey}`);
  if (targetPanel) {
    targetPanel.classList.remove('hidden');
  }

  renderAllMaterialsTables();
}

function renderActiveMaterialsTable() {
  renderAllMaterialsTables();
}

function getAllSystemUnits() {
  const unitsSet = new Set([
    'NOS', 'Box', 'Set', 'Mtr', 'Ltr', 'Kg', 'Sqmt', 'Rmt', 'Pair', 
    'Pocket', 'Pkt', 'Can', 'Tin', 'Roll', "Kg's", 'Sqm', 'Pcs', 'Coil', 
    'Bundle', 'Feet', 'Inch', 'Meters', 'Gross', 'Dozen', 'Sheet', 'Tube'
  ]);

  if (materialsData && typeof materialsData === 'object') {
    Object.values(materialsData).forEach(catList => {
      if (Array.isArray(catList)) {
        catList.forEach(item => {
          if (item.uom) unitsSet.add(String(item.uom).trim());
          if (item.purchased_unit) unitsSet.add(String(item.purchased_unit).trim());
          if (item.consumed_unit) unitsSet.add(String(item.consumed_unit).trim());
          if (item.displayed_unit) unitsSet.add(String(item.displayed_unit).trim());
        });
      }
    });
  }

  if (typeof poData !== 'undefined' && Array.isArray(poData)) {
    poData.forEach(po => {
      if (Array.isArray(po.items)) {
        po.items.forEach(it => {
          if (it.uom) unitsSet.add(String(it.uom).trim());
          if (it.unit) unitsSet.add(String(it.unit).trim());
        });
      }
    });
  }

  if (typeof inwardData !== 'undefined' && Array.isArray(inwardData)) {
    inwardData.forEach(inw => {
      if (Array.isArray(inw.items)) {
        inw.items.forEach(it => {
          if (it.uom) unitsSet.add(String(it.uom).trim());
          if (it.unit) unitsSet.add(String(it.unit).trim());
        });
      }
    });
  }

  const map = new Map();
  unitsSet.forEach(u => {
    if (!u) return;
    const lower = u.toLowerCase();
    if (!map.has(lower)) {
      map.set(lower, u);
    } else {
      const existing = map.get(lower);
      if (existing === existing.toLowerCase() && u !== u.toLowerCase()) {
        map.set(lower, u);
      }
    }
  });

  return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
}

function isPurchaseUserRole() {
  return true;
}

function renderRawMaterialsTable() {
  const tbody = document.getElementById('raw-materials-tbody');
  const countPill = document.getElementById('raw-materials-count-pill');
  if (!tbody) return;

  let list = materialsData.raw_materials || [];
  const query = (document.getElementById('raw-materials-search')?.value || '').toLowerCase().trim();
  if (query) {
    list = list.filter(item => item.name && item.name.toLowerCase().includes(query));
  }

  if (countPill) countPill.textContent = `${list.length} Items`;

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="3" style="text-align:center; padding:32px; color:var(--text-muted);">
          No raw materials match your search criteria.
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = list.map((item, idx) => `
    <tr>
      <td style="font-weight:700; color:var(--text-muted);">${idx + 1}</td>
      <td style="font-weight:600; color:var(--text-primary);">${escapeHtml(item.name)}</td>
      <td style="text-align:center;">
        <button class="btn-know-rate" data-name="${escapeHtml(item.name)}" onclick="handleKnowRate('${escapeHtml(item.name)}')">
          ℹ️ Know the rate
        </button>
      </td>
    </tr>
  `).join('');
}

function renderConsumableItemsTable() {
  const tbody = document.getElementById('consumable-items-tbody');
  const countPill = document.getElementById('consumables-count-pill');
  if (!tbody) return;

  const showAction = isPurchaseUserRole();
  const table = tbody.closest('table');
  if (table) {
    const actionTh = table.querySelector('thead tr th:last-child');
    if (actionTh && actionTh.textContent.trim().toUpperCase() === 'ACTION') {
      actionTh.style.display = showAction ? '' : 'none';
    }
  }

  let list = materialsData.consumable_items || [];
  const query = (document.getElementById('consumable-search')?.value || '').toLowerCase().trim();
  if (query) {
    list = list.filter(item => item.name && item.name.toLowerCase().includes(query));
  }

  if (countPill) countPill.textContent = `${list.length} Items`;

  const colspan = showAction ? 5 : 4;
  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="${colspan}" style="text-align:center; padding:32px; color:var(--text-muted);">
          No consumable items found.
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = list.map((item, idx) => `
    <tr>
      <td style="font-weight:700; color:var(--text-muted);">${idx + 1}</td>
      <td style="font-weight:600; color:var(--text-primary);">${escapeHtml(item.name)}</td>
      <td style="text-align:right; font-weight:700; color:var(--accent);">${item.qty !== undefined ? item.qty : 0}</td>
      <td style="text-align:center;"><span class="unit-badge">${escapeHtml(item.uom || 'NOS')}</span></td>
      ${showAction ? `
      <td style="text-align:center;">
        <button class="btn-update-item" data-category="consumable_items" data-id="${item.id}" onclick="openUpdateMaterialModal('consumable_items', ${item.id})">
          ✏️ Edit
        </button>
      </td>` : ''}
    </tr>
  `).join('');
}

function renderElectricMaterialsTable() {
  const tbody = document.getElementById('electric-materials-tbody');
  const countPill = document.getElementById('electric-count-pill');
  if (!tbody) return;

  const showAction = isPurchaseUserRole();
  const table = tbody.closest('table');
  if (table) {
    const actionTh = table.querySelector('thead tr th:last-child');
    if (actionTh && actionTh.textContent.trim().toUpperCase() === 'ACTION') {
      actionTh.style.display = showAction ? '' : 'none';
    }
  }

  let list = materialsData.electric_materials || [];
  const query = (document.getElementById('electric-search')?.value || '').toLowerCase().trim();
  if (query) {
    list = list.filter(item => item.name && item.name.toLowerCase().includes(query));
  }

  if (countPill) countPill.textContent = `${list.length} Items`;

  const colspan = showAction ? 5 : 4;
  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="${colspan}" style="text-align:center; padding:32px; color:var(--text-muted);">
          No electric materials found.
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = list.map((item, idx) => `
    <tr>
      <td style="font-weight:700; color:var(--text-muted);">${idx + 1}</td>
      <td style="font-weight:600; color:var(--text-primary);">${escapeHtml(item.name)}</td>
      <td style="text-align:right; font-weight:700; color:var(--accent);">${item.qty !== undefined ? item.qty : 0}</td>
      <td style="text-align:center;"><span class="unit-badge">${escapeHtml(item.uom || 'NOS')}</span></td>
      ${showAction ? `
      <td style="text-align:center;">
        <button class="btn-update-item" data-category="electric_materials" data-id="${item.id}" onclick="openUpdateMaterialModal('electric_materials', ${item.id})">
          ✏️ Edit
        </button>
      </td>` : ''}
    </tr>
  `).join('');
}

function renderToolsTable() {
  const tbody = document.getElementById('tools-tbody');
  const countPill = document.getElementById('tools-count-pill');
  if (!tbody) return;

  const showAction = isPurchaseUserRole();
  const table = tbody.closest('table');
  if (table) {
    const actionTh = table.querySelector('thead tr th:last-child');
    if (actionTh && actionTh.textContent.trim().toUpperCase() === 'ACTION') {
      actionTh.style.display = showAction ? '' : 'none';
    }
  }

  let list = materialsData.tools || [];
  const query = (document.getElementById('tools-search')?.value || '').toLowerCase().trim();
  if (query) {
    list = list.filter(item => item.name && item.name.toLowerCase().includes(query));
  }

  if (countPill) countPill.textContent = `${list.length} Items`;

  const colspan = showAction ? 5 : 4;
  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="${colspan}" style="text-align:center; padding:32px; color:var(--text-muted);">
          No tools found matching your search.
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = list.map((item, idx) => `
    <tr>
      <td style="font-weight:700; color:var(--text-muted);">${idx + 1}</td>
      <td style="font-weight:600; color:var(--text-primary);">${escapeHtml(item.name)}</td>
      <td style="text-align:right; font-weight:700; color:var(--accent);">${item.qty !== undefined ? item.qty : 0}</td>
      <td style="text-align:center;"><span class="unit-badge">${escapeHtml(item.uom || 'NOS')}</span></td>
      ${showAction ? `
      <td style="text-align:center;">
        <button class="btn-update-item" data-category="tools" data-id="${item.id}" onclick="openUpdateMaterialModal('tools', ${item.id})">
          ✏️ Edit
        </button>
      </td>` : ''}
    </tr>
  `).join('');
}

function handleKnowRate(materialName) {
  showToast(`ℹ️ "Know the rate" feature for "${materialName}" will be configured soon.`, 'info');
}

function openUpdateMaterialModal(category, itemId) {
  const list = materialsData[category] || [];
  const item = list.find(i => String(i.id) === String(itemId));
  if (!item) {
    showToast('Material item not found', 'error');
    return;
  }

  const categoryEl = document.getElementById('update-material-category');
  const idEl = document.getElementById('update-material-id');
  const nameEl = document.getElementById('update-material-name');
  const qtyEl = document.getElementById('update-material-qty');
  const uomSelect = document.getElementById('update-material-uom');
  const titleEl = document.getElementById('update-material-modal-title');
  const modal = document.getElementById('modal-update-material');

  if (categoryEl) categoryEl.value = category;
  if (idEl) idEl.value = itemId;
  if (nameEl) nameEl.value = item.name || '';
  if (qtyEl) qtyEl.value = item.qty !== undefined ? item.qty : 0;
  if (titleEl) titleEl.textContent = `Edit Material: ${item.name}`;

  if (uomSelect) {
    uomSelect.innerHTML = '';
    const allUnits = getAllSystemUnits();
    const itemUom = item.uom || item.displayed_unit || item.purchased_unit || 'NOS';
    
    if (!allUnits.some(u => u.toLowerCase() === String(itemUom).toLowerCase())) {
      allUnits.push(itemUom);
      allUnits.sort((a, b) => a.localeCompare(b));
    }

    allUnits.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u;
      opt.textContent = u;
      uomSelect.appendChild(opt);
    });

    const matchOpt = Array.from(uomSelect.options).find(o => o.value.toLowerCase() === String(itemUom).toLowerCase());
    if (matchOpt) {
      uomSelect.value = matchOpt.value;
    } else {
      uomSelect.value = itemUom;
    }
  }

  if (modal) {
    modal.classList.remove('hidden');
  }
}

async function saveMaterialUpdate() {
  const category = document.getElementById('update-material-category')?.value;
  const id = document.getElementById('update-material-id')?.value;
  const qtyRaw = document.getElementById('update-material-qty')?.value;
  const uom = document.getElementById('update-material-uom')?.value || 'NOS';

  if (!category || !id) return;

  const qty = parseFloat(qtyRaw);
  if (isNaN(qty) || qty < 0) {
    showToast('Please enter a valid non-negative quantity', 'warning');
    return;
  }

  try {
    const res = await fetchWithAuth(`/api/purchase/materials/${category}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qty, uom })
    });

    if (res && res.ok) {
      const data = await res.json();
      if (data && data.success) {
        // Update local memory state immediately
        const list = materialsData[category] || [];
        const item = list.find(i => String(i.id) === String(id));
        if (item) {
          item.qty = qty;
          item.uom = uom;
          if (category === 'raw_materials') {
            item.displayed_unit = uom;
          }
        }
        renderAllMaterialsTables();
        const modal = document.getElementById('modal-update-material');
        if (modal) modal.classList.add('hidden');
        showToast(`Updated "${item ? item.name : 'Item'}" stock to ${qty} ${uom}`, 'success');
        return;
      }
    }
    showToast('Failed to update material item', 'error');
  } catch (err) {
    console.error('Error saving material update:', err);
    showToast('Failed to save material update: ' + err.message, 'error');
  }
}

window.handleKnowRate = handleKnowRate;
window.openUpdateMaterialModal = openUpdateMaterialModal;

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  initPurchase();
});
