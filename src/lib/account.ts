import { getDb } from "./db";
import { acceptInvites } from "./docs";
import { emailEnabled, sendVerifyCode } from "./email";
import { issueCode } from "./security";

export type AccountRow = {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  email_verified: boolean;
  token_version: number;
};

export async function findAccountByEmail(email: string): Promise<AccountRow | null> {
  const db = await getDb();
  const rows = await db.query<AccountRow>(
    "SELECT id, name, email, password_hash, email_verified, token_version FROM users WHERE email = $1::text",
    [email],
  );
  return rows[0] ?? null;
}

export async function findAccountById(id: string): Promise<AccountRow | null> {
  const db = await getDb();
  const rows = await db.query<AccountRow>(
    "SELECT id, name, email, password_hash, email_verified, token_version FROM users WHERE id = $1::uuid",
    [id],
  );
  return rows[0] ?? null;
}

/** Emails a fresh confirmation code. Returns false if the email couldn't be sent. */
export async function sendVerification(user: { id: string; name: string; email: string }): Promise<boolean> {
  if (!emailEnabled()) return false;
  const db = await getDb();
  const code = await issueCode(db, user.id, "verify");
  try {
    await sendVerifyCode(user, code);
    return true;
  } catch (err) {
    console.error("verification email failed", err instanceof Error ? err.message : err);
    return false;
  }
}

/** True if this account already has an unexpired confirmation code waiting. */
export async function hasLiveVerifyCode(userId: string): Promise<boolean> {
  const db = await getDb();
  const rows = await db.query(
    "SELECT 1 FROM email_codes WHERE user_id = $1::uuid AND purpose = 'verify' AND expires_at > now()",
    [userId],
  );
  return rows.length > 0;
}

/**
 * Marks the email as confirmed and only then turns pending page invites into memberships,
 * so nobody can claim invites by signing up with an address they don't own.
 */
export async function markVerified(userId: string, email: string): Promise<void> {
  const db = await getDb();
  await db.query("UPDATE users SET email_verified = true WHERE id = $1::uuid", [userId]);
  await acceptInvites(userId, email);
}
