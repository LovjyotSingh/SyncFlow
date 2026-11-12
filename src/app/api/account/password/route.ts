import { after } from "next/server";
import { z } from "zod";
import { hashPassword, setSessionCookie, verifyPassword } from "@/lib/auth";
import { findAccountById } from "@/lib/account";
import { getDb } from "@/lib/db";
import { emailEnabled, sendPasswordChanged } from "@/lib/email";
import { HttpError, rateLimit, readJson, requireAccount, route } from "@/lib/http";
import { passwordProblem } from "@/lib/security";

const Body = z.object({
  currentPassword: z.string().max(200),
  newPassword: z.string().max(200, "Use at most 72 characters for your password."),
});

/** Changes the password, signs out every other device, and keeps this one signed in. */
export const POST = route(async (req) => {
  const user = await requireAccount();
  await rateLimit(req, "change-password", 5, 15 * 60, user.id);
  const { currentPassword, newPassword } = await readJson(req, Body);

  const account = await findAccountById(user.id);
  if (!account || !(await verifyPassword(currentPassword, account.password_hash))) {
    throw new HttpError(401, "Your current password isn't right.");
  }
  const problem = passwordProblem(newPassword, { name: account.name, email: account.email });
  if (problem) throw new HttpError(400, problem);
  if (await verifyPassword(newPassword, account.password_hash)) {
    throw new HttpError(400, "Choose a password different from your current one.");
  }

  const db = await getDb();
  const rows = await db.query<{ token_version: number }>(
    `UPDATE users SET password_hash = $2::text, token_version = token_version + 1
      WHERE id = $1::uuid RETURNING token_version`,
    [user.id, await hashPassword(newPassword)],
  );
  await setSessionCookie({ id: user.id, tokenVersion: Number(rows[0].token_version) });
  if (emailEnabled()) after(() => sendPasswordChanged(account).catch(() => {}));
  return Response.json({ ok: true });
});
