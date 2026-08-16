import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { ensureUser, resolveSession } from "@/lib/auth";
import { importDotaProfile } from "@/lib/dota-profile";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await resolveSession(request);
  if (!session) {
    return NextResponse.json(
      { error: "Нужно открыть приложение через Telegram-бота" },
      { status: 401 },
    );
  }
  await ensureUser(session);

  let body: { profile?: unknown };
  try {
    body = (await request.json()) as { profile?: unknown };
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const input = typeof body.profile === "string" ? body.profile.trim() : "";
  if (!input || input.length > 500) {
    return NextResponse.json({ error: "Укажи ссылку на Dota-профиль" }, { status: 400 });
  }

  const profile = await importDotaProfile(input);
  if (!profile) {
    return NextResponse.json(
      {
        error:
          "Не удалось получить Dota-профиль. Проверь ссылку и публичность профиля.",
      },
      { status: 404 },
    );
  }

  await db
    .update(users)
    .set({
      dotaAccountId: profile.accountId,
      dotaSteamId: profile.steamId,
      dotaName: profile.personaName,
      dotaAvatarUrl: profile.avatarUrl,
      dotaCountryCode: profile.countryCode,
      dotaRankTier: profile.rankTier,
      dotaLeaderboardRank: profile.leaderboardRank,
      dotaMmrEstimate: profile.mmrEstimate,
      dotaWins: profile.wins,
      dotaLosses: profile.losses,
      dotaMainHeroes: profile.mainHeroes,
      dotaLastSyncAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(users.tgId, session.tgId));

  return NextResponse.json({ profile });
}
