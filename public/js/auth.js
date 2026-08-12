/**
 * auth.js — Shared authentication utilities for all pages
 */
const API = '/api';

/** Get stored auth token */
function getToken() {
  return sessionStorage.getItem('auth_token');
}

/** Escape HTML special characters */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
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

/** Refresh current user object from server (/api/auth/me) */
async function refreshUser() {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await apiFetch('/auth/me');
    if (res && res.ok) {
      const freshUser = await res.json();
      sessionStorage.setItem('auth_user', JSON.stringify(freshUser));
      return freshUser;
    }
  } catch (e) {}
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
  if (allowedRoles) {
    const userRole = user.role;
    const powerGrants = user.powerGrants || [];
    const isRoleAllowed = allowedRoles.includes(userRole);
    const isAdminHolder = allowedRoles.includes('admin') && user.hasAdminPower;
    const isPowerGranted = powerGrants.some(g => allowedRoles.includes(g));
    const isPurchaseDefaultUnlocked = userRole === 'purchase' && (allowedRoles.includes('balance') || allowedRoles.includes('scrap'));

    if (!isRoleAllowed && !isAdminHolder && !isPowerGranted && !isPurchaseDefaultUnlocked) {
      window.location.href = '/portal.html';
      return null;
    }
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

/** Helper to check if a notification is unread */
function isNotifUnread(n) {
  if (!n) return false;
  return n.is_read === 0 || n.is_read === '0' || n.is_read === false || n.is_read === null || n.is_read === undefined;
}

/** Helper to format validity display text */
function formatValidityLabel(validity) {
  if (!validity) return '';
  if (typeof validity === 'string' && validity.includes('T')) {
    const expTime = new Date(validity).getTime();
    if (!isNaN(expTime)) {
      const diffMs = expTime - Date.now();
      if (diffMs <= 0) return 'Expired';
      const hours = Math.ceil(diffMs / (1000 * 60 * 60));
      if (hours <= 24) return `${hours} Hours`;
      const days = Math.ceil(hours / 24);
      return `${days} Days`;
    }
    return '1 Day';
  }
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

/** Helper to extract real message text from notification object */
function getNotifMessage(n) {
  if (!n) return 'System Notification';
  const valKeys = ['1day', '3day', '5day', '1week', '1month', '1year'];

  if (n.message && valKeys.includes(String(n.message).toLowerCase()) && n.type && !['custom', 'system', 'review', 'planning'].includes(String(n.type).toLowerCase())) {
    return n.type;
  }
  if (n.message && n.message !== 'undefined') return n.message;
  if (n.type && !['custom', 'system', 'review', 'planning'].includes(n.type)) return n.type;
  if (n.role && !['admin', 'manager', 'planning', 'purchase', 'dispatch', 'accounts'].includes(n.role)) return n.role;
  return 'System Notification';
}

/** Helper to extract validity display text from notification object */
function getNotifValidity(n) {
  if (!n) return '';
  const valKeys = ['1day', '3day', '5day', '1week', '1month', '1year'];
  if (n.validity && valKeys.includes(String(n.validity).toLowerCase())) {
    return formatValidityLabel(n.validity);
  }
  if (n.message && valKeys.includes(String(n.message).toLowerCase())) {
    return formatValidityLabel(n.message);
  }
  if (n.validity) {
    return formatValidityLabel(n.validity);
  }
  return '';
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
              <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
                <label class="form-label" style="font-weight:600; font-size:0.82rem; color:var(--text-primary); margin:0;">Recipients (Select One or Multiple)</label>
                <span id="send-notif-selected-count" style="font-size:0.75rem; color:#6366f1; font-weight:600;">(0 Selected)</span>
              </div>
              <div id="send-notif-user-picker" style="max-height: 170px; overflow-y: auto; border: 1px solid var(--border); border-radius: 8px; padding: 6px 10px; background: #ffffff; display: flex; flex-direction: column; gap: 4px;">
                <div style="font-size:0.8rem; color:var(--text-second); padding:4px;">Loading users…</div>
              </div>
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

let currentNotifTab = 'received';

/** Ensure Received & Sent tabs bar is present in notification panel */
function ensureNotifTabsInPanel() {
  const panel = document.getElementById('notif-panel');
  if (!panel) return;
  if (panel.querySelector('.notif-tabs-bar')) return;

  const header = panel.querySelector('.notif-panel-header');
  const tabsHtml = `
    <div class="notif-tabs-bar">
      <button type="button" class="notif-tab-btn ${currentNotifTab === 'received' ? 'active' : ''}" data-tab="received">
        <span>📥</span> Received
      </button>
      <button type="button" class="notif-tab-btn ${currentNotifTab === 'sent' ? 'active' : ''}" data-tab="sent">
        <span>📤</span> Sent
      </button>
    </div>
  `;
  if (header) {
    header.insertAdjacentHTML('afterend', tabsHtml);
  } else {
    panel.insertAdjacentHTML('afterbegin', tabsHtml);
  }

  panel.querySelectorAll('.notif-tab-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const tab = btn.dataset.tab;
      if (!tab) return;
      currentNotifTab = tab;
      panel.querySelectorAll('.notif-tab-btn').forEach(b => {
        if (b.dataset.tab === tab) b.classList.add('active');
        else b.classList.remove('active');
      });
      await loadNotifications();
    });
  });
}

