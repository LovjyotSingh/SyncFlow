import { cache } from "react";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "./db";
import { emailEnabled } from "./email";

const SECURE = process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
// The __Host- prefix makes the browser refuse the cookie unless it is Secure, host-only and path=/.
export const SESSION_COOKIE = SECURE ? "__Host-sf_session" : "sf_session";
const SESSION_DAYS = 14;
const JWT = { issuer: "syncflow", audience: "syncflow-web" } as const;
const BCRYPT_ROUNDS = 12;

export type SessionUser = { id: string; name: string; email: string; emailVerified: boolean };
type TokenUser = { id: string; tokenVersion: number };

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (secret && secret.length >= 32) return new TextEncoder().encode(secret);
  if (process.env.VERCEL || process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET is missing or too short (it needs at least 32 characters).");
  }
  return new TextEncoder().encode("syncflow-local-development-only-secret");
}

export async function createSessionToken(user: TokenUser): Promise<string> {
  return new SignJWT({ ver: user.tokenVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuer(JWT.issuer)
    .setAudience(JWT.audience)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey());
}

/** Verifies the token, then checks the account still exists and the session wasn't revoked. */
export async function readSessionToken(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  let sub: string;
  let ver: number;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"], ...JWT });
    if (typeof payload.sub !== "string" || typeof payload.ver !== "number") return null;
    sub = payload.sub;
    ver = payload.ver;
  } catch {
    return null;
  }
  const db = await getDb();
  const rows = await db.query(
    "SELECT id, name, email, email_verified, token_version FROM users WHERE id = $1::uuid",
    [sub],
  );
  const row = rows[0];
  if (!row || Number(row.token_version) !== ver) return null;
  return { id: String(row.id), name: String(row.name), email: String(row.email), emailVerified: Boolean(row.email_verified) };
}

/** The signed-in user for this request (deduplicated across one render). */
export const getSession = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  return readSessionToken(jar.get(SESSION_COOKIE)?.value);
});

/** True when this account still has to confirm its email before using SyncFlow. */
export function needsVerification(user: SessionUser): boolean {
  return !user.emailVerified && emailEnabled();
}

/** For server pages: sends visitors to sign in, and unconfirmed accounts to /verify. */
export async function requirePageUser(next: string): Promise<SessionUser> {
  const user = await getSession();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (needsVerification(user)) redirect(`/verify?next=${encodeURIComponent(next)}`);
  return user;
}

export async function setSessionCookie(user: TokenUser): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, await createSessionToken(user), {
    httpOnly: true,
    sameSite: "lax",
    secure: SECURE,
    path: "/",
    maxAge: 60 * 60 * 24 * SESSION_DAYS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: SECURE, path: "/", maxAge: 0 });
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

// Hash of a random value nobody knows. Checked when the email is unknown, so
// "no such account" takes as long as "wrong password" and can't be probed by timing.
const DUMMY_HASH = "$2b$12$qXCDsnm/HbZ.QdFQrhGJRem6cQ4eq0CqLPdviDPQSOOVcIz6elWE6";

export function verifyPassword(password: string, hash: string | null | undefined): Promise<boolean> {
  return bcrypt.compare(password, hash || DUMMY_HASH).catch(() => false);
}

/** True when the stored hash used fewer rounds than we use now. */
export function needsRehash(hash: string): boolean {
  try {
    return bcrypt.getRounds(hash) < BCRYPT_ROUNDS;
  } catch {
    return false;
  }
}
