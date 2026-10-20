"use client";

import { useRouter } from "next/navigation";
import { LogOut, Home } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import type { SessionUser } from "@/lib/auth";
import { api, colorFor } from "@/lib/utils";

export function UserMenu({ user }: { user: SessionUser }) {
  const router = useRouter();
  async function signOut() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.replace("/");
    router.refresh();
  }
  return (
    <Menu>
      <MenuTrigger className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-c1" aria-label="Account">
        <Avatar name={user.name} color={colorFor(user.id)} size={32} />
      </MenuTrigger>
      <MenuContent>
        <MenuLabel>
          <span className="block font-medium text-ink">{user.name}</span>
          <span className="block truncate">{user.email}</span>
        </MenuLabel>
        <MenuSeparator />
        <MenuItem icon={<Home />} onSelect={() => router.push("/")}>
          Home page
        </MenuItem>
        <MenuItem icon={<LogOut />} onSelect={signOut}>
          Sign out
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
