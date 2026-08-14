/**
 * planning.js — Planning Department page logic
 */

const API_PLANNING = '/api/planning';

let currentUser = null;
let currentBranch = 'maalur';
let currentProjectId = null; // for quantity modals
let selectedFile = null;
let allProjects = [];
let currentBranchProjects = [];
let currentBifurcation = 'all';
let currentStatusFilter = 'all';
let currentConversionFilter = 'all';
let revisingProject = null; // target project object when revising

function getProjectConversionStatus(p) {
  if (!p) return 'not_converted';
  if (p.conversion_status === 'converted' && p.po_file_path) {
    return 'converted';
  }
  if (p.conversion_status === 'not_converted') {
    return 'not_converted';
  }
  // Real-time 15-day check: if no conversion status assigned within 15 days, it is automatically considered Not Converted
  const createdAt = p.created_at ? new Date(p.created_at).getTime() : Date.now();
  const ageInDays = (Date.now() - createdAt) / (1000 * 60 * 60 * 24);
  return 'not_converted';
}

// ─── Product List ──────────────────────────────────────────────────────────────
const PRODUCT_LIST = [
  'Box Duct with TDF',
  'Box Duct with Angle Flange',
  'Box Duct with S&C',
  'Spigot Damper Ø150',
  'Spigot Damper Ø200',
  'Spigot Damper Ø250',
  'Spigot Damper Ø300',
  'Spigot Damper Ø350',
  'Spigot Damper Ø400',
  'Spigot Damper Ø450',
  'Spigot Damper Ø500',
  'Box Duct with TDF with Paint',
  'Spiral Oval Duct',
  'Spiral Round Duct',
  'H Bracket',
  'Gasket',
  'Cleats',
  'Corners',
  'Alu. Duct',
  'SS Duct',
  'VCD',
  'Spigot Damper',
  'Mixing Box',
  'Spigot Damper with Paint',
  'Mixing Box with Paint',
  'Box Duct with TDF with Powdercoat',
  'Spiral Oval Duct with Paint',
  'Spiral Round Duct with Paint',
  'SS Duct with Powdercoat',
  'Spigot Damper with Powdercoat',
  'Mixing Box with Powdercoat',
  'Box Duct with Plain end',
  'Spiral Oval Duct with Powdercoat',
  'Spiral Round Duct with Powdercoat',
  'Sealant',
  'C Cleat',
  'S Cleat',
  'C Clamp',
  'VAV',
  'Spiral Coupling',
  'Collar',
  'Plain Round Duct',
  'Plain Round Duct with Paint',
  'Plain Sheet',
  'Insulation',
  'Threaded Rod',
  'Round Flange',
  'CTS',
  'Flange Insulation',
  'Round Coupling',
  'Oval VCD',
  'PIR Duct',
  'PIR Sheet',
  'Bright Rod Square',
  'Bright Rod Round'
];

const RAW_MATERIALS_LIST = [
  "10 mm JTR",
  "120gsm 18G",
  "120gsm 20G",
  "120gsm 22G",
  "120gsm 24G",
  "120gsm 26G",
  "120gsm Slit 18G",
  "120gsm Slit 20G",
  "120gsm Slit 22G",
  "120gsm Slit 24G",
  "275gsm 22G",
  "275gsm 24G",
  "Alu. 0.8mm",
  "Alu. 1mm",
  "Bright Rod 10mm",
  "C Clamp",
  "Cleats",
  "Corner 25mm",
  "Corner 32mm",
  "H Bracket",
  "Insu Aerocell Thermal 13mm",
  "Insu Armasound Acou. 10mm",
  "Insu Armasound Acou. 15mm",
  "Insu Armasound Acou. 25mm",
  "Insu Kflex Thermal 13mm",
  "Insu Kflex Thermal 6mm",
  "Insu Kflex Thermal 9mm",
  "Insu Kflex Vidoflex 13mm",
  "Insu Kflex Vidoflex 19mm",
  "Insu Kflex Vidoflex 25mm",
  "Insu Kflex Vidoflex 6mm",
  "Insu Kflex Vidoflex 9mm",
  "Insu TF 13mm",
  "Insu TF 19mm",
  "Insu TF 25mm",
  "Insu TF 6mm",
  "Insu TF 9mm",
  "Insu XLPE Acou. 10mm",
  "Insu XLPE Acou. 15mm",
  "Insu XLPE Acou. 25mm",
  "Insu XLPE Thermal 12mm",
  "Insu XLPE Thermal 13mm",
  "Insu XLPE Thermal 15mm",
  "Insu XLPE Thermal 19mm",
  "Insu XLPE Thermal 20mm",
  "Insu XLPE Thermal 25mm",
  "Insu XLPE Thermal 6mm",
  "Insu XLPE Thermal 8mm",
  "Insu XLPE Thermal 9mm",
  "JCS Cleats",
  "Plain round Damper Dia 150",
  "Plain round Damper Dia 200",
  "Plain round Damper Dia 250",
  "Plain round Damper Dia 300",
  "Plain round Damper Dia 350",
  "Plain round Damper Dia 400",
  "Plain round Damper Dia 450",
  "Plain round Damper Dia 500",
  "Red Oxide paint",
  "Round Flange 25x3",
  "Round Flange 30x3",
  "Round Flange 40x3",
  "Round Flange 40x5",
  "Round Flange 50x5",
  "SS 304 0.8mm",
  "SS 304 1mm",
  "Threaded Rod 10mm",
  "Threaded Rod 8mm"
];

const INSULATION_PRODUCT_LIST = [
  'Insu Kflex Thermal 6mm',
  'Insu Kflex Thermal 9mm',
  'Insu Kflex Thermal 13mm',
  'Insu Kflex Vidoflex 6mm',
  'Insu Kflex Vidoflex 9mm',
  'Insu Kflex Vidoflex 13mm',
  'Insu Kflex Vidoflex 19mm',
  'Insu Kflex Vidoflex 25mm',
  'Insu TF 6mm',
  'Insu TF 9mm',
  'Insu TF 13mm',
  'Insu TF 19mm',
  'Insu TF 25mm',
  'Insu XLPE Thermal 6mm',
  'Insu XLPE Thermal 8mm',
  'Insu XLPE Thermal 9mm',
  'Insu XLPE Thermal 12mm',
  'Insu XLPE Thermal 13mm',
  'Insu XLPE Thermal 15mm',
  'Insu XLPE Thermal 19mm',
  'Insu XLPE Thermal 20mm',
  'Insu XLPE Thermal 25mm',
  'Insu XLPE Acou. 10mm',
  'Insu XLPE Acou. 15mm',
  'Insu XLPE Acou. 25mm',
  'Insu Armasound Acou. 10mm',
  'Insu Armasound Acou. 15mm',
  'Insu Armasound Acou. 25mm',
  'Insu Aerocell Thermal 13mm'
];

const MAKE_LIST = ['Paramount', 'Vidoflex', 'Acoustic', 'Thermal', 'Supreme', 'Trocellen', 'Kflex', 'Armasound', 'Aerocell'];

const UNIT_LIST = ['sqft', 'sqmt', 'nos', 'rmt', 'kg', 'ltr', 'set', 'pcs', 'mtr'];

// ─── All Indian States & UTs for Zone Dropdown ──────────────────────────────
const INDIA_STATES = [
  { code: 'KA', name: 'Karnataka' },
  { code: 'HR', name: 'Haryana' },
  { code: 'TN', name: 'Tamil Nadu' },
  { code: 'KL', name: 'Kerala' },
  { code: 'AP', name: 'Andhra Pradesh' },
  { code: 'TS', name: 'Telangana' },
  { code: 'MH', name: 'Maharashtra' },
  { code: 'DL', name: 'Delhi' },
  { code: 'GJ', name: 'Gujarat' },
  { code: 'RJ', name: 'Rajasthan' },
  { code: 'UP', name: 'Uttar Pradesh' },
  { code: 'WB', name: 'West Bengal' },
  { code: 'PB', name: 'Punjab' },
  { code: 'MP', name: 'Madhya Pradesh' },
  { code: 'BR', name: 'Bihar' },
  { code: 'OD', name: 'Odisha' },
  { code: 'AS', name: 'Assam' },
  { code: 'JH', name: 'Jharkhand' },
  { code: 'CG', name: 'Chhattisgarh' },
  { code: 'UK', name: 'Uttarakhand' },
  { code: 'HP', name: 'Himachal Pradesh' },
  { code: 'GA', name: 'Goa' },
  { code: 'JK', name: 'Jammu and Kashmir' },
  { code: 'LA', name: 'Ladakh' },
  { code: 'CH', name: 'Chandigarh' },
  { code: 'PY', name: 'Puducherry' },
  { code: 'TR', name: 'Tripura' },
  { code: 'ML', name: 'Meghalaya' },
  { code: 'MN', name: 'Manipur' },
  { code: 'NL', name: 'Nagaland' },
  { code: 'GA', name: 'Goa' },
  { code: 'AR', name: 'Arunachal Pradesh' },
  { code: 'MZ', name: 'Mizoram' },
  { code: 'SK', name: 'Sikkim' },
  { code: 'AN', name: 'Andaman and Nicobar Islands' },
  { code: 'DN', name: 'Dadra and Nagar Haveli and Daman and Diu' },
  { code: 'LD', name: 'Lakshadweep' }
];

// Build a product item row for PO / Billing / Insulation modals
function buildProductItemRow(containerId, idx, existing = {}) {
  const unitOptions = UNIT_LIST.map(u =>
    `<option value="${u}" ${existing.unit === u ? 'selected' : ''}>${u}</option>`
  ).join('');

  if (containerId === 'billing-items-container') {
    const matOptions = RAW_MATERIALS_LIST.map(m =>
      `<option value="${m}" ${existing.material === m ? 'selected' : ''}>${m}</option>`
    ).join('');
    return `
      <div class="product-item-row" data-row-idx="${idx}" style="display:grid; grid-template-columns: 2fr 1.5fr 1fr 1fr 32px; gap:6px; align-items:center; background:#f8fafc; border:1px solid var(--border); border-radius:8px; padding:8px 10px;">
        <div class="pi-combobox" style="position:relative;">
          <input class="form-input pi-product-search" type="text" placeholder="🔍 Search product..." autocomplete="off" value="${existing.product || ''}" style="font-size:0.85rem; width:100%; box-sizing:border-box;">
          <input class="pi-product-value" type="hidden" value="${existing.product || ''}">
        </div>
        <select class="form-input pi-material" style="font-size:0.85rem;">
          <option value="">Material</option>
          ${matOptions}
        </select>
        <select class="form-input pi-unit" style="font-size:0.85rem;">
          <option value="">Unit</option>
          ${unitOptions}
        </select>
        <input class="form-input pi-qty" type="number" placeholder="Qty" min="0" step="0.01" value="${existing.qty || ''}" style="font-size:0.85rem;">
        <button type="button" class="btn btn-ghost btn-sm pi-remove-btn" style="color:var(--danger); font-size:1.1rem; padding:2px 6px; min-width:28px;" title="Remove">✕</button>
      </div>
    `;
  }

  if (containerId === 'insulation-items-container') {
    return `
      <div class="product-item-row" data-row-idx="${idx}" style="display:grid; grid-template-columns: 2fr 1fr 1fr 32px; gap:6px; align-items:center; background:#f8fafc; border:1px solid var(--border); border-radius:8px; padding:8px 10px;">
        <div class="pi-combobox" style="position:relative;">
          <input class="form-input pi-product-search" type="text" placeholder="🔍 Search product..." autocomplete="off" value="${existing.product || ''}" style="font-size:0.85rem; width:100%; box-sizing:border-box;">
          <input class="pi-product-value" type="hidden" value="${existing.product || ''}">
        </div>
        <select class="form-input pi-unit" style="font-size:0.85rem;">
          <option value="">Unit</option>
          ${unitOptions}
        </select>
        <input class="form-input pi-qty" type="number" placeholder="Qty" min="0" step="0.01" value="${existing.qty || ''}" style="font-size:0.85rem;">
        <button type="button" class="btn btn-ghost btn-sm pi-remove-btn" style="color:var(--danger); font-size:1.1rem; padding:2px 6px; min-width:28px;" title="Remove">✕</button>
      </div>
    `;
  }

  // Fallback for PO (no material, make, or rate)
  return `
    <div class="product-item-row" data-row-idx="${idx}" style="display:grid; grid-template-columns: 2fr 1fr 1fr 32px; gap:6px; align-items:center; background:#f8fafc; border:1px solid var(--border); border-radius:8px; padding:8px 10px;">
      <div class="pi-combobox" style="position:relative;">
        <input class="form-input pi-product-search" type="text" placeholder="🔍 Search product..." autocomplete="off" value="${existing.product || ''}" style="font-size:0.85rem; width:100%; box-sizing:border-box;">
        <input class="pi-product-value" type="hidden" value="${existing.product || ''}">
      </div>
      <select class="form-input pi-unit" style="font-size:0.85rem;">
        <option value="">Unit</option>
        ${unitOptions}
      </select>
      <input class="form-input pi-qty" type="number" placeholder="Qty" min="0" step="0.01" value="${existing.qty || ''}" style="font-size:0.85rem;">
      <button type="button" class="btn btn-ghost btn-sm pi-remove-btn" style="color:var(--danger); font-size:1.1rem; padding:2px 6px; min-width:28px;" title="Remove">✕</button>
    </div>
  `;
}

// Singleton portal dropdown — one shared dropdown on body
let _portalDropdown = null;
let _portalActiveInput = null;
let _portalHiddenInput = null;
let _portalHighlighted = -1;

