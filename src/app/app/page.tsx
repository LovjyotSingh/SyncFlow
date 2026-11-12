import type { Metadata } from "next";
import { Dashboard } from "@/components/dashboard/dashboard";
import { requirePageUser } from "@/lib/auth";
import { listPages } from "@/lib/docs";

export const metadata: Metadata = { title: "Your pages" };

export default async function AppPage() {
  const user = await requirePageUser("/app");
  const pages = await listPages(user.id);
  return <Dashboard user={user} initialPages={pages} />;
}
