const API_BASE = window.location.origin;
let socket = null;
let deferredPrompt = null;

// ==========================================================================
// Theme Management (Dark Mode / Light Mode)
// ==========================================================================
function getPreferredTheme() {
  const stored = localStorage.getItem('geosafe_theme');
  if (stored) return stored;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('geosafe_theme', theme);
  document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
    btn.textContent = theme === 'dark' ? '☀️' : '🌙';
    btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode');
    btn.setAttribute('title', theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode');
  });
}

function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme') || 'light';
  const next = cur === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  showToast(next === 'dark' ? '🌙 Dark Mode Activated' : '☀️ Light Mode Activated');
}

// Auto-apply immediately
applyTheme(getPreferredTheme());

// Local persistent mock storage for database-free Vercel preview
function getLocalStore(key, defaultVal) {
  try {
    const val = localStorage.getItem('geosafe_' + key);
    return val ? JSON.parse(val) : defaultVal;
  } catch {
    return defaultVal;
  }
}

function setLocalStore(key, val) {
  try {
    localStorage.setItem('geosafe_' + key, JSON.stringify(val));
  } catch {}
}

// Initial Mock Seed Data
const DEFAULT_REPORTS = [
  {
    id: 101,
    user_id: 3,
    reporter_name: 'Juan Dela Cruz',
    incident_type: 'Flood',
    description: 'Bayanan Creek water overflowing near purok 3 bridge. Chest-level water.',
    latitude: 14.3972,
    longitude: 121.0200,
    severity: 'high',
    status: 'responding',
    assigned_to: 2,
    responder_name: 'Responder Unit 1 (Ambulance)',
    created_at: new Date(Date.now() - 15 * 60000).toISOString()
  },
  {
    id: 102,
    user_id: 4,
    reporter_name: 'Maria Santos',
    incident_type: 'SOS',
    description: 'EMERGENCY: Stranded on roof with infant. Immediate boat rescue needed.',
    latitude: 14.3985,
    longitude: 121.0225,
    severity: 'high',
    status: 'pending',
    assigned_to: null,
    responder_name: null,
    created_at: new Date(Date.now() - 5 * 60000).toISOString()
  },
  {
    id: 103,
    user_id: 5,
    reporter_name: 'Ricardo Ramos',
    incident_type: 'Fire',
    description: 'Electrical post sparking and structural fire near Bayanan Market.',
    latitude: 14.3955,
    longitude: 121.0180,
    severity: 'medium',
    status: 'verified',
    assigned_to: 3,
    responder_name: 'Rescue Boat Unit 3',
    created_at: new Date(Date.now() - 40 * 60000).toISOString()
  }
];

const DEFAULT_ALERTS = [
  {
    id: 1,
    message: 'BDRRMC ADVISORY: Continuous heavy rainfall over Barangay Bayanan. Low-lying areas on Alert Level 2.',
    severity: 'medium',
    created_by: 1,
    created_by_name: 'BDRRMC Admin Lead',
    created_at: new Date(Date.now() - 30 * 60000).toISOString()
  }
];

const DEFAULT_USERS = [
  { id: 1, name: 'BDRRMC Admin Lead', email: 'admin@geosafe.local', role: 'admin' },
  { id: 2, name: 'Responder Unit 1 (Ambulance)', email: 'responder@geosafe.local', role: 'responder' },
  { id: 3, name: 'Rescue Boat Unit 3 (Bayanan Creek)', email: 'boat@geosafe.local', role: 'responder' },
  { id: 4, name: 'Juan Dela Cruz', email: 'resident@geosafe.local', role: 'resident' }
];

function getToken() {
  return localStorage.getItem('geosafe_token');
}

function getUser() {
  const raw = localStorage.getItem('geosafe_user');
  return raw ? JSON.parse(raw) : null;
}

function setAuth(token, user) {
  localStorage.setItem('geosafe_token', token);
  localStorage.setItem('geosafe_user', JSON.stringify(user));
}

function clearAuth() {
  localStorage.removeItem('geosafe_token');
  localStorage.removeItem('geosafe_user');
}

function requireAuth(allowedRoles) {
  const user = getUser();
  const token = getToken();
  if (!token || !user) {
    window.location.href = 'index.html';
    return null;
  }
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    redirectByRole(user.role);
    return null;
  }
  return user;
}

function redirectByRole(role) {
  const map = {
    resident: 'home.html',
    admin: 'admin.html',
    responder: 'responder.html',
  };
  window.location.href = map[role] || 'index.html';
}

function renderBottomNav(active) {
  const items = [
    { id: 'home', href: 'home.html', icon: '🏠', label: 'Home' },
    { id: 'report', href: 'report.html', icon: '📝', label: 'Report' },
    { id: 'route', href: 'route.html', icon: '🧭', label: 'Routes' },
    { id: 'family', href: 'family.html', icon: '👨‍👩‍👧', label: 'Family' },
  ];
  return `<nav class="bottom-nav" aria-label="Main navigation">
    ${items
      .map(
        (i) =>
          `<a href="${i.href}" class="bottom-nav__item${active === i.id ? ' bottom-nav__item--active' : ''}">
        <span style="font-size:18px;">${i.icon}</span><span>${i.label}</span>
      </a>`
      )
      .join('')}
  </nav>`;
}

