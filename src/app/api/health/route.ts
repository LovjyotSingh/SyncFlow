import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const db = await getDb();
    await db.query("SELECT 1");
    return Response.json({ status: "ok" }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    // Log the details; never send internal error messages to the public.
    console.error("health check failed", err);
    return Response.json({ status: "degraded" }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
