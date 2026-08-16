import { and, eq, isNotNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { reports, users } from "@/db/schema";
import {
  SMALL_BODY_LIMIT,
  hasOnlyAllowedKeys,
  rejectLargeBody,
} from "@/lib/api-guards";
import { resolveUser } from "@/lib/auth";
import { REPORT_REASON_IDS } from "@/lib/report-reasons";

export const dynamic = "force-dynamic";

const ALLOWED_REPORT_KEYS = ["reportedTgId", "reason"] as const;

/** Отправить жалобу на анкету из рекомендаций */
export async function POST(request: Request) {
  const tooLarge = rejectLargeBody(request, SMALL_BODY_LIMIT);
  if (tooLarge) return tooLarge;

  const me = await resolveUser(request);
  if (!me) {
    return NextResponse.json(
      { error: "Нужно открыть приложение через Telegram-бота" },
      { status: 401 },
    );
  }
  if (!me.onboardedAt) {
    return NextResponse.json(
      { error: "Сначала заполни свою анкету" },
      { status: 403 },
    );
  }

  let body: { reportedTgId?: unknown; reason?: unknown };
  try {
    body = (await request.json()) as { reportedTgId?: unknown; reason?: unknown };
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }
  if (!hasOnlyAllowedKeys(body, ALLOWED_REPORT_KEYS)) {
    return NextResponse.json({ error: "Некорректные поля запроса" }, { status: 400 });
  }

  const reportedTgId = Number(body.reportedTgId);
  if (!Number.isInteger(reportedTgId) || reportedTgId <= 0 || reportedTgId === me.tgId) {
    return NextResponse.json({ error: "Некорректная анкета" }, { status: 400 });
  }
  const reason = typeof body.reason === "string" ? body.reason : "";
  if (!REPORT_REASON_IDS.has(reason as never)) {
    return NextResponse.json({ error: "Выбери причину жалобы" }, { status: 400 });
  }

  const [target] = await db
    .select({ tgId: users.tgId })
    .from(users)
    .where(
      and(
        eq(users.tgId, reportedTgId),
        isNotNull(users.onboardedAt),
      ),
    )
    .limit(1);
  if (!target) {
    return NextResponse.json({ error: "Анкета не найдена" }, { status: 404 });
  }

  await db
    .insert(reports)
    .values({
      reporterTgId: me.tgId,
      reportedTgId,
      reason,
    })
    .onConflictDoNothing();

  return NextResponse.json({ ok: true });
}