function injectBottomNav(active) {
  document.body.classList.add('app-shell');
  const existing = document.querySelector('.bottom-nav');
  if (existing) existing.remove();
  document.body.insertAdjacentHTML('beforeend', renderBottomNav(active));
}

// Resilient API Fetcher with Client-Side Fallback
async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      if (path === '/api/family' && (options.method || 'GET').toUpperCase() === 'GET' && (!data || !data.family)) {
        // Fall through to check local/Firestore family store
      } else {
        return data;
      }
    }
  } catch (err) {
    // Network or server error -> use fallback below
  }

  // Fallback Mock Logic when backend database is not running
  const method = (options.method || 'GET').toUpperCase();
  const body = options.body ? JSON.parse(options.body) : {};

  // Registered Users Store (Demo accounts + Newly Registered residents)
  const DEFAULT_REGISTERED_USERS = [
    { id: 1, name: 'BDRRMC Admin Lead', email: 'admin@geosafe.local', password: 'admin123', role: 'admin', phone: '0917-111-2222', address: 'BDRRMC Command Center, Bayanan' },
    { id: 2, name: 'Responder Unit 1 (Ambulance)', email: 'responder@geosafe.local', password: 'responder123', role: 'responder', phone: '0918-333-4444', address: 'Bayanan Health Station' },
    { id: 3, name: 'Rescue Boat Unit 3', email: 'boat@geosafe.local', password: 'responder123', role: 'responder', phone: '0919-555-6666', address: 'Lakeshore Evacuation Post' },
    { id: 4, name: 'Juan Dela Cruz', email: 'resident@geosafe.local', password: 'resident123', role: 'resident', phone: '0917-889-2345', address: 'Purok 3, Barangay Bayanan', family_id: 'default_circle', is_family_head: true, family_relationship: 'Head' }
  ];

  // Auth: Login with Firestore Cloud Database Verification
  if (path === '/api/login' && method === 'POST') {
    const email = (body.email || '').trim().toLowerCase();
    const password = body.password || '';

    if (!email) {
      throw new Error('Please enter your email address.');
    }
    if (!password) {
      throw new Error('Please enter your password.');
    }

    // 1. Try Firebase Firestore Cloud Login
    if (window.GeoSafeDB) {
      try {
        const cloudUser = await window.GeoSafeDB.loginUser(email, password);
        if (cloudUser) {
          return { message: 'Login successful', token: 'jwt-cloud-' + Date.now(), user: cloudUser };
        }
      } catch (err) {
        throw err; // Password mismatch or Firestore error
      }
    }

    // 2. Fallback to Local / Demo Accounts
    const registeredUsers = getLocalStore('registered_users', DEFAULT_REGISTERED_USERS);
    const user = registeredUsers.find((u) => u.email.toLowerCase() === email);

    if (!user) {
      throw new Error('Account not found. Please create an account first.');
    }

    if (user.password && user.password !== password) {
      throw new Error('Incorrect password. Please verify and try again.');
    }

    const { password: _, ...cleanUser } = user;
    return { message: 'Login successful', token: 'jwt-token-' + Date.now(), user: cleanUser };
  }

  // Auth: Register with Firestore Cloud Sync
  if (path === '/api/register' && method === 'POST') {
    const email = (body.email || '').trim().toLowerCase();
    const password = body.password || '';
    const name = (body.name || '').trim();

    if (!name || name.length < 2) {
      throw new Error('Please enter your full name (minimum 2 characters).');
    }
    if (!email || !email.includes('@')) {
      throw new Error('Please enter a valid email address.');
    }
    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters.');
    }

    const registeredUsers = getLocalStore('registered_users', DEFAULT_REGISTERED_USERS);
    if (registeredUsers.some((u) => u.email.toLowerCase() === email)) {
      throw new Error('This email is already registered. Please sign in instead.');
    }

    const newUser = {
      id: Date.now(),
      name: name,
      email: email,
      password: password,
      role: 'resident',
      phone: '0917-000-0000',
      address: 'Barangay Bayanan, Muntinlupa',
      family_id: null,
      is_family_head: false,
      family_relationship: null,
      created_at: new Date().toISOString()
    };

    // Save locally
    registeredUsers.push(newUser);
    setLocalStore('registered_users', registeredUsers);

    // Save to Firebase Firestore Cloud Database
    if (window.GeoSafeDB) {
      try {
        await window.GeoSafeDB.registerUser(newUser);
      } catch (err) {
        console.warn('Firestore register note:', err.message);
      }
    }

    const { password: _, ...cleanUser } = newUser;
    return { message: 'Registration successful', token: 'jwt-token-' + Date.now(), user: cleanUser };
  }

  // Reports: Get (Merged Firestore + Cloud Relay)
  if (path === '/api/reports' && method === 'GET') {
    let reports = getLocalStore('reports', DEFAULT_REPORTS);

    // Fetch from Firebase Firestore
    if (window.GeoSafeDB) {
      try {
        const fsReports = await window.GeoSafeDB.getReports();
        if (fsReports && fsReports.length) {
          fsReports.forEach((fr) => {
            const numId = Number(fr.id) || fr.id;
            if (!reports.some((r) => r.id == numId)) {
              reports.unshift({ ...fr, id: numId });
            }
          });
          setLocalStore('reports', reports);
        }
      } catch (e) {}
    }

    // Fetch from Cloud SSE Relay
    try {
      const cloudRes = await fetch('https://ntfy.sh/geosafe_bayanan_reports_2026/json?poll=1&since=24h');
      if (cloudRes.ok) {
        const text = await cloudRes.text();
        const lines = text.trim().split('\n');
        lines.forEach((line) => {
          try {
            const parsed = JSON.parse(line);
            if (parsed.message) {
              const rData = JSON.parse(parsed.message);
              if (rData && rData.id && !reports.some((x) => x.id === rData.id)) {
                reports.unshift(rData);
              }
            }
          } catch (e) {}
        });
        setLocalStore('reports', reports);
      }
    } catch (e) {}
    return { reports };
  }

  // Reports: Create (Saves to Firestore + Broadcasts to Cloud)
  if (path === '/api/reports' && method === 'POST') {
    const reports = getLocalStore('reports', DEFAULT_REPORTS);
    const user = getUser() || { id: 3, name: 'Resident' };
    const newReport = {
      id: Date.now(),
      user_id: user.id,
      reporter_name: user.name,
      incident_type: body.incident_type || 'Flood',
      description: body.description || 'Emergency Incident',
      latitude: parseFloat(body.latitude) || 14.4106,
      longitude: parseFloat(body.longitude) || 121.0502,
      severity: body.incident_type === 'SOS' ? 'high' : (body.severity || 'medium'),
      status: 'pending',
      assigned_to: null,
      responder_name: null,
      created_at: new Date().toISOString()
    };
    reports.unshift(newReport);
    setLocalStore('reports', reports);

    // Save to Firebase Firestore Cloud Database
    if (window.GeoSafeDB) {
      window.GeoSafeDB.createReport(newReport).catch(() => {});
    }

    // Broadcast to Cloud across all mobile & desktop devices
    try {
      fetch('https://ntfy.sh/geosafe_bayanan_reports_2026', {
        method: 'POST',
        body: JSON.stringify(newReport),
        headers: { 'Title': `🚨 ${newReport.incident_type} Reported`, 'Priority': 'high' }
      }).catch(() => {});
    } catch (e) {}

    if (typeof BroadcastChannel !== 'undefined') {
      try {
        const bc = new BroadcastChannel('geosafe_channel');
        bc.postMessage({ type: 'new-report', report: newReport });
        bc.close();
      } catch (e) {}
    }

    return { message: 'Report submitted', report: newReport };
  }

  // Reports: Status Update (Firestore + Local)
  if (path.startsWith('/api/reports/') && path.endsWith('/status') && method === 'PUT') {
    const id = parseInt(path.split('/')[3], 10);
    const reports = getLocalStore('reports', DEFAULT_REPORTS);
    const report = reports.find(r => r.id === id);
    if (report) {
      if (body.status) report.status = body.status;
      if (body.severity) report.severity = body.severity;
      if (body.assigned_to !== undefined) {
        report.assigned_to = body.assigned_to;
        report.responder_name = body.assigned_to ? 'Responder Unit 1 (Ambulance)' : null;
      }
      setLocalStore('reports', reports);

      if (window.GeoSafeDB) {
        window.GeoSafeDB.updateReport(id, report).catch(() => {});
      }

      try {
        fetch('https://ntfy.sh/geosafe_bayanan_reports_2026', {
          method: 'POST',
          body: JSON.stringify(report),
          headers: { 'Title': `Status Updated: #${report.id}` }
        }).catch(() => {});
      } catch (e) {}

      if (typeof BroadcastChannel !== 'undefined') {
        try {
          const bc = new BroadcastChannel('geosafe_channel');
          bc.postMessage({ type: 'status-update', report });
          bc.close();
        } catch (e) {}
      }

      return { message: 'Report updated', report };
    }
    return { message: 'Report updated', report: { id, ...body } };
  }

  // Alerts: Get (Merged Firestore + Cloud Relay)
  if (path === '/api/alerts' && method === 'GET') {
    let alerts = getLocalStore('alerts', DEFAULT_ALERTS);

    // Fetch from Firebase Firestore
    if (window.GeoSafeDB) {
      try {
        const fsAlerts = await window.GeoSafeDB.getAlerts();
        if (fsAlerts && fsAlerts.length) {
          fsAlerts.forEach((fa) => {
            const numId = Number(fa.id) || fa.id;
            if (!alerts.some((a) => a.id == numId || a.message === fa.message)) {
              alerts.unshift({ ...fa, id: numId });
            }
          });
          setLocalStore('alerts', alerts);
        }
      } catch (e) {}
    }

    try {
      const cloudRes = await fetch('https://ntfy.sh/geosafe_bayanan_alerts_2026/json?poll=1&since=24h');
      if (cloudRes.ok) {
        const text = await cloudRes.text();
        const lines = text.trim().split('\n');
        lines.forEach((line) => {
          try {
            const parsed = JSON.parse(line);
            if (parsed.message) {
              const aData = JSON.parse(parsed.message);
              if (aData && aData.message && !alerts.some((x) => x.id === aData.id || x.message === aData.message)) {
                alerts.unshift(aData);
              }
            }
          } catch (e) {}
        });
        setLocalStore('alerts', alerts);
      }
    } catch (e) {}
    return { alerts };
  }

  // Alerts: Broadcast (Saves to Firestore + Pushes across all devices)
  if (path === '/api/alerts' && method === 'POST') {
    const alerts = getLocalStore('alerts', DEFAULT_ALERTS);
    const newAlert = {
      id: Date.now(),
      message: body.message,
      severity: body.severity || 'high',
      created_by: 1,
      created_by_name: 'BDRRMC Admin Lead',
      created_at: new Date().toISOString()
    };
    alerts.unshift(newAlert);
    setLocalStore('alerts', alerts);

    // Save to Firebase Firestore Cloud Database
    if (window.GeoSafeDB) {
      window.GeoSafeDB.createAlert(newAlert).catch(() => {});
    }

    // Push to Cloud Relay so it lands on all mobile phones & PCs
    try {
      fetch('https://ntfy.sh/geosafe_bayanan_alerts_2026', {
        method: 'POST',
        body: JSON.stringify(newAlert),
        headers: {
          'Title': '🚨 BDRRMC Emergency Broadcast',
          'Priority': 'urgent',
          'Tags': 'warning,rotating_light'
        }
      }).catch(() => {});
    } catch (e) {}

    if (typeof BroadcastChannel !== 'undefined') {
      try {
        const bc = new BroadcastChannel('geosafe_channel');
        bc.postMessage({ type: 'new-alert', alert: newAlert });
        bc.close();
      } catch (e) {}
    }

    return { message: 'Alert broadcasted', alert: newAlert };
  }

  // Users: Get
  if (path === '/api/users' && method === 'GET') {
    return { users: DEFAULT_USERS };
  }

  // Default Families Collection (Indexed by family_id)
  const DEFAULT_FAMILIES = {
    'default_circle': {
      id: 'default_circle',
      name: 'Dela Cruz Family Circle',
      description: 'Purok 3, Barangay Bayanan',
      invite_code: 'BAYANAN8',
      head_user_id: 4,
      members: [
        {
          id: 4,
          name: 'Juan Dela Cruz',
          email: 'resident@geosafe.local',
          relationship: 'Head',
          safety_status: 'safe',
          is_family_head: true,
          battery_level: 85,
          phone: '0917-889-2345',
          last_latitude: 14.4106,
          last_longitude: 121.0502,
          last_location_name: 'Near Bayanan Covered Court',
          last_location_at: new Date().toISOString()
        },
        {
          id: 5,
          name: 'Maria Dela Cruz',
          email: 'maria@geosafe.local',
          relationship: 'Spouse',
          safety_status: 'safe',
          is_family_head: false,
          battery_level: 64,
          phone: '0918-765-4321',
          last_latitude: 14.4095,
          last_longitude: 121.0486,
          last_location_name: 'At Baywalk Lakeshore Court',
          last_location_at: new Date(Date.now() - 4 * 60000).toISOString()
        },
        {
          id: 6,
          name: 'Leo Dela Cruz',
          email: 'leo@geosafe.local',
          relationship: 'Son (Student)',
          safety_status: 'safe',
          is_family_head: false,
          battery_level: 42,
          phone: '0919-456-7890',
          last_latitude: 14.4118,
          last_longitude: 121.0517,
          last_location_name: 'Bayanan Elementary School Unit 1',
          last_location_at: new Date(Date.now() - 10 * 60000).toISOString()
        }
      ]
    }
  };

  function getFamiliesStore() {
    const stored = getLocalStore('families', {});
    return { ...DEFAULT_FAMILIES, ...stored };
  }

  function setFamiliesStore(data) {
    setLocalStore('families', data);
  }

  function generateInviteCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  // Family: Get Current User's Family Group
  if (path === '/api/family' && method === 'GET') {
    const user = getUser();
    if (!user) return { family: null, members: [], is_head: false };

    // For Juan Dela Cruz (demo account), default to default_circle if not explicitly set
    let famId = user.family_id;
    if (!famId && (user.id === 4 || user.email === 'resident@geosafe.local')) {
      famId = 'default_circle';
      user.family_id = famId;
      setAuth(getToken() || 'demo-token', user);
    }

    if (!famId) {
      return { family: null, members: [], is_head: false };
    }

    const families = getFamiliesStore();
    let family = families[famId];

    // Try fetching from Firestore Cloud Database
    if (window.GeoSafeDB) {
      try {
        const cloudFam = await window.GeoSafeDB.getFamily(famId);
        if (cloudFam && cloudFam.members) {
          family = cloudFam;
          families[famId] = cloudFam;
          setFamiliesStore(families);
        }
      } catch (e) {}
    }

    if (!family) {
      return { family: null, members: [], is_head: false };
    }

    const isHead = family.head_user_id === user.id || !!family.members?.find(m => m.id === user.id)?.is_family_head;
    return { family, members: family.members || [], is_head: isHead };
  }

  // Family: Create New Family Circle
  if (path === '/api/family' && method === 'POST') {
    const user = getUser();
    if (!user) throw new Error('Please sign in first.');

    const name = (body.name || '').trim();
    if (!name || name.length < 2) {
      throw new Error('Please enter a valid family circle name (min 2 characters).');
    }

    const circleId = 'circle_' + Date.now();
    const inviteCode = generateInviteCode();
    const newCircle = {
      id: circleId,
      name: name,
      description: (body.description || '').trim() || 'Barangay Bayanan Circle',
      invite_code: inviteCode,
      head_user_id: user.id,
      created_at: new Date().toISOString(),
      members: [
        {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone || '0917-000-0000',
          relationship: 'Head',
          safety_status: 'safe',
          is_family_head: true,
          battery_level: 85,
          last_latitude: 14.4106,
          last_longitude: 121.0502,
          last_location_name: 'Near Bayanan Covered Court',
          last_location_at: new Date().toISOString()
        }
      ]
    };

    const families = getFamiliesStore();
    families[circleId] = newCircle;
    setFamiliesStore(families);

    // Save to Firebase Firestore Cloud
    if (window.GeoSafeDB) {
      try {
        await window.GeoSafeDB.saveFamily(circleId, newCircle);
        await window.GeoSafeDB.updateUserFamily(user.email, circleId, true, 'Head');
      } catch (e) {}
    }

    // Update current session user
    user.family_id = circleId;
    user.is_family_head = true;
    user.family_relationship = 'Head';
    setAuth(getToken() || 'demo-token', user);

    const regUsers = getLocalStore('registered_users', DEFAULT_REGISTERED_USERS);
    const ruIdx = regUsers.findIndex(u => u.email.toLowerCase() === user.email.toLowerCase());
    if (ruIdx >= 0) {
      regUsers[ruIdx].family_id = circleId;
      regUsers[ruIdx].is_family_head = true;
      regUsers[ruIdx].family_relationship = 'Head';
      setLocalStore('registered_users', regUsers);
    }

    return { message: 'Family group created', family: newCircle, members: newCircle.members, is_head: true };
  }

  // Family: Join Family Circle with Invite Code
  if (path === '/api/family/join' && method === 'POST') {
    const user = getUser();
    if (!user) throw new Error('Please sign in first.');

    const inviteCode = (body.invite_code || '').trim().toUpperCase();
    if (!inviteCode || inviteCode.length < 4) {
      throw new Error('Please enter a valid invite code (e.g. BAYANAN8).');
    }

    const families = getFamiliesStore();
    let foundId = null;
    let foundCircle = null;

    // Search in local store
    for (const [id, f] of Object.entries(families)) {
      if (f.invite_code && f.invite_code.toUpperCase() === inviteCode) {
        foundId = id;
        foundCircle = f;
        break;
      }
    }

    // Search in Firestore Cloud
    if (window.GeoSafeDB) {
      try {
        const cloudCircle = await window.GeoSafeDB.findFamilyByInviteCode(inviteCode);
        if (cloudCircle) {
          foundId = cloudCircle.id;
          foundCircle = cloudCircle;
          families[foundId] = cloudCircle;
        }
      } catch (e) {}
    }

    if (!foundCircle) {
      throw new Error('Invalid invite code. No family circle found with code: ' + inviteCode);
    }

    if (!foundCircle.members) foundCircle.members = [];
    const rel = (body.relationship || 'Member').trim();

    const existingIdx = foundCircle.members.findIndex(m => m.id === user.id || (m.email && m.email.toLowerCase() === user.email.toLowerCase()));
    const memberObj = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone || '0917-000-0000',
      relationship: rel,
      safety_status: 'safe',
      is_family_head: false,
      battery_level: 85,
      last_latitude: 14.4106 + (Math.random() - 0.5) * 0.003,
      last_longitude: 121.0502 + (Math.random() - 0.5) * 0.003,
      last_location_name: 'Purok 3, Barangay Bayanan',
      last_location_at: new Date().toISOString()
    };

    if (existingIdx >= 0) {
      foundCircle.members[existingIdx] = { ...foundCircle.members[existingIdx], ...memberObj };
    } else {
      foundCircle.members.push(memberObj);
    }

    families[foundId] = foundCircle;
    setFamiliesStore(families);

    if (window.GeoSafeDB) {
      try {
        await window.GeoSafeDB.saveFamily(foundId, foundCircle);
        await window.GeoSafeDB.updateUserFamily(user.email, foundId, false, rel);
      } catch (e) {}
    }

    user.family_id = foundId;
    user.is_family_head = false;
    user.family_relationship = rel;
    setAuth(getToken() || 'demo-token', user);

    const regUsers = getLocalStore('registered_users', DEFAULT_REGISTERED_USERS);
    const ruIdx = regUsers.findIndex(u => u.email.toLowerCase() === user.email.toLowerCase());
    if (ruIdx >= 0) {
      regUsers[ruIdx].family_id = foundId;
      regUsers[ruIdx].is_family_head = false;
      regUsers[ruIdx].family_relationship = rel;
      setLocalStore('registered_users', regUsers);
    }

    return { message: 'Joined family group', family: foundCircle, members: foundCircle.members, is_head: false };
  }

  // Family: Leave Current Family Circle
  if (path === '/api/family/leave' && method === 'POST') {
    const user = getUser();
    if (!user) throw new Error('Please sign in first.');

    const famId = user.family_id;
    if (famId) {
      const families = getFamiliesStore();
      const circle = families[famId];
      if (circle && circle.members) {
        circle.members = circle.members.filter(m => m.id !== user.id && m.email?.toLowerCase() !== user.email?.toLowerCase());
        if (circle.members.length === 0) {
          delete families[famId];
          if (window.GeoSafeDB) window.GeoSafeDB.deleteFamily(famId);
        } else {
          if (circle.head_user_id === user.id) {
            circle.head_user_id = circle.members[0].id;
            circle.members[0].is_family_head = true;
            circle.members[0].relationship = 'Head';
          }
          families[famId] = circle;
          if (window.GeoSafeDB) window.GeoSafeDB.saveFamily(famId, circle);
        }
        setFamiliesStore(families);
      }
      if (window.GeoSafeDB) {
        window.GeoSafeDB.updateUserFamily(user.email, null, false, null);
      }
    }

    user.family_id = null;
    user.is_family_head = false;
    user.family_relationship = null;
    setAuth(getToken() || 'demo-token', user);

    const regUsers = getLocalStore('registered_users', DEFAULT_REGISTERED_USERS);
    const ruIdx = regUsers.findIndex(u => u.email.toLowerCase() === user.email.toLowerCase());
    if (ruIdx >= 0) {
      regUsers[ruIdx].family_id = null;
      regUsers[ruIdx].is_family_head = false;
      regUsers[ruIdx].family_relationship = null;
      setLocalStore('registered_users', regUsers);
    }

    return { message: 'Left family group' };
  }

  // Family: Add Member Directly to Circle
  if (path === '/api/family/members' && method === 'POST') {
    const user = getUser();
    if (!user || !user.family_id) throw new Error('You must belong to a family circle to add members.');

    const families = getFamiliesStore();
    const circle = families[user.family_id];
    if (!circle) throw new Error('Family circle not found.');

    const name = (body.name || '').trim();
    if (!name) throw new Error('Please enter member name.');

    const newMem = {
      id: Date.now(),
      name: name,
      relationship: body.relationship || 'Household Member',
      phone: body.phone || '0917-000-0000',
      safety_status: 'safe',
      is_family_head: false,
      battery_level: body.battery_level || 90,
      last_latitude: body.latitude || (14.4106 + (Math.random() - 0.5) * 0.003),
      last_longitude: body.longitude || (121.0502 + (Math.random() - 0.5) * 0.003),
      last_location_name: body.location_name || 'Purok 3, Barangay Bayanan',
      last_location_at: new Date().toISOString()
    };

    if (!circle.members) circle.members = [];
    circle.members.push(newMem);
    families[user.family_id] = circle;
    setFamiliesStore(families);

    if (window.GeoSafeDB) {
      window.GeoSafeDB.saveFamily(user.family_id, circle);
    }

    return { message: 'Member added', member: newMem, family: circle, members: circle.members };
  }

  // Family: Remove Member from Circle
  if (path.startsWith('/api/family/members/') && method === 'DELETE') {
    const user = getUser();
    if (!user || !user.family_id) throw new Error('Unauthorized');

    const memberId = Number(path.split('/')[4]);
    const families = getFamiliesStore();
    const circle = families[user.family_id];
    if (circle && circle.members) {
      circle.members = circle.members.filter(m => m.id !== memberId);
      families[user.family_id] = circle;
      setFamiliesStore(families);
      if (window.GeoSafeDB) {
        window.GeoSafeDB.saveFamily(user.family_id, circle);
      }
    }
    return { message: 'Member removed', family: circle, members: circle?.members || [] };
  }

  // Family: Update My Live Status / Location / Battery
  if (path === '/api/family/me' && method === 'PUT') {
    const user = getUser();
    if (!user || !user.family_id) return { status: 'no_family' };

    const families = getFamiliesStore();
    const circle = families[user.family_id];
    if (circle && circle.members) {
      let me = circle.members.find(m => m.id === user.id || (m.email && m.email.toLowerCase() === user.email.toLowerCase()));
      if (!me) {
        me = { id: user.id, name: user.name, email: user.email, relationship: 'Head', safety_status: 'safe', is_family_head: true, battery_level: 85 };
        circle.members.push(me);
      }
      if (body.safety_status) me.safety_status = body.safety_status;
      if (body.relationship) me.relationship = body.relationship;
      if (body.battery_level !== undefined) me.battery_level = body.battery_level;
      if (body.latitude && body.longitude) {
        me.last_latitude = body.latitude;
        me.last_longitude = body.longitude;
        me.last_location_name = body.location_name || 'Live GPS Updated · Bayanan';
        me.last_location_at = new Date().toISOString();
      }
      families[user.family_id] = circle;
      setFamiliesStore(families);
      if (window.GeoSafeDB) {
        window.GeoSafeDB.saveFamily(user.family_id, circle);
      }
      return { message: 'Family status updated', family: circle, members: circle.members };
    }
    return { status: 'ok' };
  }

  return { status: 'ok' };
}

