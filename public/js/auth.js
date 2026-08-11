/**
 * auth.js — Shared authentication utilities for all pages
 */
const API = '/api';

/** Get stored auth token */
function getToken() {
  return sessionStorage.getItem('auth_token');
}

/** Get current user object */
function getUser() {
  const raw = sessionStorage.getItem('auth_user');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}
function getAuthUser() {
  return getUser();
}

/** Authenticated fetch helper */
async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  // If sending FormData, remove Content-Type so browser sets it with boundary
  if (options.body instanceof FormData) {
    delete headers['Content-Type'];
  }

  const res = await fetch(`${API}${path}`, { ...options, headers });
  if (res.status === 401) {
    // Token expired — redirect to portal
    sessionStorage.removeItem('auth_token');
    sessionStorage.removeItem('auth_user');
    window.location.href = '/portal.html';
    return;
  }
  return res;
}

/** Guard: ensure user is logged in and has the correct role */
function requireAuth(allowedRoles) {
  const token = getToken();
  const user = getUser();
  if (!token || !user) {
    window.location.href = '/portal.html';
    return null;
  }
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    window.location.href = '/portal.html';
    return null;
  }
  return user;
}

/** Toast notification system */
function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icons = {
    success: '✅',
    error: '❌',
    info: 'ℹ️',
  };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(40px)';
    toast.style.transition = 'all 0.25s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/** Format date string */
function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Format datetime string */
function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** Capitalise first letter */
function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/** Setup logout button */
function setupLogout() {
  const btn = document.getElementById('logout-btn');
  if (btn) {
    btn.addEventListener('click', () => {
      sessionStorage.removeItem('auth_token');
      sessionStorage.removeItem('auth_user');
      window.location.href = '/portal.html';
    });
  }
}

/** Populate user info in topbar */
function populateTopbar(user) {
  const nameEl = document.getElementById('user-name');
  const avatarEl = document.getElementById('user-avatar');
  if (nameEl) nameEl.textContent = user.full_name;
  if (avatarEl) avatarEl.textContent = user.full_name.charAt(0).toUpperCase();
}

/** Helper to format validity display text */
function formatValidityLabel(validity) {
  const map = {
    '1day': '1 Day',
    '3day': '3 Days',
    '5day': '5 Days',
    '1week': '1 Week',
    '1month': '1 Month',
    '1year': '1 Year'
  };
  return map[validity] || validity || '1 Day';
}

