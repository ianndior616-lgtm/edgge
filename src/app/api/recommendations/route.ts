import { and, desc, eq, gte, isNotNull, lte, ne, notInArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { likes, users } from "@/db/schema";
import { ensureUser, resolveSession } from "@/lib/auth";
import { toRatedPublicProfile } from "@/lib/serialize";

export const dynamic = "force-dynamic";

const MMR_RANGE = 2000;

export async function GET(request: Request) {
  const session = await resolveSession(request);
  if (!session) {
    return NextResponse.json(
      { error: "Нужно открыть приложение через Telegram-бота" },
      { status: 401 },
    );
  }

  await ensureUser(session);

  const [me] = await db
    .select({ mmr: users.mmr })
    .from(users)
    .where(eq(users.tgId, session.tgId))
    .limit(1);

  const reacted = db
    .select({ tgId: likes.likedTgId })
    .from(likes)
    .where(eq(likes.likerTgId, session.tgId));

  const conditions: Parameters<typeof and>[0][] = [
    eq(users.isActive, true),
    ne(users.tgId, session.tgId),
    isNotNull(users.onboardedAt),
    isNotNull(users.name),
    isNotNull(users.role),
    isNotNull(users.mmr),
    isNotNull(users.age),
    isNotNull(users.profileLink),
  ];

  // Роли намеренно НЕ фильтруем: пользователю показываются carry/mid/offlane/
  // support любых позиций. Единственное игровое ограничение — близость MMR.
  if (me?.mmr != null) {
    conditions.push(gte(users.mmr, Math.max(0, me.mmr - MMR_RANGE)));
    conditions.push(lte(users.mmr, me.mmr + MMR_RANGE));
  }

  const rows = await db
    .select()
    .from(users)
    .where(and(...conditions, notInArray(users.tgId, reacted)))
    // VIP выше обычных анкет; внутри группы — более высокий MMR.
    .orderBy(desc(users.isAdmin), desc(users.mmr))
    .limit(30);

  return NextResponse.json({
    profiles: await Promise.all(rows.map(toRatedPublicProfile)),
  });
}
