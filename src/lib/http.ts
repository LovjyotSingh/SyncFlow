import { z } from "zod";
import { getSession, type SessionUser } from "./auth";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

type Handler<C> = (req: Request, ctx: C) => Promise<Response>;

/** Wraps a route handler so thrown HttpErrors and validation errors become JSON responses. */
export function route<C>(handler: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof HttpError) return Response.json({ error: err.message }, { status: err.status });
      if (err instanceof z.ZodError) {
        return Response.json({ error: err.issues[0]?.message ?? "That request isn't valid." }, { status: 400 });
      }
      console.error(err);
      return Response.json({ error: "Something went wrong on our side. Try again." }, { status: 500 });
    }
  };
}

export async function readJson<T>(req: Request, schema: z.ZodType<T>): Promise<T> {
  let data: unknown;
  try {
    data = await req.json();
  } catch {
    throw new HttpError(400, "Send the request body as JSON.");
  }
  return schema.parse(data);
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) throw new HttpError(401, "Sign in to continue.");
  return user;
}

export type IdParams = { params: Promise<{ id: string }> };
