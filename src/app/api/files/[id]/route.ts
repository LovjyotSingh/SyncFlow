import { del } from "@vercel/blob";
import { deleteFile, getFileForUser } from "@/lib/docs";
import { HttpError, requireUser, route, type IdParams } from "@/lib/http";

/** The page owner or the person who shared the file can remove it. */
export const DELETE = route<IdParams>(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const file = await getFileForUser(id, user.id);
  if (!file) throw new HttpError(404, "That file is already gone.");
  if (file.role !== "owner" && file.uploaderId !== user.id) {
    throw new HttpError(403, "Only the page owner or the person who shared it can remove this file.");
  }
  await deleteFile(id);
  if (process.env.BLOB_READ_WRITE_TOKEN) await del(file.url).catch(() => {});
  return Response.json({ ok: true, documentId: file.documentId });
});
