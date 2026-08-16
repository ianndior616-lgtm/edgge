import { and, avg, count, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { likes, ratings, users } from "@/db/schema";
import {
  SMALL_BODY_LIMIT,
  hasOnlyAllowedKeys,
  rejectLargeBody,
} from "@/lib/api-guards";
import { resolveUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const ALLOWED_RATING_KEYS = ["tgId", "stars"] as const;

async function isMatched(a: number, b: number): Promise<boolean> {
  const rows = await db
    .select({ id: likes.id })
    .from(likes)
    .where(
      and(
        eq(likes.liked, true),
        // drizzle не даёт красивого OR с объектом в этой форме — делаем 2 запроса ниже
      ),
    )
    .limit(1);
  void rows;
  const [ab] = await db
    .select({ id: likes.id })
    .from(likes)
    .where(and(eq(likes.likerTgId, a), eq(likes.likedTgId, b), eq(likes.liked, true)))
    .limit(1);
  const [ba] = await db
    .select({ id: likes.id })
    .from(likes)
    .where(and(eq(likes.likerTgId, b), eq(likes.likedTgId, a), eq(likes.liked, true)))
    .limit(1);
  return Boolean(ab && ba);
}

async function ratingStats(tgId: number, myTgId: number) {
  const [stats] = await db
    .select({ avg: avg(ratings.stars), n: count() })
    .from(ratings)
    .where(eq(ratings.ratedTgId, tgId));
  const [mine] = await db
    .select({ stars: ratings.stars })
    .from(ratings)
    .where(and(eq(ratings.raterTgId, myTgId), eq(ratings.ratedTgId, tgId)))
    .limit(1);

  return {
    averageRating: stats?.avg == null ? null : Number(stats.avg),
    ratingsCount: stats?.n ?? 0,
    myRating: mine?.stars ?? null,
  };
}

/** Поставить/обновить оценку тиммейта после мэтча */
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

  let body: { tgId?: unknown; stars?: unknown };
  try {
    body = (await request.json()) as { tgId?: unknown; stars?: unknown };
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }
  if (!hasOnlyAllowedKeys(body, ALLOWED_RATING_KEYS)) {
    return NextResponse.json({ error: "Некорректные поля запроса" }, { status: 400 });
  }

  const tgId = Number(body.tgId);
  const stars = Number(body.stars);
  if (!Number.isInteger(tgId) || tgId <= 0 || tgId === me.tgId) {
    return NextResponse.json({ error: "Некорректный пользователь" }, { status: 400 });
  }
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
    return NextResponse.json({ error: "Оценка должна быть от 1 до 5" }, { status: 400 });
  }

  const [target] = await db
    .select({ tgId: users.tgId })
    .from(users)
    .where(eq(users.tgId, tgId))
    .limit(1);
  if (!target) return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });

  if (!(await isMatched(me.tgId, tgId))) {
    return NextResponse.json(
      { error: "Оценить можно только после взаимного лайка" },
      { status: 403 },
    );
  }

  await db
    .insert(ratings)
    .values({ raterTgId: me.tgId, ratedTgId: tgId, stars })
    .onConflictDoUpdate({
      target: [ratings.raterTgId, ratings.ratedTgId],
      set: { stars, updatedAt: new Date() },
    });

  const stats = await ratingStats(tgId, me.tgId);
  return NextResponse.json({ ok: true, ...stats });
}
