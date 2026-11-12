import { after } from "next/server";
import { z } from "zod";
import { findAccountByEmail } from "@/lib/account";
import { getDb } from "@/lib/db";
import { emailEnabled, sendResetCode } from "@/lib/email";
import { HttpError, rateLimit, readJson, route } from "@/lib/http";
import { issueCode } from "@/lib/security";

const Body = z.object({
  email: z.string().trim().toLowerCase().max(254).email("Enter a valid email address."),
});

/**
 * Emails a password reset code. The answer is the same whether or not the account exists,
 * and the email goes out after the response, so neither words nor timing reveal who signed up.
 */
export const POST = route(async (req) => {
  if (!emailEnabled()) throw new HttpError(503, "Password reset by email isn't available yet.");
  await rateLimit(req, "forgot-ip", 5, 15 * 60);
  const { email } = await readJson(req, Body);
  await rateLimit(req, "forgot-email", 3, 60 * 60, email);

  // All the account-specific work happens after the response.
  after(async () => {
    try {
      const account = await findAccountByEmail(email);
      if (!account) return;
      const code = await issueCode(await getDb(), account.id, "reset");
      await sendResetCode(account, code);
    } catch (err) {
      console.error("reset email failed", err instanceof Error ? err.message : err);
    }
  });
  return Response.json({ ok: true });
});
