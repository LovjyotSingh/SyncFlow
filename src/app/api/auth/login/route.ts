import { z } from "zod";
import { setSessionCookie, verifyPassword } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { acceptInvites } from "@/lib/docs";
import { HttpError, readJson, route } from "@/lib/http";

const Body = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

export const POST = route(async (req) => {
  const { email, password } = await readJson(req, Body);
  const db = await getDb();
  const rows = await db.query("SELECT id, name, email, password_hash FROM users WHERE email = $1::text", [email]);
  const row = rows[0];
  if (!row || !(await verifyPassword(password, String(row.password_hash)))) {
    throw new HttpError(401, "That email and password don't match.");
  }
  const user = { id: String(row.id), name: String(row.name), email: String(row.email) };
  await acceptInvites(user.id, user.email);
  await setSessionCookie(user);
  return Response.json({ user });
});
