import { after } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { isUuid } from "@/lib/docs";
import { HttpError, readJson, requireUser, route, type IdParams } from "@/lib/http";
import { compactDocument, syncDocument } from "@/lib/sync/server";

const MAX_BASE64 = 3_000_000; // stays under Vercel's 4.5 MB request limit

const Body = z.object({
  after: z.number().int().min(-1),
  clientId: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  update: z.string().max(MAX_BASE64, "That change is too large to sync in one go.").nullish(),
  awareness: z.string().max(20_000).nullish(),
  leaving: z.boolean().optional(),
});

export const POST = route<IdParams>(async (req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  if (!isUuid(id)) throw new HttpError(404, "This page doesn't exist.");

  const body = await readJson(req, Body);
  const db = await getDb();
  const result = await syncDocument(db, id, user.id, body);
  if (!result.ok) throw new HttpError(403, "You don't have access to this page anymore.");

  if (result.shouldCompact) {
    // Fold the update log into a snapshot after the response is sent.
    after(() => compactDocument(db, id).catch((err) => console.error("compaction failed", err)));
  }
  return Response.json(result.response, { headers: { "cache-control": "no-store" } });
});
