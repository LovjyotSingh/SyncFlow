# SyncFlow

**A real-time collaborative workspace that runs entirely on Vercel.** Several people edit the same page at once, with live cursors, share links, email invites and files on the page.

**Live:** [syncflow-sss.vercel.app](https://syncflow-sss.vercel.app) · Built by [Lovjyot Singh](https://lovjyotsingh.github.io)

## What you can do

- Create pages and write in a block editor. Type `/` for headings, lists, checklists, code and images.
- See who is on the page, with live cursors and selections in each person's colour.
- Share a page by link. Reset the link and old ones stop working.
- Invite by email, even before the person has an account. They join the page when they sign up.
- Drop files onto the page (up to 10 MB). Add text, code or images from a file straight into the page.
- Keep typing through a bad connection. Edits queue up and sync in order when you're back.
- Press `N` for a new page and `/` to search, from the dashboard.

## How sync works without WebSockets

Vercel Functions can't hold a WebSocket open, so SyncFlow syncs over plain HTTP with its own Yjs provider.

```
Browser (Yjs doc + HttpSyncProvider)
   │  POST /api/docs/:id/sync  { after, clientId, update?, awareness? }
   ▼
Vercel Function ── one Postgres transaction ──►  doc_updates    (append-only log)
   │                                             doc_snapshots  (compacted state)
   ◄── { cursor, updates[], peers[], snapshot? } presence       (cursors, 30 s TTL)
```

1. **Edit.** Yjs turns every change into a small, mergeable update. Concurrent edits never conflict.
2. **Batch.** The browser merges pending updates and posts them every 350 ms while anyone is typing, every 1.5 s when the page is quiet, and every 8 s in a background tab. Failed requests back off and keep the changes queued.
3. **Store and fetch in one round trip.** A single transaction (one HTTP request to Neon) checks membership, appends the update, refreshes this tab's presence, and returns every update and cursor the tab hasn't seen.
4. **Never skip an edit.** Update ids come from a sequence, and a slow concurrent insert can commit after a later id is already visible. The server only advances a client's cursor past updates older than a 3-second settle window, and re-sends newer ones. Yjs makes re-applying them harmless.
5. **Compact.** Once 100 settled updates pile up, the log is folded into a snapshot after the response is sent (`after()` in Next.js). Only an unbroken run of settled updates is folded, and the upsert plus delete is one statement, so two compactions racing can't lose data.

The sync engine is covered by tests that run against a real Postgres (PGlite) in memory: `src/lib/sync/server.test.ts`.

## Stack

| Layer | Choice |
| --- | --- |
| App | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4 |
| Editor | BlockNote on a Yjs document, with y-prosemirror cursors |
| Sync | Custom HTTP Yjs provider and route handler (`src/lib/sync`) |
| Database | Postgres on Neon (serverless HTTP driver); PGlite locally |
| Files | Vercel Blob, uploaded straight from the browser |
| Auth | Email and password (bcrypt), signed JWT session cookie (jose) |
| Tests | Vitest |

## Run it locally

You need Node.js 20.9 or newer. No database to install: without `DATABASE_URL`, SyncFlow runs an embedded Postgres (PGlite) in `./.data`.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and create an account. Open the same page in a second browser (or a private window with another account) to see live sync.

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm test` | Sync engine and share-link tests |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |

## Deploy on Vercel (free tier)

1. Import the repository into Vercel. The framework is detected as Next.js; the root directory is the repository root.
2. In the project's **Storage** tab, add **Neon** (Postgres). It sets `DATABASE_URL`. Tables are created on first request.
3. In the same tab, create a **Blob** store and connect it. It sets `BLOB_READ_WRITE_TOKEN`. Without it, everything works except file sharing.
4. Optionally set `AUTH_SECRET` to a long random string. Without it, the session key is derived from `DATABASE_URL`.
5. Deploy. `GET /api/health` reports the database and file storage status.

## Project layout

```text
src/app/                 pages and API route handlers
src/app/api/docs/[id]/sync/route.ts   the sync endpoint
src/lib/sync/            protocol, server engine, browser provider, tests
src/lib/db.ts            Neon or PGlite behind one small interface
src/lib/schema.ts        the whole schema, idempotent
src/components/editor/   editor, presence, share dialog, files panel
src/components/landing/  marketing page pieces
```

## Limits worth knowing

- Edits from other people arrive within about half a second rather than instantly, because sync uses polling instead of a socket.
- Edits made while offline are kept in memory. Closing the tab while offline loses them.
- Signing out clears the session in this browser only.
