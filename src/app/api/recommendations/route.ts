import {
  and,
  desc,
  eq,
  gte,
  isNotNull,
  lte,
  ne,
  notInArray,
  or,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { likes, users } from "@/db/schema";
import { resolveUser } from "@/lib/auth";
import { LIKE_RECOMMENDATION_COOLDOWN_MS } from "@/lib/like-cooldown";
import { toRatedPublicProfile } from "@/lib/serialize";

export const dynamic = "force-dynamic";

const MMR_RANGE = 2000;

export async function GET(request: Request) {
  const currentUser = await resolveUser(request);
  if (!currentUser) {
    return NextResponse.json(
      { error: "Нужно открыть приложение через Telegram-бота" },
      { status: 401 },
    );
  }

  const [me] = await db
    .select({ mmr: users.mmr })
    .from(users)
    .where(eq(users.tgId, currentUser.tgId))
    .limit(1);

  const cooldownStartedAt = new Date(
    Date.now() - LIKE_RECOMMENDATION_COOLDOWN_MS,
  );
  const reciprocalLikes = alias(likes, "reciprocal_likes");

  // Дизлайки скрыты до ручного сброса, мэтчи — навсегда, а обычный
  // односторонний лайк прячет анкету только на 30 минут.
  const hiddenReactions = db
    .select({ tgId: likes.likedTgId })
    .from(likes)
    .leftJoin(
      reciprocalLikes,
      and(
        eq(reciprocalLikes.likerTgId, likes.likedTgId),
        eq(reciprocalLikes.likedTgId, likes.likerTgId),
      ),
    )
    .where(
      and(
        eq(likes.likerTgId, currentUser.tgId),
        or(
          eq(likes.liked, false),
          gte(likes.createdAt, cooldownStartedAt),
          eq(reciprocalLikes.liked, true),
        ),
      ),
    );

  const conditions: Parameters<typeof and>[0][] = [
    eq(users.isActive, true),
    ne(users.tgId, currentUser.tgId),
    // В рекомендациях показываем только людей, которым действительно можно
    // написать после взаимного лайка.
    isNotNull(users.username),
    isNotNull(users.onboardedAt),
    isNotNull(users.name),
    isNotNull(users.role),
    isNotNull(users.mmr),
    isNotNull(users.age),
    isNotNull(users.profileLink),
  ];

  // Роли намеренно НЕ фильтруем: показываем все позиции.
  // Единственное игровое ограничение — диапазон ±2000 MMR.
  if (me?.mmr != null) {
    conditions.push(gte(users.mmr, Math.max(0, me.mmr - MMR_RANGE)));
    conditions.push(lte(users.mmr, me.mmr + MMR_RANGE));
  }

  // Берём запас кандидатов, потому что фактические VIP и временный статус
  // «Ищу пати сейчас» вычисляются отдельно и сортируются уже после сериализации.
  const rows = await db
    .select()
    .from(users)
    .where(and(...conditions, notInArray(users.tgId, hiddenReactions)))
    .orderBy(desc(users.isAdmin), desc(users.mmr))
    .limit(100);

  const profiles = await Promise.all(rows.map(toRatedPublicProfile));

  profiles.sort((a, b) => {
    if (a.isLookingNow !== b.isLookingNow) return a.isLookingNow ? -1 : 1;
    if (a.isVip !== b.isVip) return a.isVip ? -1 : 1;
    return (b.mmr ?? 0) - (a.mmr ?? 0);
  });

  return NextResponse.json({ profiles: profiles.slice(0, 30) });
}
