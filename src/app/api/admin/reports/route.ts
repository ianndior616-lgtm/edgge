import { desc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { reports, users } from "@/db/schema";
import { resolveUser } from "@/lib/auth";
import { toPublicProfile } from "@/lib/serialize";
import type { ReportReason, ReportView } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Админ-панель: список открытых жалоб */
export async function GET(request: Request) {
  const admin = await resolveUser(request);
  if (!admin) {
    return NextResponse.json(
      { error: "Нужно открыть приложение через Telegram-бота" },
      { status: 401 },
    );
  }
  if (!admin.isAdmin) {
    return NextResponse.json(
      { error: "Только для администраторов" },
      { status: 403 },
    );
  }

  const rows = await db
    .select()
    .from(reports)
    .where(eq(reports.status, "open"))
    .orderBy(desc(reports.createdAt))
    .limit(100);

  if (rows.length === 0) return NextResponse.json({ reports: [] });

  const tgIds = [
    ...new Set(rows.flatMap((r) => [r.reporterTgId, r.reportedTgId])),
  ];
  const userRows = await db.select().from(users).where(inArray(users.tgId, tgIds));
  const byTg = new Map(userRows.map((u) => [u.tgId, u]));

  const list: ReportView[] = rows
    .map((r) => {
      const reported = byTg.get(r.reportedTgId);
      if (!reported) return null;
      const reporter = byTg.get(r.reporterTgId) ?? null;
      return {
        id: r.id,
        reason: r.reason as ReportReason,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
        reporter: reporter ? toPublicProfile(reporter) : null,
        reported: toPublicProfile(reported),
      } satisfies ReportView;
    })
    .filter((x): x is ReportView => x !== null);

  return NextResponse.json({ reports: list });
}
