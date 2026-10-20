import { SCHEMA_SQL } from "./schema";

export type Row = Record<string, unknown>;
export type Query = { text: string; params?: unknown[] };

export interface Db {
  query<T = Row>(text: string, params?: unknown[]): Promise<T[]>;
  /** Runs the queries in one transaction (one HTTP round trip on Neon) and returns each result. */
  batch(queries: Query[]): Promise<Row[][]>;
}

async function neonDb(url: string): Promise<Db> {
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(url);
  return {
    async query<T = Row>(text: string, params: unknown[] = []) {
      return (await sql.query(text, params)) as T[];
    },
    async batch(queries) {
      if (queries.length === 0) return [];
      const results = await sql.transaction(queries.map((q) => sql.query(q.text, q.params ?? [])));
      return results as Row[][];
    },
  };
}

/** Embedded Postgres for local development and tests. `dir` can be "memory://". */
export async function pgliteDb(dir: string): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  if (!dir.includes("://")) {
    const { mkdir } = await import("node:fs/promises");
    await mkdir(dir, { recursive: true });
  }
  const pg = new PGlite(dir);
  await pg.waitReady;
  return {
    async query<T = Row>(text: string, params: unknown[] = []) {
      return (await pg.query<T>(text, params)).rows;
    },
    async batch(queries) {
      return pg.transaction(async (tx) => {
        const out: Row[][] = [];
        for (const q of queries) out.push((await tx.query<Row>(q.text, q.params ?? [])).rows);
        return out;
      });
    },
  };
}

export function databaseUrl(): string | undefined {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || undefined;
}

async function connect(): Promise<Db> {
  const url = databaseUrl();
  let db: Db;
  if (url) {
    db = await neonDb(url);
  } else if (process.env.VERCEL) {
    throw new Error("DATABASE_URL is not set. Add the Neon integration to this Vercel project.");
  } else {
    db = await pgliteDb(process.env.PGLITE_DIR ?? ".data/pglite");
  }
  await db.query(SCHEMA_SQL);
  return db;
}

// Cached on globalThis so dev hot reloads reuse one PGlite instance instead of opening the folder twice.
const globalForDb = globalThis as unknown as { __syncflowDb?: Promise<Db> };

export function getDb(): Promise<Db> {
  if (!globalForDb.__syncflowDb) {
    globalForDb.__syncflowDb = connect().catch((err) => {
      globalForDb.__syncflowDb = undefined;
      throw err;
    });
  }
  return globalForDb.__syncflowDb;
}

/** Postgres timestamps come back as Date (PGlite) or string (Neon). */
export function iso(value: unknown): string {
  return new Date(value as string | Date).toISOString();
}