function getPortalDropdown() {
  if (_portalDropdown) return _portalDropdown;

  _portalDropdown = document.createElement('div');
  _portalDropdown.id = 'pi-portal-dropdown';
  _portalDropdown.style.cssText = `
    display: none;
    position: fixed;
    z-index: 99999;
    background: #ffffff;
    border: 2px solid #4f46e5;
    border-radius: 10px;
    max-height: 240px;
    overflow-y: auto;
    box-shadow: 0 12px 40px rgba(79,70,229,0.18), 0 2px 8px rgba(0,0,0,0.12);
    min-width: 240px;
    padding: 4px 0;
  `;

  // Click on an item
  _portalDropdown.addEventListener('mousedown', (e) => {
    const item = e.target.closest('.pi-combo-item');
    if (item) {
      e.preventDefault();
      if (item.classList.contains('add-new-product-option')) {
        const name = prompt('Enter new product name:');
        if (name && name.trim()) {
          const trimmed = name.trim();
          const isInsulation = _portalActiveInput && _portalActiveInput.closest('#insulation-items-container');
          const targetList = isInsulation ? INSULATION_PRODUCT_LIST : PRODUCT_LIST;
          if (!targetList.includes(trimmed)) {
            targetList.unshift(trimmed); // add to top
          }
          _selectPortalProduct(trimmed);
        }
      } else {
        _selectPortalProduct(item.dataset.value);
      }
    }
  });

  document.body.appendChild(_portalDropdown);
  return _portalDropdown;
}

function _positionPortalDropdown(inputEl) {
  const dd = getPortalDropdown();
  const rect = inputEl.getBoundingClientRect();
  dd.style.top = (rect.bottom + 4) + 'px';
  dd.style.left = rect.left + 'px';
  dd.style.width = Math.max(rect.width, 260) + 'px';
}

function _renderPortalDropdown(query) {
  const dd = getPortalDropdown();
  const q = (query || '').toLowerCase().trim();
  const isInsulation = _portalActiveInput && _portalActiveInput.closest('#insulation-items-container');
  const sourceList = isInsulation ? INSULATION_PRODUCT_LIST : PRODUCT_LIST;

  const filtered = q
    ? sourceList.filter(p => p.toLowerCase().includes(q))
    : sourceList;

  let html = `
    <div class="pi-combo-item add-new-product-option"
      style="padding:9px 14px; font-size:0.84rem; cursor:pointer; font-weight:700; color:#4f46e5; border-bottom:2px solid #e0e7ff; background:#f5f3ff;"
      onmouseenter="this.style.background='#ede9fe';"
      onmouseleave="this.style.background='#f5f3ff';">
      ➕ Add New Product Name
    </div>
  `;

  if (!filtered.length) {
    dd.innerHTML = html + '<div style="padding:10px 14px; font-size:0.83rem; color:#9ca3af;">No products found</div>';
  } else {
    dd.innerHTML = html + filtered.map((p, i) => {
      const escaped = p.replace(/"/g, '&quot;');
      const hl = q
        ? p.replace(
          new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'),
          '<mark style="background:#ede9fe; color:#4f46e5; font-weight:700; border-radius:3px; padding:0 2px;">$1</mark>'
        )
        : p;
      return `<div class="pi-combo-item"
        data-value="${escaped}"
        style="padding:9px 14px; font-size:0.84rem; cursor:pointer; border-bottom:1px solid #f3f4f6; transition:background 0.12s; display:flex; align-items:center; gap:8px;"
        onmouseenter="this.style.background='#f5f3ff'; this.style.color='#4f46e5';"
        onmouseleave="this.style.background=''; this.style.color='';">
        ${hl}
      </div>`;
    }).join('');
  }

  _portalHighlighted = -1;
  _positionPortalDropdown(_portalActiveInput);
  dd.style.display = 'block';
}

function _selectPortalProduct(value) {
  if (_portalActiveInput) _portalActiveInput.value = value;
  if (_portalHiddenInput) _portalHiddenInput.value = value;
  _closePortalDropdown();
}

function _closePortalDropdown() {
  const dd = getPortalDropdown();
  dd.style.display = 'none';
  if (_portalHiddenInput && _portalActiveInput) {
    _portalHiddenInput.value = _portalActiveInput.value.trim();
  }
  _portalActiveInput = null;
  _portalHiddenInput = null;
  _portalHighlighted = -1;
}

// Close portal dropdown when clicking outside
document.addEventListener('mousedown', (e) => {
  const dd = getPortalDropdown();
  if (dd.style.display === 'none') return;
  if (!dd.contains(e.target) && e.target !== _portalActiveInput) {
    _closePortalDropdown();
  }
}, true);

// Reposition on scroll / resize
window.addEventListener('scroll', () => {
  if (_portalActiveInput && getPortalDropdown().style.display !== 'none') {
    _positionPortalDropdown(_portalActiveInput);
  }
}, true);

window.addEventListener('resize', () => {
  if (_portalActiveInput && getPortalDropdown().style.display !== 'none') {
    _positionPortalDropdown(_portalActiveInput);
  }
});

function attachComboboxBehavior(row) {
  const searchInput = row.querySelector('.pi-product-search');
  const hiddenInput = row.querySelector('.pi-product-value');
  if (!searchInput) return;

  searchInput.addEventListener('focus', () => {
    _portalActiveInput = searchInput;
    _portalHiddenInput = hiddenInput;
    _renderPortalDropdown(searchInput.value);
  });

  searchInput.addEventListener('input', () => {
    _portalActiveInput = searchInput;
    _portalHiddenInput = hiddenInput;
    if (hiddenInput) hiddenInput.value = searchInput.value;
    _renderPortalDropdown(searchInput.value);
  });

  searchInput.addEventListener('keydown', (e) => {
    const dd = getPortalDropdown();
    if (dd.style.display === 'none') return;
    const items = dd.querySelectorAll('.pi-combo-item');
    if (!items.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      _portalHighlighted = Math.min(_portalHighlighted + 1, items.length - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      _portalHighlighted = Math.max(_portalHighlighted - 1, 0);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (_portalHighlighted >= 0 && items[_portalHighlighted]) {
        _selectPortalProduct(items[_portalHighlighted].dataset.value);
      } else {
        _closePortalDropdown();
      }
      return;
    } else if (e.key === 'Escape') {
      _closePortalDropdown();
      return;
    } else {
      return;
    }

    items.forEach((item, i) => {
      if (i === _portalHighlighted) {
        item.style.background = '#f5f3ff';
        item.style.color = '#4f46e5';
        item.scrollIntoView({ block: 'nearest' });
      } else {
        item.style.background = '';
        item.style.color = '';
      }
    });
  });

  // When row is removed, close dropdown if it belongs to this input
  row.querySelector('.pi-remove-btn').addEventListener('click', () => {
    if (_portalActiveInput === searchInput) _closePortalDropdown();
    row.remove();
  });
}

function addProductItemRow(containerId, existing = {}) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const idx = container.children.length;
  const tmp = document.createElement('div');
  tmp.innerHTML = buildProductItemRow(containerId, idx, existing);
  const row = tmp.firstElementChild;
  attachComboboxBehavior(row);
  container.appendChild(row);
}

function collectProductItems(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return [];
  const items = [];
  container.querySelectorAll('.product-item-row').forEach(row => {
    const searchInput = row.querySelector('.pi-product-search');
    const hiddenInput = row.querySelector('.pi-product-value');
    const product = ((searchInput ? searchInput.value : '') || (hiddenInput ? hiddenInput.value : '')).trim();
    const qtyInput = row.querySelector('.pi-qty');
    const qty = (qtyInput && qtyInput.value !== '') ? parseFloat(qtyInput.value) : null;
    const unitEl = row.querySelector('.pi-unit');
    const unit = unitEl ? unitEl.value.trim() : '';
    const rateEl = row.querySelector('.pi-rate');
    const rate = (rateEl && rateEl.value !== '') ? parseFloat(rateEl.value) : null;
    const materialEl = row.querySelector('.pi-material');
    const material = materialEl ? materialEl.value.trim() : undefined;
    const makeEl = row.querySelector('.pi-make');
    const make = makeEl ? makeEl.value.trim() : undefined;

    if (product) {
      items.push({ product, qty, unit, rate, material, make });
    }
  });
  return items;
}

function populateProductItems(containerId, items) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  (items || []).forEach(item => addProductItemRow(containerId, item));
}

// ─── Init ────────────────────────────────────────────────────────────────────
async function initPlanning() {
  // Auth guard: planning dept, admin, manager all can access
  const allowedRoles = ['planning', 'admin', 'manager'];
  currentUser = requireAuth(allowedRoles);
  if (!currentUser) return;

  setupLogout();
  populateTopbar(currentUser);
  setupNotifications();

  // Branch pill
  const branchFromQuery = new URLSearchParams(window.location.search).get('branch');
  const storedBranch = sessionStorage.getItem('active_branch');
  currentBranch = (branchFromQuery || storedBranch || currentUser.branch || 'maalur').toLowerCase();
  sessionStorage.setItem('active_branch', currentBranch);
  const pillText = document.getElementById('branch-pill-text');
  if (pillText) pillText.textContent = capitalize(currentBranch || '—');

  // Back button — navigate directly to role dashboard page
  const backBtn = document.getElementById('back-btn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      const brParam = currentBranch ? `?branch=${currentBranch}` : '';
      if (currentUser.role === 'admin') window.location.href = `/admin-dashboard.html${brParam}`;
      else if (currentUser.role === 'manager') window.location.href = `/manager-dashboard.html${brParam}`;
      else window.location.href = '/dept-dashboard.html';
    });
  }

  // Refresh button — animate spin icon & stay on page while refreshing data
  const refreshBtn = document.getElementById('refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      const icon = refreshBtn.querySelector('.refresh-icon');
      if (icon) {
        icon.style.transform = 'rotate(360deg)';
        setTimeout(() => { icon.style.transform = 'rotate(0deg)'; }, 500);
      }
      showToast('Page refreshed successfully', 'success');
      await loadProjects();
    });
  }

  // Show/hide upload section and admin download bar
  const uploadSection = document.getElementById('upload-section');
  const adminBar = document.getElementById('admin-download-bar');

  // Only Planning department users can upload drawings
  if (['manager', 'admin'].includes(currentUser.role)) {
    if (uploadSection) uploadSection.classList.add('hidden');
  }
  if (['admin', 'manager'].includes(currentUser.role)) {
    if (adminBar) adminBar.classList.remove('hidden');
    setupDownloadBar();
  }

  setupUploadZone();
  setupSubmitModal();
  setupZoneCombobox();
  setupPoUpdateModal();
  setupBillingModal();
  setupInsulationModal();
  setupReviewModal();
  setupDetailModal();
  setupCalendarExportModal();

  const searchInput = document.getElementById('project-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      renderFilteredList(currentBranchProjects);
    });
  }

  await loadProjects();
}

// ─── Upload Zone ─────────────────────────────────────────────────────────────
function setupUploadZone() {
  const zone = document.getElementById('upload-zone');
  const fileInput = document.getElementById('file-input');
  if (!zone || !fileInput) return;

  zone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => {
    if (e.target.files[0]) handleFileSelected(e.target.files[0]);
  });

  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelected(file);
  });
}

