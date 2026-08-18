// Client-side auth utilities

export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

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

export async function login(email: string, password: string): Promise<AuthUser> {
  const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Login failed');
  setToken(data.token);
  setUser(data.user);
  return data.user;
}

export async function register(name: string, email: string, password: string): Promise<AuthUser> {
  const res = await fetch(`${BACKEND_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Registration failed');
  setToken(data.token);
  setUser(data.user);
  return data.user;
}

export function logout(): void {
  clearToken();
  if (typeof window !== 'undefined') window.location.href = '/login';
}
