/**
 * dashboard.js — Dashboard logic: tile routing, power grants, users panel, overview
 */

const DEPT_LABELS = {
  planning: { label: 'Planning', icon: '📋', desc: 'Projects & drawings' },
  purchase: { label: 'Purchase', icon: '🛒', desc: 'PO & raw materials' },
  consumption: { label: 'Consumption', icon: '🔧', desc: 'Material & tools usage' },
  accounts: { label: 'Accounts', icon: '💼', desc: 'Billing & invoices' },
  dispatch: { label: 'Dispatch', icon: '🚚', desc: 'Shipment & delivery' },
  balance: { label: 'Balance', icon: '⚖️', desc: 'Financial overview' },
  scrap: { label: 'Scrap', icon: '♻️', desc: 'Scrap management' },
  users: { label: 'Users', icon: '👥', desc: 'User management' },
  overview: { label: 'Overview', icon: '📊', desc: 'Reports & summary' },
};

// Departments that can be power-granted
const GRANTABLE_DEPTS = ['planning', 'purchase', 'consumption', 'accounts', 'dispatch', 'balance', 'scrap'];

let currentBranch = null;
let activePanelDept = null;
let currentRole = null;
let powerModalTargetDept = null;
let existingGrants = [];

async function initDashboard(role) {
  currentRole = role;

  // STEP 1: Check token + cached user exist (fast check, no server call)
  const token = getToken();
  const cachedUser = getUser();
  if (!token || !cachedUser) {
    window.location.href = '/portal.html';
    return;
  }

  // STEP 2: ALWAYS refresh from server first to get accurate role/hasAdminPower
  // This ensures routing decisions are never made on stale sessionStorage data.
  let user = await refreshUser();
  if (!user) {
    sessionStorage.removeItem('auth_token');
    sessionStorage.removeItem('auth_user');
    window.location.href = '/portal.html';
    return;
  }

  // STEP 3: Route on FRESH server data
  if (role === 'admin') {
    // admin-dashboard.html: requires role === 'admin'
    // Both true admins AND elevated managers (server sets role='admin') pass here.
    if (user.role !== 'admin') {
      if (user.role === 'manager') {
        window.location.href = '/manager-dashboard.html';
      } else {
        window.location.href = '/portal.html';
      }
      return;
    }
  } else if (role === 'manager') {
    // manager-dashboard.html: if manager now has admin power, redirect to admin dashboard
    if (user.hasAdminPower) {
      window.location.href = '/admin-dashboard.html';
      return;
    }
    if (user.role !== 'manager') {
      window.location.href = '/portal.html';
      return;
    }
  } else {
    // dept-dashboard.html
    const deptRoles = ['planning', 'purchase', 'consumption', 'accounts', 'dispatch', 'security'];
    if (!deptRoles.includes(user.role)) {
      window.location.href = '/portal.html';
      return;
    }
  }

  // STEP 4: Initialize UI
  setupLogout();
  populateTopbar(user);
  setupNotifications();

  const refreshBtn = document.getElementById('refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      const icon = refreshBtn.querySelector('.refresh-icon');
      if (icon) {
        icon.style.transform = 'rotate(360deg)';
        setTimeout(() => { icon.style.transform = 'rotate(0deg)'; }, 600);
      }
      showToast('Refreshed successfully', 'success');

      const panel = document.getElementById('content-panel');
      const contentEl = document.getElementById('panel-content');
      if (panel && !panel.classList.contains('hidden') && contentEl && activePanelDept) {
        if (activePanelDept === 'overview') await renderOverviewPanel(contentEl, role, user);
        else if (activePanelDept === 'users') await renderUsersPanel(contentEl, role, user);
      } else {
        if (role === 'admin') await setupAdminTiles(user);
        else if (role === 'manager') await setupManagerTiles(user);
        else setupDeptTiles(user);
      }
    });
  }

  if (role === 'admin') {
    const selector = document.getElementById('branch-selector');
    const mainDash = document.getElementById('main-dashboard');
    const switchBtn = document.getElementById('switch-branch-btn');
    const backBtn = document.getElementById('back-btn');

    // Check if branch stored in query param or sessionStorage
    const urlBranch = new URLSearchParams(window.location.search).get('branch');
    const storedBranch = sessionStorage.getItem('active_branch');
    const initialBranch = urlBranch || storedBranch;

    // Helper to activate branch dashboard
    const activateBranchDashboard = (branchName) => {
      currentBranch = branchName.toLowerCase();
      sessionStorage.setItem('active_branch', currentBranch);
      try {
        history.replaceState(null, '', `?branch=${currentBranch}`);
      } catch (e) { }

      if (selector) selector.classList.add('hidden');
      if (mainDash) mainDash.classList.remove('hidden');

      const pill = document.getElementById('branch-pill-text');
      if (pill) pill.textContent = capitalize(currentBranch);

      if (backBtn) backBtn.classList.remove('hidden');

      setupAdminTiles(user);
    };

    // Elevated Manager (hasAdminPower) - branch-locked admin view
    if (user.hasAdminPower && user.branch) {
      currentBranch = user.branch.toLowerCase();
      sessionStorage.setItem('active_branch', currentBranch);

      const topbarSub = document.querySelector('.topbar-subtitle');
      if (topbarSub) topbarSub.textContent = 'Admin Power - ' + capitalize(user.branch);

      if (selector) selector.classList.add('hidden');
      if (mainDash) mainDash.classList.remove('hidden');

      const pill = document.getElementById('branch-pill-text');
      if (pill) pill.textContent = capitalize(user.branch) + ' (Authority)';

      const dashTitle = mainDash ? mainDash.querySelector('h2') : null;
      if (dashTitle) dashTitle.textContent = 'Branch Admin Dashboard';
      const dashDesc = mainDash ? mainDash.querySelector('p') : null;
      if (dashDesc) dashDesc.textContent = 'Admin authority active - ' + capitalize(user.branch) + ' branch only';

      if (switchBtn) switchBtn.style.display = 'none';

      const revertBtn = document.getElementById('revert-power-btn');
      if (revertBtn) revertBtn.classList.remove('hidden');

      setupAdminTiles(user);

    } else if (initialBranch) {
      // True Admin — auto-restore active branch if previously selected
      activateBranchDashboard(initialBranch);
    } else {
      // True Admin — normal branch selector flow
      if (selector) selector.classList.remove('hidden');
      if (mainDash) mainDash.classList.add('hidden');
      if (backBtn) backBtn.classList.add('hidden');
    }

    // Branch card click listeners
    document.querySelectorAll('.branch-card').forEach(function (card) {
      card.addEventListener('click', function () {
        activateBranchDashboard(card.dataset.branch);
      });
    });

    if (switchBtn) {
      switchBtn.addEventListener('click', function () {
        sessionStorage.removeItem('active_branch');
        currentBranch = null;
        try {
          history.replaceState(null, '', window.location.pathname);
        } catch (e) { }
        if (mainDash) mainDash.classList.add('hidden');
        const panel = document.getElementById('content-panel');
        if (panel) panel.classList.add('hidden');
        if (selector) selector.classList.remove('hidden');
        if (backBtn) backBtn.classList.add('hidden');
      });
    }

    // Topbar Back button for Admin
    if (backBtn) {
      backBtn.addEventListener('click', function () {
        const panel = document.getElementById('content-panel');
        if (panel && !panel.classList.contains('hidden')) {
          panel.classList.add('hidden');
          if (mainDash) mainDash.classList.remove('hidden');
        } else {
          // In grid view: return to branch selector
          sessionStorage.removeItem('active_branch');
          currentBranch = null;
          try {
            history.replaceState(null, '', window.location.pathname);
          } catch (e) { }
          if (mainDash) mainDash.classList.add('hidden');
          if (selector) selector.classList.remove('hidden');
          backBtn.classList.add('hidden');
        }
      });
    }

  } else if (role === 'manager') {
    currentBranch = user.branch.toLowerCase();
    sessionStorage.setItem('active_branch', currentBranch);
    var pill = document.getElementById('branch-pill-text');
    if (pill) pill.textContent = capitalize(user.branch);
    var sub = document.getElementById('mgr-branch-sub');
    if (sub) sub.textContent = 'Manager - ' + capitalize(user.branch);
    setupManagerTiles(user);

    const backBtn = document.getElementById('back-btn');
    if (backBtn) {
      backBtn.addEventListener('click', function () {
        const panel = document.getElementById('content-panel');
        if (panel && !panel.classList.contains('hidden')) {
          panel.classList.add('hidden');
          const mainDash = document.getElementById('main-dashboard');
          if (mainDash) mainDash.classList.remove('hidden');
          backBtn.classList.add('hidden');
        }
      });
    }

  } else {
    currentBranch = user.branch.toLowerCase();
    sessionStorage.setItem('active_branch', currentBranch);
    var pill2 = document.getElementById('branch-pill-text');
    if (pill2) pill2.textContent = capitalize(user.branch);
    var sub2 = document.getElementById('dept-sub');
    if (sub2) sub2.textContent = capitalize(user.role) + ' - ' + capitalize(user.branch);
    var titleEl = document.getElementById('dept-title');
    if (titleEl) titleEl.textContent = capitalize(user.role) + ' Department';
    setupDeptTiles(user);

    const backBtn = document.getElementById('back-btn');
    if (backBtn) {
      backBtn.addEventListener('click', function () {
        const panel = document.getElementById('content-panel');
        if (panel && !panel.classList.contains('hidden')) {
          panel.classList.add('hidden');
          const mainDash = document.getElementById('main-dashboard');
          if (mainDash) mainDash.classList.remove('hidden');
          backBtn.classList.add('hidden');
        }
      });
    }
  }

}

