import { after } from "next/server";
import { z } from "zod";
import { hashPassword, needsRehash, setSessionCookie, verifyPassword } from "@/lib/auth";
import { findAccountByEmail, hasLiveVerifyCode, sendVerification } from "@/lib/account";
import { getDb } from "@/lib/db";
import { acceptInvites } from "@/lib/docs";
import { emailEnabled } from "@/lib/email";
import { HttpError, rateLimit, readJson, route } from "@/lib/http";

const Body = z.object({
  email: z.string().trim().toLowerCase().max(254).email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password.").max(200),
});

export const POST = route(async (req) => {
  await rateLimit(req, "login-ip", 20, 15 * 60);
  const { email, password } = await readJson(req, Body);
  await rateLimit(req, "login-email", 8, 15 * 60, email);

  const account = await findAccountByEmail(email);
  // Always run bcrypt, even for unknown emails, so timing doesn't reveal who has an account.
  const ok = await verifyPassword(password, account?.password_hash);
  if (!account || !ok) throw new HttpError(401, "That email and password don't match.");

  const db = await getDb();
  // Upgrade hashes made with fewer bcrypt rounds, now that we know the password.
  if (needsRehash(account.password_hash)) {
    await db.query("UPDATE users SET password_hash = $2::text WHERE id = $1::uuid", [account.id, await hashPassword(password)]);
  }
  await setSessionCookie({ id: account.id, tokenVersion: Number(account.token_version) });

  const needsVerification = !account.email_verified && emailEnabled();
  if (needsVerification) {
    // Accounts made before email codes existed get their first code when they sign in.
    if (!(await hasLiveVerifyCode(account.id))) after(() => sendVerification(account));
  } else {
    await acceptInvites(account.id, account.email);
  }
  return Response.json({ user: { id: account.id, name: account.name, email: account.email }, needsVerification });
});
