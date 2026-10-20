"use client";

import * as M from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";

export const Menu = M.Root;
export const MenuTrigger = M.Trigger;

export function MenuContent({ children, className, align = "end" }: { children: React.ReactNode; className?: string; align?: "start" | "end" }) {
  return (
    <M.Portal>
      <M.Content
        align={align}
        sideOffset={8}
        className={cn(
          "z-50 min-w-[200px] rounded-xl border border-line2 bg-s2 p-1.5 shadow-[0_24px_60px_-12px_rgb(0_0_0/0.9)]",
          "data-[state=open]:animate-fade",
          className,
        )}
      >
        {children}
      </M.Content>
    </M.Portal>
  );
}

export function MenuItem({
  children,
  onSelect,
  danger,
  icon,
}: {
  children: React.ReactNode;
  onSelect?: () => void;
  danger?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <M.Item
      onSelect={onSelect}
      className={cn(
        "flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm outline-none select-none",
        danger ? "text-bad data-[highlighted]:bg-bad/10" : "text-ink data-[highlighted]:bg-white/[0.06]",
      )}
    >
      {icon ? <span className="text-dim [&>svg]:size-4">{icon}</span> : null}
      {children}
    </M.Item>
  );
}

export function MenuLabel({ children }: { children: React.ReactNode }) {
  return <M.Label className="px-2.5 pt-1.5 pb-2 text-xs text-dim">{children}</M.Label>;
}

export function MenuSeparator() {
  return <M.Separator className="my-1.5 h-px bg-line" />;
}