function handleFileSelected(file) {
  // Block OTF files
  if (file.name.toLowerCase().endsWith('.otf')) {
    showToast('OTF files are not accepted', 'error');
    return;
  }

  selectedFile = file;

  // Show submit modal with file preview
  const nameEl = document.getElementById('submit-file-name');
  const sizeEl = document.getElementById('submit-file-size');
  const iconEl = document.getElementById('submit-file-icon');

  if (nameEl) nameEl.textContent = file.name;
  if (sizeEl) sizeEl.textContent = formatFileSize(file.size);
  if (iconEl) iconEl.textContent = getFileIcon(file.name);

  const reviseIdEl = document.getElementById('s-revise-project-id');
  const titleEl = document.getElementById('submit-modal-title');
  const confirmBtn = document.getElementById('submit-modal-confirm');

  if (revisingProject) {
    if (reviseIdEl) reviseIdEl.value = revisingProject.id;
    if (titleEl) titleEl.textContent = `🔄 Revise Project #${revisingProject.job_no}`;
    if (confirmBtn) confirmBtn.innerHTML = `<svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg> Submit Project`;

    document.getElementById('s-job-no').value = revisingProject.job_no || '';
    document.getElementById('s-job-no').readOnly = true;

    document.getElementById('s-customer').value = revisingProject.customer_name || '';
    document.getElementById('s-project-name').value = revisingProject.project_name || '';
    document.getElementById('s-place').value = revisingProject.place || '';
    document.getElementById('s-location').value = revisingProject.location || '';

    const zoneSearch = document.getElementById('s-zone-search');
    const zoneHidden = document.getElementById('s-zone');
    if (zoneSearch && zoneHidden) {
      zoneSearch.value = revisingProject.zone || '';
      zoneHidden.value = revisingProject.zone || '';
    }

    if ((revisingProject.customer_type || '').toLowerCase() === 'knnd') {
      const knndRadio = document.getElementById('ctype-knnd');
      if (knndRadio) knndRadio.checked = true;
      document.getElementById('s-customer').readOnly = true;
      document.getElementById('s-customer').style.background = '#f8fafc';
    } else {
      const othersRadio = document.getElementById('ctype-others');
      if (othersRadio) othersRadio.checked = true;
      document.getElementById('s-customer').readOnly = false;
      document.getElementById('s-customer').style.background = '#ffffff';
    }

    const existingPo = safeParseItems(revisingProject.po_items, revisingProject.po_quantity, null, null, 'PO Item');
    populateProductItems('po-items-container', existingPo);
  } else {
    if (reviseIdEl) reviseIdEl.value = '';
    if (titleEl) titleEl.textContent = '📋 New Project Details';
    if (confirmBtn) confirmBtn.innerHTML = `<svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg> Submit Project`;
    document.getElementById('s-job-no').readOnly = false;
    fetchNextJobNo();
  }

  document.getElementById('submit-modal').classList.remove('hidden');
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function getFileIcon(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const icons = { png: '🖼️', jpg: '🖼️', jpeg: '🖼️', pdf: '📕', dwg: '📐', dxf: '📐', xlsx: '📊', xls: '📊', doc: '📄', docx: '📄' };
  return icons[ext] || '📄';
}

async function fetchNextJobNo() {
  if (revisingProject || document.getElementById('s-revise-project-id').value) return;

  const projNameEl = document.getElementById('s-project-name');
  const placeEl = document.getElementById('s-place');
  const jobNoEl = document.getElementById('s-job-no');
  const statusEl = document.getElementById('s-job-no-status');
  if (!jobNoEl) return;

  const projName = projNameEl ? projNameEl.value.trim() : '';
  const place = placeEl ? placeEl.value.trim() : '';
  const urlBranch = new URLSearchParams(window.location.search).get('branch');
  const storedBranch = sessionStorage.getItem('active_branch');
  const branch = (urlBranch || storedBranch || currentBranch || (currentUser && currentUser.branch) || 'maalur').toLowerCase();

  try {
    const res = await apiFetch(`/planning/next-job-no?branch=${branch}&project_name=${encodeURIComponent(projName)}&place=${encodeURIComponent(place)}`);
    if (res && res.ok) {
      const data = await res.json();
      jobNoEl.value = data.next_job_no;
      if (statusEl) {
        statusEl.textContent = data.is_existing ? 'Reusing Job No (Same Project & Place)' : 'Auto-generated sequence';
        statusEl.style.color = data.is_existing ? '#059669' : '#6366f1';
      }
    }
  } catch (err) {
    console.error('Error fetching job number:', err);
  }
}

// ─── Submit Modal ─────────────────────────────────────────────────────────────
function setupSubmitModal() {
  const modal = document.getElementById('submit-modal');
  const closeBtn = document.getElementById('submit-modal-close');
  const cancelBtn = document.getElementById('submit-modal-cancel');
  const confirmBtn = document.getElementById('submit-modal-confirm');
  const addPoBtn = document.getElementById('add-po-item-btn');
  if (!modal) return;

  // Customer type change listener
  const knndRadio = document.getElementById('ctype-knnd');
  const othersRadio = document.getElementById('ctype-others');
  const customerInput = document.getElementById('s-customer');

  if (knndRadio && othersRadio && customerInput) {
    knndRadio.addEventListener('change', () => {
      if (knndRadio.checked) {
        customerInput.value = 'KNND';
        customerInput.readOnly = true;
        customerInput.style.background = '#f8fafc';
      }
    });
    othersRadio.addEventListener('change', () => {
      if (othersRadio.checked) {
        customerInput.value = '';
        customerInput.readOnly = false;
        customerInput.style.background = '#ffffff';
        customerInput.focus();
      }
    });
  }

  // Next job no generators listeners
  const projNameEl = document.getElementById('s-project-name');
  const placeEl = document.getElementById('s-place');
  if (projNameEl) projNameEl.addEventListener('input', fetchNextJobNo);
  if (placeEl) placeEl.addEventListener('input', fetchNextJobNo);

  // Add PO item row button
  if (addPoBtn) addPoBtn.addEventListener('click', () => addProductItemRow('po-items-container'));

  [closeBtn, cancelBtn].forEach(b => b && b.addEventListener('click', () => {
    modal.classList.add('hidden');
    selectedFile = null;
    revisingProject = null;
    document.getElementById('s-revise-project-id').value = '';
    document.getElementById('file-input').value = '';
  }));

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.add('hidden');
      selectedFile = null;
      revisingProject = null;
      document.getElementById('s-revise-project-id').value = '';
    }
  });

  if (confirmBtn) {
    confirmBtn.addEventListener('click', async () => {
      const jobNo = document.getElementById('s-job-no').value.trim();
      const customer = document.getElementById('s-customer').value.trim();
      const projName = document.getElementById('s-project-name').value.trim();
      const place = document.getElementById('s-place').value.trim();
      const zoneSearch = document.getElementById('s-zone-search');
      const zoneHidden = document.getElementById('s-zone');
      const zone = (zoneSearch?.value || zoneHidden?.value || '').trim();
      if (zoneHidden) zoneHidden.value = zone;

      const location = document.getElementById('s-location').value.trim();
      const customerType = document.querySelector('input[name="customer_type"]:checked').value;

      const errEl = document.getElementById('submit-error');
      const errMsg = document.getElementById('submit-error-msg');

      if (!jobNo || !customer || !projName || !place || !location || !zone) {
        errMsg.textContent = 'Job No, Customer, Project Name, Place, Zone and Location are all required.';
        errEl.classList.remove('hidden');
        return;
      }

      // Collect PO product items
      const poItems = collectProductItems('po-items-container');

      errEl.classList.add('hidden');
      confirmBtn.disabled = true;
      confirmBtn.innerHTML = '<span class="spinner"></span> Submitting...';

      try {
        const formData = new FormData();
        formData.append('job_no', jobNo);
        formData.append('customer_name', customer);
        formData.append('customer_type', customerType);
        formData.append('project_name', projName);
        formData.append('place', place);
        formData.append('zone', zone);
        formData.append('location', location);
        formData.append('po_quantity', poItems.length || 0);
        formData.append('po_items', JSON.stringify(poItems));
        formData.append('branch', currentBranch || currentUser.branch || 'maalur');
        if (selectedFile) formData.append('drawing', selectedFile);

        const token = getToken();
        const reviseId = document.getElementById('s-revise-project-id').value;
        const endpoint = reviseId ? `${API_PLANNING}/projects/${reviseId}/revise` : `${API_PLANNING}/submit`;
        const method = reviseId ? 'PATCH' : 'POST';

        const res = await fetch(endpoint, {
          method: method,
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData,
        });

        let data;
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          data = await res.json();
        } else {
          const rawText = await res.text();
          throw new Error(rawText || `Server error (${res.status})`);
        }

        if (!res.ok) throw new Error(data.error || 'Submission failed');

        showToast(reviseId ? `Project #${jobNo} revised & resubmitted for approval 🔄` : `Project ${jobNo} created successfully ✅`, 'success');
        modal.classList.add('hidden');
        selectedFile = null;
        revisingProject = null;
        document.getElementById('s-revise-project-id').value = '';
        document.getElementById('file-input').value = '';
        document.getElementById('s-job-no').value = '';
        document.getElementById('s-job-no').readOnly = false;
        document.getElementById('s-customer').value = '';
        document.getElementById('s-project-name').value = '';
        document.getElementById('s-place').value = '';
        document.getElementById('s-zone').value = '';
        document.getElementById('s-zone-search').value = '';
        document.getElementById('s-location').value = '';
        document.getElementById('po-items-container').innerHTML = '';
        const titleEl = document.getElementById('submit-modal-title');
        if (titleEl) titleEl.textContent = '📋 New Project Details';
        await loadProjects();
      } catch (err) {
        errMsg.textContent = err.message;
        errEl.classList.remove('hidden');
      } finally {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = `<svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg> Submit Project`;
      }
    });
  }
}

// ─── Setup Zone Combobox ──────────────────────────────────────────────────
function setupZoneCombobox() {
  const searchInput = document.getElementById('s-zone-search');
  const hiddenInput = document.getElementById('s-zone');
  if (!searchInput || !hiddenInput) return;

  let dd = document.getElementById('zone-portal-dropdown');
  if (!dd) {
    dd = document.createElement('div');
    dd.id = 'zone-portal-dropdown';
    dd.style.cssText = `
      display: none; position: fixed; z-index: 99999; background: #ffffff;
      border: 2px solid #4f46e5; border-radius: 10px; max-height: 240px; overflow-y: auto;
      box-shadow: 0 12px 40px rgba(79,70,229,0.18), 0 2px 8px rgba(0,0,0,0.12);
      min-width: 240px; padding: 4px 0;
    `;
    document.body.appendChild(dd);
  }

  const renderZoneDropdown = (q) => {
    const query = (q || '').toLowerCase().trim();
    const filtered = query
      ? INDIA_STATES.filter(s => s.code.toLowerCase().includes(query) || s.name.toLowerCase().includes(query))
      : INDIA_STATES;

    if (!filtered.length) {
      dd.innerHTML = `<div style="padding:10px 14px; font-size:0.83rem; color:#9ca3af;">No state/zone found</div>`;
    } else {
      dd.innerHTML = filtered.map(s => {
        const val = `${s.code} (${s.name})`;
        return `<div class="zone-combo-item" data-value="${val}"
          style="padding:9px 14px; font-size:0.84rem; cursor:pointer; border-bottom:1px solid #f3f4f6; transition:background 0.12s;"
          onmouseenter="this.style.background='#f5f3ff'; this.style.color='#4f46e5';"
          onmouseleave="this.style.background=''; this.style.color='';">
          <strong>${s.code}</strong> — ${s.name}
        </div>`;
      }).join('');
    }

    const rect = searchInput.getBoundingClientRect();
    dd.style.top = (rect.bottom + 4) + 'px';
    dd.style.left = rect.left + 'px';
    dd.style.width = Math.max(rect.width, 240) + 'px';
    dd.style.display = 'block';
  };

  dd.onmousedown = (e) => {
    const item = e.target.closest('.zone-combo-item');
    if (item) {
      e.preventDefault();
      const val = item.dataset.value;
      searchInput.value = val;
      hiddenInput.value = val;
      dd.style.display = 'none';
    }
  };

  searchInput.addEventListener('focus', () => renderZoneDropdown(searchInput.value));
  searchInput.addEventListener('input', () => {
    hiddenInput.value = searchInput.value;
    renderZoneDropdown(searchInput.value);
  });
  searchInput.addEventListener('blur', () => {
    setTimeout(() => { dd.style.display = 'none'; }, 200);
  });
}

// ─── Load Projects ─────────────────────────────────────────────────────────────
async function loadProjects() {
  const listEl = document.getElementById('projects-list');
  if (!listEl) return;

  listEl.innerHTML = `<div style="text-align:center; padding:32px;"><span class="spinner"></span></div>`;

  try {
    const branchFromQuery = new URLSearchParams(window.location.search).get('branch');
    const targetBranch = (branchFromQuery || currentUser.branch || 'maalur').toLowerCase();

    const res = await apiFetch(`/planning/projects?branch=${targetBranch}`);
    if (!res || !res.ok) throw new Error('Failed to load projects');
    allProjects = await res.json();

    // Filter by branch
    let branchProjects = allProjects.filter(p => p.branch && p.branch.toLowerCase() === targetBranch);
    currentBranchProjects = branchProjects;

    // Update bifurcation counts
    const cntAll = currentBranchProjects.length;
    const cntKnnd = currentBranchProjects.filter(p => (p.customer_type || 'others').toLowerCase() === 'knnd').length;
    const cntOthers = currentBranchProjects.filter(p => (p.customer_type || 'others').toLowerCase() === 'others').length;

    const elAll = document.getElementById('cnt-all');
    const elKnnd = document.getElementById('cnt-knnd');
    const elOthers = document.getElementById('cnt-others');
    if (elAll) elAll.textContent = cntAll;
    if (elKnnd) elKnnd.textContent = cntKnnd;
    if (elOthers) elOthers.textContent = cntOthers;

    // Attach bifurcation tab listeners if not attached
    const tabsContainer = document.getElementById('project-bifurcation-tabs');
    if (tabsContainer) {
      tabsContainer.querySelectorAll('.bifurcation-tab-btn').forEach(btn => {
        btn.onclick = () => {
          tabsContainer.querySelectorAll('.bifurcation-tab-btn').forEach(b => {
            b.classList.remove('active');
            b.style.background = 'transparent';
            b.style.color = '#64748b';
            b.style.boxShadow = 'none';
          });
          btn.classList.add('active');
          btn.style.background = '#ffffff';
          btn.style.color = '#4f46e5';
          btn.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
          currentBifurcation = btn.dataset.bifurcation || 'all';
          updateStatusCounts();
          renderFilteredList(currentBranchProjects);
        };
      });
    }

    // Attach status tab listeners (All Status, Accepted, Rejected)
    const statusTabsContainer = document.getElementById('project-status-tabs');
    if (statusTabsContainer) {
      statusTabsContainer.querySelectorAll('.status-tab-btn').forEach(btn => {
        btn.onclick = () => {
          statusTabsContainer.querySelectorAll('.status-tab-btn').forEach(b => {
            b.classList.remove('active');
            b.style.background = 'transparent';
            b.style.color = '#64748b';
            b.style.boxShadow = 'none';
          });
          btn.classList.add('active');
          btn.style.background = '#ffffff';
          btn.style.color = '#4f46e5';
          btn.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
          currentStatusFilter = btn.dataset.status || 'all';
          updateConversionCounts();
          renderFilteredList(currentBranchProjects);
        };
      });
    }

    // Attach conversion tab listeners (All Conversion, Converted, Not Converted)
    const conversionTabsContainer = document.getElementById('project-conversion-tabs');
    if (conversionTabsContainer) {
      conversionTabsContainer.querySelectorAll('.conversion-tab-btn').forEach(btn => {
        btn.onclick = () => {
          conversionTabsContainer.querySelectorAll('.conversion-tab-btn').forEach(b => {
            b.classList.remove('active');
            b.style.background = 'transparent';
            b.style.color = '#64748b';
            b.style.boxShadow = 'none';
          });
          btn.classList.add('active');
          btn.style.background = '#ffffff';
          btn.style.color = '#4f46e5';
          btn.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
          currentConversionFilter = btn.dataset.conversion || 'all';
          renderFilteredList(currentBranchProjects);
        };
      });
    }

    updateStatusCounts();
    updateConversionCounts();
    renderFilteredList(currentBranchProjects);
  } catch (err) {
    listEl.innerHTML = `<p style="color:var(--danger); padding:16px;">Error: ${err.message}</p>`;
  }
}

