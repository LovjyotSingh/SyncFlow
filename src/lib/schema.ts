// The whole schema in one idempotent statement, so it can run on every cold start
// against Neon's HTTP driver (one statement per request) and against PGlite locally.
export const SCHEMA_SQL = /* sql */ `
DO $$
BEGIN
  CREATE TABLE IF NOT EXISTS users (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name          text NOT NULL,
    email         text NOT NULL UNIQUE,
    password_hash text NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS documents (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       text NOT NULL DEFAULT 'Untitled',
    share_token text NOT NULL UNIQUE,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS members (
    document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role        text NOT NULL DEFAULT 'editor',
    joined_at   timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (document_id, user_id)
  );
  CREATE INDEX IF NOT EXISTS members_user_idx ON members (user_id);

  CREATE TABLE IF NOT EXISTS invites (
    document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    email       text NOT NULL,
    invited_by  uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (document_id, email)
  );
  CREATE INDEX IF NOT EXISTS invites_email_idx ON invites (email);

  -- Compacted Yjs state. Every update with id <= upto is folded into state.
  CREATE TABLE IF NOT EXISTS doc_snapshots (
    document_id uuid PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
    state       text NOT NULL,
    upto        bigint NOT NULL DEFAULT 0,
    updated_at  timestamptz NOT NULL DEFAULT now()
  );

  -- Append-only log of Yjs updates (base64), read by every client polling the page.
  CREATE TABLE IF NOT EXISTS doc_updates (
    id          bigserial PRIMARY KEY,
    document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    data        text NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS doc_updates_doc_idx ON doc_updates (document_id, id);

  -- Yjs awareness (cursors, names) per browser tab, expired by updated_at.
  CREATE TABLE IF NOT EXISTS presence (
    document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    client_id   bigint NOT NULL,
    user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    state       text NOT NULL,
    updated_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (document_id, client_id)
  );

  CREATE TABLE IF NOT EXISTS files (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id  uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    uploader_id  uuid REFERENCES users(id) ON DELETE SET NULL,
    name         text NOT NULL,
    size         integer NOT NULL,
    content_type text NOT NULL,
    url          text NOT NULL,
    pathname     text NOT NULL,
    created_at   timestamptz NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS files_doc_idx ON files (document_id);

  -- Account security. token_version is bumped to revoke every session issued before it.
  ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version integer NOT NULL DEFAULT 0;

  -- 6-digit email codes. Only a SHA-256 hash is stored; attempts caps wrong guesses.
  CREATE TABLE IF NOT EXISTS email_codes (
    user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    purpose    text NOT NULL,
    code_hash  text NOT NULL,
    attempts   integer NOT NULL DEFAULT 0,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, purpose)
  );

  -- Fixed-window rate limits shared by every serverless instance.
  CREATE TABLE IF NOT EXISTS rate_limits (
    key      text PRIMARY KEY,
    count    integer NOT NULL,
    reset_at timestamptz NOT NULL
  );
END
$$;
`;
