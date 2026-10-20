/** Only allow redirects back into this app, never to another site. */
export function safeNext(value: string | string[] | undefined, fallback = "/app"): string {
  const next = Array.isArray(value) ? value[0] : value;
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