function updateStatusCounts() {
  let catProjects = currentBranchProjects;
  if (currentBifurcation === 'knnd') {
    catProjects = currentBranchProjects.filter(p => (p.customer_type || 'others').toLowerCase() === 'knnd');
  } else if (currentBifurcation === 'others') {
    catProjects = currentBranchProjects.filter(p => (p.customer_type || 'others').toLowerCase() === 'others');
  }

  // Count unique job groups status
  const jobStatusMap = {};
  catProjects.forEach(p => {
    if (!jobStatusMap[p.job_no]) {
      jobStatusMap[p.job_no] = (p.status || '').toLowerCase();
    }
  });

  const statuses = Object.values(jobStatusMap);
  const cntAll = statuses.length;
  const cntAccepted = statuses.filter(s => s === 'approved').length;
  const cntRejected = statuses.filter(s => s !== 'approved').length;

  const elStatusAll = document.getElementById('cnt-status-all');
  const elAccepted = document.getElementById('cnt-accepted');
  const elRejected = document.getElementById('cnt-rejected');
  if (elStatusAll) elStatusAll.textContent = cntAll;
  if (elAccepted) elAccepted.textContent = cntAccepted;
  if (elRejected) elRejected.textContent = cntRejected;
}

function updateConversionCounts() {
  let catProjects = currentBranchProjects;
  if (currentBifurcation === 'knnd') {
    catProjects = currentBranchProjects.filter(p => (p.customer_type || 'others').toLowerCase() === 'knnd');
  } else if (currentBifurcation === 'others') {
    catProjects = currentBranchProjects.filter(p => (p.customer_type || 'others').toLowerCase() === 'others');
  }

  if (currentStatusFilter === 'accepted') {
    catProjects = catProjects.filter(p => (p.status || '').toLowerCase() === 'approved');
  } else if (currentStatusFilter === 'rejected') {
    catProjects = catProjects.filter(p => (p.status || '').toLowerCase() !== 'approved');
  }

  const jobConvMap = {};
  catProjects.forEach(p => {
    if (!jobConvMap[p.job_no]) {
      jobConvMap[p.job_no] = getProjectConversionStatus(p);
    }
  });

  const convStatuses = Object.values(jobConvMap);
  const cntConvAll = convStatuses.length;
  const cntConvConverted = convStatuses.filter(s => s === 'converted').length;
  const cntConvNotConverted = convStatuses.filter(s => s === 'not_converted').length;

  const elConvAll = document.getElementById('cnt-conv-all');
  const elConvConverted = document.getElementById('cnt-conv-converted');
  const elConvNotConverted = document.getElementById('cnt-conv-not-converted');
  if (elConvAll) elConvAll.textContent = cntConvAll;
  if (elConvConverted) elConvConverted.textContent = cntConvConverted;
  if (elConvNotConverted) elConvNotConverted.textContent = cntConvNotConverted;
}

function renderFilteredList(branchProjects) {
  const listEl = document.getElementById('projects-list');
  if (!listEl) return;

  let filtered = branchProjects;
  if (currentBifurcation === 'knnd') {
    filtered = branchProjects.filter(p => (p.customer_type || 'others').toLowerCase() === 'knnd');
  } else if (currentBifurcation === 'others') {
    filtered = branchProjects.filter(p => (p.customer_type || 'others').toLowerCase() === 'others');
  }

  if (currentStatusFilter === 'accepted') {
    filtered = filtered.filter(p => (p.status || '').toLowerCase() === 'approved');
  } else if (currentStatusFilter === 'rejected') {
    filtered = filtered.filter(p => (p.status || '').toLowerCase() !== 'approved');
  }

  if (currentConversionFilter === 'converted') {
    filtered = filtered.filter(p => getProjectConversionStatus(p) === 'converted');
  } else if (currentConversionFilter === 'not_converted') {
    filtered = filtered.filter(p => getProjectConversionStatus(p) === 'not_converted');
  }

  if (filtered.length === 0) {
    const statusLabel = currentStatusFilter === 'all' ? '' : ` ${currentStatusFilter.toUpperCase()}`;
    const convLabel = currentConversionFilter === 'all' ? '' : ` (${currentConversionFilter.replace('_', ' ').toUpperCase()})`;
    listEl.innerHTML = `
      <div class="no-projects" style="text-align:center; padding:32px; color:var(--text-muted);">
        <div style="font-size:2rem; margin-bottom:10px; opacity:0.4;">📋</div>
        <p>No${statusLabel} projects${convLabel} found under "${currentBifurcation.toUpperCase()}" category.</p>
      </div>
    `;
    return;
  }

  // Group projects by job_no (Job Number)
  const groups = [];
  const groupsMap = {};
  filtered.forEach(p => {
    if (!groupsMap[p.job_no]) {
      groupsMap[p.job_no] = {
        job_no: p.job_no,
        customer_name: p.customer_name,
        customer_type: p.customer_type,
        created_at: p.created_at,
        branch: p.branch,
        project_name: p.project_name,
        place: p.place,
        status: p.status, // representative status
        uploads: []
      };
      groups.push(groupsMap[p.job_no]);
    }
    groupsMap[p.job_no].uploads.push(p);
  });

  // Assign serial numbers directly according to Job Number (e.g. CD-001 -> Sl.No 1)
  groups.forEach((g) => {
    const parts = (g.job_no || '').split('-');
    const seqNum = parseInt(parts[parts.length - 1], 10);
    g.serial_no = !isNaN(seqNum) ? seqNum : 1;
  });

  // Keep display order newest (highest serial number) first
  groups.sort((a, b) => (b.serial_no || 0) - (a.serial_no || 0));

  // Filter groups by search query
  const searchInput = document.getElementById('project-search-input');
  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
  let displayedGroups = groups;
  if (query) {
    const isPureNumber = /^\d+$/.test(query);
    if (isPureNumber) {
      displayedGroups = groups.filter(g => String(g.serial_no) === query);
    } else {
      displayedGroups = groups.filter(g => {
        if (`s.no ${g.serial_no}`.includes(query) || `s.no. ${g.serial_no}`.includes(query)) {
          return true;
        }
        return (g.job_no || '').toLowerCase().includes(query) ||
          (g.project_name || '').toLowerCase().includes(query) ||
          (g.place || '').toLowerCase().includes(query) ||
          (g.customer_name || '').toLowerCase().includes(query);
      });
    }
  }

  if (displayedGroups.length === 0) {
    listEl.innerHTML = `
      <div class="no-projects" style="text-align:center; padding:32px; color:var(--text-muted);">
        <div style="font-size:2rem; margin-bottom:10px; opacity:0.4;">🔍</div>
        <p>No projects match your search.</p>
      </div>
    `;
    return;
  }

  listEl.innerHTML = displayedGroups.map((g) => renderProjectCardGroup(g, g.serial_no)).join('');
  attachProjectCardEvents();
}

