const API_BASE = window.location.origin;
let socket = null;
let deferredPrompt = null;

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
      return data;
    }
  } catch (err) {
    // Network or server error -> use fallback below
  }

  // Fallback Mock Logic when backend database is not running
  const method = (options.method || 'GET').toUpperCase();
  const body = options.body ? JSON.parse(options.body) : {};

  // Auth: Login
  if (path === '/api/login' && method === 'POST') {
    const email = (body.email || '').toLowerCase();
    let role = 'resident';
    let name = 'Resident User';
    let id = 4;

    if (email.includes('admin')) {
      role = 'admin';
      name = 'BDRRMC Admin Lead';
      id = 1;
    } else if (email.includes('responder') || email.includes('boat')) {
      role = 'responder';
      name = 'Responder Unit 1 (Ambulance)';
      id = 2;
    } else {
      name = email.split('@')[0] || 'Juan Dela Cruz';
    }

    const user = { id, name, email: body.email, role };
    return { message: 'Login successful', token: 'demo-jwt-token-2026', user };
  }

  // Auth: Register
  if (path === '/api/register' && method === 'POST') {
    const user = {
      id: Math.floor(Math.random() * 1000) + 10,
      name: body.name || 'New Resident',
      email: body.email,
      role: 'resident'
    };
    return { message: 'Registration successful', token: 'demo-jwt-token-2026', user };
  }

  // Reports: Get
  if (path === '/api/reports' && method === 'GET') {
    const reports = getLocalStore('reports', DEFAULT_REPORTS);
    return { reports };
  }

  // Reports: Create
  if (path === '/api/reports' && method === 'POST') {
    const reports = getLocalStore('reports', DEFAULT_REPORTS);
    const user = getUser() || { id: 3, name: 'Resident' };
    const newReport = {
      id: reports.length + 101,
      user_id: user.id,
      reporter_name: user.name,
      incident_type: body.incident_type || 'Flood',
      description: body.description || 'Emergency Incident',
      latitude: parseFloat(body.latitude) || 14.3972,
      longitude: parseFloat(body.longitude) || 121.0200,
      severity: body.incident_type === 'SOS' ? 'high' : (body.severity || 'medium'),
      status: 'pending',
      assigned_to: null,
      responder_name: null,
      created_at: new Date().toISOString()
    };
    reports.unshift(newReport);
    setLocalStore('reports', reports);
    return { message: 'Report submitted', report: newReport };
  }

  // Reports: Status Update
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
      return { message: 'Report updated', report };
    }
    return { message: 'Report updated', report: { id, ...body } };
  }

  // Alerts: Get
  if (path === '/api/alerts' && method === 'GET') {
    const alerts = getLocalStore('alerts', DEFAULT_ALERTS);
    return { alerts };
  }

  // Alerts: Broadcast
  if (path === '/api/alerts' && method === 'POST') {
    const alerts = getLocalStore('alerts', DEFAULT_ALERTS);
    const newAlert = {
      id: alerts.length + 1,
      message: body.message,
      severity: body.severity || 'high',
      created_by: 1,
      created_by_name: 'BDRRMC Admin Lead',
      created_at: new Date().toISOString()
    };
    alerts.unshift(newAlert);
    setLocalStore('alerts', alerts);
    return { message: 'Alert broadcasted', alert: newAlert };
  }

  // Users: Get
  if (path === '/api/users' && method === 'GET') {
    return { users: DEFAULT_USERS };
  }

  // Family: Get
  if (path === '/api/family' && method === 'GET') {
    return getLocalStore('family_data', {
      family: {
        id: 1,
        name: 'Dela Cruz Family',
        description: 'Barangay Bayanan Circle',
        invite_code: 'BAYANAN8'
      },
      members: [
        { id: 4, name: 'Juan Dela Cruz', relationship: 'Head', safety_status: 'safe', is_family_head: true, battery_level: 85, last_latitude: 14.3972, last_longitude: 121.0200 },
        { id: 5, name: 'Maria Dela Cruz', relationship: 'Spouse', safety_status: 'safe', is_family_head: false, battery_level: 60, last_latitude: 14.3970, last_longitude: 121.0210 }
      ],
      is_head: true
    });
  }

  // Family: Update
  if (path === '/api/family/me' && method === 'PUT') {
    const current = getLocalStore('family_data', {});
    if (current.members) {
      const me = current.members[0];
      if (body.safety_status) me.safety_status = body.safety_status;
      if (body.relationship) me.relationship = body.relationship;
      if (body.battery_level) me.battery_level = body.battery_level;
      if (body.latitude) { me.last_latitude = body.latitude; me.last_longitude = body.longitude; }
      setLocalStore('family_data', current);
    }
    return current;
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

// Service Worker Registration
const isTunnelHost = /\.(loca\.lt|ngrok|ngrok-free\.app)$/i.test(window.location.hostname);
if ('serviceWorker' in navigator && !isTunnelHost) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
