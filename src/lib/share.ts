/**
 * Pulls the share token out of whatever someone pastes into Connect:
 * a full link (https://host/join/TOKEN), a path (/join/TOKEN), or the bare token.
 */
export function parseShareToken(input: string): string | null {
  const text = input.trim();
  if (!text) return null;
  const match = text.match(/\/join\/([A-Za-z0-9_-]+)/);
  const token = match ? match[1] : text;
  return /^[A-Za-z0-9_-]{8,64}$/.test(token) ? token : null;
}

export function shareUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, "")}/join/${token}`;
}