// ─── Render Grouped Project Card ────────────────────────────────────────────
function renderProjectCardGroup(group, serialNo) {
  const latestProj = group.uploads[0];
  const isRevisedPending = (group.status === 'pending' && latestProj.is_revised);
  const statusBadge = isRevisedPending
    ? `<span class="badge badge-revised" style="background:#fff7ed; color:#c2410c; border:1.5px solid #fdba74; font-weight:700;">🔄 Revised (Pending Approval)</span>`
    : ({
      pending: `<span class="badge badge-pending">⏳ Pending Review</span>`,
      approved: `<span class="badge badge-approved">✅ Approved</span>`,
      rejected: `<span class="badge badge-rejected">❌ Rejected</span>`,
      revised: `<span class="badge badge-revised">🔄 Revision Requested</span>`,
    }[group.status] || `<span class="badge">${group.status}</span>`);

  const getRomanNumeral = (num) => {
    const roman = { M: 1000, CM: 900, D: 500, CD: 400, C: 100, XC: 90, L: 50, XL: 40, X: 10, IX: 9, V: 5, IV: 4, I: 1 };
    let str = '';
    for (let i in roman) {
      while (num >= roman[i]) {
        str += i;
        num -= roman[i];
      }
    }
    return str;
  };

  // Generate HTML for each upload location under this job number
  const uploadsHtml = group.uploads.map((p, uIdx) => {
    const isAdminHolder = currentUser.role === 'admin' || currentUser.hasAdminPower;
    const showAdminDecisionButtons = isAdminHolder && (p.status === 'pending' || p.status === 'revised');

    const adminDecisionBar = showAdminDecisionButtons ? `
      <div class="admin-review-bar" style="display:flex; align-items:center; gap:10px; padding:12px 18px; background:#f8fafc; border-top:1.5px solid var(--border); flex-wrap:wrap; border-radius: 8px; margin-top: 8px;">
        <span style="font-size:0.85rem; font-weight:700; color:var(--text-second); text-transform:uppercase; letter-spacing:0.04em;">Admin Action:</span>
        <button class="btn btn-success btn-sm" data-id="${p.id}" data-action="quick-approve">
          ✅ Approve
        </button>
        <button class="btn btn-revise btn-sm" data-id="${p.id}" data-job="${p.job_no}" data-action="quick-revise">
          🔄 Revise
        </button>
        <button class="btn btn-danger btn-sm" data-id="${p.id}" data-action="quick-reject">
          ❌ Reject
        </button>
      </div>
    ` : '';

    const reviseBanner = (p.status === 'revised' && p.revise_remark)
      ? `<div class="revise-remark-banner" style="border-radius: 8px; margin-top: 6px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
          <div>
            <div class="revise-remark-banner-icon">🔄</div>
            <div class="revise-remark-banner-text"><strong>Revision note:</strong> ${escapeHtml(p.revise_remark)}</div>
          </div>
          ${(currentUser.role === 'planning' || currentUser.role === 'admin') ? `
            <button class="btn btn-warning btn-sm" data-id="${p.id}" data-action="reupload-revise" style="font-size:0.8rem; font-weight:700; white-space:nowrap; background:#f59e0b; color:#fff; border:none; padding:4px 12px; border-radius:6px; cursor:pointer;">
              ✏️ Re-upload &amp; Revise
            </button>
          ` : ''}
        </div>` : '';

    const drawingPill = p.drawing_name
      ? `<span class="drawing-pill" data-file="${p.drawing_path}" data-name="${escapeHtml(p.drawing_name)}">
          ${getFileIcon(p.drawing_name)} ${escapeHtml(p.drawing_name)}
        </span>` : `<span style="font-size:0.78rem; color:var(--text-muted);">No file attached</span>`;

    let qtyBar = '';
    if (p.status === 'approved') {
      const billingItems = safeParseItems(p.billing_items, p.billing_qty, p.billing_unit, p.billing_rate, 'Billing Item');
      const insulationItems = safeParseItems(p.insulation_items, p.insulation_qty, p.insulation_unit, p.insulation_rate, 'Insulation Item');
      const billingDoneItems = billingItems.length > 0;
      const insulationDoneItems = insulationItems.length > 0;

      const buildItemsSummary = (items, icon, type) =>
        items.map(it => {
          if (type === 'billing') {
            const matSpan = it.material ? ` <span style="font-size:0.82rem; color:#0369a1; background:#e0f2fe; padding:1px 6px; border-radius:4px; font-weight:600; margin:0 4px;">${escapeHtml(it.material)}</span>` : '';
            return `<div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;"><span style="font-size:0.95rem;">${icon}</span> <strong style="color:var(--text-primary); font-weight:600;">${escapeHtml(it.product)}</strong>${matSpan} <span style="font-weight:700; color:var(--text-primary);">${it.qty ?? '—'}</span> <span style="color:var(--text-second);">${escapeHtml(it.unit || '')}</span></div>`;
          }
          return `<div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;"><span style="font-size:0.95rem;">${icon}</span> <strong style="color:var(--text-primary); font-weight:600;">${escapeHtml(it.product)}</strong>: <span style="font-weight:700; color:var(--text-primary);">${it.qty ?? '—'}</span> <span style="color:var(--text-second);">${escapeHtml(it.unit || '')}</span></div>`;
        }).join('');

      const areaListPill = p.area_list_name
        ? `<div style="margin-top: 6px;"><span class="drawing-pill" data-file="${p.area_list_path}" data-name="${escapeHtml(p.area_list_name)}" style="font-size:0.8rem; background:#eff6ff; border:1px solid #bfdbfe; color:#1e40af; padding:3px 8px; border-radius:4px; cursor:pointer;">📄 Area List File: ${escapeHtml(p.area_list_name)}</span></div>` : '';
      const numberingPill = p.numbering_drawing_name
        ? `<div style="margin-top: 6px;"><span class="drawing-pill" data-file="${p.numbering_drawing_path}" data-name="${escapeHtml(p.numbering_drawing_name)}" style="font-size:0.8rem; background:#eff6ff; border:1px solid #bfdbfe; color:#1e40af; padding:3px 8px; border-radius:4px; cursor:pointer;">📄 Numbering Drawing File: ${escapeHtml(p.numbering_drawing_name)}</span></div>` : '';
      const poFilePill = (p.conversion_status === 'converted' && p.po_file_path)
        ? `<div style="margin-top: 6px;"><span class="drawing-pill" data-file="${p.po_file_path}" data-name="${escapeHtml(p.po_file_name)}" style="font-size:0.8rem; background:#ecfdf5; border:1px solid #6ee7b7; color:#047857; padding:3px 8px; border-radius:4px; cursor:pointer;">📄 PO Document: ${escapeHtml(p.po_file_name || 'View PO')}</span></div>`
        : `<div style="margin-top: 6px; font-size:0.8rem; color:#b45309; font-weight:600;">⏳ Conversion Status: Not Converted</div>`;

      if (currentUser.role === 'planning') {
        const billingContent = billingDoneItems
          ? `<details style="margin-bottom: 8px; cursor: pointer;">
               <summary style="font-size:0.85rem; font-weight:600; color:#0369a1; background:#e0f2fe; padding:6px 10px; border-radius:4px; border:1px solid #bae6fd; user-select:none; display:inline-flex; align-items:center; gap:6px;">💼 View Billing Quantity</summary>
               <div style="padding:10px; border-left:2px solid #bae6fd; margin-top:6px; font-size:0.88rem; line-height:1.8;">
                 <div style="display:flex; flex-direction:column; gap:3px;">
                   ${buildItemsSummary(billingItems, '💼', 'billing')}
                   ${areaListPill}
                   ${numberingPill}
                   ${poFilePill}
                 </div>
                 <div style="margin-top:8px;">
                   <button class="btn btn-ghost btn-sm" data-id="${p.id}" data-field="billing" data-action="request-edit" style="font-size:0.8rem; color:var(--text-second); padding:3px 10px; flex-shrink:0;">🔒 Request Edit</button>
                 </div>
               </div>
             </details>`
          : `<div style="margin-bottom:8px;"><button class="btn btn-outline btn-sm" data-id="${p.id}" data-job="${p.job_no}" data-action="billing" style="font-size:0.85rem;">💼 Enter Billing Qty</button></div>`;

        const insulationContent = insulationDoneItems
          ? `<details style="margin-bottom: 8px; cursor: pointer;">
               <summary style="font-size:0.85rem; font-weight:600; color:#b45309; background:#ffedd5; padding:6px 10px; border-radius:4px; border:1px solid #fed7aa; user-select:none; display:inline-flex; align-items:center; gap:6px;">🧱 View Insulation Quantity</summary>
               <div style="padding:10px; border-left:2px solid #fed7aa; margin-top:6px; font-size:0.88rem; line-height:1.8;">
                 <div style="display:flex; flex-direction:column; gap:3px;">
                   ${buildItemsSummary(insulationItems, '🧱', 'insulation')}
                 </div>
                 <div style="margin-top:8px;">
                   <button class="btn btn-ghost btn-sm" data-id="${p.id}" data-field="insulation" data-action="request-edit" style="font-size:0.8rem; color:var(--text-second); padding:3px 10px; flex-shrink:0;">🔒 Request Edit</button>
                 </div>
               </div>
             </details>`
          : `<div><button class="btn btn-outline btn-sm" data-id="${p.id}" data-job="${p.job_no}" data-action="insulation" style="font-size:0.85rem;">🧱 Enter Insulation Qty</button></div>`;

        qtyBar = `
          <div class="qty-actions-bar" style="display:flex; gap:16px; padding:12px 18px; background:var(--success-bg); border-top:1.5px solid #bbf7d0; align-items:flex-start; border-radius: 8px; margin-top: 8px;">
            <span class="qty-actions-label" style="font-size:0.9rem; font-weight:700; color:var(--success); padding-top:4px;">Quantities:</span>
            <div style="display:flex; flex-direction:column; gap:4px; flex:1;">
              ${billingContent}
              ${insulationContent}
            </div>
          </div>
        `;
      } else {
        const billingDisplay = billingDoneItems
          ? `<details style="margin-bottom: 8px; cursor: pointer;">
               <summary style="font-size:0.85rem; font-weight:600; color:#0369a1; background:#e0f2fe; padding:6px 10px; border-radius:4px; border:1px solid #bae6fd; user-select:none; display:inline-flex; align-items:center; gap:6px;">💼 View Billing Quantity</summary>
               <div style="padding:10px; border-left:2px solid #bae6fd; margin-top:6px; font-size:0.88rem; line-height:1.8;">
                 <div style="display:flex; flex-direction:column; gap:3px;">
                   ${buildItemsSummary(billingItems, '💼', 'billing')}
                   ${areaListPill}
                   ${numberingPill}
                   ${poFilePill}
                 </div>
               </div>
             </details>`
          : `<div style="font-size:0.85rem; color:#94a3b8; font-weight:500; margin-bottom:8px;">Billing qty pending</div>`;

        const insulationDisplay = insulationDoneItems
          ? `<details style="margin-bottom: 8px; cursor: pointer;">
               <summary style="font-size:0.85rem; font-weight:600; color:#b45309; background:#ffedd5; padding:6px 10px; border-radius:4px; border:1px solid #fed7aa; user-select:none; display:inline-flex; align-items:center; gap:6px;">🧱 View Insulation Quantity</summary>
               <div style="padding:10px; border-left:2px solid #fed7aa; margin-top:6px; font-size:0.88rem; line-height:1.8;">
                 <div style="display:flex; flex-direction:column; gap:3px;">
                   ${buildItemsSummary(insulationItems, '🧱', 'insulation')}
                 </div>
               </div>
             </details>`
          : `<div style="font-size:0.85rem; color:#94a3b8; font-weight:500;">Insulation qty pending</div>`;

        const adminUnlockBtn = (isAdminHolder && (billingDoneItems || insulationDoneItems))
          ? `<button class="btn btn-outline btn-sm" data-id="${p.id}" data-action="admin-unlock" style="font-size:0.8rem; margin-top:4px;">🔓 Unlock Edit</button>` : '';

        qtyBar = `
          <div class="qty-actions-bar" style="display:flex; gap:16px; padding:12px 18px; background:var(--success-bg); border-top:1.5px solid #bbf7d0; align-items:flex-start; border-radius: 8px; margin-top: 8px;">
            <span class="qty-actions-label" style="font-size:0.9rem; font-weight:700; color:var(--success); padding-top:4px;">Quantities:</span>
            <div style="flex:1; display:flex; flex-direction:column; gap:4px;">
              ${billingDisplay}
              ${insulationDisplay}
            </div>
            ${adminUnlockBtn}
          </div>
        `;
      }
    }

    const poItems = safeParseItems(p.po_items, p.po_quantity, null, null, 'PO Item');
    const poItemsSummary = poItems.map(it => `<div style="font-size:0.82rem; color:var(--text-primary);"><strong style="font-weight:600;">${escapeHtml(it.product)}:</strong> ${it.qty ?? '—'} ${escapeHtml(it.unit || '')}</div>`).join('');
    const poDisplay = poItems.length > 0
      ? `<div style="display:flex; flex-direction:column; gap:3px;">${poItemsSummary}</div>`
      : `<span style="font-size:0.8rem; color:var(--text-muted);">No PO items entered yet</span>`;

    const showPoUpdateBtn = (p.status === 'approved') && (currentUser.role === 'planning' || currentUser.role === 'admin' || currentUser.hasAdminPower);
    const poUpdateBtn = showPoUpdateBtn
      ? `<button class="btn btn-outline btn-sm" data-id="${p.id}" data-job="${p.job_no}" data-action="po-update" style="font-size:0.7rem; padding:2px 6px;">📝 Update</button>`
      : '';

    return `
      <div style="padding: 16px; border: 1.5px solid var(--border); border-radius: 8px; background: #ffffff; margin-bottom: 12px; box-shadow: var(--shadow-sm);">
        <h4 style="margin: 0 0 10px; color: var(--accent); font-weight: 700; font-size: 0.92rem; display: flex; align-items: center; gap: 6px;">
          📍 ${getRomanNumeral(uIdx + 1)}. ${escapeHtml(p.location || 'Location')}
        </h4>
        <div class="project-detail-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px;">
          <div class="project-detail-item">
            <div class="project-detail-label" style="display:flex; justify-content:flex-start; align-items:center; gap:8px;">
              <span>PO Quantity</span>
              ${poUpdateBtn}
            </div>
            <div class="project-detail-value">${poDisplay}</div>
          </div>
          <div class="project-detail-item">
            <div class="project-detail-label">Drawing File</div>
            <div class="project-detail-value">${drawingPill}</div>
          </div>
          <div class="project-detail-item">
            <div class="project-detail-label">Submitted By</div>
            <div class="project-detail-value" style="font-size:0.78rem;">${escapeHtml(p.submitted_by_name || '—')}</div>
          </div>
        </div>
        ${reviseBanner}
        ${qtyBar}
        ${adminDecisionBar}
      </div>
    `;
  }).join('');

  return `
    <div class="project-card" style="margin-bottom: 18px; border-left: 5px solid ${group.status === 'approved' ? '#10b981' : '#f59e0b'}; padding: 0;">
      <!-- Single Line Header -->
      <div class="project-card-header card-toggle-trigger" data-job="${group.job_no}" style="display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; cursor: pointer; user-select: none; background: #f8fafc; border-bottom: 1px solid var(--border);">
        <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap; font-size: 0.85rem; color: var(--text-primary);">
          <span style="font-weight: 800; background: #e2e8f0; color: #475569; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem;">S.No ${serialNo}</span>
          <span style="font-family: monospace; font-weight: 700; color: var(--accent); letter-spacing: 0.3px;">#${escapeHtml(group.job_no)}</span>
          <span style="font-weight: 700;">🏢 ${escapeHtml(group.customer_name)}</span>
          <span style="color: var(--text-second);">📅 ${new Date(group.created_at).toLocaleDateString('en-IN')}</span>
          <span class="badge" style="background:#e0e7ff; color:#4338ca; text-transform:uppercase; font-size:0.7rem; font-weight:700;">${(group.branch || '').toUpperCase()}</span>
          <span style="font-weight: 600; color: var(--text-second);">📁 ${escapeHtml(group.project_name)}</span>
          <span style="color: var(--text-muted);">📍 ${escapeHtml(group.place)}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 10px;">
          ${statusBadge}
          <button class="btn btn-outline btn-sm excel-dl-btn" data-id="${latestProj.id}" style="font-size: 0.75rem; padding: 3px 8px;">📊 Download Excel</button>
          <span class="toggle-icon-indicator" style="font-size: 0.8rem; color: var(--text-second); transition: transform 0.2s;">▼</span>
        </div>
      </div>

      <!-- Collapsible Body -->
      <div class="project-card-body-collapsible hidden" id="body-job-${group.job_no}" style="padding: 16px 20px; background: #ffffff; border-top: 1px solid var(--border);">
        ${uploadsHtml}
      </div>
    </div>
  `;
}

