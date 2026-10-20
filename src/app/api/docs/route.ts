import { z } from "zod";
import { createPage, listPages } from "@/lib/docs";
import { readJson, requireUser, route } from "@/lib/http";

export const GET = route(async () => {
  const user = await requireUser();
  return Response.json({ pages: await listPages(user.id) });
});

const Body = z.object({ title: z.string().trim().max(120).optional() });

export const POST = route(async (req) => {
  const user = await requireUser();
  const { title } = await readJson(req, Body);
  const id = await createPage(user.id, title || "Untitled");
  return Response.json({ id }, { status: 201 });
});
