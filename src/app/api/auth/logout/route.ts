import { clearSessionCookie } from "@/lib/auth";
import { route } from "@/lib/http";

export const POST = route(async () => {
  await clearSessionCookie();
  return Response.json({ ok: true });
});
