import { and, eq, inArray, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { likes, users } from "@/db/schema";
import { resolveSession } from "@/lib/auth";
import { toPublicProfile } from "@/lib/serialize";
import type { MatchItem } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Чаты: список взаимных лайков (совпадений) */
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
  if (ids.length === 0) {
    return NextResponse.json({ matches: [] });
  }

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
  if (matchIds.length === 0) {
    return NextResponse.json({ matches: [] });
  }

  const rows = await db
    .select()
    .from(users)
    .where(inArray(users.tgId, matchIds));

  const matchedAtByTg = new Map(
    incoming.map((r) => [
      r.tgId,
      r.matchedAt ? r.matchedAt.toISOString() : null,
    ]),
  );

  const matches: MatchItem[] = rows.map((row) => ({
    profile: toPublicProfile(row),
    matchedAt: matchedAtByTg.get(row.tgId) ?? null,
  }));

  return NextResponse.json({ matches });
}

/** Убрать совпадение (удаляет оба лайка пары) */
export async function DELETE(request: Request) {
  const session = await resolveSession(request);
  if (!session) {
    return NextResponse.json(
      { error: "Нужно открыть приложение через Telegram-бота" },
      { status: 401 },
    );
  }

  const tgId = Number(new URL(request.url).searchParams.get("tgId"));
  if (!Number.isInteger(tgId)) {
    return NextResponse.json({ error: "Некорректный tgId" }, { status: 400 });
  }

  await db
    .delete(likes)
    .where(
      or(
        and(eq(likes.likerTgId, session.tgId), eq(likes.likedTgId, tgId)),
        and(eq(likes.likerTgId, tgId), eq(likes.likedTgId, session.tgId)),
      ),
    );

  return NextResponse.json({ ok: true });
}