// ─── Admin Tiles Setup ──────────────────────────────────────────────────────
async function setupAdminTiles(user) {
  // Load existing power grants
  try {
    const res = await apiFetch('/users/power-grants');
    if (res && res.ok) existingGrants = await res.json();
  } catch (e) { }

  document.querySelectorAll('.dept-tile').forEach(tile => {
    const dept = tile.dataset.dept;

    tile.addEventListener('click', (e) => {
      // Don't trigger tile click when power button clicked
      if (e.target.closest('.tile-power-btn')) return;
      openDeptPanel(dept, 'admin', user);
    });
  });

  // Power buttons
  document.querySelectorAll('.tile-power-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const dept = btn.dataset.dept;
      openPowerModal(dept, user);
    });
  });

  setupPowerModal(user);
}

// ─── Manager Tiles Setup ────────────────────────────────────────────────────
async function setupManagerTiles(user) {
  // Fetch power grants for this manager's branch
  let managerGrants = [];
  try {
    const res = await apiFetch('/users/power-grants');
    if (res && res.ok) {
      const all = await res.json();
      // Power grants for 'manager' role in this branch
      managerGrants = all
        .filter(g => g.granted_to_role === 'manager' && (g.granted_branch || '').toLowerCase() === (user.branch || '').toLowerCase())
        .map(g => g.granted_dept);
    }
  } catch (e) { }

  const usersTile = document.getElementById('tile-users');
  const hasUsersGrant = managerGrants.includes('users');

  document.querySelectorAll('.dept-tile').forEach(tile => {
    const dept = tile.dataset.dept;
    if (dept === 'users') {
      if (hasUsersGrant) {
        // Unlock the tile
        tile.classList.remove('locked');
        const lockIcon = tile.querySelector('.tile-lock-icon');
        if (lockIcon) lockIcon.remove();
        tile.addEventListener('click', () => openDeptPanel(dept, 'manager', user));
      }
      // If no grant, tile stays locked (no click handler)
    } else {
      tile.addEventListener('click', () => {
        openDeptPanel(dept, 'manager', user);
      });
    }
  });
}

