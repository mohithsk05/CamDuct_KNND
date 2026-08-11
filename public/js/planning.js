/**
 * planning.js — Planning Department page logic
 */

const API_PLANNING = '/api/planning';

let currentUser = null;
let currentBranch = 'maalur';
let currentProjectId = null; // for quantity modals
let selectedFile = null;
let allProjects = [];

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

const UNIT_LIST = ['sqft', 'sqmt', 'nos', 'rmt', 'kg', 'ltr', 'set', 'pcs', 'mtr'];

// Build a product item row for PO / Billing / Insulation modals
function buildProductItemRow(containerId, idx, existing = {}) {
  const unitOptions = UNIT_LIST.map(u =>
    `<option value="${u}" ${existing.unit === u ? 'selected' : ''}>${u}</option>`
  ).join('');

  const hasRate = containerId !== 'po-items-container';

  return `
    <div class="product-item-row" data-row-idx="${idx}" style="display:grid; grid-template-columns: 2fr 1fr 1fr ${hasRate ? '1fr' : ''} 32px; gap:6px; align-items:center; background:#f8fafc; border:1px solid var(--border); border-radius:8px; padding:8px 10px;">
      <div class="pi-combobox" style="position:relative;">
        <input class="form-input pi-product-search" type="text" placeholder="🔍 Search product..." autocomplete="off" value="${existing.product || ''}" style="font-size:0.85rem; width:100%; box-sizing:border-box;">
        <input class="pi-product-value" type="hidden" value="${existing.product || ''}">
      </div>
      <input class="form-input pi-qty" type="number" placeholder="Qty" min="0" step="0.01" value="${existing.qty || ''}" style="font-size:0.85rem;">
      <select class="form-input pi-unit" style="font-size:0.85rem;">
        <option value="">Unit</option>
        ${unitOptions}
      </select>
      ${hasRate ? `<input class="form-input pi-rate" type="number" placeholder="Rate (₹)" min="0" step="0.01" value="${existing.rate || ''}" style="font-size:0.85rem;">` : ''}
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
      _selectPortalProduct(item.dataset.value);
    }
  });

  document.body.appendChild(_portalDropdown);
  return _portalDropdown;
}

function _positionPortalDropdown(inputEl) {
  const dd = getPortalDropdown();
  const rect = inputEl.getBoundingClientRect();
  dd.style.top  = (rect.bottom + 4) + 'px';
  dd.style.left = rect.left + 'px';
  dd.style.width = Math.max(rect.width, 260) + 'px';
}

function _renderPortalDropdown(query) {
  const dd = getPortalDropdown();
  const q = (query || '').toLowerCase().trim();
  const filtered = q
    ? PRODUCT_LIST.filter(p => p.toLowerCase().includes(q))
    : PRODUCT_LIST;

  if (!filtered.length) {
    dd.innerHTML = '<div style="padding:10px 14px; font-size:0.83rem; color:#9ca3af;">No products found</div>';
  } else {
    dd.innerHTML = filtered.map((p, i) => {
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

    if (product) {
      items.push({ product, qty, unit, rate });
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
  currentBranch = branchFromQuery || currentUser.branch || 'maalur';
  const pillText = document.getElementById('branch-pill-text');
  if (pillText) pillText.textContent = capitalize(currentBranch || '—');

  // Back button
  const backBtn = document.getElementById('back-btn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      if (currentUser.role === 'admin') window.location.href = '/admin-dashboard.html';
      else if (currentUser.role === 'manager') window.location.href = '/manager-dashboard.html';
      else window.location.href = '/dept-dashboard.html';
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
  setupBillingModal();
  setupInsulationModal();
  setupReviewModal();
  setupDetailModal();

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

// ─── Submit Modal ─────────────────────────────────────────────────────────────
function setupSubmitModal() {
  const modal = document.getElementById('submit-modal');
  const closeBtn = document.getElementById('submit-modal-close');
  const cancelBtn = document.getElementById('submit-modal-cancel');
  const confirmBtn = document.getElementById('submit-modal-confirm');
  const addPoBtn = document.getElementById('add-po-item-btn');
  if (!modal) return;

  // Add PO item row button
  if (addPoBtn) addPoBtn.addEventListener('click', () => addProductItemRow('po-items-container'));

  [closeBtn, cancelBtn].forEach(b => b && b.addEventListener('click', () => {
    modal.classList.add('hidden');
    selectedFile = null;
    document.getElementById('file-input').value = '';
  }));

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.add('hidden');
      selectedFile = null;
    }
  });

  if (confirmBtn) {
    confirmBtn.addEventListener('click', async () => {
      const jobNo = document.getElementById('s-job-no').value.trim();
      const customer = document.getElementById('s-customer').value.trim();
      const errEl = document.getElementById('submit-error');
      const errMsg = document.getElementById('submit-error-msg');

      if (!jobNo || !customer) {
        errMsg.textContent = 'Job Number and Customer Name are required.';
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
        // Send po_items as JSON; po_quantity summary will be count of items or 0
        formData.append('po_quantity', poItems.length || 0);
        formData.append('po_items', JSON.stringify(poItems));
        formData.append('branch', currentBranch || currentUser.branch || 'maalur');
        if (selectedFile) formData.append('drawing', selectedFile);

        const token = getToken();
        const res = await fetch(`${API_PLANNING}/submit`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData,
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Submission failed');

        showToast(`Project ${jobNo} submitted for approval ✅`, 'success');
        modal.classList.add('hidden');
        selectedFile = null;
        document.getElementById('file-input').value = '';
        document.getElementById('s-job-no').value = '';
        document.getElementById('s-customer').value = '';
        document.getElementById('po-items-container').innerHTML = '';
        await loadProjects();
      } catch (err) {
        errMsg.textContent = err.message;
        errEl.classList.remove('hidden');
      } finally {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = `<svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg> Submit for Approval`;
      }
    });
  }
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
    let filtered = allProjects.filter(p => p.branch && p.branch.toLowerCase() === targetBranch);
    if (filtered.length === 0 && allProjects.length > 0 && currentUser.role === 'admin') {
      filtered = allProjects; // admin fallback
    }

    if (filtered.length === 0) {
      listEl.innerHTML = `
        <div class="no-projects">
          <div style="font-size:2rem; margin-bottom:10px; opacity:0.4;">📋</div>
          <p>No projects yet for ${capitalize(targetBranch)} branch.</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = filtered.map(p => renderProjectCard(p)).join('');
    attachProjectCardEvents();
  } catch (err) {
    listEl.innerHTML = `<p style="color:var(--danger); padding:16px;">Error: ${err.message}</p>`;
  }
}

