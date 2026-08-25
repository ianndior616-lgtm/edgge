import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { likes, ratings, users } from "@/db/schema";
import { resolveUser } from "@/lib/auth";
import { feedbackTagsFromRater } from "@/lib/feedback";
import { toRatedPublicProfile } from "@/lib/serialize";
import type { MatchItem } from "@/lib/types";
import { isUserBanned } from "@/lib/wallet";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const me = await resolveUser(request);
  if (!me) {
    return NextResponse.json(
      { error: "Нужно открыть приложение через Telegram-бота" },
      { status: 401 },
    );
  }

  const outgoing = await db
    .select({ tgId: likes.likedTgId })
    .from(likes)
    .where(and(eq(likes.likerTgId, me.tgId), eq(likes.liked, true)));
  const ids = outgoing.map((r) => r.tgId);
  if (ids.length === 0) return NextResponse.json({ matches: [] });

  const incoming = await db
    .select({ tgId: likes.likerTgId, matchedAt: likes.createdAt })
    .from(likes)
    .where(
      and(
        eq(likes.likedTgId, me.tgId),
        eq(likes.liked, true),
        inArray(likes.likerTgId, ids),
      ),
    );
  const matchIds = incoming.map((r) => r.tgId);
  if (matchIds.length === 0) return NextResponse.json({ matches: [] });

  const [rows, myRatings] = await Promise.all([
    db
      .select()
      .from(users)
      .where(and(inArray(users.tgId, matchIds), isNotNull(users.username))),
    db
      .select({ tgId: ratings.ratedTgId, stars: ratings.stars })
      .from(ratings)
      .where(
        and(
          eq(ratings.raterTgId, me.tgId),
          inArray(ratings.ratedTgId, matchIds),
        ),
      ),
  ]);

  // Заблокированная анкета не должна оставаться точкой входа в переписку
  // даже у людей, с которыми мэтч случился до модерации.
  const visibleRows = (
    await Promise.all(
      rows.map(async (row) => ({ row, banned: await isUserBanned(row.tgId) })),
    )
  )
    .filter(({ banned }) => !banned)
    .map(({ row }) => row);

  const matchedAtByTg = new Map(
    incoming.map((r) => [
      r.tgId,
      r.matchedAt ? r.matchedAt.toISOString() : null,
    ]),
  );
  const myRatingByTg = new Map(myRatings.map((r) => [r.tgId, r.stars]));

  const matches: MatchItem[] = await Promise.all(
    visibleRows.map(async (row) => ({
      profile: await toRatedPublicProfile(row),
      matchedAt: matchedAtByTg.get(row.tgId) ?? null,
      myRating: myRatingByTg.get(row.tgId) ?? null,
      myFeedbackTags: await feedbackTagsFromRater(me.tgId, row.tgId),
    })),
  );

  return NextResponse.json({ matches });
}

/**
 * Убрать мэтч из «Чатов», но НЕ стирать историю пары.
 * Обе записи likes остаются в БД с liked=false. Поэтому эти люди больше
 * никогда не попадут друг другу в рекомендации.
 */
export async function DELETE(request: Request) {
  const me = await resolveUser(request);
  if (!me) {
    return NextResponse.json(
      { error: "Нужно открыть приложение через Telegram-бота" },
      { status: 401 },
    );
  }

  const tgId = Number(new URL(request.url).searchParams.get("tgId"));
  if (!Number.isInteger(tgId) || tgId <= 0 || tgId === me.tgId) {
    return NextResponse.json({ error: "Некорректный tgId" }, { status: 400 });
  }

  // Одинаковый timestamp используется как маркер закрытой пары, чтобы
  // «Начать сначала» не удалил эту историю позже.
  await db.execute(sql`
    update likes
       set liked = false,
           created_at = now()
     where (liker_tg_id = ${me.tgId} and liked_tg_id = ${tgId})
        or (liker_tg_id = ${tgId} and liked_tg_id = ${me.tgId})
  `);

  return NextResponse.json({ ok: true });
}
