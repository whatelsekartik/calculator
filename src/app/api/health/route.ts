export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Load the database only when the health endpoint is called. Keeping the
    // adapter out of module initialization lets static routes (including the
    // browser-only calculator) build without DATABASE_URL or a DB connection.
    const [{ db }, { sql }] = await Promise.all([
      import("@/db"),
      import("drizzle-orm"),
    ]);
    await db.execute(sql`select 1`);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