// ─── Render Project Card ────────────────────────────────────────────────────
function renderProjectCard(p) {
  const statusBadge = {
    pending:  `<span class="badge badge-pending">⏳ Pending Review</span>`,
    approved: `<span class="badge badge-approved">✅ Approved</span>`,
    rejected: `<span class="badge badge-rejected">❌ Rejected</span>`,
    revised:  `<span class="badge badge-revised">🔄 Revision Requested</span>`,
  }[p.status] || `<span class="badge">${p.status}</span>`;

  // Admin decision buttons (ONLY show on pending or revised projects)
  const showAdminDecisionButtons = (currentUser.role === 'admin') && (p.status === 'pending' || p.status === 'revised');

  const adminDecisionBar = showAdminDecisionButtons ? `
    <div class="admin-review-bar" style="display:flex; align-items:center; gap:10px; padding:12px 18px; background:#f8fafc; border-top:1.5px solid var(--border); flex-wrap:wrap;">
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

  // Revise remark banner
  const reviseBanner = (p.status === 'revised' && p.revise_remark)
    ? `<div class="revise-remark-banner">
        <div class="revise-remark-banner-icon">🔄</div>
        <div class="revise-remark-banner-text"><strong>Revision note:</strong> ${escapeHtml(p.revise_remark)}</div>
      </div>` : '';

  // Drawing pill
  const drawingPill = p.drawing_name
    ? `<span class="drawing-pill" data-file="${p.drawing_path}" data-name="${escapeHtml(p.drawing_name)}">
        ${getFileIcon(p.drawing_name)} ${escapeHtml(p.drawing_name)}
      </span>` : `<span style="font-size:0.78rem; color:var(--text-muted);">No file attached</span>`;

  // Quantities Bar logic
  let qtyBar = '';
  if (p.status === 'approved') {
    // Parse stored JSON items (with legacy single field fallback)
    const billingItems  = safeParseItems(p.billing_items, p.billing_qty, p.billing_unit, p.billing_rate, 'Billing Item');
    const insulationItems = safeParseItems(p.insulation_items, p.insulation_qty, p.insulation_unit, p.insulation_rate, 'Insulation Item');
    const billingDoneItems = billingItems.length > 0;
    const insulationDoneItems = insulationItems.length > 0;

    const buildItemsSummary = (items, icon) =>
      items.map(it => `<div style="display:flex; align-items:center; gap:6px;"><span style="font-size:0.95rem;">${icon}</span> <strong style="color:var(--text-primary); font-weight:600;">${escapeHtml(it.product)}:</strong> <span style="font-weight:700; color:var(--text-primary);">${it.qty ?? '—'}</span> <span style="color:var(--text-second);">${escapeHtml(it.unit || '')}</span> ${it.rate ? `<span style="color:var(--text-second);">@ ₹${it.rate}</span>` : ''}</div>`).join('');

    if (currentUser.role === 'planning') {
      const billingContent = billingDoneItems
        ? `<div style="display:flex; align-items:flex-start; justify-content:space-between; width:100%; gap:12px; font-size:0.88rem; line-height:1.8;">
             <div style="display:flex; flex-direction:column; gap:3px;">${buildItemsSummary(billingItems, '💼')}</div>
             <button class="btn btn-ghost btn-sm" data-id="${p.id}" data-field="billing" data-action="request-edit" style="font-size:0.8rem; color:var(--text-second); padding:3px 10px; flex-shrink:0;">🔒 Request Edit</button>
           </div>`
        : `<button class="btn btn-outline btn-sm" data-id="${p.id}" data-job="${p.job_no}" data-action="billing" style="font-size:0.85rem;">💼 Enter Billing Qty</button>`;

      const insulationContent = insulationDoneItems
        ? `<div style="display:flex; align-items:flex-start; justify-content:space-between; width:100%; gap:12px; font-size:0.88rem; line-height:1.8;">
             <div style="display:flex; flex-direction:column; gap:3px;">${buildItemsSummary(insulationItems, '🧱')}</div>
             <button class="btn btn-ghost btn-sm" data-id="${p.id}" data-field="insulation" data-action="request-edit" style="font-size:0.8rem; color:var(--text-second); padding:3px 10px; flex-shrink:0;">🔒 Request Edit</button>
           </div>`
        : `<button class="btn btn-outline btn-sm" data-id="${p.id}" data-job="${p.job_no}" data-action="insulation" style="font-size:0.85rem;">🧱 Enter Insulation Qty</button>`;

      qtyBar = `
        <div class="qty-actions-bar" style="display:flex; gap:16px; padding:12px 18px; background:var(--success-bg); border-top:1.5px solid #bbf7d0; align-items:flex-start;">
          <span class="qty-actions-label" style="font-size:0.9rem; font-weight:700; color:var(--success); padding-top:2px;">Quantities:</span>
          <div style="display:flex; flex-direction:column; gap:10px; flex:1;">
            ${billingContent}
            ${insulationContent}
          </div>
        </div>
      `;
    } else {
      // Admin / Manager: READ-ONLY
      const billingDisplay = billingDoneItems
        ? `<div style="display:flex; flex-direction:column; gap:3px; font-size:0.88rem; line-height:1.8;">${buildItemsSummary(billingItems, '💼')}</div>`
        : `<div style="font-size:0.85rem; color:#94a3b8; font-weight:500;">Billing qty pending</div>`;

      const insulationDisplay = insulationDoneItems
        ? `<div style="display:flex; flex-direction:column; gap:3px; font-size:0.88rem; line-height:1.8;">${buildItemsSummary(insulationItems, '🧱')}</div>`
        : `<div style="font-size:0.85rem; color:#94a3b8; font-weight:500;">Insulation qty pending</div>`;

      const adminUnlockBtn = (currentUser.role === 'admin' && (billingDoneItems || insulationDoneItems))
        ? `<button class="btn btn-outline btn-sm" data-id="${p.id}" data-action="admin-unlock" style="font-size:0.8rem;">🔓 Unlock Edit for Planning</button>` : '';

      qtyBar = `
        <div class="qty-actions-bar" style="display:flex; gap:16px; padding:12px 18px; background:var(--success-bg); border-top:1.5px solid #bbf7d0; align-items:flex-start;">
          <span class="qty-actions-label" style="font-size:0.9rem; font-weight:700; color:var(--success); padding-top:2px;">Quantities:</span>
          <div style="flex:1; display:flex; flex-direction:column; gap:10px;">
            ${billingDisplay}
            ${insulationDisplay}
          </div>
          ${adminUnlockBtn}
        </div>
      `;
    }
  }

  return `
    <div class="project-card" data-status="${p.status}" data-id="${p.id}">
      <div class="project-card-header">
        <div class="project-card-meta">
          <div class="project-job-no">Job# <span>${escapeHtml(p.job_no)}</span></div>
          <div class="project-customer">📍 ${escapeHtml(p.customer_name)}</div>
          <div class="project-date">🕒 ${formatDate(p.created_at)}</div>
          <span style="font-size:0.75rem; color:var(--text-second); background:var(--bg); border:1px solid var(--border); border-radius:999px; padding:2px 9px; text-transform:uppercase; font-weight:700;">${capitalize(p.branch)}</span>
        </div>
        <div class="project-card-actions">
          ${statusBadge}
          <button class="btn btn-outline btn-sm" data-id="${p.id}" data-action="view-detail">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
            Details
          </button>
        </div>
      </div>

      ${reviseBanner}

      <div class="project-card-body">
        <div class="project-detail-grid">
          <div class="project-detail-item">
            <div class="project-detail-label">PO Quantity</div>
            <div class="project-detail-value">${p.po_quantity ?? '—'}</div>
          </div>
          <div class="project-detail-item">
            <div class="project-detail-label">Drawing</div>
            <div class="project-detail-value">${drawingPill}</div>
          </div>
          <div class="project-detail-item">
            <div class="project-detail-label">Submitted By</div>
            <div class="project-detail-value">${escapeHtml(p.submitted_by_name || '—')}</div>
          </div>
          <div class="project-detail-item">
            <div class="project-detail-label">Last Updated</div>
            <div class="project-detail-value">${formatDate(p.updated_at)}</div>
          </div>
        </div>
      </div>

      ${qtyBar}
      ${adminDecisionBar}
    </div>
  `;
}

// ─── Attach Project Card Events ─────────────────────────────────────────────
function attachProjectCardEvents() {
  // Drawing pill → view/download
  document.querySelectorAll('.drawing-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const filename = pill.dataset.file;
      if (!filename) return;
      apiFetch(`/planning/drawing/${filename}`).then(r => {
        if (!r || !r.ok) { showToast('File not found', 'error'); return; }
        return r.blob();
      }).then(blob => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.click();
        URL.revokeObjectURL(url);
      });
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
      document.getElementById('billing-modal').classList.remove('hidden');
    });
  });

  // Add Billing item button
  const addBillingBtn = document.getElementById('add-billing-item-btn');
  if (addBillingBtn) addBillingBtn.addEventListener('click', () => addProductItemRow('billing-items-container'));

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
  if (addInsulationBtn) addInsulationBtn.addEventListener('click', () => addProductItemRow('insulation-items-container'));

  // Admin Quick Approve
  document.querySelectorAll('[data-action="quick-approve"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      const res = await apiFetch(`/planning/projects/${id}/review`, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'approved', remark: '' }),
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
      const el = e.currentTarget;
      currentProjectId = el.getAttribute('data-id');
      document.getElementById('review-job-no').textContent = '#' + el.getAttribute('data-job');
      document.getElementById('review-remark').value = '';
      document.getElementById('review-modal').classList.remove('hidden');
    });
  });

  // Admin Quick Reject
  document.querySelectorAll('[data-action="quick-reject"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      const res = await apiFetch(`/planning/projects/${id}/review`, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'rejected', remark: '' }),
      });
      if (res && res.ok) {
        showToast('Project rejected ❌', 'error');
        await loadProjects();
      }
    });
  });

  // Request Edit button (Planning user)
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
    errEl.classList.add('hidden');

    try {
      const res = await apiFetch(`/planning/projects/${currentProjectId}/quantities`, {
        method: 'PATCH',
        body: JSON.stringify({ billing_items: items }),
      });
      const data = res ? await res.json() : null;

      if (res && res.ok) {
        showToast('Billing quantities saved ✅', 'success');
        document.getElementById('billing-modal').classList.add('hidden');
        await loadProjects();
      } else {
        errMsg.textContent = (data && data.error) || 'Failed to save billing quantities.';
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
    { id: 'review-revise-btn',  action: 'revised' },
    { id: 'review-reject-btn',  action: 'rejected' },
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
        if (!bi.length) return '<div style="font-size:0.82rem; color:var(--text-muted); padding:8px 0;">No billing quantities entered yet.</div>';
        return `<table style="width:100%; border-collapse:collapse; font-size:0.82rem;">
          <tr style="background:var(--bg);"><th style="text-align:left; padding:5px 8px; border:1px solid var(--border);">Product</th><th style="padding:5px 8px; border:1px solid var(--border);">Qty</th><th style="padding:5px 8px; border:1px solid var(--border);">Unit</th><th style="padding:5px 8px; border:1px solid var(--border);">Rate (₹)</th><th style="padding:5px 8px; border:1px solid var(--border);">Total (₹)</th></tr>
          ${bi.map(it => `<tr><td style="padding:5px 8px; border:1px solid var(--border);">${escapeHtml(it.product)}</td><td style="padding:5px 8px; border:1px solid var(--border); text-align:center;">${it.qty ?? '—'}</td><td style="padding:5px 8px; border:1px solid var(--border); text-align:center;">${it.unit || '—'}</td><td style="padding:5px 8px; border:1px solid var(--border); text-align:right;">${it.rate ?? '—'}</td><td style="padding:5px 8px; border:1px solid var(--border); text-align:right; font-weight:600;">${it.qty && it.rate ? (it.qty * it.rate).toFixed(2) : '—'}</td></tr>`).join('')}
        </table>`;
      })()}
    </div>
    <div class="detail-section">
      <div class="detail-section-title">Insulation Quantity</div>
      ${(() => {
        const ii = safeParseItems(p.insulation_items, p.insulation_qty, p.insulation_unit, p.insulation_rate, 'Insulation Item');
        if (!ii.length) return '<div style="font-size:0.82rem; color:var(--text-muted); padding:8px 0;">No insulation quantities entered yet.</div>';
        return `<table style="width:100%; border-collapse:collapse; font-size:0.82rem;">
          <tr style="background:var(--bg);"><th style="text-align:left; padding:5px 8px; border:1px solid var(--border);">Product</th><th style="padding:5px 8px; border:1px solid var(--border);">Qty</th><th style="padding:5px 8px; border:1px solid var(--border);">Unit</th><th style="padding:5px 8px; border:1px solid var(--border);">Rate (₹)</th><th style="padding:5px 8px; border:1px solid var(--border);">Total (₹)</th></tr>
          ${ii.map(it => `<tr><td style="padding:5px 8px; border:1px solid var(--border);">${escapeHtml(it.product)}</td><td style="padding:5px 8px; border:1px solid var(--border); text-align:center;">${it.qty ?? '—'}</td><td style="padding:5px 8px; border:1px solid var(--border); text-align:center;">${it.unit || '—'}</td><td style="padding:5px 8px; border:1px solid var(--border); text-align:right;">${it.rate ?? '—'}</td><td style="padding:5px 8px; border:1px solid var(--border); text-align:right; font-weight:600;">${it.qty && it.rate ? (it.qty * it.rate).toFixed(2) : '—'}</td></tr>`).join('')}
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
      <tr><th>Product</th><th>Qty</th><th>Unit</th><th>Rate (₹)</th><th>Total (₹)</th></tr>
      ${(() => { const bi = safeParseItems(p.billing_items, p.billing_qty, p.billing_unit, p.billing_rate, 'Billing Item'); return bi.length ? bi.map(it => `<tr><td>${it.product || '—'}</td><td>${it.qty ?? '—'}</td><td>${it.unit || '—'}</td><td>${it.rate ?? '—'}</td><td>${it.qty && it.rate ? (it.qty * it.rate).toFixed(2) : '—'}</td></tr>`).join('') : '<tr><td colspan="5">No billing quantities entered yet</td></tr>'; })()}
    </table>
    <div class="section-title">Insulation Quantity</div>
    <table>
      <tr><th>Product</th><th>Qty</th><th>Unit</th><th>Rate (₹)</th><th>Total (₹)</th></tr>
      ${(() => { const ii = safeParseItems(p.insulation_items, p.insulation_qty, p.insulation_unit, p.insulation_rate, 'Insulation Item'); return ii.length ? ii.map(it => `<tr><td>${it.product || '—'}</td><td>${it.qty ?? '—'}</td><td>${it.unit || '—'}</td><td>${it.rate ?? '—'}</td><td>${it.qty && it.rate ? (it.qty * it.rate).toFixed(2) : '—'}</td></tr>`).join('') : '<tr><td colspan="5">No insulation quantities entered yet</td></tr>'; })()}
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
    'Billing Product', 'Billing Qty', 'Billing Unit', 'Billing Rate (₹)', 'Billing Total (₹)',
    'Insulation Product', 'Insulation Qty', 'Insulation Unit', 'Insulation Rate (₹)', 'Insulation Total (₹)',
    'Submitted By', 'Revision Remark'
  ];

  const bi = safeParseItems(p.billing_items, p.billing_qty, p.billing_unit, p.billing_rate, 'Billing Item');
  const ii = safeParseItems(p.insulation_items, p.insulation_qty, p.insulation_unit, p.insulation_rate, 'Insulation Item');
  const maxLen = Math.max(1, bi.length, ii.length);

  const rows = [];
  for (let i = 0; i < maxLen; i++) {
    const b = bi[i] || {};
    const ins = ii[i] || {};
    const bTotal = b.qty && b.rate ? (b.qty * b.rate).toFixed(2) : '—';
    const iTotal = ins.qty && ins.rate ? (ins.qty * ins.rate).toFixed(2) : '—';
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
      b.rate ?? '—',
      bTotal,
      `"${ins.product || '—'}"`,
      ins.qty ?? '—',
      `"${ins.unit || '—'}"`,
      ins.rate ?? '—',
      iTotal,
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

// ─── Overall Download Bar ────────────────────────────────────────────────────
function setupDownloadBar() {
  const excelBtn = document.getElementById('dl-excel-btn');
  if (!excelBtn) return;

  excelBtn.addEventListener('click', () => {
    const from = document.getElementById('dl-from').value;
    const to   = document.getElementById('dl-to').value;
    const branchParam = new URLSearchParams(window.location.search).get('branch') || '';

    apiFetch(`/planning/export?${from ? 'from='+from+'&' : ''}${to ? 'to='+to+'&' : ''}${branchParam ? 'branch='+branchParam : ''}`)
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
    } catch {}
  }
  if (legacyQty != null && legacyQty !== '') {
    return [{ product: defaultLabel, qty: Number(legacyQty), unit: legacyUnit || '', rate: legacyRate ? Number(legacyRate) : null }];
  }
  return [];
}

// ─── Start ────────────────────────────────────────────────────────────────────
initPlanning();