// ─── Department Tiles Setup ─────────────────────────────────────────────────
function setupDeptTiles(user) {
  const ownRole = user.role;
  const granted = user.powerGrants || [];
  const accessible = [ownRole, ...granted];

  document.querySelectorAll('.dept-tile').forEach(tile => {
    const dept = tile.dataset.dept;
    let isAccessible = accessible.includes(dept) || dept === 'overview';

    // Purchase department has default access to Balance and Scrap
    if (ownRole === 'purchase' && (dept === 'balance' || dept === 'scrap')) {
      isAccessible = true;
    }

    if (isAccessible) {
      tile.classList.remove('locked');
      tile.addEventListener('click', () => openDeptPanel(dept, 'department', user));
    } else {
      tile.classList.add('locked');
    }
  });
}

// ─── Open Department Panel ──────────────────────────────────────────────────
function openDeptPanel(dept, role, user) {
  activePanelDept = dept;
  const mainDash = document.getElementById('main-dashboard');
  const panel = document.getElementById('content-panel');
  const titleEl = document.getElementById('panel-title');
  const contentEl = document.getElementById('panel-content');

  if (!panel || !contentEl) return;

  const info = DEPT_LABELS[dept] || { label: capitalize(dept), icon: '📁' };
  if (titleEl) titleEl.textContent = `${info.icon} ${info.label}`;

  mainDash && mainDash.classList.add('hidden');
  panel.classList.remove('hidden');

  const backBtn = document.getElementById('back-btn');
  if (backBtn) backBtn.classList.remove('hidden');

  // Route to department-specific content
  switch (dept) {
    case 'planning':
      renderPlanningPanel(contentEl, role, user);
      break;
    case 'purchase':
      renderPurchasePanel(contentEl, role, user);
      break;
    case 'users':
      renderUsersPanel(contentEl, role, user);
      break;
    case 'overview':
      renderOverviewPanel(contentEl, role, user);
      break;
    default:
      renderComingSoon(contentEl, info);
  }
}