/** Inject Send Notification modal dynamically into body if missing */
function injectSendNotifModal() {
  if (document.getElementById('send-notif-modal')) return;

  const modalHtml = `
    <div class="modal-backdrop hidden" id="send-notif-modal" style="z-index: 1000;">
      <div class="modal" style="max-width: 480px; width: 90%;">
        <div class="modal-header">
          <h3 style="font-size:1rem; font-weight:600; display:flex; align-items:center; gap:8px; margin:0;">
            <span>📤</span> Send Notification
          </h3>
          <button class="modal-close" id="send-notif-close">✕</button>
        </div>
        <form id="send-notif-form">
          <div class="modal-body" style="display:flex; flex-direction:column; gap:14px; padding:16px 20px;">
            <div class="form-group">
              <label class="form-label" style="font-weight:600; font-size:0.82rem; margin-bottom:6px; display:block; color:var(--text-primary);">Recipient User</label>
              <select id="send-notif-recipient" class="form-control" style="width:100%; padding:8px 12px; border-radius:6px; border:1px solid var(--border); font-size:0.85rem;" required>
                <option value="all">ALL</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" style="font-weight:600; font-size:0.82rem; margin-bottom:6px; display:block; color:var(--text-primary);">Notification Message</label>
              <textarea id="send-notif-message" class="form-control" rows="3" style="width:100%; padding:8px 12px; border-radius:6px; border:1px solid var(--border); font-size:0.85rem; resize:vertical;" placeholder="Enter message to send..." required></textarea>
            </div>
            <div class="form-group">
              <label class="form-label" style="font-weight:600; font-size:0.82rem; margin-bottom:6px; display:block; color:var(--text-primary);">Notification Validity</label>
              <select id="send-notif-validity" class="form-control" style="width:100%; padding:8px 12px; border-radius:6px; border:1px solid var(--border); font-size:0.85rem;" required>
                <option value="1day">1 Day (24 Hours)</option>
                <option value="3day">3 Days</option>
                <option value="5day">5 Days</option>
                <option value="1week">1 Week</option>
                <option value="1month">1 Month</option>
                <option value="1year">1 Year</option>
              </select>
            </div>
          </div>
          <div class="modal-footer" style="padding:12px 20px; border-top:1px solid var(--border-light); display:flex; justify-content:flex-end; gap:8px; background:var(--bg-surface,#f9fafb);">
            <button type="button" class="btn btn-outline btn-sm" id="send-notif-cancel">Cancel</button>
            <button type="submit" class="btn btn-primary btn-sm" id="send-notif-submit">Send Notification</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

/** Load and display notifications */
async function loadNotifications() {
  try {
    const res = await apiFetch('/users/notifications');
    if (!res || !res.ok) return;
    const notifs = await res.json();

    const listEl = document.getElementById('notif-list');
    const badgeEl = document.getElementById('notif-badge');
    if (!listEl || !badgeEl) return;

    const unread = notifs.filter(n => !n.is_read);
    if (unread.length > 0) {
      badgeEl.textContent = unread.length > 9 ? '9+' : unread.length;
      badgeEl.classList.remove('hidden');
    } else {
      badgeEl.classList.add('hidden');
    }

    if (notifs.length === 0) {
      listEl.innerHTML = `<div class="empty-state" style="padding:24px 16px;"><div class="empty-state-icon" style="font-size:1.5rem;">🔔</div><p>No notifications</p></div>`;
      return;
    }

    listEl.innerHTML = notifs.map(n => {
      const isCustom = n.type === 'custom' || n.sender_name;
      const icon = isCustom ? '📩' : (n.type === 'review' ? '📋' : '🔔');
      const iconClass = isCustom ? 'notif-icon-custom' : (n.type === 'review' ? 'notif-icon-review' : 'notif-icon-planning');

      const senderText = n.sender_name ? `<span class="notif-item-sender">From: ${n.sender_name}</span>` : '';
      const validityBadge = n.validity ? `<span class="notif-validity-tag">⏱️ ${formatValidityLabel(n.validity)}</span>` : '';

      return `
        <div class="notif-item ${n.is_read ? '' : 'unread'}" data-id="${n.id}">
          <div class="notif-item-icon ${iconClass}">
            ${icon}
          </div>
          <div class="notif-item-body">
            <div class="notif-item-msg">${n.message}</div>
            <div class="notif-item-time">
              <span>${senderText ? senderText + ' • ' : ''}${formatDateTime(n.created_at)}</span>
              ${validityBadge}
            </div>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('Error loading notifications:', err);
  }
}

/** Setup notification bell toggle */
function setupNotifications() {
  const btn = document.getElementById('notif-btn');
  const panel = document.getElementById('notif-panel');
  const markAllBtn = document.getElementById('mark-all-read');

  if (!btn || !panel) return;

  // Add footer button inside notif-panel if not already present
  if (!panel.querySelector('.notif-panel-footer')) {
    const footerEl = document.createElement('div');
    footerEl.className = 'notif-panel-footer';
    footerEl.innerHTML = `
      <button class="btn btn-primary btn-sm" id="open-send-notif-btn">
        <span>📤</span> Send Notification
      </button>
    `;
    panel.appendChild(footerEl);
  }

  // Inject modal into DOM if not present
  injectSendNotifModal();

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    panel.classList.toggle('hidden');
    if (!panel.classList.contains('hidden')) loadNotifications();
  });

  document.addEventListener('click', () => panel.classList.add('hidden'));
  panel.addEventListener('click', e => e.stopPropagation());

  if (markAllBtn) {
    markAllBtn.addEventListener('click', async () => {
      await apiFetch('/users/notifications/read-all', { method: 'PATCH' });
      loadNotifications();
    });
  }

  // Setup Send Notification button handler
  const openSendBtn = document.getElementById('open-send-notif-btn');
  const modal = document.getElementById('send-notif-modal');
  const closeBtn = document.getElementById('send-notif-close');
  const cancelBtn = document.getElementById('send-notif-cancel');
  const form = document.getElementById('send-notif-form');
  const recipientSelect = document.getElementById('send-notif-recipient');

