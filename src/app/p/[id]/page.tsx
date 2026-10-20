import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Workspace } from "@/components/editor/workspace";
import { getSession } from "@/lib/auth";
import { getPage } from "@/lib/docs";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const user = await getSession();
  const page = user ? await getPage(id, user.id) : null;
  return { title: page?.title || "Page" };
}

export default async function DocPage({ params }: Props) {
  const { id } = await params;
  const user = await getSession();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/p/${id}`)}`);
  const page = await getPage(id, user.id);
  if (!page) notFound();
  return <Workspace user={user} page={page} filesEnabled={Boolean(process.env.BLOB_READ_WRITE_TOKEN)} />;
}
