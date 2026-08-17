/**
 * purchase.js — Purchase Department page logic (Tab switching & initialization)
 */

let currentUser = null;
let currentBranch = 'maalur';
let activeMainTab = 'po';
let activeSubTab = 'igr';

async function initPurchase() {
  // Guard: purchase dept, admin, manager all can access
  const allowedRoles = ['purchase', 'admin', 'manager'];
  currentUser = requireAuth(allowedRoles);
  if (!currentUser) return;

  // Determine branch
  const urlBranch = new URLSearchParams(window.location.search).get('branch');
  const storedBranch = sessionStorage.getItem('active_branch');
  currentBranch = (urlBranch || storedBranch || currentUser.branch || 'maalur').toLowerCase();

  // Save active branch in session
  sessionStorage.setItem('active_branch', currentBranch);

  // Setup UI topbar & user chip
  populateTopbar(currentUser);
  setupLogout();
  setupNotifications();

  // Branch pill
  const pill = document.getElementById('branch-pill-text');
  if (pill) pill.textContent = capitalize(currentBranch);

  // Setup navigation buttons
  setupTopNavigation();

  // Setup tab listeners
  setupPurchaseTabs();
}

function setupTopNavigation() {
  // Back button
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

  // Refresh button
  const refreshBtn = document.getElementById('refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      const icon = refreshBtn.querySelector('.refresh-icon');
      if (icon) {
        icon.style.transform = 'rotate(360deg)';
        setTimeout(() => { icon.style.transform = 'rotate(0deg)'; }, 600);
      }
      showToast('Purchase workspace refreshed', 'success');
    });
  }
}

function setupPurchaseTabs() {
  const mainTabBtns = document.querySelectorAll('.purchase-tab-btn');
  const subTabBtns = document.querySelectorAll('.purchase-subtab-btn');
  const subtabsBar = document.getElementById('inventory-subtabs-bar');

  // Main Tab Switcher
  mainTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabKey = btn.dataset.tab;
      if (!tabKey) return;

      activeMainTab = tabKey;

      // Update main tab button states
      mainTabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Hide all main panels
      document.querySelectorAll('.purchase-content-panel').forEach(panel => {
        panel.classList.add('hidden');
      });

      // Show active main panel
      const targetPanel = document.getElementById(`panel-${tabKey}`);
      if (targetPanel) {
        targetPanel.classList.remove('hidden');
      }

      // Show/Hide Inventory Subtabs Bar
      if (tabKey === 'inventory') {
        subtabsBar && subtabsBar.classList.remove('hidden');
        switchInventorySubTab(activeSubTab);
      } else {
        subtabsBar && subtabsBar.classList.add('hidden');
      }
    });
  });

  // Sub Tab Switcher (for Inventory)
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

  // Update subtab button states
  subTabBtns.forEach(b => {
    if (b.dataset.subtab === subtabKey) {
      b.classList.add('active');
    } else {
      b.classList.remove('active');
    }
  });

  // Hide all subpanels
  document.querySelectorAll('.inventory-subpanel').forEach(subpanel => {
    subpanel.classList.add('hidden');
  });

  // Show target subpanel
  const targetSubpanel = document.getElementById(`subpanel-${subtabKey}`);
  if (targetSubpanel) {
    targetSubpanel.classList.remove('hidden');
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  initPurchase();
});