function initSocket(onEvents = {}) {
  if (typeof io === 'undefined') return;
  if (socket) socket.disconnect();

  try {
    socket = io(API_BASE, { transports: ['websocket', 'polling'], timeout: 3000 });
    const user = getUser();
    if (user) socket.emit('join-role', user.role);

    if (onEvents['new-report']) socket.on('new-report', onEvents['new-report']);
    if (onEvents['alert-broadcast']) socket.on('alert-broadcast', onEvents['alert-broadcast']);
    if (onEvents['status-update']) socket.on('status-update', onEvents['status-update']);
  } catch {}

  return socket;
}

function severityBadge(severity) {
  const s = (severity || 'medium').toLowerCase();
  return `<span class="ui-badge ui-badge--${['high', 'medium', 'low'].includes(s) ? s : 'medium'}">${escapeHtml(s)}</span>`;
}

function safetyStatusBadge(status) {
  const map = {
    safe: { label: 'Safe' },
    need_help: { label: 'Need Help' },
    injured: { label: 'Injured' },
    no_response: { label: 'No Response' },
  };
  const s = map[status] || map.no_response;
  const value = map[status] ? status : 'no_response';
  return `<span class="ui-badge ui-badge--safety-${value}">${s.label}</span>`;
}

function safetyStatusCardClass(status) {
  const value = ['safe', 'need_help', 'injured', 'no_response'].includes(status) ? status : 'no_response';
  return `safety-card--${value}`;
}

