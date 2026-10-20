import { z } from "zod";
import { addFile, listFiles, requirePage } from "@/lib/docs";
import { isPageBlob, MAX_FILE_BYTES } from "@/lib/files";
import { HttpError, readJson, requireUser, route, type IdParams } from "@/lib/http";

export const GET = route<IdParams>(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  await requirePage(id, user.id);
  return Response.json({ files: await listFiles(id) });
});

const Body = z.object({
  url: z.string().url(),
  pathname: z.string().min(1).max(500),
  name: z.string().trim().min(1).max(200),
  size: z.number().int().nonnegative().max(MAX_FILE_BYTES),
  contentType: z.string().max(200),
});

/** Records a file the browser just uploaded to Blob, so everyone on the page can see it. */
export const POST = route<IdParams>(async (req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  await requirePage(id, user.id);
  const body = await readJson(req, Body);
  if (!isPageBlob(body.url, body.pathname, id)) throw new HttpError(400, "That file wasn't uploaded to this page.");
  const file = await addFile(id, user.id, { ...body, contentType: body.contentType || "application/octet-stream" });
  return Response.json({ file }, { status: 201 });
});
