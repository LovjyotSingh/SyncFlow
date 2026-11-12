import { beforeAll, describe, expect, it } from "vitest";
import { pgliteDb, type Db } from "./db";
import { SCHEMA_SQL } from "./schema";
import { CODE_MAX_ATTEMPTS, checkCode, hit, issueCode, normalizeCode, passwordProblem } from "./security";

let db: Db;
let userId: string;

beforeAll(async () => {
  db = await pgliteDb("memory://");
  await db.query(SCHEMA_SQL);
  // Running the schema twice must be harmless: it runs on every cold start.
  await db.query(SCHEMA_SQL);
  const rows = await db.query("INSERT INTO users (name, email, password_hash) VALUES ('Asha', 'asha@example.com', 'x') RETURNING id");
  userId = String(rows[0].id);
});

const wrongCode = (code: string) => String((Number(code) + 1) % 1_000_000).padStart(6, "0");

describe("passwordProblem", () => {
  it("accepts a reasonable password", () => {
    expect(passwordProblem("blue-river-42", { name: "Asha", email: "asha@example.com" })).toBeNull();
  });
  it("rejects short, letter-only, number-only and too-long passwords", () => {
    expect(passwordProblem("ab12")).toMatch(/at least 8/);
    expect(passwordProblem("onlyletters")).toMatch(/letter and one number/);
    expect(passwordProblem("12345678")).toMatch(/letter and one number/);
    expect(passwordProblem("a1".repeat(40))).toMatch(/at most 72/);
  });
  it("rejects passwords built from the name or email", () => {
    expect(passwordProblem("ashaverma1", { email: "ashaverma@example.com" })).toMatch(/name or email/);
  });
});

describe("normalizeCode", () => {
  it("accepts spaces and dashes, rejects anything else", () => {
    expect(normalizeCode("123 456")).toBe("123456");
    expect(normalizeCode("123-456")).toBe("123456");
    expect(normalizeCode("12345")).toBeNull();
    expect(normalizeCode("12a456")).toBeNull();
    expect(normalizeCode(123456)).toBeNull();
  });
});

describe("email codes", () => {
  it("accepts the right code exactly once", async () => {
    const code = await issueCode(db, userId, "verify");
    expect(code).toMatch(/^\d{6}$/);
    expect(await checkCode(db, userId, "verify", code)).toBe("ok");
    expect(await checkCode(db, userId, "verify", code)).toBe("expired");
  });

  it("keeps codes for different purposes apart", async () => {
    const code = await issueCode(db, userId, "verify");
    expect(await checkCode(db, userId, "reset", code)).toBe("expired");
    expect(await checkCode(db, userId, "verify", code)).toBe("ok");
  });

  it("locks the code after too many wrong guesses, even parallel ones", async () => {
    const code = await issueCode(db, userId, "reset");
    const guesses = await Promise.all(Array.from({ length: 12 }, () => checkCode(db, userId, "reset", wrongCode(code))));
    expect(guesses.filter((g) => g === "wrong")).toHaveLength(CODE_MAX_ATTEMPTS);
    expect(await checkCode(db, userId, "reset", code)).toBe("locked");
  });

  it("a new code replaces the old one and resets attempts", async () => {
    const first = await issueCode(db, userId, "verify");
    const second = await issueCode(db, userId, "verify");
    if (first !== second) expect(await checkCode(db, userId, "verify", first)).toBe("wrong");
    expect(await checkCode(db, userId, "verify", second)).toBe("ok");
  });

  it("rejects expired codes", async () => {
    const code = await issueCode(db, userId, "verify");
    await db.query("UPDATE email_codes SET expires_at = now() - interval '1 second' WHERE user_id = $1::uuid", [userId]);
    expect(await checkCode(db, userId, "verify", code)).toBe("expired");
  });

  it("stores only a hash, never the code", async () => {
    const code = await issueCode(db, userId, "verify");
    const rows = await db.query("SELECT code_hash FROM email_codes WHERE user_id = $1::uuid AND purpose = 'verify'", [userId]);
    expect(String(rows[0].code_hash)).not.toContain(code);
    expect(String(rows[0].code_hash)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("rate limits", () => {
  it("allows up to the limit in a window, then blocks", async () => {
    const results = [];
    for (let i = 0; i < 5; i++) results.push(await hit(db, "test:1.2.3.4", 3, 60));
    expect(results).toEqual([true, true, true, false, false]);
    expect(await hit(db, "test:5.6.7.8", 3, 60)).toBe(true);
  });

  it("starts a new window once the old one ends", async () => {
    for (let i = 0; i < 4; i++) await hit(db, "test:window", 3, 60);
    await db.query("UPDATE rate_limits SET reset_at = now() - interval '1 second' WHERE key = 'test:window'");
    expect(await hit(db, "test:window", 3, 60)).toBe(true);
  });
});
