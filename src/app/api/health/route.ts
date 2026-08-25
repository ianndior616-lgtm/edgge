import { db, isDatabaseConfigurationError } from "@/db";
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
    if (isDatabaseConfigurationError(error)) {
      return Response.json(
        {
          ok: false,
          database: "not_configured",
          error:
            "Set DATABASE_URL or POSTGRES_URL in Vercel and apply the Drizzle schema.",
        },
        { status: 503 },
      );
    }

    console.error("DATABASE ERROR:", error);
    const message = error instanceof Error ? error.message : String(error);

    return Response.json(
      {
        ok: false,
        database: "failed",
        error: message,
      },
      { status: 500 },
    );
  }
}