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
import {
  feedbackTagsFromRater,
  parseFeedbackTags,
  saveFeedbackTags,
} from "@/lib/feedback";

export const dynamic = "force-dynamic";

const ALLOWED_RATING_KEYS = ["tgId", "stars", "tags"] as const;

async function isMatched(a: number, b: number): Promise<boolean> {
  const [ab] = await db
    .select({ id: likes.id })
    .from(likes)
    .where(
      and(
        eq(likes.likerTgId, a),
        eq(likes.likedTgId, b),
        eq(likes.liked, true),
      ),
    )
    .limit(1);
  const [ba] = await db
    .select({ id: likes.id })
    .from(likes)
    .where(
      and(
        eq(likes.likerTgId, b),
        eq(likes.likedTgId, a),
        eq(likes.liked, true),
      ),
    )
    .limit(1);
  return Boolean(ab && ba);
}

async function ratingStats(tgId: number, myTgId: number) {
  const [stats, mine, myFeedbackTags] = await Promise.all([
    db
      .select({ avg: avg(ratings.stars), n: count() })
      .from(ratings)
      .where(eq(ratings.ratedTgId, tgId))
      .then((rows) => rows[0]),
    db
      .select({ stars: ratings.stars })
      .from(ratings)
      .where(
        and(
          eq(ratings.raterTgId, myTgId),
          eq(ratings.ratedTgId, tgId),
        ),
      )
      .limit(1)
      .then((rows) => rows[0]),
    feedbackTagsFromRater(myTgId, tgId),
  ]);

  return {
    averageRating: stats?.avg == null ? null : Number(stats.avg),
    ratingsCount: stats?.n ?? 0,
    myRating: mine?.stars ?? null,
    myFeedbackTags,
  };
}

/**
 * Поставить оценку тиммейту после мэтча.
 * И звёзды, и выбранные характеристики сохраняются один раз и неизменяемы.
 */
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

  let body: { tgId?: unknown; stars?: unknown; tags?: unknown };
  try {
    body = (await request.json()) as {
      tgId?: unknown;
      stars?: unknown;
      tags?: unknown;
    };
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }
  if (!hasOnlyAllowedKeys(body, ALLOWED_RATING_KEYS)) {
    return NextResponse.json({ error: "Некорректные поля запроса" }, { status: 400 });
  }

  const tgId = Number(body.tgId);
  const stars = Number(body.stars);
  const tags = parseFeedbackTags(body.tags);

  if (!Number.isInteger(tgId) || tgId <= 0 || tgId === me.tgId) {
    return NextResponse.json({ error: "Некорректный пользователь" }, { status: 400 });
  }
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
    return NextResponse.json({ error: "Оценка должна быть от 1 до 5" }, { status: 400 });
  }
  if (tags == null) {
    return NextResponse.json(
      { error: "Можно выбрать не больше двух характеристик" },
      { status: 400 },
    );
  }

  const [target] = await db
    .select({ tgId: users.tgId })
    .from(users)
    .where(eq(users.tgId, tgId))
    .limit(1);
  if (!target) {
    return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
  }

  if (!(await isMatched(me.tgId, tgId))) {
    return NextResponse.json(
      { error: "Оценить можно только после взаимного лайка" },
      { status: 403 },
    );
  }

  const [existing] = await db
    .select({ stars: ratings.stars })
    .from(ratings)
    .where(
      and(
        eq(ratings.raterTgId, me.tgId),
        eq(ratings.ratedTgId, tgId),
      ),
    )
    .limit(1);

  if (existing) {
    return NextResponse.json(
      {
        error: `Ты уже поставил этому игроку ${existing.stars}/5. Оценку и характеристики изменить нельзя.`,
      },
      { status: 409 },
    );
  }

  try {
    await db.insert(ratings).values({
      raterTgId: me.tgId,
      ratedTgId: tgId,
      stars,
    });
    await saveFeedbackTags(me.tgId, tgId, tags);
  } catch {
    return NextResponse.json(
      { error: "Оценка уже сохранена и изменить её нельзя" },
      { status: 409 },
    );
  }

  const stats = await ratingStats(tgId, me.tgId);
  return NextResponse.json({ ok: true, ...stats });
}
