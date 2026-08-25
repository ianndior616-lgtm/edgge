import {
  and,
  desc,
  eq,
  inArray,
  isNotNull,
  notInArray,
} from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { likes, users } from "@/db/schema";
import { resolveUser } from "@/lib/auth";
import { toRatedPublicProfile } from "@/lib/serialize";

export const dynamic = "force-dynamic";

/** Люди, которые лайкнули меня, но я им ещё не ответил. */
export async function GET(request: Request) {
  const me = await resolveUser(request);
  if (!me) {
    return NextResponse.json(
      { error: "Нужно открыть приложение через Telegram-бота" },
      { status: 401 },
    );
  }

  const incoming = await db
    .select({ tgId: likes.likerTgId })
    .from(likes)
    .where(and(eq(likes.likedTgId, me.tgId), eq(likes.liked, true)))
    .orderBy(desc(likes.createdAt));

  const ids = [...new Set(incoming.map((x) => x.tgId))];
  if (ids.length === 0) return NextResponse.json({ profiles: [] });

  const myReactions = db
    .select({ tgId: likes.likedTgId })
    .from(likes)
    .where(eq(likes.likerTgId, me.tgId));

  const rows = await db
    .select()
    .from(users)
    .where(
      and(
        inArray(users.tgId, ids),
        notInArray(users.tgId, myReactions),
        eq(users.isActive, true),
        // Старые записи без @username не могут попасть в ответный лайк:
        // после мэтча с ними нельзя открыть t.me-чат.
        isNotNull(users.username),
        isNotNull(users.onboardedAt),
      ),
    );

  // SQL IN не сохраняет порядок входящих лайков; восстанавливаем его для UI.
  const byTgId = new Map(rows.map((row) => [row.tgId, row]));
  const orderedRows = ids.flatMap((tgId) => {
    const row = byTgId.get(tgId);
    return row ? [row] : [];
  });

  return NextResponse.json({
    profiles: await Promise.all(orderedRows.map(toRatedPublicProfile)),
  });
}
