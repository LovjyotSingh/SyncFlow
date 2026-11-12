import { sendVerification } from "@/lib/account";
import { emailEnabled } from "@/lib/email";
import { HttpError, rateLimit, requireAccount, route } from "@/lib/http";

/** Emails a new confirmation code to the signed-in account. Older codes stop working. */
export const POST = route(async (req) => {
  const user = await requireAccount();
  if (user.emailVerified) return Response.json({ ok: true, alreadyVerified: true });
  if (!emailEnabled()) throw new HttpError(503, "Email isn't set up on this site yet.");
  await rateLimit(req, "resend-short", 3, 10 * 60, user.id);
  await rateLimit(req, "resend-day", 10, 24 * 60 * 60, user.id);

  if (!(await sendVerification(user))) {
    throw new HttpError(502, "We couldn't send the email right now. Try again in a few minutes.");
  }
  return Response.json({ ok: true });
});
