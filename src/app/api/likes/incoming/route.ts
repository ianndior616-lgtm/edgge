import { and, eq, inArray, isNotNull, notInArray } from "drizzle-orm";
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
    return NextResponse.json({ error: "Нужно открыть приложение через Telegram-бота" }, { status: 401 });
  }

  const incoming = await db
    .select({ tgId: likes.likerTgId })
    .from(likes)
    .where(and(eq(likes.likedTgId, me.tgId), eq(likes.liked, true)));

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
        isNotNull(users.onboardedAt),
      ),
    );

  return NextResponse.json({
    profiles: await Promise.all(rows.map(toRatedPublicProfile)),
  });
}
