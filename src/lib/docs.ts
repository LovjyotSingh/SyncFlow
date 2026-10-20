import { randomBytes } from "node:crypto";
import { getDb, iso } from "./db";
import { HttpError } from "./http";

export type Role = "owner" | "editor";

export type PageSummary = {
  id: string;
  title: string;
  role: Role;
  ownerName: string;
  memberCount: number;
  updatedAt: string;
};

export type PageDetail = {
  id: string;
  title: string;
  role: Role;
  ownerId: string;
  shareToken: string;
  updatedAt: string;
};

export type Member = { id: string; name: string; email: string; role: Role; joinedAt: string };
export type Invite = { email: string; createdAt: string };

export type SharedFile = {
  id: string;
  name: string;
  size: number;
  contentType: string;
  url: string;
  uploaderId: string | null;
  uploaderName: string | null;
  createdAt: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: string) => UUID.test(value);

export function newShareToken(): string {
  return randomBytes(18).toString("base64url");
}

const NOT_FOUND = "This page doesn't exist, or you don't have access to it.";

export async function listPages(userId: string): Promise<PageSummary[]> {
  const db = await getDb();
  const rows = await db.query(
    `SELECT d.id, d.title, m.role, u.name AS owner_name, d.updated_at,
            (SELECT count(*)::int FROM members mm WHERE mm.document_id = d.id) AS member_count
       FROM members m
       JOIN documents d ON d.id = m.document_id
       JOIN users u ON u.id = d.owner_id
      WHERE m.user_id = $1::uuid
      ORDER BY d.updated_at DESC`,
    [userId],
  );
  return rows.map((r) => ({
    id: String(r.id),
    title: String(r.title),
    role: r.role as Role,
    ownerName: String(r.owner_name),
    memberCount: Number(r.member_count),
    updatedAt: iso(r.updated_at),
  }));
}

export async function createPage(userId: string, title = "Untitled"): Promise<string> {
  const db = await getDb();
  const rows = await db.query(
    `WITH d AS (
       INSERT INTO documents (owner_id, title, share_token) VALUES ($1::uuid, $2::text, $3::text) RETURNING id
     )
     INSERT INTO members (document_id, user_id, role) SELECT id, $1::uuid, 'owner' FROM d RETURNING document_id AS id`,
    [userId, title, newShareToken()],
  );
  return String(rows[0].id);
}

export async function getPage(docId: string, userId: string): Promise<PageDetail | null> {
  if (!isUuid(docId)) return null;
  const db = await getDb();
  const rows = await db.query(
    `SELECT d.id, d.title, d.owner_id, d.share_token, d.updated_at, m.role
       FROM documents d JOIN members m ON m.document_id = d.id AND m.user_id = $2::uuid
      WHERE d.id = $1::uuid`,
    [docId, userId],
  );
  const r = rows[0];
  if (!r) return null;
  return {
    id: String(r.id),
    title: String(r.title),
    role: r.role as Role,
    ownerId: String(r.owner_id),
    shareToken: String(r.share_token),
    updatedAt: iso(r.updated_at),
  };
}

export async function requirePage(docId: string, userId: string): Promise<PageDetail> {
  const page = await getPage(docId, userId);
  if (!page) throw new HttpError(404, NOT_FOUND);
  return page;
}

export async function requireOwner(docId: string, userId: string): Promise<PageDetail> {
  const page = await requirePage(docId, userId);
  if (page.role !== "owner") throw new HttpError(403, "Only the page owner can do that.");
  return page;
}

export async function renamePage(docId: string, title: string): Promise<void> {
  const db = await getDb();
  await db.query("UPDATE documents SET title = $2::text WHERE id = $1::uuid", [docId, title]);
}

export async function deletePage(docId: string): Promise<string[]> {
  const db = await getDb();
  // Return file paths first so the route can remove the blobs after the rows are gone.
  const files = await db.query<{ url: string }>("SELECT url FROM files WHERE document_id = $1::uuid", [docId]);
  await db.query("DELETE FROM documents WHERE id = $1::uuid", [docId]);
  return files.map((f) => f.url);
}

export async function leavePage(docId: string, userId: string): Promise<void> {
  const db = await getDb();
  await db.batch([
    { text: "DELETE FROM members WHERE document_id = $1::uuid AND user_id = $2::uuid AND role <> 'owner'", params: [docId, userId] },
    { text: "DELETE FROM presence WHERE document_id = $1::uuid AND user_id = $2::uuid", params: [docId, userId] },
  ]);
}

export async function resetShareToken(docId: string): Promise<string> {
  const db = await getDb();
  const token = newShareToken();
  await db.query("UPDATE documents SET share_token = $2::text WHERE id = $1::uuid", [docId, token]);
  return token;
}

/** Adds the user to the page behind a share token. Returns the page id, or null for a dead link. */
export async function joinByToken(token: string, userId: string): Promise<string | null> {
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(token)) return null;
  const db = await getDb();
  const rows = await db.query(
    `WITH d AS (SELECT id FROM documents WHERE share_token = $1::text),
          j AS (INSERT INTO members (document_id, user_id, role)
                SELECT id, $2::uuid, 'editor' FROM d
                ON CONFLICT (document_id, user_id) DO NOTHING)
     SELECT id FROM d`,
    [token, userId],
  );
  return rows[0] ? String(rows[0].id) : null;
}