/** Update notification badge icon unconditionally */
async function updateNotifBadge() {
  const badgeEl = document.getElementById('notif-badge');
  if (!badgeEl) return;
  try {
    const res = await apiFetch('/users/notifications?tab=received');
    if (!res || !res.ok) return;
    const receivedNotifs = await res.json();
    const unread = Array.isArray(receivedNotifs) ? receivedNotifs.filter(isNotifUnread) : [];
    if (unread.length > 0) {
      badgeEl.textContent = unread.length > 9 ? '9+' : unread.length;
      badgeEl.classList.remove('hidden');
      badgeEl.style.display = 'flex';
    } else {
      badgeEl.textContent = '0';
      badgeEl.classList.add('hidden');
      badgeEl.style.display = 'none';
    }
  } catch (e) {
    console.error('Error updating badge:', e);
  }
}

/** Load and display notifications */
async function loadNotifications() {
  ensureNotifTabsInPanel();
  try {
    updateNotifBadge();

    const res = await apiFetch(`/users/notifications?tab=${currentNotifTab}`);
    if (!res || !res.ok) return;
    const notifs = await res.json();

    const listEl = document.getElementById('notif-list');
    if (!listEl) return;

    if (!Array.isArray(notifs) || notifs.length === 0) {
      const emptyMsg = currentNotifTab === 'sent' ? 'No sent notifications' : 'No received notifications';
      listEl.innerHTML = `<div class="empty-state" style="padding:24px 16px;"><div class="empty-state-icon" style="font-size:1.5rem;">${currentNotifTab === 'sent' ? '📤' : '🔔'}</div><p>${emptyMsg}</p></div>`;
      return;
    }

    listEl.innerHTML = notifs.map(n => {
      const isSent = currentNotifTab === 'sent';
      const icon = isSent ? '📤' : (n.type === 'custom' || n.sender_name ? '📩' : (n.type === 'review' ? '📋' : '🔔'));
      const iconClass = isSent ? 'notif-icon-custom' : (n.type === 'custom' || n.sender_name ? 'notif-icon-custom' : (n.type === 'review' ? 'notif-icon-review' : 'notif-icon-planning'));

      let partyText = '';
      if (isSent) {
        const target = n.target_user_name || (n.role === 'all' ? '🌐 ALL USERS (Broadcast)' : (n.role ? n.role.toUpperCase() : 'All Recipients'));
        partyText = `<span class="notif-item-sender" style="color:#6366f1;">To: ${target}</span>`;
      } else {
        partyText = n.sender_name ? `<span class="notif-item-sender">From: ${n.sender_name}</span>` : '';
      }

      const validityText = getNotifValidity(n);
      const validityBadge = validityText ? `<span class="notif-validity-tag">⏱️ ${validityText}</span>` : '';
      const msgText = getNotifMessage(n);
      const unreadClass = (!isSent && isNotifUnread(n)) ? 'unread' : '';

      return `
        <div class="notif-item ${unreadClass}" data-id="${n.id}">
          <div class="notif-item-icon ${iconClass}">
            ${icon}
          </div>
          <div class="notif-item-body">
            <div class="notif-item-msg">${escapeHtml(msgText)}</div>
            <div class="notif-item-time">
              <span>${partyText ? partyText + ' • ' : ''}${formatDateTime(n.created_at)}</span>
              ${validityBadge}
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Attach click handlers to mark individual notifications as read and open detail modal
    listEl.querySelectorAll('.notif-item').forEach(item => {
      item.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = item.dataset.id;
        if (!id) return;

        const panel = document.getElementById('notif-panel');
        if (panel) panel.classList.add('hidden');

        if (currentNotifTab === 'received') {
          item.classList.remove('unread');
          await apiFetch(`/users/notifications/${id}/read`, { method: 'PATCH' });
        }

        const n = notifs.find(x => x.id == id);
        if (n) {
          showNotifDetailModal(n);
        }

        await loadNotifications();
      });
    });
  } catch (err) {
    console.error('Error loading notifications:', err);
  }
}

/** Inject Notification Detail Modal into body */
function injectNotifDetailModal() {
  if (document.getElementById('notif-detail-modal')) return;

  const modalHtml = `
    <div class="modal-backdrop hidden" id="notif-detail-modal" style="z-index: 1100;">
      <div class="modal" style="max-width: 460px; width: 90%;">
        <div class="modal-header" style="background: var(--bg-surface, #f8fafc); border-bottom: 1px solid var(--border); padding: 14px 20px;">
          <h3 id="notif-detail-title" style="font-size:0.95rem; font-weight:600; display:flex; align-items:center; gap:8px; margin:0; color:var(--text-primary);">
            <span>📩</span> Notification Details
          </h3>
          <button class="modal-close" id="notif-detail-close">✕</button>
        </div>
        <div class="modal-body" style="padding: 20px; display: flex; flex-direction: column; gap: 12px;">
          <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.82rem; color: var(--text-second);">
            <span id="notif-detail-sender" style="font-weight: 600; color: var(--accent);"></span>
            <span id="notif-detail-time" style="color: var(--text-second);"></span>
          </div>
          <div id="notif-detail-validity" style="font-size: 0.78rem; font-weight:600; color: #4338ca;"></div>
          <div style="margin-top: 4px; padding: 14px 16px; background: var(--bg-surface, #f8fafc); border: 1px solid var(--border); border-radius: 8px; font-size: 0.9rem; line-height: 1.5; color: var(--text-primary); max-height: 260px; overflow-y: auto; white-space: pre-wrap; word-break: break-word;" id="notif-detail-message">
          </div>
        </div>
        <div class="modal-footer" style="padding: 12px 20px; border-top: 1px solid var(--border-light); display: flex; justify-content: flex-end; background: var(--bg-surface, #f9fafb);">
          <button type="button" class="btn btn-primary btn-sm" id="notif-detail-ok">Close</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  const modal = document.getElementById('notif-detail-modal');
  const closeBtn = document.getElementById('notif-detail-close');
  const okBtn = document.getElementById('notif-detail-ok');
  const closeModal = () => {
    if (modal) modal.classList.add('hidden');
  };

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (okBtn) okBtn.addEventListener('click', closeModal);
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }
}

/** Show Notification Details Modal */
function showNotifDetailModal(n) {
  injectNotifDetailModal();
  const modal = document.getElementById('notif-detail-modal');
  const titleEl = document.getElementById('notif-detail-title');
  const senderEl = document.getElementById('notif-detail-sender');
  const timeEl = document.getElementById('notif-detail-time');
  const validityEl = document.getElementById('notif-detail-validity');
  const messageEl = document.getElementById('notif-detail-message');

  if (!modal) return;

  const me = getUser();
  const isSent = (n.sender_id && me && String(n.sender_id) === String(me.id)) || currentNotifTab === 'sent';
  const msgText = getNotifMessage(n);
  const valText = getNotifValidity(n);

  if (titleEl) {
    titleEl.innerHTML = isSent ? `<span>📤</span> Sent Notification Details` : `<span>📩</span> Notification Details`;
  }

  if (senderEl) {
    if (isSent) {
      const target = n.target_user_name || (n.role === 'all' ? '🌐 ALL USERS (Broadcast)' : (n.role ? n.role.toUpperCase() : 'All Recipients'));
      senderEl.textContent = `To: ${target}`;
      senderEl.style.color = '#6366f1';
    } else {
      senderEl.textContent = n.sender_name ? `From: ${n.sender_name}` : 'System Notification';
      senderEl.style.color = 'var(--accent)';
    }
  }

  if (timeEl) timeEl.textContent = formatDateTime(n.created_at);
  if (validityEl) {
    validityEl.textContent = valText ? `⏱️ Validity: ${valText}` : '';
  }
  if (messageEl) messageEl.textContent = msgText;

  modal.classList.remove('hidden');
}

/** Populate recipient user picker checkboxes */
async function populateRecipientUserPicker(pickerEl) {
  if (!pickerEl || !(pickerEl instanceof HTMLElement)) {
    pickerEl = document.getElementById('send-notif-user-picker');
  }
  if (!pickerEl) return;

  try {
    let users = [];
    let res = await apiFetch('/users/recipients');
    if (res && res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        users = data;
      } else if (data && typeof data === 'object') {
        users = Object.values(data).flat().filter(u => u && u.id);
      }
    }

    // Fallback to GET /users if recipients endpoint returned empty or non-ok
    if (!users || users.length === 0) {
      const fallbackRes = await apiFetch('/users');
      if (fallbackRes && fallbackRes.ok) {
        const fallbackData = await fallbackRes.json();
        if (Array.isArray(fallbackData)) {
          users = fallbackData;
        } else if (fallbackData && typeof fallbackData === 'object') {
          users = Object.values(fallbackData).flat().filter(u => u && u.id);
        }
      }
    }

    if (!Array.isArray(users) || users.length === 0) {
      pickerEl.innerHTML = `
        <div style="padding:8px 12px; font-size:0.82rem; color:var(--text-second); text-align:center;">
          No eligible recipients found.
        </div>
      `;
      return;
    }

    const me = getUser();
    const activeBranch = (window.currentBranch ? window.currentBranch : (me && me.branch ? me.branch : '')).toLowerCase();

    const filteredUsers = users.filter(u => {
      if (!u || !u.id) return false;
      if (me && String(u.id) === String(me.id)) return false;
      if (u.role === 'admin') return true;
      if (activeBranch) {
        return (u.branch || '').toLowerCase() === activeBranch;
      }
      return true;
    });

    if (filteredUsers.length === 0) {
      users.forEach(u => {
        if (u && u.id && (!me || String(u.id) !== String(me.id))) {
          filteredUsers.push(u);
        }
      });
    }

    filteredUsers.sort((a, b) => {
      if (a.role === 'admin') return -1;
      if (b.role === 'admin') return 1;
      return (a.full_name || a.username || '').localeCompare(b.full_name || b.username || '');
    });

    let html = `
      <label class="notif-user-picker-item" style="display:flex; align-items:center; gap:8px; padding:6px 8px; border-radius:6px; cursor:pointer; background:#f8fafc; font-weight:700; color:#4338ca; border-bottom:1px solid #e2e8f0; margin-bottom:4px;">
        <input type="checkbox" id="notif-select-all" value="all" style="width:16px; height:16px; cursor:pointer;" />
        <span>🌐 ALL USERS (Broadcast)</span>
      </label>
    `;

    html += filteredUsers.map(u => {
      const branchTag = u.branch ? ` (${u.branch.toUpperCase()})` : '';
      const roleTag = u.role ? ` • ${u.role.toUpperCase()}` : '';
      return `
        <label class="notif-user-picker-item" style="display:flex; align-items:center; gap:8px; padding:6px 8px; border-radius:6px; cursor:pointer; font-size:0.83rem;">
          <input type="checkbox" class="notif-user-cb" value="${u.id}" style="width:15px; height:15px; cursor:pointer;" />
          <span><strong>${escapeHtml(u.full_name || u.username)}</strong>${branchTag}<span style="color:var(--text-second); font-size:0.75rem;">${roleTag}</span></span>
        </label>
      `;
    }).join('');

    pickerEl.innerHTML = html;

    const selectAllCb = pickerEl.querySelector('#notif-select-all');
    const userCbs = pickerEl.querySelectorAll('.notif-user-cb');
    const countBadge = document.getElementById('send-notif-selected-count');

    function updateSelectedCount() {
      if (selectAllCb && selectAllCb.checked) {
        if (countBadge) countBadge.textContent = `(ALL Users Selected)`;
      } else {
        const checkedCount = pickerEl.querySelectorAll('.notif-user-cb:checked').length;
        if (countBadge) countBadge.textContent = `(${checkedCount} Selected)`;
      }
    }

    if (selectAllCb) {
      selectAllCb.addEventListener('change', () => {
        const isChecked = selectAllCb.checked;
        userCbs.forEach(cb => cb.checked = isChecked);
        updateSelectedCount();
      });
    }

    userCbs.forEach(cb => {
      cb.addEventListener('change', () => {
        if (!cb.checked && selectAllCb) selectAllCb.checked = false;
        if (selectAllCb && Array.from(userCbs).every(c => c.checked)) selectAllCb.checked = true;
        updateSelectedCount();
      });
    });

    updateSelectedCount();
  } catch (err) {
    console.error('Error loading recipient options:', err);
    if (pickerEl) {
      pickerEl.innerHTML = `<div style="padding:8px 12px; font-size:0.82rem; color:var(--danger); text-align:center;">Failed to load users list. Please try again.</div>`;
    }
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

  // Load notification badge immediately on initialization
  loadNotifications();

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    panel.classList.toggle('hidden');
    if (!panel.classList.contains('hidden')) {
      // Instantly remove red badge number on bell icon when bell is clicked
      const badgeEl = document.getElementById('notif-badge');
      if (badgeEl) {
        badgeEl.textContent = '0';
        badgeEl.classList.add('hidden');
        badgeEl.style.display = 'none';
      }
      loadNotifications();
    }
  });

  document.addEventListener('click', () => panel.classList.add('hidden'));

  panel.addEventListener('click', async (e) => {
    const markBtn = e.target.closest('#mark-all-read, .mark-all-read-box-btn');
    if (markBtn) {
      e.stopPropagation();
      e.preventDefault();

      // Immediately clear UI badge & unread indicators optimistically
      const badgeEl = document.getElementById('notif-badge');
      if (badgeEl) {
        badgeEl.textContent = '0';
        badgeEl.classList.add('hidden');
        badgeEl.style.display = 'none';
      }
      const listEl = document.getElementById('notif-list');
      if (listEl) {
        listEl.querySelectorAll('.notif-item').forEach(item => item.classList.remove('unread'));
      }

      await apiFetch('/users/notifications/read-all', { method: 'PATCH' });
      await loadNotifications();
      if (typeof showToast === 'function') {
        showToast('✓ All notifications marked as read', 'success');
      }
      return;
    }
    e.stopPropagation();
  });

  // Setup Send Notification button handler
  const openSendBtn = document.getElementById('open-send-notif-btn');
  const modal = document.getElementById('send-notif-modal');
  const closeBtn = document.getElementById('send-notif-close');
  const cancelBtn = document.getElementById('send-notif-cancel');
  const form = document.getElementById('send-notif-form');
  const userPickerEl = document.getElementById('send-notif-user-picker');

  if (openSendBtn && modal) {
    populateRecipientUserPicker(userPickerEl);

    openSendBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      panel.classList.add('hidden'); // hide notification dropdown
      await populateRecipientUserPicker(userPickerEl);
      modal.classList.remove('hidden');
    });

    const closeModal = () => {
      modal.classList.add('hidden');
      if (form) form.reset();
      const submitBtn = document.getElementById('send-notif-submit');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send Notification';
      }
    };
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const pickerEl = document.getElementById('send-notif-user-picker');
        const selectAllCb = pickerEl ? pickerEl.querySelector('#notif-select-all') : null;
        let selectedRecipients = [];

        if (selectAllCb && selectAllCb.checked) {
          selectedRecipients = ['all'];
        } else if (pickerEl) {
          selectedRecipients = Array.from(pickerEl.querySelectorAll('.notif-user-cb:checked')).map(cb => cb.value);
        }

        const message = document.getElementById('send-notif-message').value.trim();
        const validity = document.getElementById('send-notif-validity').value;
        const me = getUser();
        const activeBranch = (window.currentBranch ? window.currentBranch : (me && me.branch ? me.branch : '')).toLowerCase();

        if (selectedRecipients.length === 0) {
          showToast('Please select at least one recipient user', 'error');
          return;
        }

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
            body: JSON.stringify({ recipients: selectedRecipients, message, validity, branch: activeBranch })
          });

          if (res && res.ok) {
            showToast('Notification sent successfully!', 'success');
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

  // Setup authority feature
  setupAuthorityFeature();
}