// ─── Planning Panel (inside dashboard) ─────────────────────────────────────────────
function renderPlanningPanel(container, role, user) {
  // STRICT BRANCH ISOLATION: always use currentBranch (admin-selected branch), never user.branch
  const br = (currentBranch || (user && user.branch) || 'maalur').toLowerCase();
  window.location.href = `/planning.html?branch=${br}`;
}

// ─── Purchase Panel (inside dashboard) ─────────────────────────────────────────────
function renderPurchasePanel(container, role, user) {
  // STRICT BRANCH ISOLATION: always use currentBranch (admin-selected branch), never user.branch
  const br = (currentBranch || (user && user.branch) || 'maalur').toLowerCase();
  window.location.href = `/purchase.html?branch=${br}`;
}

// ─── Users Panel ──────────────────────────────────────────────────
async function renderUsersPanel(container, role, user) {
  const isAdmin = role === 'admin';
  // STRICT BRANCH ISOLATION: admin always sees only the currently-selected branch
  const scopedBranch = currentBranch ? currentBranch.toLowerCase() : null;

  container.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:10px;">
      <div>
        <h3 style="margin-bottom:3px;">System Users</h3>
        <p style="font-size:0.8rem;">${isAdmin ? capitalize(scopedBranch || '') + ' Branch Users' : capitalize(user.branch) + ' Branch Users'}</p>
      </div>
      ${isAdmin ? `<button class="btn btn-primary btn-sm" id="add-user-btn">
        <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
        Add User
      </button>` : ''}
    </div>
    <div class="users-panel" id="users-panel">
      <div style="text-align:center; padding:24px;"><span class="spinner"></span></div>
    </div>
  `;

  try {
    const res = await apiFetch('/users');
    if (!res || !res.ok) {
      const errData = await res.json().catch(() => ({}));
      if (!isAdmin) {
        document.getElementById('users-panel').innerHTML = `
          <div style="text-align:center; padding:48px 24px;">
            <div style="font-size:3rem; margin-bottom:12px;">🔒</div>
            <h4 style="margin-bottom:6px; color:var(--text-primary);">Access Restricted</h4>
            <p style="font-size:0.82rem; color:var(--text-muted);">${errData.error || 'Users view has not been permitted by Admin for your branch.'}</p>
          </div>
        `;
        return;
      }
      throw new Error(errData.error || 'Failed to load users');
    }
    const data = await res.json();

    const renderTable = (users, label) => {
      if (!users || users.length === 0) return `<p style="font-size:0.82rem; color:var(--text-muted); padding:8px 0;">No users in this branch.</p>`;
      return `
        <div class="users-branch-section" style="margin-bottom:20px;">
          <h3>${label}</h3>
          <div class="card">
            <table class="users-table">
              <thead><tr><th>Full Name</th><th>Username</th><th>Role</th><th>Joined</th>${isAdmin ? '<th>Actions</th>' : ''}</tr></thead>
              <tbody>
                ${users.map(u => `
                  <tr>
                    <td><strong>${u.full_name}</strong></td>
                    <td style="font-family:monospace; font-size:0.8rem; color:var(--text-second);">${u.username}</td>
                    <td><span class="role-badge">${capitalize(u.role)}</span></td>
                    <td style="color:var(--text-muted); font-size:0.78rem;">${formatDate(u.created_at)}</td>
                    ${isAdmin ? `<td>
                      <button class="btn btn-danger btn-sm" onclick="deleteUser(${u.id})" style="font-size:0.72rem;">Remove</button>
                    </td>` : ''}
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    };

    if (isAdmin) {
      // STRICT BRANCH ISOLATION: show only the currently selected branch users
      const branchKey = scopedBranch || 'maalur';
      const branchLabel = branchKey === 'maalur' ? '🏗️ Maalur Branch Users' : '🏗️️ Haryana Branch Users';
      document.getElementById('users-panel').innerHTML = renderTable(data[branchKey] || [], branchLabel);
    } else {
      // Manager: only their branch
      const branchUsers = data[user.branch] || [];
      document.getElementById('users-panel').innerHTML =
        renderTable(branchUsers, '👥 ' + capitalize(user.branch) + ' Branch Users');
    }

    const addBtn = document.getElementById('add-user-btn');
    if (addBtn) addBtn.addEventListener('click', () => showAddUserModal());
  } catch (err) {
    document.getElementById('users-panel').innerHTML = `<p style="color:var(--danger);">Error: ${err.message}</p>`;
  }
}

async function deleteUser(id) {
  if (!confirm('Remove this user? This cannot be undone.')) return;
  const res = await apiFetch(`/users/${id}`, { method: 'DELETE' });
  if (res && res.ok) {
    showToast('User removed successfully', 'success');
    // Re-render
    const user = getUser();
    renderUsersPanel(document.getElementById('panel-content'), 'admin', user);
  }
}

function showAddUserModal() {
  const existing = document.getElementById('add-user-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.id = 'add-user-modal';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3>Add New User</h3>
        <button class="modal-close" onclick="document.getElementById('add-user-modal').remove()">✕</button>
      </div>
      <div class="modal-body" style="display:flex; flex-direction:column; gap:14px;">
        <div class="form-group">
          <label class="form-label">Full Name</label>
          <input class="form-input" id="nu-name" placeholder="e.g. John Doe">
        </div>
        <div class="form-group">
          <label class="form-label">Username</label>
          <input class="form-input" id="nu-username" placeholder="e.g. plan_maalur2" spellcheck="false">
        </div>
        <div class="form-group">
          <label class="form-label">Password</label>
          <input class="form-input" type="password" id="nu-password" placeholder="Set a password">
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
          <div class="form-group">
            <label class="form-label">Role</label>
            <select class="form-select" id="nu-role">
              <option value="planning">Planning</option>
              <option value="purchase">Purchase</option>
              <option value="consumption">Consumption</option>
              <option value="accounts">Accounts</option>
              <option value="dispatch">Dispatch</option>
              <option value="security">Security</option>
              <option value="manager">Manager</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Branch</label>
            <select class="form-select" id="nu-branch">
              <option value="maalur">Maalur</option>
              <option value="haryana">Haryana</option>
            </select>
          </div>
        </div>
        <div id="nu-error" class="login-error hidden"><span id="nu-error-msg"></span></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="document.getElementById('add-user-modal').remove()">Cancel</button>
        <button class="btn btn-primary" id="nu-save-btn">Create User</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('nu-save-btn').addEventListener('click', async () => {
    const full_name = document.getElementById('nu-name').value.trim();
    const username = document.getElementById('nu-username').value.trim();
    const password = document.getElementById('nu-password').value;
    const role = document.getElementById('nu-role').value;
    const branch = document.getElementById('nu-branch').value;
    const errEl = document.getElementById('nu-error');
    const errMsg = document.getElementById('nu-error-msg');

    if (!full_name || !username || !password) {
      errMsg.textContent = 'All fields are required.';
      errEl.classList.remove('hidden');
      return;
    }

    const res = await apiFetch('/users', {
      method: 'POST',
      body: JSON.stringify({ full_name, username, password, role, branch }),
    });
    const data = await res.json();
    if (!res.ok) {
      errMsg.textContent = data.error;
      errEl.classList.remove('hidden');
      return;
    }
    showToast('User created successfully', 'success');
    document.getElementById('add-user-modal').remove();
    const user = getUser();
    renderUsersPanel(document.getElementById('panel-content'), 'admin', user);
  });
}

// ─── Planning Panel (inside dashboard) ─────────────────────────────────────────────
function renderPlanningPanel(container, role, user) {
  // STRICT BRANCH ISOLATION: always use currentBranch (admin-selected branch), never user.branch
  const br = (currentBranch || (user && user.branch) || 'maalur').toLowerCase();
  window.location.href = `/planning.html?branch=${br}`;
}

// ─── Overview Panel ─────────────────────────────────────────────────────────
async function renderOverviewPanel(container, role, user) {
  // STRICT BRANCH ISOLATION: scope to current active branch
  const overviewBranch = (currentBranch || sessionStorage.getItem('active_branch') || (user && user.branch) || 'maalur').toLowerCase();

  container.innerHTML = `
    <div style="margin-bottom:24px;">
      <h3 style="margin-bottom:3px;">Summary &amp; Reports</h3>
      <p style="font-size:0.8rem;">Branch: <strong>${capitalize(overviewBranch)}</strong></p>
    </div>

    <!-- Date Range Export -->
    <div class="card" style="margin-bottom:24px;">
      <div class="card-header"><h4>📥 Export Planning Data — ${capitalize(overviewBranch)} Branch</h4></div>
      <div class="card-body">
        <div class="download-controls">
          <div class="form-group">
            <label class="form-label">From Date</label>
            <input type="date" id="export-from" class="form-input" style="width:auto;">
          </div>
          <div class="form-group">
            <label class="form-label">To Date</label>
            <input type="date" id="export-to" class="form-input" style="width:auto;">
          </div>
          <div class="form-group" style="justify-content:flex-end; padding-top:18px;">
            <button class="btn btn-primary" id="export-xlsx-btn">
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
              Download Excel
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Stats -->
    <div class="overview-stats" id="overview-stats">
      <div style="text-align:center; padding:24px; grid-column: 1/-1;"><span class="spinner"></span></div>
    </div>
  `;

  // Export button — always scoped to overviewBranch (no cross-branch leakage)
  document.getElementById('export-xlsx-btn').addEventListener('click', () => {
    const from = document.getElementById('export-from').value;
    const to = document.getElementById('export-to').value;
    const branch = overviewBranch;

    apiFetch(`/planning/export?${from ? 'from=' + from + '&' : ''}${to ? 'to=' + to + '&' : ''}${branch ? 'branch=' + branch : ''}`)
      .then(r => r.blob())
      .then(blob => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `planning_report_${overviewBranch}_${new Date().toISOString().split('T')[0]}.xlsx`;
        link.click();
        URL.revokeObjectURL(link.href);
        showToast('Export downloaded', 'success');
      });
  });

  // Load stats — STRICTLY scoped to overviewBranch
  try {
    const res = await apiFetch(`/planning/projects?branch=${overviewBranch}`);
    if (!res || !res.ok) return;
    const projects = await res.json();

    const pending = projects.filter(p => p.status === 'pending').length;
    const approved = projects.filter(p => p.status === 'approved').length;
    const rejected = projects.filter(p => p.status === 'rejected').length;
    const revised = projects.filter(p => p.status === 'revised').length;

    document.getElementById('overview-stats').innerHTML = `
      <div class="stat-card"><div class="stat-card-label">Total Projects</div><div class="stat-card-value">${projects.length}</div></div>
      <div class="stat-card"><div class="stat-card-label">Pending</div><div class="stat-card-value" style="color:var(--warning);">${pending}</div></div>
      <div class="stat-card"><div class="stat-card-label">Approved</div><div class="stat-card-value" style="color:var(--success);">${approved}</div></div>
      <div class="stat-card"><div class="stat-card-label">Rejected</div><div class="stat-card-value" style="color:var(--danger);">${rejected}</div></div>
      <div class="stat-card"><div class="stat-card-label">Revision Pending</div><div class="stat-card-value" style="color:var(--revise);">${revised}</div></div>
    `;
  } catch (e) { }
}


// ─── Coming Soon Panel ──────────────────────────────────────────────────────
function renderComingSoon(container, info) {
  container.innerHTML = `
    <div class="empty-state" style="padding:64px 24px;">
      <div class="empty-state-icon" style="font-size:3rem;">${info.icon}</div>
      <h3 style="margin-bottom:6px; color:var(--text-primary);">${info.label} Department</h3>
      <p>${info.desc}</p>
      <p style="margin-top:8px; font-size:0.78rem; color:var(--text-muted);">This module will be available in the next phase.</p>
    </div>
  `;
}

// ─── Power Modal ─────────────────────────────────────────────────────────────
let isPowerModalSetup = false;

function setupPowerModal(user) {
  const modal = document.getElementById('power-modal');
  const closeBtn = document.getElementById('power-modal-close');
  const cancelBtn = document.getElementById('power-modal-cancel');
  const saveBtn = document.getElementById('power-modal-save');

  if (!modal || isPowerModalSetup) return;
  isPowerModalSetup = true;

  [closeBtn, cancelBtn].forEach(b => b && b.addEventListener('click', () => modal.classList.add('hidden')));
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.add('hidden'); });

  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      saveBtn.disabled = true;
      const checkboxes = document.querySelectorAll('#power-dept-list input[type="checkbox"]');
      const requests = [];

      for (const cb of checkboxes) {
        const checkedDept = cb.dataset.dept;
        let roleToGrant, deptToAccess;

        if (powerModalTargetDept === 'users') {
          roleToGrant = 'manager';
          deptToAccess = 'users';
        } else {
          roleToGrant = powerModalTargetDept;
          deptToAccess = checkedDept;
        }

        const existing = existingGrants.find(g =>
          (g.granted_to_role || '').toLowerCase() === (roleToGrant || '').toLowerCase() &&
          (g.granted_branch || '').toLowerCase() === (currentBranch || '').toLowerCase() &&
          (g.granted_dept || '').toLowerCase() === (deptToAccess || '').toLowerCase()
        );

        if (cb.checked) {
          if (!existing) {
            requests.push(apiFetch('/users/power-grants', {
              method: 'POST',
              body: JSON.stringify({
                granted_to_role: roleToGrant,
                granted_branch: currentBranch,
                granted_dept: deptToAccess,
              }),
            }));
          }
        } else {
          if (existing) {
            requests.push(apiFetch(`/users/power-grants/${existing.id}`, { method: 'DELETE' }));
          }
        }
      }

      try {
        await Promise.all(requests);

        // Refresh grants
        const res = await apiFetch('/users/power-grants');
        if (res && res.ok) existingGrants = await res.json();

        showToast('Power settings saved', 'success');
        modal.classList.add('hidden');
      } catch (err) {
        showToast('Failed to save power settings', 'error');
      } finally {
        saveBtn.disabled = false;
      }
    });
  }
}

async function openPowerModal(targetDept, user) {
  powerModalTargetDept = targetDept;
  const modal = document.getElementById('power-modal');
  const titleEl = document.getElementById('power-modal-title');
  const descEl = document.getElementById('power-modal-desc');

  if (!modal) return;

  // Always load latest power grants when opening modal
  try {
    const res = await apiFetch('/users/power-grants');
    if (res && res.ok) existingGrants = await res.json();
  } catch (e) { }

  const info = DEPT_LABELS[targetDept] || { label: capitalize(targetDept), icon: '⚡' };
  if (titleEl) titleEl.textContent = `${info.icon} Power Settings — ${info.label}`;

  if (descEl) {
    if (targetDept === 'users') {
      descEl.innerHTML = `Select which roles can access <strong id="power-target-dept">${info.label}</strong> department:`;
    } else {
      descEl.innerHTML = `Select which departments <strong id="power-target-dept">${info.label}</strong> department can access:`;
    }
  }

  renderPowerModalList(targetDept);
  modal.classList.remove('hidden');
}

function renderPowerModalList(targetDept) {
  const listEl = document.getElementById('power-dept-list');
  if (!listEl) return;

  if (targetDept === 'users') {
    const existing = existingGrants.find(g =>
      (g.granted_to_role || '').toLowerCase() === 'manager' &&
      (g.granted_branch || '').toLowerCase() === (currentBranch || '').toLowerCase() &&
      (g.granted_dept || '').toLowerCase() === 'users'
    );
    const hasGrant = !!existing;
    listEl.innerHTML = `
      <div class="power-dept-item ${hasGrant ? 'active-grant' : ''}">
        <label>
          <input type="checkbox" data-dept="manager" ${hasGrant ? 'checked' : ''}>
          👔 ${capitalize(currentBranch || '')} Branch Manager
        </label>
        <div style="display:flex; align-items:center; gap:8px;">
          ${hasGrant ? `
            <span class="badge-grant-active">Active</span>
            <button class="btn-revert-dept-power" data-dept="manager" data-grant-id="${existing.id}" title="Revert Manager Access">🔄 Revert</button>
          ` : `
            <span style="font-size:0.72rem; color:var(--text-muted);">View-only</span>
          `}
        </div>
      </div>
    `;
  } else {
    const otherDepts = GRANTABLE_DEPTS.filter(d => d !== targetDept);
    listEl.innerHTML = otherDepts.map(dept => {
      const existing = existingGrants.find(g =>
        (g.granted_to_role || '').toLowerCase() === (targetDept || '').toLowerCase() &&
        (g.granted_branch || '').toLowerCase() === (currentBranch || '').toLowerCase() &&
        (g.granted_dept || '').toLowerCase() === (dept || '').toLowerCase()
      );
      const hasGrant = !!existing;
      const deptInfo = DEPT_LABELS[dept] || { label: capitalize(dept), icon: '📁' };
      return `
        <div class="power-dept-item ${hasGrant ? 'active-grant' : ''}">
          <label>
            <input type="checkbox" data-dept="${dept}" ${hasGrant ? 'checked' : ''}>
            ${deptInfo.icon} ${deptInfo.label}
          </label>
          <div style="display:flex; align-items:center; gap:8px;">
            ${hasGrant ? `
              <span class="badge-grant-active">Granted</span>
              <button class="btn-revert-dept-power" data-dept="${dept}" data-grant-id="${existing.id}" title="Revert power for ${deptInfo.label}">🔄 Revert</button>
            ` : `
              <span style="font-size:0.72rem; color:var(--text-muted);">${capitalize(currentBranch || '')}</span>
            `}
          </div>
        </div>
      `;
    }).join('');
  }

  // Attach Revert button listeners
  listEl.querySelectorAll('.btn-revert-dept-power').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const grantId = btn.dataset.grantId;
      const dept = btn.dataset.dept;
      const deptName = (DEPT_LABELS[dept] || {}).label || capitalize(dept);

      btn.disabled = true;
      btn.textContent = 'Reverting...';

      try {
        const res = await apiFetch(`/users/power-grants/${grantId}`, { method: 'DELETE' });
        if (res && res.ok) {
          showToast(`Power access for ${deptName} reverted`, 'success');
          // Refresh existingGrants and re-render list
          const fetchRes = await apiFetch('/users/power-grants');
          if (fetchRes && fetchRes.ok) existingGrants = await fetchRes.json();
          renderPowerModalList(targetDept);
        } else {
          showToast('Failed to revert power', 'error');
          btn.disabled = false;
          btn.textContent = '🔄 Revert';
        }
      } catch (err) {
        showToast('Error reverting power', 'error');
        btn.disabled = false;
        btn.textContent = '🔄 Revert';
      }
    });
  });
}
