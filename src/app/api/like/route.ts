import { and, eq, isNotNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { likes, users } from "@/db/schema";
import {
  SMALL_BODY_LIMIT,
  hasOnlyAllowedKeys,
  rejectLargeBody,
} from "@/lib/api-guards";
import { resolveSession, resolveUser } from "@/lib/auth";
import { toPublicProfile } from "@/lib/serialize";
import { tgApi } from "@/lib/telegram";

export const dynamic = "force-dynamic";

const ALLOWED_LIKE_KEYS = ["tgId", "liked"] as const;

/**
 * Свайп: POST { tgId, liked } — лайк или «мимо».
 * Если лайк взаимный — возвращает match:true с анкетой партнёра
 * и уведомляет его через бота.
 */
export async function POST(request: Request) {
  const tooLarge = rejectLargeBody(request, SMALL_BODY_LIMIT);
  if (tooLarge) return tooLarge;

  const session = await resolveSession(request);
  const me = await resolveUser(request);
  if (!session || !me) {
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

  let body: { tgId?: unknown; liked?: unknown };
  try {
    body = (await request.json()) as { tgId?: unknown; liked?: unknown };
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  if (!hasOnlyAllowedKeys(body, ALLOWED_LIKE_KEYS)) {
    return NextResponse.json({ error: "Некорректные поля запроса" }, { status: 400 });
  }

  const tgId = Number(body.tgId);
  if (!Number.isInteger(tgId) || tgId <= 0 || tgId === session.tgId) {
    return NextResponse.json({ error: "Некорректная цель" }, { status: 400 });
  }
  if (typeof body.liked !== "boolean") {
    return NextResponse.json({ error: "liked должен быть boolean" }, { status: 400 });
  }
  const liked = body.liked;

  const [target] = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.tgId, tgId),
        eq(users.isActive, true),
        isNotNull(users.onboardedAt),
      ),
    )
    .limit(1);

  if (!target) {
    return NextResponse.json({ error: "Анкета не найдена" }, { status: 404 });
  }

  await db
    .insert(likes)
    .values({ likerTgId: session.tgId, likedTgId: tgId, liked })
    .onConflictDoUpdate({
      target: [likes.likerTgId, likes.likedTgId],
      set: { liked, createdAt: new Date() },
    });

  let match = false;
  if (liked) {
    const reciprocal = await db
      .select()
      .from(likes)
      .where(
        and(
          eq(likes.likerTgId, tgId),
          eq(likes.likedTgId, session.tgId),
          eq(likes.liked, true),
        ),
      )
      .limit(1);
    match = reciprocal.length > 0;

    if (match) {
      // Уведомляем партнёра через бота (если он запускал бота)
      try {
        const origin = new URL(request.url).origin;
        const appUrl = process.env.APP_URL || origin;
        const likerName = session.firstName || "Игрок";
        await tgApi("sendMessage", {
          chat_id: tgId,
          text: `💘 Это взаимно!\n\n${likerName} тоже лайкнул(а) тебя. Загляни в раздел «Чаты», чтобы написать:`,
          reply_markup: {
            inline_keyboard: [
              [{ text: "💬 Открыть чаты", web_app: { url: appUrl } }],
            ],
          },
        });
      } catch {
        // бот недоступен — не критично
      }
    }
  }

  return NextResponse.json({
    match,
    matchedProfile: match ? toPublicProfile(target) : undefined,
  });
}

/** Сброс всех реакций пользователя — лента рекомендаций наполняется заново */
export async function DELETE(request: Request) {
  const session = await resolveSession(request);
  if (!session) {
    return NextResponse.json(
      { error: "Нужно открыть приложение через Telegram-бота" },
      { status: 401 },
    );
  }

  await db.delete(likes).where(eq(likes.likerTgId, session.tgId));
  return NextResponse.json({ ok: true });
}
