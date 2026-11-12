import { clearSessionCookie } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { requireAccount, route } from "@/lib/http";

/** Revokes every session on every device, including this one. */
export const POST = route(async () => {
  const user = await requireAccount();
  const db = await getDb();
  await db.query("UPDATE users SET token_version = token_version + 1 WHERE id = $1::uuid", [user.id]);
  await clearSessionCookie();
  return Response.json({ ok: true });
});
