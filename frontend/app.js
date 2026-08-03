const API_BASE = window.location.origin;
let socket = null;

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
    { id: 'route', href: 'route.html', icon: '🧭', label: 'Route' },
    { id: 'family', href: 'family.html', icon: '👨‍👩‍👧', label: 'Family' },
  ];
  return `<nav class="bottom-nav" aria-label="Main navigation">
    ${items
      .map(
        (i) =>
          `<a href="${i.href}" class="bottom-nav__item${active === i.id ? ' bottom-nav__item--active' : ''}">
        <span>${i.icon}</span><span>${i.label}</span>
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

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (res.status === 401) {
    clearAuth();
    window.location.href = 'index.html';
    throw new Error('Session expired');
  }
  if (!res.ok) {
    const msg = data.error || data.errors?.[0]?.msg || 'Request failed';
    throw new Error(msg);
  }
  return data;
}

function initSocket(onEvents = {}) {
  if (typeof io === 'undefined') return;
  if (socket) socket.disconnect();

  socket = io(API_BASE, { transports: ['websocket', 'polling'] });
  const user = getUser();
  if (user) socket.emit('join-role', user.role);

  if (onEvents['new-report']) socket.on('new-report', onEvents['new-report']);
  if (onEvents['alert-broadcast']) socket.on('alert-broadcast', onEvents['alert-broadcast']);
  if (onEvents['status-update']) socket.on('status-update', onEvents['status-update']);

  return socket;
}

function severityBadge(severity) {
  const s = severity || 'medium';
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
  setTimeout(() => el.remove(), 5000);
}

function showAlertBanner(alert) {
  let banner = document.getElementById('alert-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'alert-banner';
    banner.className = 'alert-banner';
    document.body.prepend(banner);
  }
  banner.className = `alert-banner alert-banner--${['high', 'medium', 'low'].includes(alert.severity) ? alert.severity : 'medium'}`;
  banner.innerHTML = `🚨 EMERGENCY ALERT: ${escapeHtml(alert.message)}`;
  banner.classList.remove('hidden');
  setTimeout(() => banner.classList.add('hidden'), 15000);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatDate(d) {
  return new Date(d).toLocaleString();
}

function logout() {
  clearAuth();
  if (socket) socket.disconnect();
  window.location.href = 'index.html';
}

function getGeolocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported by this browser'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      (err) => {
        const hints = {
          1: 'Location blocked — allow location for this site in browser settings.',
          2: 'Position unavailable — turn on Windows Location (Settings → Privacy → Location) or enter coordinates manually.',
          3: 'Location timed out — try again or enter coordinates manually.',
        };
        reject(new Error(hints[err.code] || err.message || 'Unable to get location'));
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  });
}

function setLocationOnForm(lat, lng, statusEl, mapContainerId) {
  document.getElementById('latitude').value = lat;
  document.getElementById('longitude').value = lng;
  if (statusEl) {
    statusEl.textContent = `${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}`;
    statusEl.classList.remove('text-red-400');
    statusEl.classList.add('text-green-400');
  }
  if (mapContainerId && typeof L !== 'undefined') {
    const mapEl = document.getElementById(mapContainerId);
    if (!mapEl) return;
    mapEl.classList.remove('hidden');
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    if (!mapEl._leafletMap) {
      mapEl._leafletMap = L.map(mapContainerId).setView([latNum, lngNum], 15);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
      }).addTo(mapEl._leafletMap);
    } else {
      mapEl._leafletMap.setView([latNum, lngNum], 15);
    }
    if (mapEl._leafletMarker) mapEl._leafletMarker.remove();
    mapEl._leafletMarker = L.marker([latNum, lngNum]).addTo(mapEl._leafletMap);
  }
}

const isTunnelHost = /\.(loca\.lt|ngrok|ngrok-free\.app)$/i.test(window.location.hostname);
if ('serviceWorker' in navigator && !isTunnelHost) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
if (isTunnelHost && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
}