/* ─── Admin Authority Feature ────────────────────────────────────────────── */
async function setupAuthorityFeature() {
  const me = getUser();
  if (!me) return;

  // ── ADMIN SIDE: Branch Selection Card Authority buttons ───────────────────
  if (me.role === 'admin' || me.hasAdminPower) {
    /** Refresh authority state on branch cards */
    async function refreshAuthorityUI() {
      try {
        const res = await apiFetch('/users/authority');
        if (!res || !res.ok) return;
        const { authority } = await res.json();

        // Update branch selector cards
        document.querySelectorAll('.branch-card-authority-btn').forEach(btn => {
          const b = btn.dataset.branch;
          const isHolder = authority && (authority.branch || '').toLowerCase() === (b || '').toLowerCase();
          if (isHolder) {
            btn.innerHTML = '⚡ Authority Active (Revoke)';
            btn.classList.add('active-authority');
          } else {
            btn.innerHTML = '<span>👑</span> <span>Transfer Admin Power</span>';
            btn.classList.remove('active-authority');
          }
        });
      } catch (e) {}
    }

    // Attach Branch Card Authority buttons listeners
    document.querySelectorAll('.branch-card-authority-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const targetBranch = btn.dataset.branch;
        const res = await apiFetch('/users/authority');
        const { authority } = res ? await res.json() : {};

        if (authority && (authority.branch || '').toLowerCase() === targetBranch.toLowerCase()) {
          if (!confirm(`Revoke Admin Authority from ${authority.manager_name}? Full power will return to Admin.`)) return;
          btn.disabled = true;
          try {
            const r = await apiFetch('/users/authority/revert', { method: 'POST' });
            const d = await r.json();
            if (d.success) {
              showToast('✅ Admin authority revoked', 'success');
              await refreshAuthorityUI();
            } else {
              showToast(d.error || 'Failed to revoke authority', 'error');
            }
          } catch (err) {
            showToast('Error revoking authority', 'error');
          } finally {
            btn.disabled = false;
          }
        } else {
          if (!confirm(`Transfer FULL ADMIN POWER to ${capitalize(targetBranch)} Branch Manager while Admin is on leave?`)) return;
          btn.disabled = true;
          try {
            // Find manager_id for target branch
            let managerId = null;
            try {
              const uRes = await apiFetch('/users');
              if (uRes && uRes.ok) {
                const uData = await uRes.json();
                const branchUsers = uData[targetBranch.toLowerCase()] || [];
                const mgr = branchUsers.find(u => u.role === 'manager');
                if (mgr) managerId = mgr.id;
              }
            } catch (e) {}

            const r = await apiFetch('/users/authority/grant', {
              method: 'POST',
              body: JSON.stringify({ branch: targetBranch, manager_id: managerId })
            });
            const d = await r.json();
            if (d.success) {
              showToast(`✅ Full Admin Power transferred to ${capitalize(targetBranch)} Manager`, 'success');
              await refreshAuthorityUI();
            } else {
              showToast(d.error || 'Failed to grant authority', 'error');
            }
          } catch (err) {
            showToast('Failed to grant authority', 'error');
          } finally {
            btn.disabled = false;
          }
        }
      });
    });

    // Initial refresh
    refreshAuthorityUI();
  }

  // ── MANAGER SIDE: REVERT POWER button ────────────────────────────────────
  const revertBtn = document.getElementById('revert-power-btn');
  if (revertBtn) {
    try {
      const res = await apiFetch('/users/authority');
      if (res && res.ok) {
        const { authority } = await res.json();
        if (authority && authority.manager_id == me.id) {
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
                await refreshUser();
                window.location.reload();
              } else {
                showToast(d.error || 'Failed to revert authority', 'danger');
                revertBtn.disabled = false;
              }
            } catch { revertBtn.disabled = false; }
          });
        }
      }
    } catch (e) {}
  }
}
