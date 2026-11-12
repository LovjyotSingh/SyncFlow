import { z } from "zod";
import { markVerified } from "@/lib/account";
import { getDb } from "@/lib/db";
import { HttpError, rateLimit, readJson, requireAccount, route } from "@/lib/http";
import { checkCode, normalizeCode } from "@/lib/security";

const Body = z.object({ code: z.string().max(20) });

/** Confirms the signed-in account's email with the 6-digit code we sent. */
export const POST = route(async (req) => {
  const user = await requireAccount();
  if (user.emailVerified) return Response.json({ ok: true });
  await rateLimit(req, "verify", 15, 15 * 60, user.id);

  const code = normalizeCode((await readJson(req, Body)).code);
  if (!code) throw new HttpError(400, "Enter the 6-digit code from the email.");

  const result = await checkCode(await getDb(), user.id, "verify", code);
  if (result === "expired") throw new HttpError(400, "This code has expired. Send a new one.");
  if (result === "locked") throw new HttpError(429, "Too many wrong codes. Send a new one.");
  if (result === "wrong") throw new HttpError(400, "That code isn't right. Check the email and try again.");

  await markVerified(user.id, user.email);
  return Response.json({ ok: true });
});
