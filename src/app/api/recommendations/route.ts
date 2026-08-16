import { and, desc, eq, isNotNull, ne, notInArray, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { likes, users } from "@/db/schema";
import { ensureUser, resolveSession } from "@/lib/auth";
import { toPublicProfile } from "@/lib/serialize";

export const dynamic = "force-dynamic";

/**
 * Лента рекомендаций с взаимным подбором ролей:
 * показываются только те, кто ИГРАЕТ на роли, которую я ищу,
 * и при этом САМ ИЩЕТ игрока моей роли.
 * (Пустой список «кого ищу» означает «любую роль».)
 */
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
    // Только прошедшие регистрацию через приложение (заполнившие анкету)
    isNotNull(users.onboardedAt),
    isNotNull(users.name),
    isNotNull(users.role),
    isNotNull(users.mmr),
    isNotNull(users.age),
    isNotNull(users.profileLink),
  ];

  // Кандидат ищет игрока моей роли (или ищет кого угодно)
  if (myRole) {
    conditions.push(
      sql`(${myRole} = ANY(${users.lookingFor}) OR coalesce(array_length(${users.lookingFor}, 1), 0) = 0)`,
    );
  }

  // Кандидат играет на роли, которую я ищу
  if (myLookingFor.length > 0) {
    conditions.push(
      sql`${users.role} = ANY(string_to_array(${myLookingFor.join(",")}, ${","}))`,
    );
  }

  const rows = await db
    .select()
    .from(users)
    .where(and(...conditions, notInArray(users.tgId, reacted)))
    .orderBy(desc(users.mmr))
    .limit(30);

  return NextResponse.json({ profiles: rows.map(toPublicProfile) });
}
