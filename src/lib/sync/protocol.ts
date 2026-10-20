// The wire format between HttpSyncProvider (browser) and POST /api/docs/[id]/sync.

export type SyncRequest = {
  /** Highest update id this client has fully seen. -1 on first load. */
  after: number;
  /** The Yjs client id of this tab, used as the presence key. */
  clientId: number;
  /** Local Yjs changes since the last request, merged into one update (base64). */
  update?: string | null;
  /** This tab's encoded awareness state (base64), sent when it changes and as a heartbeat. */
  awareness?: string | null;
  /** Sent from pagehide: store the last update and drop this tab's presence. */
  leaving?: boolean;
};

export type SyncUpdate = { id: number; data: string };
export type SyncPeer = { clientId: number; state: string };

export type SyncResponse = {
  cursor: number;
  /** Compacted state, sent when the client's cursor is older than the latest snapshot. */
  snapshot: string | null;
  updates: SyncUpdate[];
  peers: SyncPeer[];
  /** Id of the update stored from this request, so the client can skip its own echo. */
  inserted: number | null;
  /** More updates are waiting; poll again right away. */
  more: boolean;
};

/** Updates newer than this are re-sent until they settle, so a slow concurrent insert is never skipped. */
export const SETTLE_SECONDS = 3;
/** Presence rows older than this are treated as gone. */
export const PRESENCE_TTL_SECONDS = 30;
/** Fold the update log into the snapshot once this many settled updates pile up. */
export const COMPACT_AFTER = 100;
export const PAGE_SIZE = 400;