// ─── File Viewer Modal Helper ───────────────────────────────────────────────
function triggerDownload(url, filename) {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
function openFileViewerModal(rawFilePath, displayName) {
  if (!rawFilePath) {
    showToast('File path missing', 'error');
    return;
  }
  const cleanFilename = String(rawFilePath || '').split('/').pop().split('\\').pop();
  if (!cleanFilename) {
    showToast('Invalid file name', 'error');
    return;
  }
  const safeDisplayName = displayName || cleanFilename;

  showToast('Loading file...', 'info');

  apiFetch(`/planning/drawing/${encodeURIComponent(cleanFilename)}`).then(r => {
    if (!r || !r.ok) {
      showToast('File not found or access denied', 'error');
      return null;
    }
    return r.blob();
  }).then(async (blob) => {
    if (!blob) return;
    const blobUrl = URL.createObjectURL(blob);
    const lowerName = safeDisplayName.toLowerCase();

    const modal = document.getElementById('file-viewer-modal');
    if (!modal) {
      triggerDownload(blobUrl, safeDisplayName);
      return;
    }

    const title = document.getElementById('file-viewer-title');
    const body = document.getElementById('file-viewer-body');
    const info = document.getElementById('file-viewer-info');
    const dlBtn = document.getElementById('file-viewer-download-btn');

    const fileExt = safeDisplayName.includes('.') ? safeDisplayName.split('.').pop().toUpperCase() : 'FILE';
    const formatBadge = `<span style="background:#e0f2fe; color:#0369a1; font-size:0.75rem; font-weight:700; padding:2px 8px; border-radius:4px; border:1px solid #bae6fd; margin-left:8px; text-transform:uppercase;">${escapeHtml(fileExt)}</span>`;

    if (title) title.innerHTML = `📄 ${escapeHtml(safeDisplayName)} ${formatBadge}`;
    if (info) info.textContent = `Size: ${Math.round(blob.size / 1024)} KB | Format: ${fileExt}`;

    if (body) body.innerHTML = '';

    if (lowerName.endsWith('.png') || lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg') || lowerName.endsWith('.webp') || lowerName.endsWith('.gif') || lowerName.endsWith('.svg')) {
      body.innerHTML = `
        <div style="width:100%; height:100%; display:flex; justify-content:center; align-items:center; background:#0f172a; padding:16px; border-radius:8px; overflow:hidden;">
          <img src="${blobUrl}" alt="${escapeHtml(safeDisplayName)}" style="max-width:100%; max-height:65vh; object-fit:contain; border-radius:6px; box-shadow:0 10px 25px rgba(0,0,0,0.5);">
        </div>
      `;
    } else if (lowerName.endsWith('.pdf')) {
      body.innerHTML = `<iframe src="${blobUrl}" style="width:100%; height:65vh; border:none; border-radius:8px; background:#fff;"></iframe>`;
    } else if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls') || lowerName.endsWith('.csv')) {
      let renderedTable = false;
      if (window.XLSX) {
        try {
          const buffer = await blob.arrayBuffer();
          const workbook = XLSX.read(buffer, { type: 'array' });
          if (workbook && workbook.SheetNames && workbook.SheetNames.length > 0) {
            const sheets = workbook.SheetNames;
            let currentSheetName = sheets[0];
            let currentZoom = 1.0;

            const renderExactDocumentView = (activeSheetName) => {
              const worksheet = workbook.Sheets[activeSheetName];
              let htmlContent = XLSX.utils.sheet_to_html(worksheet, { editable: false });
              htmlContent = htmlContent.replace('<table>', '<table class="exact-excel-rendered-table">');

              return `
                <div style="width:100%; height:100%; display:flex; flex-direction:column; gap:8px;">
                  <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; padding:8px 12px; background:#ffffff; border:1px solid #cbd5e1; border-radius:8px; flex-shrink:0;">
                    <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
                      <span style="font-size:0.78rem; font-weight:700; color:#475569; margin-right:4px;">Sheets (${sheets.length}):</span>
                      ${sheets.map(sName => `
                        <button type="button" class="sheet-tab-btn ${sName === activeSheetName ? 'active' : ''}" data-sheet="${escapeHtml(sName)}"
                          style="font-size:0.8rem; font-weight:700; padding:4px 12px; border-radius:6px; border:1px solid ${sName === activeSheetName ? '#2563eb' : '#cbd5e1'}; background:${sName === activeSheetName ? '#eff6ff' : '#ffffff'}; color:${sName === activeSheetName ? '#1d4ed8' : '#475569'}; cursor:pointer; transition:all 0.15s;">
                          📊 ${escapeHtml(sName)}
                        </button>
                      `).join('')}
                    </div>
                    <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                      <button type="button" class="btn btn-outline btn-sm zoom-action-btn" data-zoom="fit" style="font-size:0.78rem; padding:3px 10px; font-weight:700; background:#f0fdf4; color:#15803d; border-color:#86efac;">🔍 Fit Width</button>
                      <button type="button" class="btn btn-outline btn-sm zoom-action-btn" data-zoom="out" style="font-size:0.78rem; padding:3px 8px; font-weight:700;">➖ Zoom Out</button>
                      <span id="zoom-level-indicator" style="font-size:0.78rem; font-weight:700; color:#334155; min-width:45px; text-align:center;">100%</span>
                      <button type="button" class="btn btn-outline btn-sm zoom-action-btn" data-zoom="in" style="font-size:0.78rem; padding:3px 8px; font-weight:700;">➕ Zoom In</button>
                      <button type="button" class="btn btn-outline btn-sm zoom-action-btn" data-zoom="reset" style="font-size:0.78rem; padding:3px 8px; color:#64748b;">Reset</button>
                    </div>
                  </div>
                  <div id="xlsx-exact-container" style="flex:1; width:100%; height:62vh; overflow:auto; background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; padding:16px; display:flex; justify-content:center; align-items:flex-start;">
                    <div id="xlsx-zoom-target" style="transform-origin: top center; transition: transform 0.15s ease-out; background:#ffffff; border:1px solid #cbd5e1; border-radius:6px; box-shadow:0 4px 16px rgba(0,0,0,0.06); padding:16px; width:fit-content; min-width:80%;">
                      <style>
                        .exact-excel-rendered-table { border-collapse: collapse !important; width: 100% !important; font-family: Calibri, Arial, sans-serif !important; font-size: 13px !important; color: #1e293b !important; }
                        .exact-excel-rendered-table td, .exact-excel-rendered-table th { border: 1px solid #cbd5e1 !important; padding: 6px 10px !important; min-width: 60px !important; text-align: left !important; vertical-align: middle !important; background: #ffffff !important; }
                        .exact-excel-rendered-table tr:first-child td, .exact-excel-rendered-table tr:first-child th { background: #f1f5f9 !important; font-weight: bold !important; color: #0f172a !important; }
                      </style>
                      ${htmlContent}
                    </div>
                  </div>
                </div>
              `;
            };

            body.innerHTML = renderExactDocumentView(currentSheetName);
            renderedTable = true;

            const applyZoom = (newZoom) => {
              currentZoom = Math.min(2.5, Math.max(0.3, newZoom));
              const target = body.querySelector('#xlsx-zoom-target');
              const indicator = body.querySelector('#zoom-level-indicator');
              if (target) target.style.transform = `scale(${currentZoom})`;
              if (indicator) indicator.textContent = `${Math.round(currentZoom * 100)}%`;
            };

            body.onclick = (e) => {
              const tabBtn = e.target.closest('.sheet-tab-btn');
              if (tabBtn) {
                const targetSheet = tabBtn.dataset.sheet;
                if (targetSheet && targetSheet !== currentSheetName) {
                  currentSheetName = targetSheet;
                  body.innerHTML = renderExactDocumentView(currentSheetName);
                  applyZoom(currentZoom);
                }
                return;
              }
              const zoomBtn = e.target.closest('.zoom-action-btn');
              if (zoomBtn) {
                const action = zoomBtn.dataset.zoom;
                if (action === 'in') applyZoom(currentZoom + 0.15);
                else if (action === 'out') applyZoom(currentZoom - 0.15);
                else if (action === 'reset') applyZoom(1.0);
                else if (action === 'fit') {
                  const container = body.querySelector('#xlsx-exact-container');
                  const target = body.querySelector('#xlsx-zoom-target');
                  if (container && target) {
                    const cWidth = container.clientWidth - 40;
                    const tWidth = target.scrollWidth || target.clientWidth;
                    if (tWidth > 0) applyZoom(Math.min(1.2, Math.max(0.35, cWidth / tWidth)));
                  }
                }
              }
            };
          }
        } catch(err) {
          console.warn('XLSX rendering fallback:', err);
        }
      }

      if (!renderedTable) {
        body.innerHTML = `
          <div style="text-align:center; padding:36px 24px; background:#ffffff; border:1px dashed #bfdbfe; border-radius:12px; width:100%; max-width:480px;">
            <div style="font-size:3.5rem; margin-bottom:12px; line-height:1;">📊</div>
            <h4 style="font-size:1.1rem; margin:0 0 6px 0; color:#0f172a; font-weight:700;">${escapeHtml(safeDisplayName)}</h4>
            <p style="font-size:0.88rem; color:#64748b; margin:0 0 18px 0;">Excel Spreadsheet Document</p>
            <button class="btn btn-primary direct-modal-dl-btn" style="padding:9px 22px; font-size:0.92rem; font-weight:600; display:inline-flex; align-items:center; gap:6px;">
              <span>⬇ Download &amp; View Excel</span>
            </button>
          </div>
        `;
        const directBtn = body.querySelector('.direct-modal-dl-btn');
        if (directBtn) {
          directBtn.onclick = () => triggerDownload(blobUrl, safeDisplayName);
        }
      }
    } else {
      body.innerHTML = `
        <div style="text-align:center; padding:36px 24px; background:#ffffff; border:1px dashed #cbd5e1; border-radius:12px; width:100%; max-width:480px;">
          <div style="font-size:3.5rem; margin-bottom:12px; line-height:1;">📦</div>
          <h4 style="font-size:1.1rem; margin:0 0 6px 0; color:#0f172a; font-weight:700;">${escapeHtml(safeDisplayName)}</h4>
          <p style="font-size:0.88rem; color:#64748b; margin:0 0 18px 0;">Binary File Document</p>
          <button class="btn btn-primary direct-modal-dl-btn" style="padding:9px 22px; font-size:0.92rem; font-weight:600; display:inline-flex; align-items:center; gap:6px;">
            <span>⬇ Download File</span>
          </button>
        </div>
      `;
      const directBtn = body.querySelector('.direct-modal-dl-btn');
      if (directBtn) {
        directBtn.onclick = () => triggerDownload(blobUrl, safeDisplayName);
      }
    }

    if (dlBtn) {
      dlBtn.onclick = () => triggerDownload(blobUrl, safeDisplayName);
    }

    modal.classList.remove('hidden');
  }).catch(err => {
    console.error('File viewer error:', err);
    showToast('Error opening file preview', 'error');
  });
}

// Global click event delegation for drawing pills
document.addEventListener('click', (e) => {
  const pill = e.target.closest('.drawing-pill');
  if (pill) {
    e.stopPropagation();
    const rawFile = pill.dataset.file;
    const name = pill.dataset.name || rawFile;
    if (rawFile) openFileViewerModal(rawFile, name);
  }
});

// ─── Attach Project Card Events ─────────────────────────────────────────────
function attachProjectCardEvents() {
  // Toggle collapse logic
  document.querySelectorAll('.card-toggle-trigger').forEach(trigger => {
    trigger.addEventListener('click', (e) => {
      // Prevent toggle if Excel button clicked
      if (e.target.closest('.excel-dl-btn')) return;

      const jobNo = trigger.dataset.job;
      const body = document.getElementById(`body-job-${jobNo}`);
      const indicator = trigger.querySelector('.toggle-icon-indicator');
      if (body) {
        const isHidden = body.classList.contains('hidden');
        if (isHidden) {
          body.classList.remove('hidden');
          if (indicator) indicator.style.transform = 'rotate(180deg)';
        } else {
          body.classList.add('hidden');
          if (indicator) indicator.style.transform = 'rotate(0deg)';
        }
      }
    });
  });

  // Excel download button
  document.querySelectorAll('.excel-dl-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const p = allProjects.find(x => String(x.id) === String(id));
      if (p) downloadProjectExcel(p);
    });
  });

  // Drawing pill → view/download
  document.querySelectorAll('.drawing-pill').forEach(pill => {
    pill.addEventListener('click', (e) => {
      e.stopPropagation();
      openFileViewerModal(pill.dataset.file, pill.dataset.name);
    });
  });

  // Billing quantity button
  document.querySelectorAll('[data-action="billing"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const el = e.currentTarget;
      currentProjectId = el.getAttribute('data-id');
      document.getElementById('billing-job-no').textContent = '#' + el.getAttribute('data-job');
      const p = allProjects.find(x => String(x.id) === String(currentProjectId));
      const existing = safeParseItems(p && p.billing_items, p && p.billing_qty, p && p.billing_unit, p && p.billing_rate, 'Billing Item');
      populateProductItems('billing-items-container', existing);
      if (existing.length === 0) addProductItemRow('billing-items-container');

      // Clear file inputs names
      document.getElementById('area-list-name').textContent = (p && p.area_list_name) ? p.area_list_name : 'No file chosen';
      document.getElementById('numbering-drawing-name').textContent = (p && p.numbering_drawing_name) ? p.numbering_drawing_name : 'No file chosen';

      // Set conversion status & PO file fields
      const convSelect = document.getElementById('billing-conversion-status');
      const poContainer = document.getElementById('po-file-container');
      const poFileName = document.getElementById('po-file-name');
      const poFileInput = document.getElementById('billing-po-file');
      const existingPoDisplay = document.getElementById('existing-po-display');

      if (poFileInput) poFileInput.value = '';
      const isConv = p && p.conversion_status === 'converted' && p.po_file_path;
      if (convSelect) {
        convSelect.value = isConv ? 'converted' : (p && p.conversion_status === 'not_converted' ? 'not_converted' : 'not_converted');
      }
      if (poContainer) {
        if (convSelect && convSelect.value === 'converted') {
          poContainer.classList.remove('hidden');
        } else {
          poContainer.classList.add('hidden');
        }
      }
      if (poFileName) poFileName.textContent = 'No file chosen';
      if (existingPoDisplay) {
        existingPoDisplay.innerHTML = (p && p.po_file_name)
          ? `📄 Current PO: <span class="drawing-pill" data-file="${p.po_file_path}" data-name="${escapeHtml(p.po_file_name)}" style="font-size:0.78rem; cursor:pointer;">${escapeHtml(p.po_file_name)}</span>`
          : '';
      }

      if (convSelect && poContainer) {
        convSelect.onchange = () => {
          if (convSelect.value === 'converted') {
            poContainer.classList.remove('hidden');
          } else {
            poContainer.classList.add('hidden');
          }
        };
      }

      document.getElementById('billing-modal').classList.remove('hidden');
    });
  });

  // Add Billing item button
  const addBillingBtn = document.getElementById('add-billing-item-btn');
  if (addBillingBtn) {
    addBillingBtn.replaceWith(addBillingBtn.cloneNode(true));
    document.getElementById('add-billing-item-btn').addEventListener('click', () => addProductItemRow('billing-items-container'));
  }

  // Insulation quantity button
  document.querySelectorAll('[data-action="insulation"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const el = e.currentTarget;
      currentProjectId = el.getAttribute('data-id');
      document.getElementById('insulation-job-no').textContent = '#' + el.getAttribute('data-job');
      const p = allProjects.find(x => String(x.id) === String(currentProjectId));
      const existing = safeParseItems(p && p.insulation_items, p && p.insulation_qty, p && p.insulation_unit, p && p.insulation_rate, 'Insulation Item');
      populateProductItems('insulation-items-container', existing);
      if (existing.length === 0) addProductItemRow('insulation-items-container');
      document.getElementById('insulation-modal').classList.remove('hidden');
    });
  });

  // Add Insulation item button
  const addInsulationBtn = document.getElementById('add-insulation-item-btn');
  if (addInsulationBtn) {
    addInsulationBtn.replaceWith(addInsulationBtn.cloneNode(true));
    document.getElementById('add-insulation-item-btn').addEventListener('click', () => addProductItemRow('insulation-items-container'));
  }

  // PO Update button
  document.querySelectorAll('[data-action="po-update"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const el = e.currentTarget;
      currentProjectId = el.getAttribute('data-id');
      document.getElementById('po-update-job-no').textContent = '#' + el.getAttribute('data-job');
      const p = allProjects.find(x => String(x.id) === String(currentProjectId));
      const existing = safeParseItems(p && p.po_items, p && p.po_quantity, null, null, 'PO Item');
      populateProductItems('po-update-items-container', existing);
      if (existing.length === 0) addProductItemRow('po-update-items-container');
      document.getElementById('po-update-modal').classList.remove('hidden');
    });
  });

  // Add PO Update item button
  const addPoUpdateBtn = document.getElementById('add-po-update-item-btn');
  if (addPoUpdateBtn) {
    addPoUpdateBtn.replaceWith(addPoUpdateBtn.cloneNode(true));
    document.getElementById('add-po-update-item-btn').addEventListener('click', () => addProductItemRow('po-update-items-container'));
  }

  // Admin Quick Approve
  document.querySelectorAll('[data-action="quick-approve"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      const res = await apiFetch(`/planning/projects/${id}/review`, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'approved' }),
      });
      if (res && res.ok) {
        showToast('Project approved ✅', 'success');
        await loadProjects();
      }
    });
  });

  // Admin Quick Revise
  document.querySelectorAll('[data-action="quick-revise"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      currentProjectId = e.currentTarget.getAttribute('data-id');
      document.getElementById('review-job-no').textContent = '#' + e.currentTarget.getAttribute('data-job');
      document.getElementById('review-remark').value = '';
      document.getElementById('review-modal').classList.remove('hidden');
    });
  });

  // Admin Quick Reject
  document.querySelectorAll('[data-action="quick-reject"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      if (!confirm('Reject this project drawing?')) return;
      const id = e.currentTarget.getAttribute('data-id');
      const res = await apiFetch(`/planning/projects/${id}/review`, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'rejected' }),
      });
      if (res && res.ok) {
        showToast('Project rejected ❌', 'error');
        await loadProjects();
      }
    });
  });

  // Request quantity edit
  document.querySelectorAll('[data-action="request-edit"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const el = e.currentTarget;
      const id = el.getAttribute('data-id');
      const field = el.getAttribute('data-field');
      const res = await apiFetch(`/planning/projects/${id}/request-edit`, {
        method: 'POST',
        body: JSON.stringify({ field }),
      });
      if (res && res.ok) {
        showToast('Edit permission request sent to Admin ✉️', 'info');
      }
    });
  });

  // Admin Unlock Edit button
  document.querySelectorAll('[data-action="admin-unlock"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      if (!confirm('Unlock quantity editing for the Planning department?')) return;
      const id = e.currentTarget.getAttribute('data-id');
      const res = await apiFetch(`/planning/projects/${id}/unlock-edit`, {
        method: 'POST',
        body: JSON.stringify({ field: 'all' }),
      });
      if (res && res.ok) {
        showToast('Quantity editing unlocked for Planning department 🔓', 'success');
        await loadProjects();
      }
    });
  });

  // Re-upload & Revise button
  document.querySelectorAll('[data-action="reupload-revise"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      revisingProject = allProjects.find(x => String(x.id) === String(id));
      if (!revisingProject) return;

      // Start from drawing file upload: open native file picker!
      const fileInput = document.getElementById('file-input');
      if (fileInput) {
        fileInput.value = '';
        fileInput.click();
      }
    });
  });

  // View detail button
  document.querySelectorAll('[data-action="view-detail"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const target = e.currentTarget;
      const id = target.getAttribute('data-id');
      const p = allProjects.find(x => String(x.id) === String(id));
      if (p) {
        openDetailModal(p);
      }
    });
  });
}

