import * as Y from "yjs";
import type { Db, Query, Row } from "../db";
import { fromBase64, toBase64 } from "./encoding";
import {
  COMPACT_AFTER,
  PAGE_SIZE,
  PRESENCE_TTL_SECONDS,
  SETTLE_SECONDS,
  type SyncRequest,
  type SyncResponse,
} from "./protocol";

// Every statement re-checks membership, so one batch is both the auth check and the work.
const IS_MEMBER = "EXISTS (SELECT 1 FROM members WHERE document_id = $1::uuid AND user_id = $2::uuid)";

export type SyncResult = { ok: false } | { ok: true; response: SyncResponse; shouldCompact: boolean };

/**
 * One sync round trip: store this tab's changes and presence, then return everything the
 * tab has not seen yet. Runs as a single transaction, which is one HTTP request on Neon.
 */
export async function syncDocument(db: Db, docId: string, userId: string, req: SyncRequest): Promise<SyncResult> {
  const base = [docId, userId];
  const queries: Query[] = [{ text: "SELECT role FROM members WHERE document_id = $1::uuid AND user_id = $2::uuid", params: base }];

  const hasUpdate = Boolean(req.update);
  if (hasUpdate) {
    queries.push({
      text: `INSERT INTO doc_updates (document_id, data) SELECT $1::uuid, $3::text WHERE ${IS_MEMBER} RETURNING id::float8 AS id`,
      params: [...base, req.update],
    });
    queries.push({ text: `UPDATE documents SET updated_at = now() WHERE id = $1::uuid AND ${IS_MEMBER}`, params: base });
  }

  if (req.leaving) {
    queries.push({
      text: "DELETE FROM presence WHERE document_id = $1::uuid AND user_id = $2::uuid AND client_id = $3::bigint",
      params: [...base, req.clientId],
    });
    const results = await db.batch(queries);
    return results[0].length ? { ok: true, response: emptyResponse(req.after), shouldCompact: false } : { ok: false };
  }

  if (req.awareness) {
    queries.push({
      text: `INSERT INTO presence (document_id, client_id, user_id, state, updated_at)
             SELECT $1::uuid, $3::bigint, $2::uuid, $4::text, now() WHERE ${IS_MEMBER}
             ON CONFLICT (document_id, client_id)
             DO UPDATE SET state = excluded.state, user_id = excluded.user_id, updated_at = now()`,
      params: [...base, req.clientId, req.awareness],
    });
  }

  const readsStart = queries.length;
  queries.push(
    {
      text: `SELECT state, upto::float8 AS upto FROM doc_snapshots WHERE document_id = $1::uuid AND upto > $3::bigint AND ${IS_MEMBER}`,
      params: [...base, req.after],
    },
    {
      text: `SELECT id::float8 AS id, data, created_at < now() - interval '${SETTLE_SECONDS} seconds' AS settled
             FROM doc_updates WHERE document_id = $1::uuid AND id > $3::bigint AND ${IS_MEMBER}
             ORDER BY id LIMIT ${PAGE_SIZE}`,
      params: [...base, req.after],
    },
    {
      text: `SELECT client_id::float8 AS client_id, state FROM presence
             WHERE document_id = $1::uuid AND client_id <> $3::bigint
               AND updated_at > now() - interval '${PRESENCE_TTL_SECONDS} seconds' AND ${IS_MEMBER}`,
      params: [...base, req.clientId],
    },
    {
      text: `SELECT count(*)::int AS n FROM doc_updates
             WHERE document_id = $1::uuid AND created_at < now() - interval '10 seconds' AND ${IS_MEMBER}`,
      params: base,
    },
  );

  const results = await db.batch(queries);
  if (results[0].length === 0) return { ok: false };

  const inserted = hasUpdate ? Number((results[1][0] as Row | undefined)?.id ?? NaN) : NaN;
  const [snapRows, updateRows, peerRows, statRows] = results.slice(readsStart);

  let cursor = req.after;
  let snapshot: string | null = null;
  const snap = snapRows[0];
  if (snap) {
    snapshot = String(snap.state);
    cursor = Math.max(cursor, Number(snap.upto));
  }

  const updates = updateRows.map((r) => ({ id: Number(r.id), data: String(r.data) }));
  // Only advance past updates old enough that no earlier insert can still be committing.
  for (const r of updateRows) if (r.settled) cursor = Math.max(cursor, Number(r.id));

  const response: SyncResponse = {
    cursor,
    snapshot,
    updates,
    peers: peerRows.map((r) => ({ clientId: Number(r.client_id), state: String(r.state) })),
    inserted: Number.isFinite(inserted) ? inserted : null,
    more: updateRows.length === PAGE_SIZE,
  };
  return { ok: true, response, shouldCompact: Number(statRows[0]?.n ?? 0) >= COMPACT_AFTER };
}

