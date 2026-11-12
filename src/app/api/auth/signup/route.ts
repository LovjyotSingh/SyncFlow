import { z } from "zod";
import { hashPassword, setSessionCookie } from "@/lib/auth";
import { sendVerification } from "@/lib/account";
import { getDb } from "@/lib/db";
import { acceptInvites } from "@/lib/docs";
import { emailEnabled } from "@/lib/email";
import { HttpError, rateLimit, readJson, route } from "@/lib/http";
import { passwordProblem } from "@/lib/security";

const Body = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(60, "Use a shorter name."),
  email: z.string().trim().toLowerCase().max(254, "Use a shorter email address.").email("Enter a valid email address."),
  password: z.string().max(200, "Use at most 72 characters for your password."),
});

export const POST = route(async (req) => {
  await rateLimit(req, "signup", 5, 60 * 60);
  const { name, email, password } = await readJson(req, Body);
  const problem = passwordProblem(password, { name, email });
  if (problem) throw new HttpError(400, problem);

  const verifyByEmail = emailEnabled();
  const db = await getDb();
  const rows = await db.query(
    `INSERT INTO users (name, email, password_hash, email_verified) VALUES ($1::text, $2::text, $3::text, $4::boolean)
     ON CONFLICT (email) DO NOTHING RETURNING id`,
    [name, email, await hashPassword(password), !verifyByEmail],
  );
  if (!rows[0]) throw new HttpError(409, "An account with that email already exists. Sign in instead.");

  const user = { id: String(rows[0].id), name, email };
  await setSessionCookie({ id: user.id, tokenVersion: 0 });

  if (!verifyByEmail) {
    await acceptInvites(user.id, email);
    return Response.json({ user, needsVerification: false });
  }
  const emailSent = await sendVerification(user);
  return Response.json({ user, needsVerification: true, emailSent });
});
