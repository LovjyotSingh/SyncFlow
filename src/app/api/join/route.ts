import { z } from "zod";
import { joinByToken } from "@/lib/docs";
import { HttpError, readJson, requireUser, route } from "@/lib/http";
import { parseShareToken } from "@/lib/share";

const Body = z.object({ link: z.string().max(500) });

export const POST = route(async (req) => {
  const user = await requireUser();
  const { link } = await readJson(req, Body);
  const token = parseShareToken(link);
  if (!token) throw new HttpError(400, "Paste a SyncFlow share link, like https://…/join/abc123.");
  const id = await joinByToken(token, user.id);
  if (!id) throw new HttpError(404, "That link doesn't work anymore. Ask the owner for a new one.");
  return Response.json({ id });
});
