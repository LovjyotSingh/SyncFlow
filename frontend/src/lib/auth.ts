export const BACKEND_URL = (process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000').replace(/\/+$/, '');

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatarColor: string;
}

const TOKEN_KEY = 'sf_token';
const USER_KEY = 'sf_user';
const EVENT = 'sf-auth';

type Listener = () => void;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((listener) => listener());
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(EVENT));
  }
}

export function subscribeAuth(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

let cachedRaw: string | null | undefined;
let cachedUser: AuthUser | null = null;

export function getUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(USER_KEY);
  if (raw === cachedRaw) return cachedUser;
  cachedRaw = raw;
  if (!raw) {
    cachedUser = null;
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as AuthUser;
    cachedUser = parsed?.id && parsed.email ? parsed : null;
  } catch {
    cachedUser = null;
  }
  return cachedUser;
}

export function getAuthSnapshot(): AuthUser | null {
  return getUser();
}

export function setSession(token: string, user: AuthUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  emit();
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  emit();
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  let response: Response;
  try {
    response = await fetch(`${BACKEND_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers || {}),
      },
    });
  } catch {
    throw new ApiError('Cannot reach SyncFlow. Check that the API is running.', 0);
  }

  const data = await response.json().catch(() => ({} as { message?: string }));
  if (!response.ok) {
    throw new ApiError(data.message || 'Request failed', response.status);
  }
  return data as T;
}

export async function login(email: string, password: string) {
  const data = await api<{ token: string; user: AuthUser }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setSession(data.token, data.user);
  return data.user;
}

export async function register(name: string, email: string, password: string) {
  const data = await api<{ token: string; user: AuthUser }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  });
  setSession(data.token, data.user);
  return data.user;
}

export function logout() {
  clearSession();
}
