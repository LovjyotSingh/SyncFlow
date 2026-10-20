import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { requirePage } from "@/lib/docs";
import { HttpError, requireUser, route, type IdParams } from "@/lib/http";
import { MAX_FILE_BYTES } from "@/lib/files";

/** Issues a short-lived token so the browser can upload straight to Vercel Blob. */
export const POST = route<IdParams>(async (req, { params }) => {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new HttpError(503, "File sharing isn't set up yet. Connect a Vercel Blob store to this project.");
  }
  const user = await requireUser();
  const { id } = await params;
  await requirePage(id, user.id);

  const body = (await req.json()) as HandleUploadBody;
  const result = await handleUpload({
    body,
    request: req,
    onBeforeGenerateToken: async (pathname) => {
      if (!pathname.startsWith(`docs/${id}/`)) throw new HttpError(400, "That upload path isn't allowed.");
      return { maximumSizeInBytes: MAX_FILE_BYTES, addRandomSuffix: true };
    },
  });
  return Response.json(result);
});
