import { del } from "@vercel/blob";
import { z } from "zod";
import { deletePage, leavePage, renamePage, requirePage } from "@/lib/docs";
import { readJson, requireUser, route, type IdParams } from "@/lib/http";

export const GET = route<IdParams>(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  return Response.json({ page: await requirePage(id, user.id) });
});

const Patch = z.object({ title: z.string().trim().max(120) });

export const PATCH = route<IdParams>(async (req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  await requirePage(id, user.id);
  const { title } = await readJson(req, Patch);
  await renamePage(id, title || "Untitled");
  return Response.json({ ok: true });
});

/** The owner deletes the page for everyone; anyone else just leaves it. */
export const DELETE = route<IdParams>(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const page = await requirePage(id, user.id);
  if (page.role !== "owner") {
    await leavePage(id, user.id);
    return Response.json({ left: true });
  }
  const urls = await deletePage(id);
  if (urls.length && process.env.BLOB_READ_WRITE_TOKEN) await del(urls).catch(() => {});
  return Response.json({ deleted: true });
});
