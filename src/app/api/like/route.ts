import { and, eq, isNotNull, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { likes, users } from "@/db/schema";
import {
  SMALL_BODY_LIMIT,
  hasOnlyAllowedKeys,
  rejectLargeBody,
} from "@/lib/api-guards";
import { resolveSession, resolveUser } from "@/lib/auth";
import { LIKE_RECOMMENDATION_COOLDOWN_MS } from "@/lib/like-cooldown";
import { toRatedPublicProfile } from "@/lib/serialize";
import { tgApi } from "@/lib/telegram";
import { checkMilestones, recordSwipeActivity } from "@/lib/wallet";

export const dynamic = "force-dynamic";
const ALLOWED_LIKE_KEYS = ["tgId", "liked"] as const;

async function sendLikeNotification({
  chatId,
  likerName,
  appUrl,
  match,
}: {
  chatId: number;
  likerName: string;
  appUrl: string;
  match: boolean;
}) {
  try {
    await tgApi("sendMessage", {
      chat_id: chatId,
      text: match
        ? `💘 У тебя новый мэтч!\n\n${likerName} тоже лайкнул(а) тебя. Открой EdGGe и загляни в «Чаты».`
        : `❤️ Твою анкету лайкнули!\n\n${likerName} поставил(а) тебе лайк. Загляни в EdGGe — возможно, это будущий мэтч.`,
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: match ? "💬 Открыть мэтч" : "❤️ Открыть EdGGe",
              web_app: { url: appUrl },
            },
          ],
        ],
      },
    });
  } catch {
    // Пользователь мог заблокировать бота; работа лайка от этого не зависит.
  }
}

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

  // Нужен, чтобы повторный запрос/двойной клик не слал повторные уведомления.
  const [previousReaction] = await db
    .select({ liked: likes.liked })
    .from(likes)
    .where(
      and(
        eq(likes.likerTgId, session.tgId),
        eq(likes.likedTgId, tgId),
      ),
    )
    .limit(1);
  const isFreshLike = body.liked && previousReaction?.liked !== true;

  await db
    .insert(likes)
    .values({ likerTgId: session.tgId, likedTgId: tgId, liked: body.liked })
    .onConflictDoUpdate({
      target: [likes.likerTgId, likes.likedTgId],
      set: { liked: body.liked, createdAt: new Date() },
    });

  await recordSwipeActivity(session.tgId).catch(() => undefined);
  if (me.referredByTgId) {
    await checkMilestones(me.referredByTgId).catch(() => undefined);
  }

  let match = false;
  if (body.liked) {
    const reciprocal = await db
      .select({ id: likes.id })
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

    if (isFreshLike) {
      const origin = new URL(request.url).origin;
      const appUrl = process.env.APP_URL || origin;
      const likerName = me.name || session.firstName || "Игрок";
      await sendLikeNotification({
        chatId: tgId,
        likerName,
        appUrl,
        match,
      });
    }
  }

  return NextResponse.json({
    match,
    matchedProfile: match ? await toRatedPublicProfile(target) : undefined,
  });
}

/**
 * «Начать сначала» очищает обычные свайпы, но НЕ стирает историю мэтчей.
 * Активный мэтч = обе стороны liked=true.
 * Закрытый мэтч помечается одинаковым created_at у обеих записей.
 */
export async function DELETE(request: Request) {
  const session = await resolveSession(request);
  if (!session) {
    return NextResponse.json(
      { error: "Нужно открыть приложение через Telegram-бота" },
      { status: 401 },
    );
  }

  const cooldownStartedAt = new Date(
    Date.now() - LIKE_RECOMMENDATION_COOLDOWN_MS,
  );

  await db.execute(sql`
    delete from likes l
     where l.liker_tg_id = ${session.tgId}
       and (l.liked = false or l.created_at < ${cooldownStartedAt})
       and not exists (
         select 1
           from likes r
          where r.liker_tg_id = l.liked_tg_id
            and r.liked_tg_id = l.liker_tg_id
            and (
              (l.liked = true and r.liked = true)
              or l.created_at = r.created_at
            )
       )
  `);

  return NextResponse.json({ ok: true });
}
