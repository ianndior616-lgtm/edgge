import { db } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.execute(sql`select 1`);

    return Response.json({
      ok: true,
      database: "connected",
    });
  } catch (error) {
    console.error("DATABASE ERROR:", error);

    const message =
      error instanceof Error ? error.message : String(error);

    return Response.json(
      {
        ok: false,
        database: "failed",
        error: message,
      },
      { status: 500 }
    );
  }
}