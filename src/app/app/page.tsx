import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Dashboard } from "@/components/dashboard/dashboard";
import { getSession } from "@/lib/auth";
import { listPages } from "@/lib/docs";

export const metadata: Metadata = { title: "Your pages" };

export default async function AppPage() {
  const user = await getSession();
  if (!user) redirect("/login?next=/app");
  const pages = await listPages(user.id);
  return <Dashboard user={user} initialPages={pages} />;
}
