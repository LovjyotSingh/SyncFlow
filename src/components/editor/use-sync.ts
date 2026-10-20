"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import * as Y from "yjs";
import { HttpSyncProvider, type ProviderState } from "@/lib/sync/provider";

export type SyncSession = { doc: Y.Doc; provider: HttpSyncProvider };

/** Creates the Y.Doc and HTTP provider for a page, and tears them down when the page closes. */
export function useSyncSession(docId: string): SyncSession | null {
  const [session, setSession] = useState<SyncSession | null>(null);
  useEffect(() => {
    const doc = new Y.Doc();
    const provider = new HttpSyncProvider(doc, docId);
    // The provider polls the network, so it must be created and destroyed by this effect
    // (not during render) to stay correct under Strict Mode's double mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSession({ doc, provider });
    return () => {
      provider.destroy();
      doc.destroy();
    };
  }, [docId]);
  return session;
}

const INITIAL: ProviderState = { status: "connecting", latency: null, lastSyncedAt: null };

export function useProviderState(provider: HttpSyncProvider | undefined): ProviderState {
  const subscribe = useCallback((onChange: () => void) => (provider ? provider.subscribe(onChange) : () => {}), [provider]);
  return useSyncExternalStore(
    subscribe,
    () => provider?.state ?? INITIAL,
    () => INITIAL,
  );
}

export function useSynced(provider: HttpSyncProvider | undefined): boolean {
  const [synced, setSynced] = useState(false);
  useEffect(() => {
    if (!provider) return;
    let alive = true;
    void provider.whenSynced.then(() => alive && setSynced(true));
    return () => {
      alive = false;
    };
  }, [provider]);
  return synced;
}

export type Peer = { key: string; name: string; color: string };

/** Everyone else currently on the page, from Yjs awareness. One entry per person, even with several tabs open. */
export function usePeers(provider: HttpSyncProvider | undefined): Peer[] {
  const [peers, setPeers] = useState<Peer[]>([]);
  useEffect(() => {
    if (!provider) return;
    let alive = true;
    // BlockNote writes our own awareness while it renders, so read on a microtask, never mid-render.
    const read = () => queueMicrotask(() => alive && compute());
    const compute = () => {
      const byPerson = new Map<string, Peer>();
      provider.awareness.getStates().forEach((state, clientId) => {
        if (clientId === provider.doc.clientID) return;
        const user = (state as { user?: { name?: string; color?: string } }).user;
        if (!user?.name) return;
        const key = `${user.name}|${user.color}`;
        byPerson.set(key, { key, name: user.name, color: user.color ?? "#a1a1aa" });
      });
      setPeers([...byPerson.values()]);
    };
    read();
    provider.awareness.on("change", read);
    return () => {
      alive = false;
      provider.awareness.off("change", read);
    };
  }, [provider]);
  return peers;
}

/** A value in the page's shared Y.Map, kept in React state. */
export function useMetaValue<T>(doc: Y.Doc | undefined, key: string): [T | undefined, (value: T) => void] {
  const [value, setValue] = useState<T | undefined>(undefined);
  useEffect(() => {
    if (!doc) return;
    const meta = doc.getMap<T>("meta");
    const read = () => setValue(meta.get(key));
    read();
    meta.observe(read);
    return () => meta.unobserve(read);
  }, [doc, key]);
  const set = useCallback((next: T) => doc?.getMap<T>("meta").set(key, next), [doc, key]);
  return [value, set];
}
