const TOKEN_KEY = 'geosafe_token';
const USER_KEY = 'geosafe_user';

export type GeosafeUser = {
  id: number;
  name: string;
  email: string;
  role: 'resident' | 'admin' | 'responder';
};

export type AlertRow = {
  id: number;
  message: string;
  severity: 'low' | 'medium' | 'high';
  created_at: string;
  created_by_name?: string;
};

export type ReportRow = {
  id: number;
  incident_type: string;
  description: string;
  status: string;
  severity?: string | null;
  latitude: number;
  longitude: number;
  created_at: string;
  user_id: number;
};

export type FamilyDashboard = {
  family: {
    id: number;
    name: string;
    description?: string | null;
    invite_code: string;
  } | null;
  members: Array<{
    id: number;
    name: string;
    relationship: string;
    safety_status: string;
    is_family_head: boolean;
    last_latitude?: number | null;
    last_longitude?: number | null;
    last_location_at?: string | null;
    battery_level?: number | null;
  }>;
  is_head: boolean;
};

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser(): GeosafeUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as GeosafeUser;
  } catch {
    return null;
  }
}

export function setAuth(token: string, user: GeosafeUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export async function api<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(path, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (res.status === 401) {
    clearAuth();
    throw new Error('Session expired');
  }
  if (!res.ok) {
    const msg =
      (data as { error?: string }).error ||
      (data as { errors?: Array<{ msg: string }> }).errors?.[0]?.msg ||
      'Request failed';
    throw new Error(msg);
  }
  return data as T;
}

export async function login(email: string, password: string) {
  const data = await api<{ token: string; user: GeosafeUser }>('/api/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setAuth(data.token, data.user);
  return data;
}

export async function register(name: string, email: string, password: string) {
  const data = await api<{ token: string; user: GeosafeUser }>('/api/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  });
  setAuth(data.token, data.user);
  return data;
}

export function getGeolocation(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }),
      (err) => reject(new Error(err.message || 'Unable to get location')),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  });
}

export async function submitReport(payload: {
  incident_type: string;
  description: string;
  latitude: number;
  longitude: number;
}) {
  return api<{ message: string; report: ReportRow }>('/api/reports', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getMyReports() {
  return api<{ reports: ReportRow[] }>('/api/reports');
}

export async function getAlerts() {
  return api<{ alerts: AlertRow[] }>('/api/alerts');
}

export async function getFamily() {
  return api<FamilyDashboard>('/api/family');
}

export async function createFamily(name: string, description?: string) {
  return api<FamilyDashboard>('/api/family', {
    method: 'POST',
    body: JSON.stringify({ name, description }),
  });
}

export async function joinFamily(invite_code: string, relationship?: string) {
  return api<FamilyDashboard>('/api/family/join', {
    method: 'POST',
    body: JSON.stringify({ invite_code, relationship }),
  });
}

export async function updateMyFamilyStatus(body: {
  safety_status?: string;
  relationship?: string;
  latitude?: number;
  longitude?: number;
  battery_level?: number;
}) {
  return api<FamilyDashboard>('/api/family/me', {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export function roleHome(role: GeosafeUser['role']): string {
  if (role === 'admin') return '/admin.html';
  if (role === 'responder') return '/responder.html';
  return '';
}

export function formatRelativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs > 1 ? 's' : ''} ago`;
  return new Date(iso).toLocaleString();
}

export function greetingForNow(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning,';
  if (h < 18) return 'Good afternoon,';
  return 'Good evening,';
}
