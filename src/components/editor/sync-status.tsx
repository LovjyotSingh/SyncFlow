"use client";

import type { ProviderState } from "@/lib/sync/provider";
import { cn } from "@/lib/utils";

const LABEL: Record<ProviderState["status"], string> = {
  connecting: "Connecting",
  synced: "Synced",
  saving: "Saving",
  offline: "Offline · retrying",
  denied: "No access",
};

export function SyncStatus({ state }: { state: ProviderState }) {
  const tone =
    state.status === "synced"
      ? "bg-ok"
      : state.status === "saving" || state.status === "connecting"
        ? "bg-warn animate-pulse"
        : "bg-bad";
  return (
    <span
      className="inline-flex h-8 items-center gap-2 rounded-full border border-line px-3 font-mono text-[11.5px] text-muted"
      title={state.lastSyncedAt ? `Last synced ${new Date(state.lastSyncedAt).toLocaleTimeString()}` : undefined}
      aria-live="polite"
    >
      <span className={cn("size-1.5 rounded-full", tone)} />
      {LABEL[state.status]}
      {state.status === "synced" && state.latency !== null ? <span className="text-dim">· {state.latency} ms</span> : null}
    </span>
  );
}
