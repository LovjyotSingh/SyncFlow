import { beforeEach, describe, expect, it } from "vitest";
import * as Y from "yjs";
import { pgliteDb, type Db } from "../db";
import { SCHEMA_SQL } from "../schema";
import { fromBase64, toBase64 } from "./encoding";
import { compactDocument, loadDocumentState, syncDocument } from "./server";
import type { SyncResponse } from "./protocol";

let db: Db;
let owner: string;
let guest: string;
let outsider: string;
let docId: string;

async function user(name: string) {
  const rows = await db.query("INSERT INTO users (name, email, password_hash) VALUES ($1, $2, 'x') RETURNING id", [
    name,
    `${name}@example.com`,
  ]);
  return String(rows[0].id);
}

function edit(doc: Y.Doc, text: string) {
  let update: Uint8Array | null = null;
  const capture = (u: Uint8Array) => (update = u);
  doc.on("update", capture);
  doc.getText("t").insert(doc.getText("t").length, text);
  doc.off("update", capture);
  return toBase64(update!);
}

function apply(doc: Y.Doc, res: SyncResponse) {
  if (res.snapshot) Y.applyUpdate(doc, fromBase64(res.snapshot));
  for (const u of res.updates) Y.applyUpdate(doc, fromBase64(u.data));
}

async function sync(userId: string, body: Parameters<typeof syncDocument>[3]) {
  const result = await syncDocument(db, docId, userId, body);
  if (!result.ok) throw new Error("expected access");
  return result.response;
}

const settleAll = () => db.query("UPDATE doc_updates SET created_at = now() - interval '1 minute'");

beforeEach(async () => {
  db = await pgliteDb("memory://");
  await db.query(SCHEMA_SQL);
  owner = await user("owner");
  guest = await user("guest");
  outsider = await user("outsider");
  const rows = await db.query("INSERT INTO documents (owner_id, share_token) VALUES ($1, 'token-123456') RETURNING id", [owner]);
  docId = String(rows[0].id);
  await db.query("INSERT INTO members (document_id, user_id, role) VALUES ($1, $2, 'owner'), ($1, $3, 'editor')", [
    docId,
    owner,
    guest,
  ]);
});

describe("syncDocument", () => {
  it("delivers one client's edit to another", async () => {
    const a = new Y.Doc();
    const b = new Y.Doc();
    const first = await sync(owner, { after: -1, clientId: a.clientID, update: edit(a, "hello") });
    expect(first.inserted).toBeTypeOf("number");

    const got = await sync(guest, { after: -1, clientId: b.clientID });
    apply(b, got);
    expect(b.getText("t").toString()).toBe("hello");
  });

  it("refuses people who are not members", async () => {
    const result = await syncDocument(db, docId, outsider, { after: -1, clientId: 1, update: edit(new Y.Doc(), "x") });
    expect(result.ok).toBe(false);
    expect(await db.query("SELECT 1 FROM doc_updates")).toHaveLength(0);
  });

  it("keeps re-sending recent updates until they settle, then advances the cursor", async () => {
    const a = new Y.Doc();
    await sync(owner, { after: -1, clientId: a.clientID, update: edit(a, "one") });

    const fresh = await sync(guest, { after: -1, clientId: 2 });
    expect(fresh.updates).toHaveLength(1);
    expect(fresh.cursor).toBe(-1);

    await settleAll();
    const settled = await sync(guest, { after: -1, clientId: 2 });
    expect(settled.cursor).toBe(settled.updates[0].id);
    const after = await sync(guest, { after: settled.cursor, clientId: 2 });
    expect(after.updates).toHaveLength(0);
  });

  it("compacts the log into a snapshot without losing text", async () => {
    const a = new Y.Doc();
    for (let i = 0; i < 120; i++) await sync(owner, { after: -1, clientId: a.clientID, update: edit(a, `${i},`) });
    await settleAll();

    const folded = await compactDocument(db, docId);
    expect(folded).toBe(120);
    expect(await db.query("SELECT 1 FROM doc_updates")).toHaveLength(0);

    const late = new Y.Doc();
    const res = await sync(guest, { after: -1, clientId: late.clientID });
    expect(res.snapshot).not.toBeNull();
    apply(late, res);
    expect(late.getText("t").toString()).toBe(a.getText("t").toString());

    const stored = new Y.Doc();
    Y.applyUpdate(stored, await loadDocumentState(db, docId));
    expect(stored.getText("t").toString()).toBe(a.getText("t").toString());
  });

  it("only compacts an unbroken run of settled updates", async () => {
    const a = new Y.Doc();
    for (let i = 0; i < 5; i++) await sync(owner, { after: -1, clientId: a.clientID, update: edit(a, `${i}`) });
    // Age everything except the middle update.
    await db.query(
      "UPDATE doc_updates SET created_at = now() - interval '1 minute' WHERE id <> (SELECT min(id) + 2 FROM doc_updates)",
    );
    expect(await compactDocument(db, docId)).toBe(2);
    expect(await db.query("SELECT 1 FROM doc_updates")).toHaveLength(3);

    const b = new Y.Doc();
    apply(b, await sync(guest, { after: -1, clientId: b.clientID }));
    expect(b.getText("t").toString()).toBe("01234");
  });

  it("shares presence between tabs and removes it when a tab leaves", async () => {
    await sync(owner, { after: -1, clientId: 11, awareness: "AAAA" });
    const seen = await sync(guest, { after: -1, clientId: 22 });
    expect(seen.peers).toEqual([{ clientId: 11, state: "AAAA" }]);

    await sync(owner, { after: -1, clientId: 11, leaving: true });
    const gone = await sync(guest, { after: -1, clientId: 22 });
    expect(gone.peers).toEqual([]);
  });
});
