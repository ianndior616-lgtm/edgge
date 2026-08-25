import { and, eq, isNotNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import {
  SMALL_BODY_LIMIT,
  hasOnlyAllowedKeys,
  rejectLargeBody,
} from "@/lib/api-guards";
import { resolveUser } from "@/lib/auth";
import { recordProfileView } from "@/lib/profile-stats";

export const dynamic = "force-dynamic";
const ALLOWED_KEYS = ["tgId"] as const;

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

  let body: { tgId?: unknown };
  try {
    body = (await request.json()) as { tgId?: unknown };
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  if (!hasOnlyAllowedKeys(body, ALLOWED_KEYS)) {
    return NextResponse.json({ error: "Некорректные поля запроса" }, { status: 400 });
  }

  const tgId = Number(body.tgId);
  if (!Number.isInteger(tgId) || tgId <= 0 || tgId === me.tgId) {
    return NextResponse.json({ error: "Некорректная анкета" }, { status: 400 });
  }

  const [target] = await db
    .select({ tgId: users.tgId })
    .from(users)
    .where(
      and(
        eq(users.tgId, tgId),
        eq(users.isActive, true),
        isNotNull(users.username),
        isNotNull(users.onboardedAt),
      ),
    )
    .limit(1);

  if (!target) {
    return NextResponse.json({ error: "Анкета не найдена" }, { status: 404 });
  }

  await recordProfileView(me.tgId, tgId);
  return NextResponse.json({ ok: true });
}