// ─── Update PO Modal ──────────────────────────────────────────────────────────
function setupPoUpdateModal() {
  const saveBtn = document.getElementById('po-update-save-btn');
  if (!saveBtn) return;
  saveBtn.addEventListener('click', async () => {
    const errEl = document.getElementById('po-update-error');
    const errMsg = document.getElementById('po-update-error-msg');

    const items = collectProductItems('po-update-items-container');
    if (items.length === 0) {
      errMsg.textContent = 'Please select/enter at least one product name.';
      errEl.classList.remove('hidden');
      return;
    }
    errEl.classList.add('hidden');

    try {
      const res = await apiFetch(`/planning/projects/${currentProjectId}/po`, {
        method: 'PATCH',
        body: JSON.stringify({ po_items: items }),
      });
      const data = res ? await res.json() : null;

      if (res && res.ok) {
        showToast('PO Details updated successfully ✅', 'success');
        document.getElementById('po-update-modal').classList.add('hidden');
        await loadProjects();
      } else {
        errMsg.textContent = (data && data.error) || 'Failed to update PO details.';
        errEl.classList.remove('hidden');
      }
    } catch (err) {
      errMsg.textContent = err.message || 'Error updating PO details.';
      errEl.classList.remove('hidden');
    }
  });
}

// ─── Billing Modal ────────────────────────────────────────────────────────────
function setupBillingModal() {
  const saveBtn = document.getElementById('billing-save-btn');
  if (!saveBtn) return;
  saveBtn.addEventListener('click', async () => {
    const errEl = document.getElementById('billing-error');
    const errMsg = document.getElementById('billing-error-msg');

    const items = collectProductItems('billing-items-container');
    if (items.length === 0) {
      errMsg.textContent = 'Please select/enter at least one product name.';
      errEl.classList.remove('hidden');
      return;
    }

    const areaListInput = document.getElementById('billing-area-list');
    const numberingInput = document.getElementById('billing-numbering-drawing');

    const project = allProjects.find(x => String(x.id) === String(currentProjectId));
    const hasExistingFiles = project && project.area_list_path && project.numbering_drawing_path;

    const areaFile = areaListInput && areaListInput.files ? areaListInput.files[0] : null;
    const numberingFile = numberingInput && numberingInput.files ? numberingInput.files[0] : null;

    if (!hasExistingFiles) {
      if (!areaFile) {
        errMsg.textContent = 'Area List xlsx file is mandatory.';
        errEl.classList.remove('hidden');
        return;
      }
      if (!numberingFile) {
        errMsg.textContent = 'Numbering Drawing xlsx file is mandatory.';
        errEl.classList.remove('hidden');
        return;
      }
    }

    const conversionStatusSelect = document.getElementById('billing-conversion-status');
    const conversionStatus = conversionStatusSelect ? conversionStatusSelect.value : 'not_converted';
    const poFileInput = document.getElementById('billing-po-file');
    const poFile = poFileInput && poFileInput.files ? poFileInput.files[0] : null;

    if (conversionStatus === 'converted') {
      const hasExistingPo = project && project.po_file_path;
      if (!poFile && !hasExistingPo) {
        errMsg.textContent = 'Uploading a PO file is mandatory when marking status as Converted.';
        errEl.classList.remove('hidden');
        return;
      }
    }

    errEl.classList.add('hidden');

    try {
      const formData = new FormData();
      formData.append('billing_items', JSON.stringify(items));
      formData.append('conversion_status', conversionStatus);
      if (areaFile) formData.append('area_list', areaFile);
      if (numberingFile) formData.append('numbering_drawing', numberingFile);
      if (poFile) formData.append('po_file', poFile);

      const token = getToken();
      const res = await fetch(`/api/planning/projects/${currentProjectId}/quantities`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });
      const data = res ? await res.json() : null;

      if (res && res.ok) {
        showToast('Billing details and conversion status saved ✅', 'success');
        document.getElementById('billing-modal').classList.add('hidden');
        // Clear file inputs
        if (areaListInput) areaListInput.value = '';
        if (numberingInput) numberingInput.value = '';
        if (poFileInput) poFileInput.value = '';
        const aName = document.getElementById('area-list-name');
        const nName = document.getElementById('numbering-drawing-name');
        const pName = document.getElementById('po-file-name');
        if (aName) aName.textContent = 'No file chosen';
        if (nName) nName.textContent = 'No file chosen';
        if (pName) pName.textContent = 'No file chosen';
        await loadProjects();
      } else {
        errMsg.textContent = (data && data.error) || 'Failed to save billing details.';
        errEl.classList.remove('hidden');
      }
    } catch (err) {
      errMsg.textContent = err.message || 'Error saving quantities.';
      errEl.classList.remove('hidden');
    }
  });
}

// ─── Insulation Modal ──────────────────────────────────────────────────────────
function setupInsulationModal() {
  const saveBtn = document.getElementById('insulation-save-btn');
  if (!saveBtn) return;
  saveBtn.addEventListener('click', async () => {
    const errEl = document.getElementById('insulation-error');
    const errMsg = document.getElementById('insulation-error-msg');

    const items = collectProductItems('insulation-items-container');
    if (items.length === 0) {
      errMsg.textContent = 'Please select/enter at least one product name.';
      errEl.classList.remove('hidden');
      return;
    }
    errEl.classList.add('hidden');

    try {
      const res = await apiFetch(`/planning/projects/${currentProjectId}/quantities`, {
        method: 'PATCH',
        body: JSON.stringify({ insulation_items: items }),
      });
      const data = res ? await res.json() : null;

      if (res && res.ok) {
        showToast('Insulation quantities saved ✅', 'success');
        document.getElementById('insulation-modal').classList.add('hidden');
        await loadProjects();
      } else {
        errMsg.textContent = (data && data.error) || 'Failed to save insulation quantities.';
        errEl.classList.remove('hidden');
      }
    } catch (err) {
      errMsg.textContent = err.message || 'Error saving quantities.';
      errEl.classList.remove('hidden');
    }
  });
}

// ─── Review Modal ──────────────────────────────────────────────────────────────
function setupReviewModal() {
  const modal = document.getElementById('review-modal');
  if (!modal) return;

  modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.add('hidden'); });

  const actions = [
    { id: 'review-approve-btn', action: 'approved' },
    { id: 'review-revise-btn', action: 'revised' },
    { id: 'review-reject-btn', action: 'rejected' },
  ];

  actions.forEach(({ id, action }) => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.addEventListener('click', async () => {
        const remark = document.getElementById('review-remark').value.trim();
        const res = await apiFetch(`/planning/projects/${currentProjectId}/review`, {
          method: 'PATCH',
          body: JSON.stringify({ action, remark }),
        });
        if (res && res.ok) {
          const msgs = { approved: 'Project approved ✅', revised: 'Revision requested 🔄', rejected: 'Project rejected ❌' };
          showToast(msgs[action], action === 'approved' ? 'success' : action === 'rejected' ? 'error' : 'info');
          modal.classList.add('hidden');
          await loadProjects();
        }
      });
    }
  });
}

// ─── Detail Modal ──────────────────────────────────────────────────────────────
function setupDetailModal() {
  const modal = document.getElementById('detail-modal');
  if (!modal) return;
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.add('hidden'); });
}

