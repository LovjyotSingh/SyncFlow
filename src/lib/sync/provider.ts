import * as Y from "yjs";
import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
  removeAwarenessStates,
} from "y-protocols/awareness";
import { fromBase64, toBase64 } from "./encoding";
import type { SyncRequest, SyncResponse } from "./protocol";

export type SyncStatus = "connecting" | "synced" | "saving" | "offline" | "denied";

export type ProviderState = {
  status: SyncStatus;
  /** Round-trip time of the last successful request, in ms. */
  latency: number | null;
  lastSyncedAt: number | null;
};

// Poll fast while anyone is typing, slower when the page is quiet, and barely at all in a hidden tab.
const ACTIVE_MS = 350;
const IDLE_MS = 1500;
const HIDDEN_MS = 8000;
const ACTIVE_WINDOW_MS = 10_000;
const HEARTBEAT_MS = 10_000;

/**
 * A Yjs provider that syncs over plain HTTP, so it can run on serverless functions.
 * Local changes are merged and posted; remote changes and presence come back in the same response.
 */
export class HttpSyncProvider {
  readonly awareness: Awareness;
  readonly whenSynced: Promise<void>;
  state: ProviderState = { status: "connecting", latency: null, lastSyncedAt: null };

  private resolveSynced!: () => void;
  private cursor = -1;
  private seen = new Set<number>();
  private pending: Uint8Array[] = [];
  private peers = new Set<number>();
  private awarenessDirty = true;
  private lastAwarenessSent = 0;
  private lastActivity = Date.now();
  private failures = 0;
  private inflight = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private dueAt = Infinity;
  private destroyed = false;
  private listeners = new Set<(state: ProviderState) => void>();

  constructor(
    readonly doc: Y.Doc,
    readonly docId: string,
  ) {
    this.awareness = new Awareness(doc);
    this.whenSynced = new Promise((resolve) => (this.resolveSynced = resolve));
    doc.on("update", this.onDocUpdate);
    this.awareness.on("update", this.onAwarenessUpdate);
    document.addEventListener("visibilitychange", this.onVisibility);
    window.addEventListener("online", this.onOnline);
    window.addEventListener("pagehide", this.onPageHide);
    this.schedule(0);
  }

  get endpoint() {
    return `/api/docs/${this.docId}/sync`;
  }

  subscribe(listener: (state: ProviderState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Poll right away, for example after the window regains focus. */
  kick = () => this.schedule(0);

  destroy() {
    if (this.destroyed) return;
    this.sendLeaving();
    this.destroyed = true;
    if (this.timer) clearTimeout(this.timer);
    this.doc.off("update", this.onDocUpdate);
    this.awareness.off("update", this.onAwarenessUpdate);
    document.removeEventListener("visibilitychange", this.onVisibility);
    window.removeEventListener("online", this.onOnline);
    window.removeEventListener("pagehide", this.onPageHide);
    this.awareness.destroy();
    this.listeners.clear();
  }

  private setState(patch: Partial<ProviderState>) {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener(this.state);
  }

  private onDocUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === this) return;
    this.pending.push(update);
    this.lastActivity = Date.now();
    if (this.state.status === "synced") this.setState({ status: "saving" });
    this.schedule(120);
  };

  private onAwarenessUpdate = (_changes: unknown, origin: unknown) => {
    if (origin !== "local") return;
    this.awarenessDirty = true;
    this.schedule(200);
  };

  private onVisibility = () => {
    if (!document.hidden) this.schedule(0);
  };

  private onOnline = () => {
    this.failures = 0;
    this.schedule(0);
  };

  private onPageHide = () => this.sendLeaving();

  private sendLeaving() {
    if (this.destroyed) return;
    const body: SyncRequest = {
      after: this.cursor,
      clientId: this.doc.clientID,
      update: this.pending.length ? toBase64(Y.mergeUpdates(this.pending)) : null,
      leaving: true,
    };
    this.pending = [];
    const blob = new Blob([JSON.stringify(body)], { type: "application/json" });
    if (!navigator.sendBeacon?.(this.endpoint, blob)) {
      void fetch(this.endpoint, { method: "POST", body: blob, keepalive: true }).catch(() => {});
    }
  }

  private schedule(delay: number) {
    if (this.destroyed) return;
    const due = Date.now() + delay;
    if (this.timer && due >= this.dueAt) return;
    if (this.timer) clearTimeout(this.timer);
    this.dueAt = due;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.dueAt = Infinity;
      void this.tick();
    }, delay);
  }

  private nextDelay(): number {
    if (this.failures > 0) return Math.min(15_000, 1000 * 2 ** (this.failures - 1));
    if (document.hidden) return HIDDEN_MS;
    return Date.now() - this.lastActivity < ACTIVE_WINDOW_MS ? ACTIVE_MS : IDLE_MS;
  }

  private async tick() {
    if (this.destroyed) return;
    if (this.inflight) return this.schedule(50);
    this.inflight = true;

    const outgoing = this.pending;
    this.pending = [];
    const now = Date.now();
    const sendAwareness = this.awarenessDirty || now - this.lastAwarenessSent > HEARTBEAT_MS;
    this.awarenessDirty = false;

    const body: SyncRequest = {
      after: this.cursor,
      clientId: this.doc.clientID,
      update: outgoing.length ? toBase64(Y.mergeUpdates(outgoing)) : null,
      awareness: sendAwareness ? toBase64(encodeAwarenessUpdate(this.awareness, [this.doc.clientID])) : null,
    };

    const started = performance.now();
    let next = IDLE_MS;
    try {
      const res = await fetch(this.endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      });
      if (res.status === 401 || res.status === 403 || res.status === 404) {
        this.setState({ status: "denied" });
        this.inflight = false;
        return;
      }
      if (!res.ok) throw new Error(`sync failed: ${res.status}`);
      const data = (await res.json()) as SyncResponse;
      if (sendAwareness) this.lastAwarenessSent = now;
      this.apply(data);
      this.failures = 0;
      this.setState({
        status: this.pending.length ? "saving" : "synced",
        latency: Math.round(performance.now() - started),
        lastSyncedAt: Date.now(),
      });
      this.resolveSynced();
      next = data.more ? 0 : this.nextDelay();
    } catch {
      // Keep the unsent changes in order and try again with backoff.
      this.pending = outgoing.concat(this.pending);
      if (sendAwareness) this.awarenessDirty = true;
      this.failures++;
      this.setState({ status: "offline" });
      next = this.nextDelay();
    }
    this.inflight = false;
    this.schedule(this.pending.length ? Math.min(next, 120) : next);
  }

  private apply(data: SyncResponse) {
    if (data.inserted !== null) this.seen.add(data.inserted);

    let remoteActivity = false;
    if (data.snapshot) {
      Y.applyUpdate(this.doc, fromBase64(data.snapshot), this);
    }
    for (const update of data.updates) {
      if (this.seen.has(update.id)) continue;
      this.seen.add(update.id);
      Y.applyUpdate(this.doc, fromBase64(update.data), this);
      remoteActivity = true;
    }
    if (remoteActivity) this.lastActivity = Date.now();

    this.cursor = Math.max(this.cursor, data.cursor);
    for (const id of this.seen) if (id <= this.cursor) this.seen.delete(id);

    const current = new Set<number>();
    for (const peer of data.peers) {
      current.add(peer.clientId);
      applyAwarenessUpdate(this.awareness, fromBase64(peer.state), this);
    }
    const gone = [...this.peers].filter((id) => !current.has(id));
    if (gone.length) removeAwarenessStates(this.awareness, gone, this);
    this.peers = current;
  }
}
