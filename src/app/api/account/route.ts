import { del } from "@vercel/blob";
import { z } from "zod";
import { clearSessionCookie, verifyPassword } from "@/lib/auth";
import { findAccountById } from "@/lib/account";
import { getDb } from "@/lib/db";
import { HttpError, rateLimit, readJson, requireAccount, route } from "@/lib/http";

const Body = z.object({ password: z.string().max(200) });

/**
 * Permanently deletes the account. Pages it owns (and their files) go with it;
 * it simply leaves pages owned by other people.
 */
export const DELETE = route(async (req) => {
  const user = await requireAccount();
  await rateLimit(req, "delete-account", 5, 15 * 60, user.id);
  const { password } = await readJson(req, Body);
  const account = await findAccountById(user.id);
  if (!account || !(await verifyPassword(password, account.password_hash))) {
    throw new HttpError(401, "Your password isn't right.");
  }

  const db = await getDb();
  const files = await db.query<{ url: string }>(
    "SELECT f.url FROM files f JOIN documents d ON d.id = f.document_id WHERE d.owner_id = $1::uuid",
    [user.id],
  );
  await db.query("DELETE FROM users WHERE id = $1::uuid", [user.id]);
  if (files.length && process.env.BLOB_READ_WRITE_TOKEN) await del(files.map((f) => f.url)).catch(() => {});
  await clearSessionCookie();
  return Response.json({ ok: true });
});