function statusBadge(status) {
  const label = (status || 'pending').replace('_', ' ');
  const value = ['pending', 'verified', 'responding', 'on_site', 'resolved'].includes(status) ? status : 'pending';
  return `<span class="ui-badge ui-badge--status-${value}">${escapeHtml(label)}</span>`;
}

function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const el = document.createElement('div');
  el.className = `toast toast--${['info', 'success', 'warning', 'danger'].includes(type) ? type : 'info'}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), 4500);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function formatDate(d) {
  if (!d) return 'Just now';
  return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ', ' + new Date(d).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function logout() {
  clearAuth();
  if (socket) socket.disconnect();
  window.location.href = 'index.html';
}

function getGeolocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported by this device'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      (err) => {
        const hints = {
          1: 'Location blocked — please allow location permissions.',
          2: 'Position unavailable — ensure device GPS is turned on.',
          3: 'Location timed out — using default coordinates.',
        };
        reject(new Error(hints[err.code] || err.message || 'Unable to acquire location'));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

function setLocationOnForm(lat, lng, statusEl, mapContainerId) {
  const latEl = document.getElementById('latitude') || document.getElementById('report-lat');
  const lngEl = document.getElementById('longitude') || document.getElementById('report-lng');
  if (latEl) latEl.value = Number(lat).toFixed(6);
  if (lngEl) lngEl.value = Number(lng).toFixed(6);

  if (statusEl) {
    statusEl.textContent = `📍 ${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)} (Active)`;
    statusEl.style.color = 'var(--success)';
  }
  if (mapContainerId && typeof L !== 'undefined') {
    const mapEl = document.getElementById(mapContainerId);
    if (!mapEl) return;
    mapEl.style.display = 'block';
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    if (!mapEl._leafletMap) {
      mapEl._leafletMap = L.map(mapContainerId).setView([latNum, lngNum], 16);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
      }).addTo(mapEl._leafletMap);
    } else {
      mapEl._leafletMap.setView([latNum, lngNum], 16);
    }
    if (mapEl._leafletMarker) mapEl._leafletMarker.remove();
    mapEl._leafletMarker = L.marker([latNum, lngNum]).addTo(mapEl._leafletMap).bindPopup('Captured Incident GPS').openPopup();
  }
}

// PWA Install Prompt Listener
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const pwaBtn = document.getElementById('pwa-install-banner');
  if (pwaBtn) pwaBtn.style.display = 'flex';
});

function triggerPwaInstall() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        showToast('🎉 GeoSafe App installed on your device!', 'success');
      }
      deferredPrompt = null;
      const pwaBtn = document.getElementById('pwa-install-banner');
      if (pwaBtn) pwaBtn.style.display = 'none';
    });
  } else {
    showToast('To install: Tap browser menu (⋮ or Share) ➔ "Add to Home Screen"');
  }
}

// Resident Profile Modal & Info Editor
function openProfileModal() {
  const user = getUser() || { name: 'Juan Dela Cruz', email: 'resident@geosafe.local', role: 'resident' };
  let modal = document.getElementById('profile-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'profile-modal';
    modal.className = 'profile-modal-backdrop';
    document.body.appendChild(modal);
  }

  const initials = (user.name || 'Resident')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  modal.innerHTML = `
    <div class="profile-modal-card">
      <div class="profile-modal-header">
        <div style="display:flex; align-items:center; gap:12px;">
          <div class="profile-avatar-large">${escapeHtml(initials || 'JD')}</div>
          <div>
            <h3 style="margin:0; font-size:16px; font-weight:800;" id="prof-display-name">${escapeHtml(user.name || 'Resident User')}</h3>
            <span class="ui-badge ui-badge--low" style="font-size:11px; margin-top:2px;">Barangay Bayanan Resident</span>
          </div>
        </div>
        <button type="button" class="profile-modal-close" onclick="closeProfileModal()">&times;</button>
      </div>

      <form id="profile-edit-form" onsubmit="saveProfileChanges(event)">
        <div style="margin-bottom:12px;">
          <label style="display:block; font-size:12px; font-weight:700; margin-bottom:4px;">Full Name</label>
          <input type="text" id="prof-name" class="ui-input" value="${escapeHtml(user.name || '')}" required />
        </div>

        <div style="margin-bottom:12px;">
          <label style="display:block; font-size:12px; font-weight:700; margin-bottom:4px;">Email Address</label>
          <input type="email" id="prof-email" class="ui-input" value="${escapeHtml(user.email || '')}" required />
        </div>

        <div style="margin-bottom:12px;">
          <label style="display:block; font-size:12px; font-weight:700; margin-bottom:4px;">Mobile Contact Number</label>
          <input type="tel" id="prof-phone" class="ui-input" placeholder="0917 123 4567" value="${escapeHtml(user.phone || '0917-889-2345')}" />
        </div>

        <div style="margin-bottom:12px;">
          <label style="display:block; font-size:12px; font-weight:700; margin-bottom:4px;">Purok / Street Address</label>
          <input type="text" id="prof-address" class="ui-input" placeholder="e.g. Purok 3, Ilaya St., Bayanan" value="${escapeHtml(user.address || 'Purok 3, Barangay Bayanan, Muntinlupa')}" />
        </div>

        <div style="margin-bottom:12px;">
          <label style="display:block; font-size:12px; font-weight:700; margin-bottom:4px;">Emergency Contact Person & Phone</label>
          <input type="text" id="prof-emergency" class="ui-input" placeholder="e.g. Maria Santos (0918-765-4321)" value="${escapeHtml(user.emergency_contact || 'Maria Santos (0918-765-4321)')}" />
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:16px;">
          <div>
            <label style="display:block; font-size:12px; font-weight:700; margin-bottom:4px;">Vulnerability</label>
            <select id="prof-vulnerability" class="ui-input">
              <option value="None" ${user.vulnerability === 'None' ? 'selected' : ''}>None (Able)</option>
              <option value="Senior Citizen" ${user.vulnerability === 'Senior Citizen' ? 'selected' : ''}>Senior (60+)</option>
              <option value="PWD" ${user.vulnerability === 'PWD' ? 'selected' : ''}>PWD</option>
              <option value="Pregnant / Infant" ${user.vulnerability === 'Pregnant / Infant' ? 'selected' : ''}>Pregnant/Child</option>
              <option value="Medical Condition" ${user.vulnerability === 'Medical Condition' ? 'selected' : ''}>Medical/Oxygen</option>
            </select>
          </div>

          <div>
            <label style="display:block; font-size:12px; font-weight:700; margin-bottom:4px;">Blood Type</label>
            <select id="prof-blood" class="ui-input">
              <option value="O+" ${user.blood_type === 'O+' ? 'selected' : ''}>O+</option>
              <option value="O-" ${user.blood_type === 'O-' ? 'selected' : ''}>O-</option>
              <option value="A+" ${user.blood_type === 'A+' ? 'selected' : ''}>A+</option>
              <option value="A-" ${user.blood_type === 'A-' ? 'selected' : ''}>A-</option>
              <option value="B+" ${user.blood_type === 'B+' ? 'selected' : ''}>B+</option>
              <option value="B-" ${user.blood_type === 'B-' ? 'selected' : ''}>B-</option>
              <option value="AB+" ${user.blood_type === 'AB+' ? 'selected' : ''}>AB+</option>
              <option value="Unknown" ${!user.blood_type || user.blood_type === 'Unknown' ? 'selected' : ''}>Unknown</option>
            </select>
          </div>
        </div>

        <button type="submit" class="ui-btn ui-btn-primary" style="margin-bottom:8px;">
          💾 Save Profile Changes
        </button>
        <button type="button" class="ui-btn ui-btn-secondary" onclick="logout()" style="color:var(--emergency);">
          🚪 Log Out
        </button>
      </form>
    </div>
  `;

  modal.classList.add('profile-modal--open');
}

function closeProfileModal() {
  const modal = document.getElementById('profile-modal');
  if (modal) modal.classList.remove('profile-modal--open');
}

function saveProfileChanges(e) {
  e.preventDefault();
  const user = getUser() || {};
  user.name = document.getElementById('prof-name').value.trim();
  user.email = document.getElementById('prof-email').value.trim();
  user.phone = document.getElementById('prof-phone').value.trim();
  user.address = document.getElementById('prof-address').value.trim();
  user.emergency_contact = document.getElementById('prof-emergency').value.trim();
  user.vulnerability = document.getElementById('prof-vulnerability').value;
  user.blood_type = document.getElementById('prof-blood').value;

  setAuth(getToken() || 'demo-token', user);

  // Update name and avatar initials on page
  const nameEl = document.getElementById('resident-name');
  if (nameEl) nameEl.textContent = user.name;

  const initials = (user.name || 'Resident')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  document.querySelectorAll('.resident-avatar, #header-avatar').forEach((el) => {
    el.textContent = initials || 'JD';
  });

  closeProfileModal();
  showToast('✅ Profile information updated successfully!', 'success');
}

// Auto sync avatar initials on load
document.addEventListener('DOMContentLoaded', () => {
  const user = getUser();
  if (user && user.name) {
    const initials = user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
    document.querySelectorAll('.resident-avatar, #header-avatar').forEach((el) => {
      el.textContent = initials || 'JD';
    });
  }
});

// Service Worker Registration
const isTunnelHost = /\.(loca\.lt|ngrok|ngrok-free\.app)$/i.test(window.location.hostname);
if ('serviceWorker' in navigator && !isTunnelHost) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