export async function listMembers(docId: string): Promise<{ members: Member[]; invites: Invite[] }> {
  const db = await getDb();
  const [memberRows, inviteRows] = await db.batch([
    {
      text: `SELECT u.id, u.name, u.email, m.role, m.joined_at
               FROM members m JOIN users u ON u.id = m.user_id
              WHERE m.document_id = $1::uuid
              ORDER BY (m.role = 'owner') DESC, m.joined_at`,
      params: [docId],
    },
    {
      text: "SELECT email, created_at FROM invites WHERE document_id = $1::uuid ORDER BY created_at",
      params: [docId],
    },
  ]);
  return {
    members: memberRows.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      email: String(r.email),
      role: r.role as Role,
      joinedAt: iso(r.joined_at),
    })),
    invites: inviteRows.map((r) => ({ email: String(r.email), createdAt: iso(r.created_at) })),
  };
}

/** Adds an existing account right away; otherwise keeps the invite until that email signs up. */
export async function inviteByEmail(docId: string, email: string, invitedBy: string): Promise<"added" | "invited"> {
  const db = await getDb();
  const users = await db.query("SELECT id FROM users WHERE email = $1::text", [email]);
  if (users[0]) {
    await db.query(
      `INSERT INTO members (document_id, user_id, role) VALUES ($1::uuid, $2::uuid, 'editor')
       ON CONFLICT (document_id, user_id) DO NOTHING`,
      [docId, users[0].id],
    );
    return "added";
  }
  await db.query(
    `INSERT INTO invites (document_id, email, invited_by) VALUES ($1::uuid, $2::text, $3::uuid)
     ON CONFLICT (document_id, email) DO NOTHING`,
    [docId, email, invitedBy],
  );
  return "invited";
}

export async function removeMember(docId: string, userId: string): Promise<void> {
  await leavePage(docId, userId);
}

export async function cancelInvite(docId: string, email: string): Promise<void> {
  const db = await getDb();
  await db.query("DELETE FROM invites WHERE document_id = $1::uuid AND email = $2::text", [docId, email]);
}

/** Turns pending invites for this email into memberships. Called after sign-up and sign-in. */
export async function acceptInvites(userId: string, email: string): Promise<void> {
  const db = await getDb();
  await db.query(
    `WITH i AS (DELETE FROM invites WHERE email = $2::text RETURNING document_id)
     INSERT INTO members (document_id, user_id, role)
     SELECT document_id, $1::uuid, 'editor' FROM i
     ON CONFLICT (document_id, user_id) DO NOTHING`,
    [userId, email],
  );
}

export async function listFiles(docId: string): Promise<SharedFile[]> {
  const db = await getDb();
  const rows = await db.query(
    `SELECT f.id, f.name, f.size, f.content_type, f.url, f.uploader_id, u.name AS uploader_name, f.created_at
       FROM files f LEFT JOIN users u ON u.id = f.uploader_id
      WHERE f.document_id = $1::uuid
      ORDER BY f.created_at DESC`,
    [docId],
  );
  return rows.map(toFile);
}

export async function addFile(
  docId: string,
  uploaderId: string,
  file: { name: string; size: number; contentType: string; url: string; pathname: string },
): Promise<SharedFile> {
  const db = await getDb();
  const rows = await db.query(
    `WITH f AS (
       INSERT INTO files (document_id, uploader_id, name, size, content_type, url, pathname)
       VALUES ($1::uuid, $2::uuid, $3::text, $4::int, $5::text, $6::text, $7::text) RETURNING *
     )
     SELECT f.*, u.name AS uploader_name FROM f LEFT JOIN users u ON u.id = f.uploader_id`,
    [docId, uploaderId, file.name, file.size, file.contentType, file.url, file.pathname],
  );
  return toFile(rows[0]);
}

export async function getFileForUser(fileId: string, userId: string) {
  if (!isUuid(fileId)) return null;
  const db = await getDb();
  const rows = await db.query(
    `SELECT f.id, f.document_id, f.uploader_id, f.url, m.role
       FROM files f JOIN members m ON m.document_id = f.document_id AND m.user_id = $2::uuid
      WHERE f.id = $1::uuid`,
    [fileId, userId],
  );
  const r = rows[0];
  if (!r) return null;
  return {
    id: String(r.id),
    documentId: String(r.document_id),
    uploaderId: r.uploader_id ? String(r.uploader_id) : null,
    url: String(r.url),
    role: r.role as Role,
  };
}

export async function deleteFile(fileId: string): Promise<void> {
  const db = await getDb();
  await db.query("DELETE FROM files WHERE id = $1::uuid", [fileId]);
}

function toFile(r: Record<string, unknown>): SharedFile {
  return {
    id: String(r.id),
    name: String(r.name),
    size: Number(r.size),
    contentType: String(r.content_type),
    url: String(r.url),
    uploaderId: r.uploader_id ? String(r.uploader_id) : null,
    uploaderName: r.uploader_name ? String(r.uploader_name) : null,
    createdAt: iso(r.created_at),
  };
}
