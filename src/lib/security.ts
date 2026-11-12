import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import type { Db } from "./db";

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX_BYTES = 72; // bcrypt ignores everything past 72 bytes

/** Returns why a new password isn't acceptable, or null when it is fine. */
export function passwordProblem(password: string, { name = "", email = "" } = {}): string | null {
  if (password.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters for your password.`;
  if (Buffer.byteLength(password, "utf8") > PASSWORD_MAX_BYTES) return "Use at most 72 characters for your password.";
  if (!/\p{L}/u.test(password) || !/\d/.test(password)) return "Use at least one letter and one number in your password.";
  const lower = password.toLowerCase();
  const local = email.split("@")[0] ?? "";
  if (
    (email && lower === email.toLowerCase()) ||
    (name && lower === name.trim().toLowerCase()) ||
    (local.length >= 4 && lower.includes(local.toLowerCase()))
  ) {
    return "Your password can't contain your name or email.";
  }
  return null;
}

// ---------------------------------------------------------------------------
// 6-digit email codes. A code alone is guessable (1 in a million), so each one
// expires quickly and allows only a few wrong attempts. The hash is bound to the
// user and the purpose, so the same digits can't be replayed elsewhere.
// ---------------------------------------------------------------------------

export type CodePurpose = "verify" | "reset";
export const CODE_TTL_MINUTES = 15;
export const CODE_MAX_ATTEMPTS = 5;

function hashCode(purpose: CodePurpose, userId: string, code: string): string {
  return createHash("sha256").update(`syncflow:${purpose}:${userId}:${code}`).digest("hex");
}

/** Accepts "123456", "123 456" or "123-456". */
export function normalizeCode(value: unknown): string | null {
  const digits = typeof value === "string" ? value.replace(/[\s-]/g, "") : "";
  return /^\d{6}$/.test(digits) ? digits : null;
}

/** Creates a new code for this user and purpose, replacing any older one. */
export async function issueCode(db: Db, userId: string, purpose: CodePurpose): Promise<string> {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await db.query(
    `INSERT INTO email_codes (user_id, purpose, code_hash, attempts, expires_at)
     VALUES ($1::uuid, $2::text, $3::text, 0, now() + make_interval(mins => $4::int))
     ON CONFLICT (user_id, purpose) DO UPDATE
       SET code_hash = EXCLUDED.code_hash, attempts = 0, expires_at = EXCLUDED.expires_at, created_at = now()`,
    [userId, purpose, hashCode(purpose, userId, code), CODE_TTL_MINUTES],
  );
  return code;
}

export type CodeResult = "ok" | "wrong" | "expired" | "locked";

/**
 * Checks a code. Each check first uses up an attempt in one atomic UPDATE, so even
 * parallel guesses can never exceed CODE_MAX_ATTEMPTS. A correct code is deleted.
 */
export async function checkCode(db: Db, userId: string, purpose: CodePurpose, code: string): Promise<CodeResult> {
  const claimed = await db.query<{ code_hash: string }>(
    `UPDATE email_codes SET attempts = attempts + 1
      WHERE user_id = $1::uuid AND purpose = $2::text AND expires_at > now() AND attempts < $3::int
      RETURNING code_hash`,
    [userId, purpose, CODE_MAX_ATTEMPTS],
  );
  if (!claimed[0]) {
    const rows = await db.query<{ live: boolean }>(
      "SELECT expires_at > now() AS live FROM email_codes WHERE user_id = $1::uuid AND purpose = $2::text",
      [userId, purpose],
    );
    return rows[0]?.live ? "locked" : "expired";
  }
  const expected = Buffer.from(claimed[0].code_hash, "hex");
  const actual = Buffer.from(hashCode(purpose, userId, code), "hex");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return "wrong";
  await db.query("DELETE FROM email_codes WHERE user_id = $1::uuid AND purpose = $2::text", [userId, purpose]);
  return "ok";
}

// ---------------------------------------------------------------------------
// Rate limits, stored in Postgres so they hold across serverless instances.
// ---------------------------------------------------------------------------

/** The caller's IP. On Vercel, x-real-ip is set by the platform and can't be spoofed. */
export function clientIp(req: Request): string {
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "local";
}

/** Counts one hit against `key`. Returns true while the caller is within `limit` per `windowSeconds`. */
export async function hit(db: Db, key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const rows = await db.query<{ count: number }>(
    `INSERT INTO rate_limits (key, count, reset_at) VALUES ($1::text, 1, now() + make_interval(secs => $2::int))
     ON CONFLICT (key) DO UPDATE SET
       count    = CASE WHEN rate_limits.reset_at <= now() THEN 1 ELSE rate_limits.count + 1 END,
       reset_at = CASE WHEN rate_limits.reset_at <= now() THEN EXCLUDED.reset_at ELSE rate_limits.reset_at END
     RETURNING count`,
    [key, windowSeconds],
  );
  // Now and then, clear out windows that ended long ago so the table stays small.
  if (Math.random() < 0.02) {
    await db.query("DELETE FROM rate_limits WHERE reset_at < now() - interval '1 day'").catch(() => {});
  }
  return Number(rows[0]?.count ?? 0) <= limit;
}
