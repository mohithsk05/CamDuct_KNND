const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DATA_FILE = path.join(__dirname, 'data.json');

// Initial structure
let data = {
  users: [],
  projects: [],
  notifications: [],
  power_grants: [],
  purchase_igr: [],
  purchase_bpr: [],
  admin_authority: null,
  autoInc: { users: 1, projects: 1, notifications: 1, power_grants: 1, purchase_igr: 1, purchase_bpr: 1 }
};

// Load data if exists
if (fs.existsSync(DATA_FILE)) {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    data = JSON.parse(raw);
    if (!data.purchase_igr) data.purchase_igr = [];
    if (!data.purchase_bpr) data.purchase_bpr = [];
    if (!data.autoInc) data.autoInc = { users: 1, projects: 1, notifications: 1, power_grants: 1, purchase_igr: 1, purchase_bpr: 1 };
    if (!data.autoInc.purchase_igr) data.autoInc.purchase_igr = 1;
    if (!data.autoInc.purchase_bpr) data.autoInc.purchase_bpr = 1;
    // Always clear admin_authority on server start — must be granted fresh each session
    data.admin_authority = null;
    saveData();
  } catch (e) {
    console.error('Error loading data.json:', e);
  }
}

// Clean up any corrupt status or branch values in existing projects
if (data.projects) {
  let dirty = false;
  data.projects.forEach(p => {
    if (!['pending', 'approved', 'rejected', 'revised'].includes(p.status)) {
      p.status = 'pending';
      dirty = true;
    }
    if (p.branch) {
      const lower = p.branch.toLowerCase();
      if (p.branch !== lower) { p.branch = lower; dirty = true; }
    } else {
      p.branch = 'maalur';
      dirty = true;
    }
  });
  if (dirty) saveData();
}

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// ─── Query Engine Mock matching SQLite interface ──────────────────────────

const db = {
  prepare(sql) {
    const cleanSql = sql.replace(/\s+/g, ' ').trim();

    return {
      get(...args) {
        const rows = executeQuery(cleanSql, args);
        return rows[0] || undefined;
      },
      all(...args) {
        return executeQuery(cleanSql, args);
      },
      run(...args) {
        return executeMutation(cleanSql, args);
      }
    };
  },
  exec(sql) {
    // Schema creation — noop
  }
};

function autoCleanupNotifications() {
  if (!data.notifications || data.notifications.length === 0) return;
  const now = Date.now();
  const initialLength = data.notifications.length;

  const validityDurations = {
    '1day': 24 * 60 * 60 * 1000,
    '3day': 3 * 24 * 60 * 60 * 1000,
    '5day': 5 * 24 * 60 * 60 * 1000,
    '1week': 7 * 24 * 60 * 60 * 1000,
    '1month': 30 * 24 * 60 * 60 * 1000,
    '1year': 365 * 24 * 60 * 60 * 1000,
  };

  data.notifications = data.notifications.filter(n => {
    // Custom notifications with explicit expires_at
    if (n.expires_at) {
      return new Date(n.expires_at).getTime() > now;
    }
    // Custom notifications with validity
    if (n.validity && validityDurations[n.validity]) {
      const exp = new Date(n.created_at).getTime() + validityDurations[n.validity];
      return exp > now;
    }
    // Usual / system notifications: automatically deleted after 24 hours
    const age = now - new Date(n.created_at).getTime();
    return age < 24 * 60 * 60 * 1000;
  });

  if (data.notifications.length !== initialLength) {
    saveData();
  }
}

// Initial cleanup and periodic cleanup every minute
autoCleanupNotifications();
setInterval(autoCleanupNotifications, 60000).unref();