function openDetailModal(p) {
  const body = document.getElementById('detail-modal-body');
  if (!body) return;

  const statusColors = { pending: 'var(--warning)', approved: 'var(--success)', rejected: 'var(--danger)', revised: 'var(--revise)' };
  const statusColor = statusColors[p.status] || 'var(--text-second)';

  const areaListPill = p.area_list_name
    ? `<div style="margin-top: 6px;"><span class="drawing-pill" data-file="${p.area_list_path}" data-name="${escapeHtml(p.area_list_name)}" style="font-size:0.8rem; background:#eff6ff; border:1px solid #bfdbfe; color:#1e40af; padding:3px 8px; border-radius:4px; cursor:pointer;">📄 Area List File: ${escapeHtml(p.area_list_name)}</span></div>` : '';
  const numberingPill = p.numbering_drawing_name
    ? `<div style="margin-top: 6px;"><span class="drawing-pill" data-file="${p.numbering_drawing_path}" data-name="${escapeHtml(p.numbering_drawing_name)}" style="font-size:0.8rem; background:#eff6ff; border:1px solid #bfdbfe; color:#1e40af; padding:3px 8px; border-radius:4px; cursor:pointer;">📄 Numbering Drawing File: ${escapeHtml(p.numbering_drawing_name)}</span></div>` : '';
  const poFilePill = (p.conversion_status === 'converted' && p.po_file_path)
    ? `<div style="margin-top: 6px;"><span class="drawing-pill" data-file="${p.po_file_path}" data-name="${escapeHtml(p.po_file_name)}" style="font-size:0.8rem; background:#ecfdf5; border:1px solid #6ee7b7; color:#047857; padding:3px 8px; border-radius:4px; cursor:pointer;">📄 PO Document: ${escapeHtml(p.po_file_name || 'View PO')}</span></div>`
    : `<div style="margin-top: 6px; font-size:0.8rem; color:#b45309; font-weight:600;">⏳ Conversion Status: Not Converted</div>`;

  body.innerHTML = `
    <div class="detail-section">
      <div class="detail-section-title">Project Information</div>
      <div class="detail-grid">
        <div><div class="detail-item-label">Job Number</div><div class="detail-item-value" style="font-family:monospace; color:var(--accent);">${escapeHtml(p.job_no)}</div></div>
        <div><div class="detail-item-label">Branch</div><div class="detail-item-value">${capitalize(p.branch)}</div></div>
        <div><div class="detail-item-label">Customer</div><div class="detail-item-value">${escapeHtml(p.customer_name)}</div></div>
        <div><div class="detail-item-label">PO Quantity</div><div class="detail-item-value">${p.po_quantity}</div></div>
        <div><div class="detail-item-label">Status</div><div class="detail-item-value" style="color:${statusColor}; font-weight:600;">${capitalize(p.status)}</div></div>
        <div><div class="detail-item-label">Created</div><div class="detail-item-value">${formatDate(p.created_at)}</div></div>
        <div><div class="detail-item-label">Submitted By</div><div class="detail-item-value">${escapeHtml(p.submitted_by_name || '—')}</div></div>
        <div><div class="detail-item-label">Drawing</div><div class="detail-item-value">${p.drawing_name ? escapeHtml(p.drawing_name) : '—'}</div></div>
      </div>
      ${p.revise_remark ? `<div style="margin-top:12px; padding:10px 12px; background:var(--revise-bg); border-radius:var(--radius-sm); font-size:0.82rem; color:var(--revise);">🔄 <strong>Revision note:</strong> ${escapeHtml(p.revise_remark)}</div>` : ''}
    </div>

    ${p.status === 'approved' ? `
    <div class="detail-section">
      <div class="detail-section-title">Billing Quantity</div>
      ${(() => {
        const bi = safeParseItems(p.billing_items, p.billing_qty, p.billing_unit, p.billing_rate, 'Billing Item');
        if (!bi.length) return `<div style="font-size:0.82rem; color:var(--text-muted); padding:8px 0;">No billing quantities entered yet.</div>${areaListPill}${numberingPill}${poFilePill}`;
        return `<table style="width:100%; border-collapse:collapse; font-size:0.82rem;">
          <tr style="background:var(--bg);"><th style="text-align:left; padding:5px 8px; border:1px solid var(--border);">Product</th><th style="padding:5px 8px; border:1px solid var(--border);">Qty</th><th style="padding:5px 8px; border:1px solid var(--border);">Unit</th></tr>
          ${bi.map(it => `<tr><td style="padding:5px 8px; border:1px solid var(--border);">${escapeHtml(it.product)}</td><td style="padding:5px 8px; border:1px solid var(--border); text-align:center;">${it.qty ?? '—'}</td><td style="padding:5px 8px; border:1px solid var(--border); text-align:center;">${it.unit || '—'}</td></tr>`).join('')}
        </table>
        <div style="margin-top:8px;">
          ${areaListPill}
          ${numberingPill}
          ${poFilePill}
        </div>`;
      })()}
    </div>
    <div class="detail-section">
      <div class="detail-section-title">Insulation Quantity</div>
      ${(() => {
        const ii = safeParseItems(p.insulation_items, p.insulation_qty, p.insulation_unit, p.insulation_rate, 'Insulation Item');
        if (!ii.length) return '<div style="font-size:0.82rem; color:var(--text-muted); padding:8px 0;">No insulation quantities entered yet.</div>';
        return `<table style="width:100%; border-collapse:collapse; font-size:0.82rem;">
          <tr style="background:var(--bg);"><th style="text-align:left; padding:5px 8px; border:1px solid var(--border);">Product</th><th style="padding:5px 8px; border:1px solid var(--border);">Qty</th><th style="padding:5px 8px; border:1px solid var(--border);">Unit</th></tr>
          ${ii.map(it => `<tr><td style="padding:5px 8px; border:1px solid var(--border);">${escapeHtml(it.product)}</td><td style="padding:5px 8px; border:1px solid var(--border); text-align:center;">${it.qty ?? '—'}</td><td style="padding:5px 8px; border:1px solid var(--border); text-align:center;">${it.unit || '—'}</td></tr>`).join('')}
        </table>`;
      })()}
    </div>` : ''}
  `;

  // Download buttons
  const dlPdf = document.getElementById('detail-dl-pdf');
  const dlExcel = document.getElementById('detail-dl-excel');

  if (dlPdf) dlPdf.onclick = () => downloadProjectPDF(p);
  if (dlExcel) dlExcel.onclick = () => downloadProjectExcel(p);

  document.getElementById('detail-modal').classList.remove('hidden');
}

// ─── Download: PDF (client-side print) ────────────────────────────────────────
function downloadProjectPDF(p) {
  const win = window.open('', '_blank');
  win.document.write(`
    <html><head><title>Project ${p.job_no}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 30px; color: #111; }
      h1 { font-size: 18px; margin-bottom: 4px; }
      .sub { font-size: 12px; color: #666; margin-bottom: 24px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
      th { background: #f5f5f5; text-align: left; padding: 8px 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #e0e0e0; }
      td { padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 13px; }
      .section-title { font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.06em; color: #666; margin: 20px 0 8px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
    </style>
    </head><body>
    <h1>CamDuct KNND — Planning Report</h1>
    <div class="sub">Generated on ${new Date().toLocaleDateString('en-IN')}</div>

    <div class="section-title">Project Details</div>
    <table>
      <tr><th>Field</th><th>Value</th></tr>
      <tr><td>Job Number</td><td>${p.job_no}</td></tr>
      <tr><td>Branch</td><td>${capitalize(p.branch)}</td></tr>
      <tr><td>Customer</td><td>${p.customer_name}</td></tr>
      <tr><td>PO Quantity</td><td>${p.po_quantity}</td></tr>
      <tr><td>Status</td><td>${capitalize(p.status)}</td></tr>
      <tr><td>Created</td><td>${formatDate(p.created_at)}</td></tr>
      <tr><td>Submitted By</td><td>${p.submitted_by_name || '—'}</td></tr>
      ${p.revise_remark ? `<tr><td>Revision Note</td><td>${p.revise_remark}</td></tr>` : ''}
    </table>

    ${p.status === 'approved' ? `
    <div class="section-title">Billing Quantity</div>
    <table>
      <tr><th>Product</th><th>Qty</th><th>Unit</th></tr>
      ${(() => { const bi = safeParseItems(p.billing_items, p.billing_qty, p.billing_unit, p.billing_rate, 'Billing Item'); return bi.length ? bi.map(it => `<tr><td>${it.product || '—'}</td><td>${it.qty ?? '—'}</td><td>${it.unit || '—'}</td></tr>`).join('') : '<tr><td colspan="3">No billing quantities entered yet</td></tr>'; })()}
    </table>
    <div class="section-title">Insulation Quantity</div>
    <table>
      <tr><th>Product</th><th>Qty</th><th>Unit</th></tr>
      ${(() => { const ii = safeParseItems(p.insulation_items, p.insulation_qty, p.insulation_unit, p.insulation_rate, 'Insulation Item'); return ii.length ? ii.map(it => `<tr><td>${it.product || '—'}</td><td>${it.qty ?? '—'}</td><td>${it.unit || '—'}</td></tr>`).join('') : '<tr><td colspan="3">No insulation quantities entered yet</td></tr>'; })()}
    </table>` : ''}

    <script>window.print(); window.onafterprint = () => window.close();<\/script>
    </body></html>
  `);
  win.document.close();
}

// ─── Download: Single Project Excel / CSV ─────────────────────────────────────
async function downloadProjectExcel(p) {
  const headers = [
    'Job No', 'Branch', 'Customer', 'PO Quantity', 'Status', 'Created Date',
    'Billing Product', 'Billing Qty', 'Billing Unit',
    'Insulation Product', 'Insulation Qty', 'Insulation Unit',
    'Submitted By', 'Revision Remark'
  ];

  const bi = safeParseItems(p.billing_items, p.billing_qty, p.billing_unit, p.billing_rate, 'Billing Item');
  const ii = safeParseItems(p.insulation_items, p.insulation_qty, p.insulation_unit, p.insulation_rate, 'Insulation Item');
  const maxLen = Math.max(1, bi.length, ii.length);

  const rows = [];
  for (let i = 0; i < maxLen; i++) {
    const b = bi[i] || {};
    const ins = ii[i] || {};
    rows.push([
      `"${i === 0 ? p.job_no : ''}"`,
      `"${i === 0 ? capitalize(p.branch) : ''}"`,
      `"${i === 0 ? p.customer_name : ''}"`,
      i === 0 ? p.po_quantity : '',
      `"${i === 0 ? capitalize(p.status) : ''}"`,
      `"${i === 0 ? formatDate(p.created_at) : ''}"`,
      `"${b.product || '—'}"`,
      b.qty ?? '—',
      `"${b.unit || '—'}"`,
      `"${ins.product || '—'}"`,
      ins.qty ?? '—',
      `"${ins.unit || '—'}"`,
      `"${i === 0 ? (p.submitted_by_name || '—') : ''}"`,
      `"${i === 0 ? (p.revise_remark || '—') : ''}"`
    ]);
  }

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `project_${p.job_no}_${p.branch}.csv`;
  link.click();
  showToast('Project data downloaded', 'success');
}

// ─── Calendar Export Modal ───────────────────────────────────────────────────
function setupCalendarExportModal() {
  const modal = document.getElementById('calendar-export-modal');
  const openBtn = document.getElementById('open-calendar-dl-btn');
  const closeBtn = document.getElementById('calendar-export-modal-close');
  const cancelBtn = document.getElementById('calendar-export-modal-cancel');
  const confirmBtn = document.getElementById('calendar-export-modal-confirm');
  const categorySelect = document.getElementById('cal-export-category');
  const statusSelect = document.getElementById('cal-export-status');
  const fromInput = document.getElementById('cal-export-from');
  const toInput = document.getElementById('cal-export-to');

  if (!modal || !openBtn) return;

  const closeModal = () => modal.classList.add('hidden');
  const openModal = () => {
    if (categorySelect) categorySelect.value = currentBifurcation;
    if (statusSelect) statusSelect.value = currentStatusFilter;
    modal.classList.remove('hidden');
  };

  openBtn.addEventListener('click', openModal);
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

  // Preset buttons
  document.querySelectorAll('.cal-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = btn.dataset.preset;
      const today = new Date().toISOString().split('T')[0];
      if (preset === 'today') {
        fromInput.value = today;
        toInput.value = today;
      } else if (preset === 'this-week') {
        const d = new Date();
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d.setDate(diff)).toISOString().split('T')[0];
        fromInput.value = monday;
        toInput.value = today;
      } else if (preset === 'this-month') {
        const d = new Date();
        const firstDay = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
        fromInput.value = firstDay;
        toInput.value = today;
      } else if (preset === 'all-time') {
        fromInput.value = '';
        toInput.value = '';
      }
    });
  });

  if (confirmBtn) {
    confirmBtn.addEventListener('click', async () => {
      const cat = categorySelect ? categorySelect.value : currentBifurcation;
      const st = statusSelect ? statusSelect.value : currentStatusFilter;
      const from = fromInput ? fromInput.value : '';
      const to = toInput ? toInput.value : '';
      const branchParam = new URLSearchParams(window.location.search).get('branch') || (currentUser ? currentUser.branch : '') || 'maalur';

      const queryParams = new URLSearchParams();
      if (branchParam) queryParams.set('branch', branchParam);
      if (cat && cat !== 'all') queryParams.set('customer_type', cat);
      if (st && st !== 'all') queryParams.set('status', st);
      if (from) queryParams.set('from', from);
      if (to) queryParams.set('to', to);

      try {
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '⏳ Exporting...';
        const res = await apiFetch(`/planning/export?${queryParams.toString()}`);
        if (!res || !res.ok) throw new Error('Failed to export report');
        const blob = await res.blob();
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        const fileName = `projects_export_${cat}_${st}_${new Date().toISOString().split('T')[0]}.xlsx`;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(link.href);
        showToast('Excel report downloaded successfully!', 'success');
        closeModal();
      } catch (err) {
        showToast(`Export error: ${err.message}`, 'error');
      } finally {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = '📊 Export Excel';
      }
    });
  }
}

// ─── Overall Download Bar ────────────────────────────────────────────────────
function setupDownloadBar() {
  const excelBtn = document.getElementById('dl-excel-btn');
  if (!excelBtn) return;

  excelBtn.addEventListener('click', () => {
    const from = document.getElementById('dl-from').value;
    const to = document.getElementById('dl-to').value;
    const branchParam = new URLSearchParams(window.location.search).get('branch') || '';

    apiFetch(`/planning/export?${from ? 'from=' + from + '&' : ''}${to ? 'to=' + to + '&' : ''}${branchParam ? 'branch=' + branchParam : ''}`)
      .then(r => r.blob())
      .then(blob => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `planning_export_${new Date().toISOString().split('T')[0]}.xlsx`;
        link.click();
        URL.revokeObjectURL(link.href);
        showToast('Excel exported', 'success');
      });
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function safeParseItems(raw, legacyQty, legacyUnit, legacyRate, defaultLabel = 'Quantity') {
  if (raw) {
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch { }
  }
  if (legacyQty != null && legacyQty !== '') {
    return [{ product: defaultLabel, qty: Number(legacyQty), unit: legacyUnit || '', rate: legacyRate ? Number(legacyRate) : null }];
  }
  return [];
}

// ─── Start ────────────────────────────────────────────────────────────────────
initPlanning();
