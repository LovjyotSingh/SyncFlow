import { z } from "zod";
import { getSession, needsVerification, type SessionUser } from "./auth";
import { getDb } from "./db";
import { clientIp, hit } from "./security";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

type Handler<C> = (req: Request, ctx: C) => Promise<Response>;

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Blocks cross-site requests that change data (CSRF). Browsers always send Origin on
 * cross-origin POST/PATCH/DELETE, so it must match the host the request was sent to.
 */
function isSameOrigin(req: Request): boolean {
  if (SAFE_METHODS.has(req.method)) return true;
  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") return false;
  const origin = req.headers.get("origin");
  if (!origin) return true; // non-browser clients; the SameSite cookie still applies
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** Wraps a route handler so thrown HttpErrors and validation errors become JSON responses. */
export function route<C>(handler: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      if (!isSameOrigin(req)) throw new HttpError(403, "That request came from another site, so it was blocked.");
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof HttpError) {
        return Response.json(
          { error: err.message, ...err.extra },
          { status: err.status, headers: { "cache-control": "no-store" } },
        );
      }
      if (err instanceof z.ZodError) {
        return Response.json({ error: err.issues[0]?.message ?? "That request isn't valid." }, { status: 400 });
      }
      console.error(err);
      return Response.json({ error: "Something went wrong on our side. Try again." }, { status: 500 });
    }
  };
}

export async function readJson<T>(req: Request, schema: z.ZodType<T>): Promise<T> {
  const type = req.headers.get("content-type") ?? "";
  if (!type.toLowerCase().startsWith("application/json")) throw new HttpError(415, "Send the request body as JSON.");
  let data: unknown;
  try {
    data = await req.json();
  } catch {
    throw new HttpError(400, "Send the request body as JSON.");
  }
  return schema.parse(data);
}

/** Any signed-in account, confirmed or not. Only for account and sign-in routes. */
export async function requireAccount(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) throw new HttpError(401, "Sign in to continue.");
  return user;
}

/** A signed-in account that has confirmed its email (when email is set up). */
export async function requireUser(): Promise<SessionUser> {
  const user = await requireAccount();
  if (needsVerification(user)) {
    throw new HttpError(403, "Confirm your email to continue.", { code: "verify_email" });
  }
  return user;
}

/** Counts a hit for this caller and throws 429 once they go over `limit` per `windowSeconds`. */
export async function rateLimit(
  req: Request,
  name: string,
  limit: number,
  windowSeconds: number,
  subject?: string,
): Promise<void> {
  const db = await getDb();
  const key = `${name}:${subject ?? clientIp(req)}`;
  if (!(await hit(db, key, limit, windowSeconds))) {
    const minutes = Math.max(1, Math.round(windowSeconds / 60));
    throw new HttpError(429, `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`);
  }
}

export type IdParams = { params: Promise<{ id: string }> };
