import { after } from "next/server";
import { z } from "zod";
import { clearSessionCookie, hashPassword } from "@/lib/auth";
import { findAccountByEmail } from "@/lib/account";
import { getDb } from "@/lib/db";
import { acceptInvites } from "@/lib/docs";
import { sendPasswordChanged } from "@/lib/email";
import { HttpError, rateLimit, readJson, route } from "@/lib/http";
import { checkCode, normalizeCode, passwordProblem } from "@/lib/security";

const Body = z.object({
  email: z.string().trim().toLowerCase().max(254).email("Enter a valid email address."),
  code: z.string().max(20),
  password: z.string().max(200, "Use at most 72 characters for your password."),
});

const WRONG = "That code isn't right or has expired. Check the email, or ask for a new code.";

/** Sets a new password with the emailed code, then signs the account out everywhere. */
export const POST = route(async (req) => {
  await rateLimit(req, "reset-ip", 10, 15 * 60);
  const body = await readJson(req, Body);
  const code = normalizeCode(body.code);
  if (!code) throw new HttpError(400, "Enter the 6-digit code from the email.");

  // Unknown emails get the same answer as wrong codes, so this reveals nothing.
  const account = await findAccountByEmail(body.email);
  if (!account) throw new HttpError(400, WRONG);

  // Check the new password first so a typo there doesn't use up a code attempt.
  const problem = passwordProblem(body.password, { name: account.name, email: account.email });
  if (problem) throw new HttpError(400, problem);

  const db = await getDb();
  const result = await checkCode(db, account.id, "reset", code);
  if (result === "locked") throw new HttpError(429, "Too many wrong codes. Ask for a new one.");
  if (result !== "ok") throw new HttpError(400, WRONG);

  // They just proved they own the inbox, so the email counts as confirmed too.
  await db.query(
    `UPDATE users SET password_hash = $2::text, email_verified = true, token_version = token_version + 1
      WHERE id = $1::uuid`,
    [account.id, await hashPassword(body.password)],
  );
  await db.query("DELETE FROM email_codes WHERE user_id = $1::uuid", [account.id]);
  await acceptInvites(account.id, account.email);
  await clearSessionCookie();
  after(() => sendPasswordChanged(account).catch(() => {}));
  return Response.json({ ok: true });
});
