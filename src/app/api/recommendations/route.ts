import { and, desc, eq, isNotNull, ne, notInArray, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { likes, users } from "@/db/schema";
import { ensureUser, resolveSession } from "@/lib/auth";
import { toRatedPublicProfile } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await resolveSession(request);
  if (!session) {
    return NextResponse.json({ error: "Нужно открыть приложение через Telegram-бота" }, { status: 401 });
  }
  await ensureUser(session);

  const [me] = await db
    .select({ role: users.role, lookingFor: users.lookingFor })
    .from(users)
    .where(eq(users.tgId, session.tgId))
    .limit(1);

  const myRole = me?.role ?? null;
  const myLookingFor = me?.lookingFor ?? [];
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

  if (myRole) {
    conditions.push(
      sql`(${myRole} = ANY(${users.lookingFor}) OR coalesce(array_length(${users.lookingFor}, 1), 0) = 0)`,
    );
  }
  if (myLookingFor.length > 0) {
    conditions.push(sql`${users.role} = ANY(string_to_array(${myLookingFor.join(",")}, ${","}))`);
  }

  // Берём расширенный пул, затем учитываем VIP entitlement, который хранится
  // в журнале покупок. Это даёт VIP-анкетам заметно более частый показ.
  const rows = await db
    .select()
    .from(users)
    .where(and(...conditions, notInArray(users.tgId, reacted)))
    .orderBy(desc(users.mmr))
    .limit(80);

  const profiles = await Promise.all(rows.map(toRatedPublicProfile));
  profiles.sort((a, b) => {
    if (a.isVip !== b.isVip) return a.isVip ? -1 : 1;
    return (b.mmr ?? 0) - (a.mmr ?? 0);
  });

  return NextResponse.json({ profiles: profiles.slice(0, 30) });
}