/** Load recipients into dropdown based on active branch / user role */
async function populateRecipientDropdown(recipientSelect) {
  if (!recipientSelect) return;
  try {
    const res = await apiFetch('/users/recipients');
    if (!res || !res.ok) return;
    const users = await res.json();
    const me = getUser();

    // Active branch context (window.currentBranch or user's branch)
    const activeBranch = (window.currentBranch ? window.currentBranch : (me && me.branch ? me.branch : '')).toLowerCase();

    // Filter users based on branch rules:
    // - Admin in Maalur / Maalur User: Maalur users + Admin / Owner
    // - Admin in Haryana / Haryana User: Haryana users + Admin / Owner
    // - Admin in all/global mode: All users
    const filteredUsers = users.filter(u => {
      if (me && String(u.id) === String(me.id)) return false; // exclude self from individual list
      if (u.role === 'admin') return true; // Admin / Owner is always included
      if (activeBranch) {
        return (u.branch || '').toLowerCase() === activeBranch;
      }
      return true;
    });

    // Sort Admin first, then alphabetically by full_name
    filteredUsers.sort((a, b) => {
      if (a.role === 'admin') return -1;
      if (b.role === 'admin') return 1;
      return a.full_name.localeCompare(b.full_name);
    });

    const userOptions = filteredUsers.map(u => `
      <option value="${u.id}">${u.full_name}</option>
    `).join('');

    recipientSelect.innerHTML = `<option value="all">ALL</option>` + userOptions;
  } catch (err) {
    console.error('Error loading recipient options:', err);
  }
}

  if (openSendBtn && modal) {
    populateRecipientDropdown(recipientSelect);

    openSendBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      panel.classList.add('hidden'); // hide notification dropdown
      await populateRecipientDropdown(recipientSelect);
      modal.classList.remove('hidden');
    });

    const closeModal = () => modal.classList.add('hidden');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const recipient = recipientSelect.value;
        const message = document.getElementById('send-notif-message').value.trim();
        const validity = document.getElementById('send-notif-validity').value;
        const me = getAuthUser();
        const activeBranch = (window.currentBranch ? window.currentBranch : (me && me.branch ? me.branch : '')).toLowerCase();

        if (!message) {
          showToast('Please enter a notification message', 'error');
          return;
        }

        const submitBtn = document.getElementById('send-notif-submit');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending...';

        try {
          const res = await apiFetch('/users/send-notification', {
            method: 'POST',
            body: JSON.stringify({ recipient, message, validity, branch: activeBranch })
          });

          if (res && res.ok) {
            showToast('Notification sent successfully!', 'success');
            form.reset();
            closeModal();
            loadNotifications();
          } else {
            const err = await res.json();
            showToast(err.error || 'Failed to send notification', 'error');
          }
        } catch (err) {
          showToast('Error sending notification', 'error');
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Send Notification';
        }
      });
    }
  }

  // Auto-load on init
  loadNotifications();
  // Refresh every 30 seconds
  setInterval(loadNotifications, 30000);

  // Setup authority feature (admin: AUTHORITY button; manager: REVERT POWER button)
  setupAuthorityFeature();
}

