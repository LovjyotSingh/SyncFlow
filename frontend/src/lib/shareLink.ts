const SHARE_TOKEN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function tokenFromPath(pathname: string) {
  const parts = pathname.split('/').filter(Boolean).map((part) => {
    try {
      return decodeURIComponent(part);
    } catch {
      return part;
    }
  });
  const index = parts.lastIndexOf('doc');
  const token = index >= 0 ? parts[index + 1] : '';
  return token && SHARE_TOKEN.test(token) ? token : null;
}

export function shareTokenFromInput(raw: string) {
  const value = raw.trim();
  if (!value) return null;
  if (SHARE_TOKEN.test(value)) return value;

  if (/^https?:\/\//i.test(value) || value.startsWith('/')) {
    try {
      const url = value.startsWith('/') ? new URL(value, 'http://syncflow.local') : new URL(value);
      return tokenFromPath(url.pathname);
    } catch {
      return null;
    }
  }

  return tokenFromPath(value.startsWith('doc/') ? `/${value}` : value);
}
