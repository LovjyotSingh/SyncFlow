import { z } from "zod";
import { cancelInvite, inviteByEmail, listMembers, removeMember, requireOwner, requirePage } from "@/lib/docs";
import { HttpError, readJson, requireUser, route, type IdParams } from "@/lib/http";

export const GET = route<IdParams>(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  await requirePage(id, user.id);
  return Response.json(await listMembers(id));
});

const Invite = z.object({ email: z.string().trim().toLowerCase().email("Enter a valid email address.") });

export const POST = route<IdParams>(async (req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  await requirePage(id, user.id);
  const { email } = await readJson(req, Invite);
  if (email === user.email.toLowerCase()) throw new HttpError(400, "You're already on this page.");
  const result = await inviteByEmail(id, email, user.id);
  return Response.json({ result, ...(await listMembers(id)) });
});

const Remove = z.union([z.object({ userId: z.string().uuid() }), z.object({ email: z.string().email() })]);

export const DELETE = route<IdParams>(async (req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const page = await requireOwner(id, user.id);
  const target = await readJson(req, Remove);
  if ("userId" in target) {
    if (target.userId === page.ownerId) throw new HttpError(400, "The owner can't be removed from their own page.");
    await removeMember(id, target.userId);
  } else {
    await cancelInvite(id, target.email.toLowerCase());
  }
  return Response.json(await listMembers(id));
});
