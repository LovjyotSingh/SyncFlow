import type { Metadata } from "next";
import { Settings } from "@/components/settings/settings";
import { requirePageUser } from "@/lib/auth";
import { emailEnabled } from "@/lib/email";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requirePageUser("/settings");
  return <Settings user={user} emailCodes={emailEnabled()} />;
}
