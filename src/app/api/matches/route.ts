import { and, eq, inArray, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { likes, ratings, users } from "@/db/schema";
import { resolveSession } from "@/lib/auth";
import { feedbackTagsFromRater } from "@/lib/feedback";
import { toRatedPublicProfile } from "@/lib/serialize";
import type { MatchItem } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await resolveSession(request);
  if (!session) {
    return NextResponse.json(
      { error: "Нужно открыть приложение через Telegram-бота" },
      { status: 401 },
    );
  }

  const outgoing = await db
    .select({ tgId: likes.likedTgId })
    .from(likes)
    .where(and(eq(likes.likerTgId, session.tgId), eq(likes.liked, true)));
  const ids = outgoing.map((r) => r.tgId);
  if (ids.length === 0) return NextResponse.json({ matches: [] });

  const incoming = await db
    .select({ tgId: likes.likerTgId, matchedAt: likes.createdAt })
    .from(likes)
    .where(
      and(
        eq(likes.likedTgId, session.tgId),
        eq(likes.liked, true),
        inArray(likes.likerTgId, ids),
      ),
    );
  const matchIds = incoming.map((r) => r.tgId);
  if (matchIds.length === 0) return NextResponse.json({ matches: [] });

  const [rows, myRatings] = await Promise.all([
    db.select().from(users).where(inArray(users.tgId, matchIds)),
    db
      .select({ tgId: ratings.ratedTgId, stars: ratings.stars })
      .from(ratings)
      .where(
        and(
          eq(ratings.raterTgId, session.tgId),
          inArray(ratings.ratedTgId, matchIds),
        ),
      ),
  ]);

  const matchedAtByTg = new Map(
    incoming.map((r) => [
      r.tgId,
      r.matchedAt ? r.matchedAt.toISOString() : null,
    ]),
  );
  const myRatingByTg = new Map(myRatings.map((r) => [r.tgId, r.stars]));

  const matches: MatchItem[] = await Promise.all(
    rows.map(async (row) => ({
      profile: await toRatedPublicProfile(row),
      matchedAt: matchedAtByTg.get(row.tgId) ?? null,
      myRating: myRatingByTg.get(row.tgId) ?? null,
      myFeedbackTags: await feedbackTagsFromRater(session.tgId, row.tgId),
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
  const session = await resolveSession(request);
  if (!session) {
    return NextResponse.json(
      { error: "Нужно открыть приложение через Telegram-бота" },
      { status: 401 },
    );
  }

  const tgId = Number(new URL(request.url).searchParams.get("tgId"));
  if (!Number.isInteger(tgId) || tgId <= 0 || tgId === session.tgId) {
    return NextResponse.json({ error: "Некорректный tgId" }, { status: 400 });
  }

  // Одинаковый timestamp используется как маркер закрытой пары, чтобы
  // «Начать сначала» не удалил эту историю позже.
  await db.execute(sql`
    update likes
       set liked = false,
           created_at = now()
     where (liker_tg_id = ${session.tgId} and liked_tg_id = ${tgId})
        or (liker_tg_id = ${tgId} and liked_tg_id = ${session.tgId})
  `);

  return NextResponse.json({ ok: true });
}