/* ─── Admin Authority Feature ────────────────────────────────────────────── */
async function setupAuthorityFeature() {
  const me = getUser();
  if (!me) return;

  // ── ADMIN SIDE: AUTHORITY button + modal ──────────────────────────────────
  if (me.role === 'admin') {
    const authorityBtn   = document.getElementById('authority-btn');
    const authorityModal = document.getElementById('authority-modal');
    const authorityClose = document.getElementById('authority-close');
    const activeBanner   = document.getElementById('authority-active-banner');
    const activeText     = document.getElementById('authority-active-text');
    const activeDot      = document.getElementById('authority-active-dot');
    const revokeBtn      = document.getElementById('authority-revoke-btn');
    const managerList    = document.getElementById('authority-manager-list');

    if (!authorityBtn || !authorityModal) return;

    /** Refresh authority modal UI */
    async function refreshAuthorityModal() {
      const res = await apiFetch('/users/authority');
      const { authority } = await res.json();

      // Load all managers
      const usersRes = await apiFetch('/users');
      const usersData = await usersRes.json();
      const managers = [
        ...(usersData.maalur || []),
        ...(usersData.haryana || []),
      ].filter(u => u.role === 'manager');

      // Update active banner
      if (authority) {
        activeBanner.classList.remove('hidden');
        activeText.textContent = `${authority.manager_name} (${authority.branch}) holds full Admin power since ${new Date(authority.granted_at).toLocaleString()}`;
        activeDot.classList.remove('hidden');
      } else {
        activeBanner.classList.add('hidden');
        activeDot.classList.add('hidden');
      }

      // Render manager cards
      managerList.innerHTML = managers.map(mgr => {
        const isHolder = authority && authority.manager_id == mgr.id;
        const branchLabel = mgr.branch ? mgr.branch.charAt(0).toUpperCase() + mgr.branch.slice(1) : '—';
        const initial = (mgr.full_name || mgr.username || 'M')[0].toUpperCase();
        return `
          <div class="authority-manager-card ${isHolder ? 'active-holder' : ''}">
            <div class="authority-manager-avatar">${initial}</div>
            <div style="flex:1;">
              <div style="font-size:0.85rem; font-weight:600; color:var(--text-primary);">${mgr.full_name || mgr.username}</div>
              <div style="font-size:0.75rem; color:var(--text-second);">Manager — ${branchLabel} Branch</div>
              ${isHolder ? '<div style="font-size:0.72rem; color:#92400e; font-weight:600; margin-top:2px;">⚡ Currently holding Admin Authority</div>' : ''}
            </div>
            <button class="authority-grant-btn" data-mgr-id="${mgr.id}" data-mgr-name="${mgr.full_name || mgr.username}" ${isHolder ? 'disabled' : ''}>
              ${isHolder ? '✓ Active' : 'Grant Power'}
            </button>
          </div>
        `;
      }).join('');

      // Attach grant buttons
      managerList.querySelectorAll('.authority-grant-btn:not([disabled])').forEach(btn => {
        btn.addEventListener('click', async () => {
          const mgrId   = btn.dataset.mgrId;
          const mgrName = btn.dataset.mgrName;
          if (!confirm(`Grant FULL ADMIN AUTHORITY to ${mgrName}? They will have complete admin powers.`)) return;
          btn.disabled = true;
          btn.textContent = 'Granting…';
          try {
            const r = await apiFetch('/users/authority/grant', { method: 'POST', body: JSON.stringify({ manager_id: mgrId }) });
            const d = await r.json();
            if (d.success) {
              showToast(`✅ Admin authority granted to ${mgrName}`, 'success');
              await refreshAuthorityModal();
            } else {
              showToast(d.error || 'Failed to grant authority', 'danger');
              btn.disabled = false;
              btn.textContent = 'Grant Power';
            }
          } catch { btn.disabled = false; btn.textContent = 'Grant Power'; }
        });
      });
    }

    // Open modal on AUTHORITY button click
    authorityBtn.addEventListener('click', async () => {
      await refreshAuthorityModal();
      authorityModal.classList.remove('hidden');
    });

    // Close modal
    const closeAuthority = () => authorityModal.classList.add('hidden');
    if (authorityClose) authorityClose.addEventListener('click', closeAuthority);
    authorityModal.addEventListener('click', e => { if (e.target === authorityModal) closeAuthority(); });

    // Revoke from modal
    if (revokeBtn) {
      revokeBtn.addEventListener('click', async () => {
        if (!confirm('Revoke admin authority? Power will return to Admin / Owner.')) return;
        const r = await apiFetch('/users/authority/revert', { method: 'POST' });
        const d = await r.json();
        if (d.success) {
          showToast('✅ Admin authority revoked', 'success');
          await refreshAuthorityModal();
        } else {
          showToast(d.error || 'Failed to revoke authority', 'danger');
        }
      });
    }

    // Check on load to set dot state
    try {
      const res = await apiFetch('/users/authority');
      const { authority } = await res.json();
      if (authority) activeDot && activeDot.classList.remove('hidden');
    } catch {}
  }

  // ── MANAGER SIDE: REVERT POWER button ────────────────────────────────────
  if (me.role === 'manager') {
    const revertBtn = document.getElementById('revert-power-btn');
    if (!revertBtn) return;

    // Check if this manager holds authority
    try {
      const res = await apiFetch('/users/authority');
      if (!res.ok) return;
      const { authority } = await res.json();
      if (authority && authority.manager_id == me.id) {
        // Show the REVERT POWER button
        revertBtn.classList.remove('hidden');
        revertBtn.addEventListener('click', async () => {
          if (!confirm('Return Admin Authority back to Admin / Owner?')) return;
          revertBtn.disabled = true;
          try {
            const r = await apiFetch('/users/authority/revert', { method: 'POST' });
            const d = await r.json();
            if (d.success) {
              showToast('✅ Admin authority returned to Admin', 'success');
              revertBtn.classList.add('hidden');
            } else {
              showToast(d.error || 'Failed to revert authority', 'danger');
              revertBtn.disabled = false;
            }
          } catch { revertBtn.disabled = false; }
        });
      }
    } catch {}
  }
}
