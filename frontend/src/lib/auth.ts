// Client-side auth utilities

export const BACKEND_URL = (process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000').replace(/\/+$/, '');

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatarColor: string;
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('sf_token');
}

export function setToken(token: string): void {
  localStorage.setItem('sf_token', token);
}

export function clearToken(): void {
  localStorage.removeItem('sf_token');
  localStorage.removeItem('sf_user');
}

export function getUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('sf_user');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function setUser(user: AuthUser): void {
  localStorage.setItem('sf_user', JSON.stringify(user));
}

export function isLoggedIn(): boolean {
  return !!getToken() && !!getUser();
}

async function parseResponseJson(res: Response, fallbackAction = 'Request'): Promise<any> {
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      return await res.json();
    } catch {}
  }
  const text = await res.text().catch(() => '');
  if (text && text.trim().startsWith('{')) {
    try {
      return JSON.parse(text);
    } catch {}
  }
  if (res.status === 502 || res.status === 503 || res.status === 504) {
    throw new Error('Backend server is waking up (Render cold start). Please retry in 20-30 seconds.');
  }
  if (res.status === 404) {
    throw new Error(`API endpoint not found (404). Please verify NEXT_PUBLIC_BACKEND_URL (${BACKEND_URL}).`);
  }
  if (!res.ok) {
    throw new Error(`${fallbackAction} failed (Status ${res.status})`);
  }
  return {};
}

export async function login(email: string, password: string): Promise<AuthUser> {
  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    throw new Error(`Cannot connect to backend (${BACKEND_URL}). Please verify your backend server is live.`);
  }
  const data = await parseResponseJson(res, 'Login');
  if (!res.ok) throw new Error(data.message || 'Login failed');
  setToken(data.token);
  setUser(data.user);
  return data.user;
}

export async function register(name: string, email: string, password: string): Promise<AuthUser> {
  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
  } catch {
    throw new Error(`Cannot connect to backend (${BACKEND_URL}). Please verify your backend server is live.`);
  }
  const data = await parseResponseJson(res, 'Registration');
  if (!res.ok) throw new Error(data.message || 'Registration failed');
  setToken(data.token);
  setUser(data.user);
  return data.user;
}

export function logout(): void {
  clearToken();
  if (typeof window !== 'undefined') window.location.href = '/login';
}