function emptyResponse(after: number): SyncResponse {
  return { cursor: after, snapshot: null, updates: [], peers: [], inserted: null, more: false };
}

/**
 * Folds settled updates into the snapshot and deletes them. Takes only an unbroken prefix of
 * settled ids, and the upsert + delete is one statement, so concurrent runs can't lose data.
 */
export async function compactDocument(db: Db, docId: string): Promise<number> {
  const [snapRows, rows] = await db.batch([
    { text: "SELECT state, upto::float8 AS upto FROM doc_snapshots WHERE document_id = $1::uuid", params: [docId] },
    {
      text: `SELECT id::float8 AS id, data, created_at < now() - interval '10 seconds' AS old
             FROM doc_updates WHERE document_id = $1::uuid ORDER BY id LIMIT 2000`,
      params: [docId],
    },
  ]);

  const prefix: Row[] = [];
  for (const r of rows) {
    if (!r.old) break;
    prefix.push(r);
  }
  if (prefix.length < 2) return 0;

  const doc = new Y.Doc();
  try {
    if (snapRows[0]) Y.applyUpdate(doc, fromBase64(String(snapRows[0].state)));
    for (const r of prefix) Y.applyUpdate(doc, fromBase64(String(r.data)));
    const state = toBase64(Y.encodeStateAsUpdate(doc));
    const upto = Number(prefix[prefix.length - 1].id);

    await db.batch([
      {
        text: `WITH s AS (
                 INSERT INTO doc_snapshots (document_id, state, upto, updated_at)
                 VALUES ($1::uuid, $2::text, $3::bigint, now())
                 ON CONFLICT (document_id) DO UPDATE
                   SET state = excluded.state, upto = excluded.upto, updated_at = now()
                   WHERE doc_snapshots.upto < excluded.upto
                 RETURNING 1
               )
               DELETE FROM doc_updates WHERE document_id = $1::uuid AND id <= $3::bigint AND EXISTS (SELECT 1 FROM s)`,
        params: [docId, state, upto],
      },
      {
        text: "DELETE FROM presence WHERE document_id = $1::uuid AND updated_at < now() - interval '5 minutes'",
        params: [docId],
      },
    ]);
    return prefix.length;
  } finally {
    doc.destroy();
  }
}

/** Reads the full current document state (snapshot + log). Used for seeding and tests. */
export async function loadDocumentState(db: Db, docId: string): Promise<Uint8Array> {
  const [snapRows, rows] = await db.batch([
    { text: "SELECT state FROM doc_snapshots WHERE document_id = $1::uuid", params: [docId] },
    { text: "SELECT data FROM doc_updates WHERE document_id = $1::uuid ORDER BY id", params: [docId] },
  ]);
  const doc = new Y.Doc();
  try {
    if (snapRows[0]) Y.applyUpdate(doc, fromBase64(String(snapRows[0].state)));
    for (const r of rows) Y.applyUpdate(doc, fromBase64(String(r.data)));
    return Y.encodeStateAsUpdate(doc);
  } finally {
    doc.destroy();
  }
}
