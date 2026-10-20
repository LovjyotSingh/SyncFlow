import { z } from "zod";
import { hashPassword, setSessionCookie } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { acceptInvites } from "@/lib/docs";
import { HttpError, readJson, route } from "@/lib/http";

const Body = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(60, "Use a shorter name."),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(8, "Use at least 8 characters for your password.").max(200),
});

export const POST = route(async (req) => {
  const { name, email, password } = await readJson(req, Body);
  const db = await getDb();
  const rows = await db.query(
    `INSERT INTO users (name, email, password_hash) VALUES ($1::text, $2::text, $3::text)
     ON CONFLICT (email) DO NOTHING RETURNING id`,
    [name, email, await hashPassword(password)],
  );
  if (!rows[0]) throw new HttpError(409, "An account with that email already exists. Sign in instead.");

  const user = { id: String(rows[0].id), name, email };
  await acceptInvites(user.id, email);
  await setSessionCookie(user);
  return Response.json({ user });
});
