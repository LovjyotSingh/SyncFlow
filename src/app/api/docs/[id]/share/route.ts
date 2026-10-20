import { requireOwner, resetShareToken } from "@/lib/docs";
import { requireUser, route, type IdParams } from "@/lib/http";

/** Replaces the share link. Old links stop working; people already on the page stay. */
export const POST = route<IdParams>(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  await requireOwner(id, user.id);
  return Response.json({ shareToken: await resetShareToken(id) });
});