function executeQuery(sql, args) {
  // Users queries
  if (sql.includes('FROM users WHERE username = ? AND role != ?')) {
    const [username, role] = args;
    return data.users.filter(u => u.username === username && u.role !== role);
  }
  if (sql.includes('FROM users WHERE id = ?')) {
    const [id] = args;
    return data.users.filter(u => u.id == id);
  }
  if (sql.includes('COUNT(*) as c FROM users')) {
    return [{ c: data.users.length }];
  }
  // Branch-filtered users query (for manager users view)
  if (sql.includes('FROM users WHERE role != \'gate\' AND branch = ?')) {
    const [branch] = args;
    return data.users
      .filter(u => u.role !== 'gate' && u.branch === branch)
      .sort((a, b) => a.role.localeCompare(b.role));
  }
  if (sql.includes('FROM users')) {
    return [...data.users.filter(u => u.role !== 'gate')].sort((a,b) => (a.branch || '').localeCompare(b.branch || ''));
  }

  // admin_authority queries
  if (sql.includes('FROM admin_authority')) {
    return data.admin_authority ? [data.admin_authority] : [];
  }

  // Power Grants queries — must come BEFORE the generic 'FROM users' check below
  if (sql.includes('FROM power_grants pg LEFT JOIN users u')) {
    return data.power_grants.map(pg => {
      const u = data.users.find(usr => usr.id == pg.granted_by);
      return { ...pg, granted_by_name: u ? u.full_name : null };
    });
  }
  if (sql.includes('FROM power_grants')) {
    const role = args[0];
    const branch = args[1];
    const dept = args[2];
    return data.power_grants.filter(p => {
      const roleMatch = !role || (p.granted_to_role || '').toLowerCase() === (role || '').toLowerCase();
      const branchMatch = !branch || (p.granted_branch || '').toLowerCase() === (branch || '').toLowerCase();
      const deptMatch = !dept || (p.granted_dept || '').toLowerCase() === (dept || '').toLowerCase();
      return roleMatch && branchMatch && deptMatch;
    });
  }

  // Projects queries: Single project lookup
  if (sql.includes('FROM projects') && (sql.includes('WHERE p.id = ?') || sql.includes('WHERE id = ?'))) {
    const id = args[0];
    const p = data.projects.find(x => x.id == id);
    if (!p) return [];
    const sub = data.users.find(u => u.id == p.submitted_by);
    const rev = data.users.find(u => u.id == p.reviewed_by);
    return [{ ...p, submitted_by_name: sub ? sub.full_name : null, reviewed_by_name: rev ? rev.full_name : null }];
  }
  if (sql.includes('FROM projects WHERE job_no = ?')) {
    const [job_no, branch] = args;
    return data.projects.filter(p => p.job_no === job_no && (!branch || p.branch.toLowerCase() === branch.toLowerCase()));
  }
  if (sql.includes('FROM projects WHERE LOWER(branch) = LOWER(?) AND LOWER(project_name) = LOWER(?) AND LOWER(place) = LOWER(?)')) {
    const [branch, project_name, place] = args;
    return data.projects.filter(p =>
      p.branch.toLowerCase() === branch.toLowerCase() &&
      (p.project_name || '').toLowerCase() === project_name.toLowerCase() &&
      (p.place || '').toLowerCase() === place.toLowerCase()
    );
  }

  // Projects queries: Single project lookup by ID, pattern matching, or List projects
  if (sql.includes('FROM projects')) {
    let list = [...data.projects];

    if (sql.includes('job_no LIKE') || sql.includes('LIKE')) {
      const pattern = (args[0] || '').replace(/%/g, '');
      const branchArg = args.find(a => typeof a === 'string' && (a.toLowerCase() === 'maalur' || a.toLowerCase() === 'haryana'));
      return list.filter(p => {
        const matchPattern = p.job_no && p.job_no.startsWith(pattern);
        const matchBranch = !branchArg || (p.branch || '').toLowerCase() === branchArg.toLowerCase();
        return matchPattern && matchBranch;
      });
    }

    if (sql.includes('LOWER(project_name)') && sql.includes('LOWER(place)')) {
      const [branch, projName, place] = args;
      const found = list.find(p =>
        (p.branch || '').toLowerCase() === (branch || '').toLowerCase() &&
        (p.project_name || '').toLowerCase() === (projName || '').toLowerCase() &&
        (p.place || '').toLowerCase() === (place || '').toLowerCase()
      );
      return found || null;
    }

    if (sql.includes('WHERE p.id = ?') || sql.includes('WHERE id = ?') || sql.includes('p.id = ?')) {
      const idArg = args[0];
      list = list.filter(p => String(p.id) === String(idArg));
    } else {
      // Branch filter check
      const branchArg = args.find(a => typeof a === 'string' && (a.toLowerCase() === 'maalur' || a.toLowerCase() === 'haryana'));
      if (branchArg && (sql.includes('branch') || sql.includes('LOWER'))) {
        list = list.filter(p => (p.branch || '').toLowerCase() === branchArg.toLowerCase());
      }

      // Date range filter check
      if (sql.includes('WHERE 1=1')) {
        let paramIdx = 0;
        if (sql.includes('p.created_at >= ?')) { list = list.filter(p => p.created_at >= args[paramIdx++]); }
        if (sql.includes('p.created_at <= ?')) { list = list.filter(p => p.created_at <= args[paramIdx++]); }
        if (branchArg) { list = list.filter(p => (p.branch || '').toLowerCase() === branchArg.toLowerCase()); }
      }
    }

    list.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
    return list.map(p => {
      const sub = data.users.find(u => u.id == p.submitted_by);
      const rev = data.users.find(u => u.id == p.reviewed_by);
      return { ...p, submitted_by_name: sub ? sub.full_name : null, reviewed_by_name: rev ? rev.full_name : null };
    });
  }

  // Notifications queries
  if (sql.includes('FROM notifications')) {
    autoCleanupNotifications();

    if (sql.includes('sender_id = ?')) {
      const senderId = args[0];
      return data.notifications
        .filter(n => n.sender_id == senderId)
        .sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
    }

    let userId = null;
    let userRole = null;
    let userBranch = null;

    if (args.length === 3) {
      [userId, userRole, userBranch] = args;
    } else if (args.length === 2) {
      [userRole, userBranch] = args;
    } else if (args.length === 1) {
      if (typeof args[0] === 'number') userId = args[0];
      else userRole = args[0];
    }

    return data.notifications
      .filter(n => {
        // Direct target to this user ID
        if (userId && n.target_user_id == userId) return true;

        // Broadcast notifications (target_user_id === 'all' or role === 'all')
        if (n.target_user_id === 'all' || n.role === 'all') {
          if (n.branch) {
            if (userRole === 'admin') return true;
            if (userBranch && (userBranch || '').toLowerCase() === (n.branch || '').toLowerCase()) return true;
            return false;
          }
          return true;
        }

        // Admin role sees admin system notifications
        if (userRole === 'admin' || (!userRole && sql.includes("role = 'admin'"))) {
          if (n.role === 'admin' || (!n.role && !n.target_user_id)) return true;
        }

        // Matching system notification role and branch
        if (n.role && userRole && n.role === userRole) {
          if (!n.branch || !userBranch || (n.branch || '').toLowerCase() === (userBranch || '').toLowerCase()) {
            return true;
          }
        }
        return false;
      })
      .sort((a,b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 50);
  }

  return [];
}

function executeMutation(sql, args) {
  const now = new Date().toISOString();

  // Users insert
  if (sql.includes('INSERT INTO users')) {
    const id = data.autoInc.users++;
    let user;
    if (sql.includes('VALUES (@username')) {
      const obj = args[0];
      user = { id, ...obj, created_at: now };
    } else {
      const [username, password, role, branch, full_name] = args;
      user = { id, username, password, role, branch, full_name, created_at: now };
    }
    data.users.push(user);
    saveData();
    return { lastInsertRowid: id };
  }

  // Users delete
  if (sql.includes('DELETE FROM users WHERE id = ?')) {
    const id = args[0];
    data.users = data.users.filter(u => u.id != id);
    saveData();
    return { changes: 1 };
  }

  // Users password update
  if (sql.includes('UPDATE users SET password = ? WHERE id = ?')) {
    const [password, id] = args;
    const u = data.users.find(x => x.id == id);
    if (u) u.password = password;
    saveData();
    return { changes: 1 };
  }

  // Projects insert
  if (sql.includes('INSERT INTO projects')) {
    const id = data.autoInc.projects++;
    let job_no, branch, customer_name, customer_type, project_name, place, zone, location, po_quantity, po_items, drawing_path, drawing_name, status, submitted_by;
    
    if (args.length === 14) {
      [job_no, branch, customer_name, customer_type, project_name, place, zone, location, po_quantity, po_items, drawing_path, drawing_name, status, submitted_by] = args;
    } else if (args.length === 13) {
      [job_no, branch, customer_name, customer_type, project_name, place, location, po_quantity, po_items, drawing_path, drawing_name, status, submitted_by] = args;
      zone = null;
    } else if (sql.includes('po_items')) {
      [job_no, branch, customer_name, po_quantity, po_items, drawing_path, drawing_name, status, submitted_by] = args;
      zone = null;
    } else {
      [job_no, branch, customer_name, po_quantity, drawing_path, drawing_name, status, submitted_by] = args;
      zone = null;
    }

    const project = {
      id,
      job_no,
      branch: (branch || 'maalur').toLowerCase(),
      customer_name,
      customer_type: customer_type || (customer_name && customer_name.toLowerCase() === 'knnd' ? 'knnd' : 'others'),
      project_name: project_name || null,
      place: place || null,
      zone: zone || null,
      location: location || null,
      po_quantity: Number(po_quantity) || 0,
      po_items: po_items || null,
      drawing_path: drawing_path || null,
      drawing_name: drawing_name || null,
      status: status || 'pending',
      revise_remark: null,
      billing_items: null,
      insulation_items: null,
      submitted_by: Number(submitted_by),
      reviewed_by: null,
      created_at: now,
      updated_at: now
    };
    data.projects.push(project);
    saveData();
    return { lastInsertRowid: id };
  }

  // Projects review update (Admin action: approved/rejected/revised)
  if (sql.includes('UPDATE projects SET status = ?') && sql.includes('reviewed_by = ?')) {
    const [status, remark, reviewed_by, id] = args;
    const p = data.projects.find(x => x.id == id);
    if (p) {
      p.status = status;
      p.revise_remark = remark;
      p.reviewed_by = reviewed_by;
      p.updated_at = now;
    }
    saveData();
    return { changes: 1 };
  }

  // Projects revision resubmit update (Planning re-upload & resubmit)
  if (sql.includes('UPDATE projects SET job_no = ?') || (sql.includes('UPDATE projects SET') && sql.includes('is_revised'))) {
    const id = args[args.length - 1];
    const [job_no, customer_name, customer_type, project_name, place, zone, location, po_quantity, po_items, drawing_path, drawing_name] = args;
    const p = data.projects.find(x => x.id == id);
    if (p) {
      p.job_no = job_no;
      p.customer_name = customer_name;
      if (customer_type) p.customer_type = customer_type;
      p.project_name = project_name;
      p.place = place;
      p.zone = zone;
      p.location = location;
      p.po_quantity = Number(po_quantity) || 0;
      p.po_items = po_items;
      if (drawing_path) p.drawing_path = drawing_path;
      if (drawing_name) p.drawing_name = drawing_name;
      p.status = 'pending';
      p.is_revised = 1;
      p.revise_remark = null;
      p.updated_at = now;
    }
    saveData();
    return { changes: 1 };
  }


  // Projects quantities update (new JSON items format + summary fields)
  if (sql.includes('UPDATE projects SET billing_items = ?')) {
    const bi = args[0];
    const id = args[args.length - 1];
    const p = data.projects.find(x => x.id == id);
    if (p) {
      p.billing_items = bi;
      if (args.length >= 5) {
        p.billing_qty = args[1];
        p.billing_unit = args[2];
        p.billing_rate = args[3];
      }
      p.updated_at = now;
    }
    saveData();
    return { changes: 1 };
  }
  if (sql.includes('UPDATE projects SET insulation_items = ?')) {
    const ii = args[0];
    const id = args[args.length - 1];
    const p = data.projects.find(x => x.id == id);
    if (p) {
      p.insulation_items = ii;
      if (args.length >= 5) {
        p.insulation_qty = args[1];
        p.insulation_unit = args[2];
        p.insulation_rate = args[3];
      }
      p.updated_at = now;
    }
    saveData();
    return { changes: 1 };
  }

  // Projects quantities reset (unlock edit)
  if (sql.includes('UPDATE projects SET billing_items = NULL, billing_qty = NULL, billing_unit = NULL, billing_rate = NULL, insulation_items = NULL')) {
    const id = args[args.length - 1];
    const p = data.projects.find(x => x.id == id);
    if (p) {
      p.billing_items = null; p.billing_qty = null; p.billing_unit = null; p.billing_rate = null;
      p.insulation_items = null; p.insulation_qty = null; p.insulation_unit = null; p.insulation_rate = null;
      p.updated_at = now;
    }
    saveData();
    return { changes: 1 };
  }
  if (sql.includes('UPDATE projects SET billing_items = NULL')) {
    const id = args[args.length - 1];
    const p = data.projects.find(x => x.id == id);
    if (p) {
      p.billing_items = null; p.billing_qty = null; p.billing_unit = null; p.billing_rate = null;
      p.updated_at = now;
    }
    saveData();
    return { changes: 1 };
  }
  if (sql.includes('UPDATE projects SET insulation_items = NULL')) {
    const id = args[args.length - 1];
    const p = data.projects.find(x => x.id == id);
    if (p) {
      p.insulation_items = null; p.insulation_qty = null; p.insulation_unit = null; p.insulation_rate = null;
      p.updated_at = now;
    }
    saveData();
    return { changes: 1 };
  }

  // Notifications insert
  if (sql.includes('INSERT INTO notifications')) {
    const id = data.autoInc.notifications++;
    let n;
    if (sql.includes('sender_id') || args.length >= 8) {
      const [sender_id, sender_name, target_user_id, target_user_name, role, branch, type, message, validity, expires_at] = args;
      n = { id, sender_id, sender_name, target_user_id, target_user_name, role, branch, type: type || 'custom', message, validity, expires_at, is_read: 0, created_at: now };
    } else if (sql.includes("VALUES ('admin'")) {
      const [message, project_id] = args;
      n = { id, role: 'admin', branch: null, type: 'planning', message, project_id, is_read: 0, created_at: now };
    } else if (sql.includes("VALUES ('manager'")) {
      const [branch, message, project_id] = args;
      n = { id, role: 'manager', branch: (branch || '').toLowerCase(), type: 'planning', message, project_id, is_read: 0, created_at: now };
    } else if (sql.includes("VALUES ('planning'")) {
      const [branch, message, project_id] = args;
      n = { id, role: 'planning', branch: (branch || '').toLowerCase(), type: 'review', message, project_id, is_read: 0, created_at: now };
    } else {
      const [role, branch, type, message, project_id] = args;
      n = { id, role, branch, type, message, project_id, is_read: 0, created_at: now };
    }
    if (n) data.notifications.push(n);
    saveData();
    return { lastInsertRowid: id };
  }

  // Notifications mark read
  if (sql.includes('UPDATE notifications SET is_read = 1 WHERE id = ?')) {
    const id = args[0];
    const n = data.notifications.find(x => x.id == id);
    if (n) n.is_read = 1;
    saveData();
    return { changes: 1 };
  }
  if (sql.includes("UPDATE notifications SET is_read = 1 WHERE role = 'admin'")) {
    data.notifications.filter(n => n.role === 'admin').forEach(n => n.is_read = 1);
    saveData();
    return { changes: 1 };
  }
  if (sql.includes('UPDATE notifications SET is_read = 1 WHERE role = ?')) {
    const [role, branch] = args;
    data.notifications.filter(n => n.role === role && (!n.branch || (n.branch || '').toLowerCase() === (branch || '').toLowerCase())).forEach(n => n.is_read = 1);
    saveData();
    return { changes: 1 };
  }

  // Power grants insert
  if (sql.includes('INSERT OR IGNORE INTO power_grants')) {
    const [granted_to_role, granted_branch, granted_dept, granted_by] = args;
    const exists = data.power_grants.some(pg => pg.granted_to_role === granted_to_role && pg.granted_branch === granted_branch && pg.granted_dept === granted_dept);
    if (!exists) {
      const id = data.autoInc.power_grants++;
      data.power_grants.push({ id, granted_to_role, granted_branch: (granted_branch || '').toLowerCase(), granted_dept, granted_by, created_at: now });
      saveData();
    }
    return { changes: 1 };
  }

  // Power grants delete
  if (sql.includes('DELETE FROM power_grants WHERE id = ?')) {
    const id = args[0];
    data.power_grants = data.power_grants.filter(pg => pg.id != id);
    saveData();
    return { changes: 1 };
  }

  // Admin authority — grant
  if (sql.includes('INSERT INTO admin_authority') || sql.includes('REPLACE INTO admin_authority')) {
    const [manager_id, manager_name, manager_role, branch, granted_at] = args;
    data.admin_authority = { manager_id, manager_name, manager_role, branch, granted_at };
    saveData();
    return { changes: 1 };
  }

  // Admin authority — revoke
  if (sql.includes('DELETE FROM admin_authority')) {
    data.admin_authority = null;
    saveData();
    return { changes: 1 };
  }

  return { changes: 0 };
}

// ─── Seed Users ─────────────────────────────────────────────────────────────
function seedUsers() {
  if (data.users.length > 0) return;

  const defaultUsers = [
    { username: 'gate',             password: 'camduct@2024',   role: 'gate',               branch: null,      full_name: 'Gate Access' },
    { username: 'admin',            password: 'admin@2024',     role: 'admin',              branch: null,      full_name: 'Admin / Owner' },
    { username: 'manager_maalur',   password: 'mgr_maalur@24',  role: 'manager',            branch: 'maalur',  full_name: 'Manager – Maalur' },
    { username: 'manager_haryana',  password: 'mgr_haryana@24', role: 'manager',            branch: 'haryana', full_name: 'Manager – Haryana' },
    { username: 'plan_maalur',      password: 'plan@24',        role: 'planning',           branch: 'maalur',  full_name: 'Planning – Maalur' },
    { username: 'purchase_maalur',  password: 'purchase@24',    role: 'purchase',           branch: 'maalur',  full_name: 'Purchase – Maalur' },
    { username: 'consume_maalur',   password: 'consume@24',     role: 'consumption',        branch: 'maalur',  full_name: 'Consumption – Maalur' },
    { username: 'dispatch_maalur',  password: 'dispatch@24',    role: 'dispatch',           branch: 'maalur',  full_name: 'Dispatch – Maalur' },
    { username: 'accounts_maalur',  password: 'accounts@24',    role: 'accounts',           branch: 'maalur',  full_name: 'Accounts – Maalur' },
    { username: 'security_maalur',  password: 'security@24',    role: 'security',           branch: 'maalur',  full_name: 'Security – Maalur' },
    { username: 'plan_haryana',     password: 'plan@24h',       role: 'planning',           branch: 'haryana', full_name: 'Planning – Haryana' },
    { username: 'purchase_haryana', password: 'purchase@24h',   role: 'purchase',           branch: 'haryana', full_name: 'Purchase – Haryana' },
    { username: 'consume_haryana',  password: 'consume@24h',    role: 'consumption',        branch: 'haryana', full_name: 'Consumption – Haryana' },
    { username: 'dispatch_haryana', password: 'dispatch@24h',   role: 'dispatch',           branch: 'haryana', full_name: 'Dispatch – Haryana' },
    { username: 'accounts_haryana', password: 'accounts@24h',   role: 'accounts',           branch: 'haryana', full_name: 'Accounts – Haryana' },
    { username: 'security_haryana', password: 'security@24h',   role: 'security',           branch: 'haryana', full_name: 'Security – Haryana' },
  ];

  for (const u of defaultUsers) {
    const id = data.autoInc.users++;
    u.password = bcrypt.hashSync(u.password, 10);
    data.users.push({ id, ...u, created_at: new Date().toISOString() });
  }
  saveData();
  console.log('✅ Default users seeded to JSON database');
}

seedUsers();

db.data = data;
db.saveData = saveData;

module.exports = db;
