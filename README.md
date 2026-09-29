# SyncFlow

## About

SyncFlow is a real-time collaborative workspace. Sign in, write on the same page as other people, and the document stays in sync for everyone in the room. Share a link to invite someone, or paste their link into Connect to join. Use the plus button to share a file with the people already on that page.

Built with Next.js, TypeScript, a BlockNote editor, Yjs over Socket.io, MongoDB, and Redis.

**Live demo:** [syncflow-sss.vercel.app](https://syncflow-sss.vercel.app)

## What you can do

- Create an account and keep a private list of pages.
- Write in a block editor. Type `/` for headings, lists, and quotes.
- See who else is on the page, with a live cursor and a presence chip.
- Share a page by link or by email. Anyone with the link can edit after they sign in.
- Paste a share link into **Connect** and join that page without opening it in a new tab.
- Reset a link so the old one stops working. The owner can delete a page; a collaborator can leave it.
- Share a file from the **+** button. Everyone on the page can open it. The owner, or the person who added it, can remove it.

Press `N` to create a page when you are not typing in a field.

## Stack

| Layer | Choice |
| --- | --- |
| Web app | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| Editor | BlockNote on a Yjs document |
| Realtime | Socket.io, with Yjs updates and awareness for cursors |
| API | Express 5 |
| Accounts | JWT sessions, passwords hashed with bcrypt |
| Pages and files | MongoDB |
| Live document state | Redis, with an in-memory fallback when Redis is not set |

## How a page stays in sync

1. The browser opens a Socket.io connection and joins a document room with its JWT.
2. The server checks that the user owns the page or is a collaborator, then sends the current Yjs state.
3. Edits and cursor moves are broadcast to the rest of the room.
4. The Yjs document is written to Redis about 700ms after the latest change and kept for 30 days.
5. Page titles, members, share tokens, and uploaded files live in MongoDB.

Without `REDIS_URL`, document text stays in the API process and is lost on restart. Accounts, page lists, and shared files still persist in MongoDB.

## Repository layout

```text
frontend/     Next.js app (pages, editor, share dialog, file list)
backend/      Express API, Socket.io server, MongoDB models
docker-compose.yml   Local MongoDB and Redis
```

The important UI lives in `frontend/src/components`. Document and file routes live in `backend/src/routes/documents.ts`. The realtime room lives in `backend/src/socket/index.ts`.

## Run it locally

You need Node.js 22 or newer.

### 1. Start MongoDB and Redis

```bash
docker compose up -d
```

MongoDB is on `localhost:27017`. Redis is on `localhost:6379`.

### 2. Start the API

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

Use this `.env` for the Docker services:

```bash
PORT=5000
FRONTEND_URL=http://localhost:3000
MONGODB_URI=mongodb://127.0.0.1:27017/syncflow
REDIS_URL=redis://127.0.0.1:6379
JWT_SECRET=replace-with-a-long-random-string
```

The API listens on [http://localhost:5000](http://localhost:5000). `GET /api/health` returns `{ "status": "ok", "service": "SyncFlow" }`.

`JWT_SECRET` falls back to a development value when it is unset. Set your own before you share a deployment.

### 3. Start the web app

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The app calls `http://localhost:5000` unless you set `NEXT_PUBLIC_BACKEND_URL`.

```bash
# frontend/.env.local
NEXT_PUBLIC_BACKEND_URL=http://localhost:5000
```

Create an account with a name, an email, and a password of at least 8 characters.

## Share a page

1. Open a page and choose **Share**.
2. Copy the link, or invite someone by email. An invite for an existing account adds them immediately. An unknown email is saved until that person signs up and opens the link.
3. The other person signs in, pastes the link into **Connect**, and chooses **Join**.
4. They can also open `/doc/<share-token>` directly. If they are signed out, SyncFlow sends them through login and then adds them to the page.

**Reset link** replaces the token. Old links no longer join the page. People who already joined stay on it.

## Share a file

The **+** button next to **Share** uploads one file to the current page.

- Maximum size is 10 MB.
- A page holds up to 40 files.
- File bytes are stored in MongoDB, so both collaborators can open them after a refresh.
- Text and images open in the page. PDFs open in a new tab. Other types download.
- Only members of the page can list or upload files. Removing a file is limited to the page owner and the person who shared it.

A new or removed file is pushed to the open room with a `files-changed` event, so the list updates without a reload.

## Scripts

| Where | Command | What it does |
| --- | --- | --- |
| `frontend` | `npm run dev` | Next.js dev server |
| `frontend` | `npm run build` | Production build |
| `frontend` | `npm run lint` | ESLint |
| `backend` | `npm run dev` | API with reload |
| `backend` | `npm run build` | Compile TypeScript to `dist/` |
| `backend` | `npm start` | Run the compiled API |

The share-link parser has a small test:

```bash
cd frontend
node --experimental-strip-types --test src/lib/shareLink.test.ts
```

## Deploy

The frontend is a Next.js app and can be deployed on Vercel. Set `NEXT_PUBLIC_BACKEND_URL` to the public API origin. The value is read in the browser, so it must be reachable from the people using the demo.

The API is a long-running Node server because of Socket.io. `backend/render.yaml` is a starting point for Render. Set `MONGODB_URI`, `REDIS_URL`, and `JWT_SECRET` in the host’s environment. Point MongoDB Atlas and your Redis provider at those variables. Network access on the database must allow the API host.

A split deploy only works when the API allows the frontend origin. The server currently reflects the request origin in CORS.

## Limits worth knowing

- Document text is not written into the MongoDB page document. Redis holds that state. If Redis is down, a restart drops unsaved editor content.
- Shared files are capped at 10 MB because each file is one MongoDB document.
- Signing out clears the token in this browser. It does not end sessions on other devices.
