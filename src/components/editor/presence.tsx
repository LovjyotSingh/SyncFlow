"use client";

import { Avatar } from "@/components/ui/avatar";
import type { Peer } from "./use-sync";

export function Presence({ peers, self }: { peers: Peer[]; self: { name: string; color: string } }) {
  const shown = peers.slice(0, 4);
  const extra = peers.length - shown.length;
  const label =
    peers.length === 0 ? "Only you are here" : `${peers.map((p) => p.name).join(", ")} ${peers.length === 1 ? "is" : "are"} here too`;
  return (
    <div className="flex items-center" title={label} aria-label={label}>
      <div className="flex -space-x-2">
        {shown.map((p) => (
          <span key={p.key} className="relative animate-fade">
            <Avatar name={p.name} color={p.color} size={30} ring />
          </span>
        ))}
        {extra > 0 ? (
          <span className="grid size-[30px] place-items-center rounded-full bg-s3 text-[11px] font-semibold text-muted ring-2 ring-bg">+{extra}</span>
        ) : null}
        <span className="relative">
          <Avatar name={self.name} color={self.color} size={30} ring title={`${self.name} (you)`} />
          <span className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full bg-ok ring-2 ring-bg" />
        </span>
      </div>
    </div>
  );
}
