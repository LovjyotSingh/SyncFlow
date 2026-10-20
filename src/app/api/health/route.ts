import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const db = await getDb();
    await db.query("SELECT 1");
    return Response.json({ status: "ok", database: "ok", files: Boolean(process.env.BLOB_READ_WRITE_TOKEN) });
  } catch (err) {
    return Response.json(
      { status: "degraded", database: err instanceof Error ? err.message : "unavailable" },
      { status: 503 },
    );
  }
}
