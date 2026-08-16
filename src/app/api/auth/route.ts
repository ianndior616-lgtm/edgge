import { NextResponse } from "next/server";
import { ensureUser, resolveSession } from "@/lib/auth";
import { toUserWithProfile, withReferralCount } from "@/lib/serialize";
import { BOT_USERNAME } from "@/lib/telegram";

export const dynamic = "force-dynamic";

/**
 * Авторизация: проверяет initData Telegram (заголовок x-init-data)
 * и возвращает текущего пользователя с его анкетой и кошельком.
 */
export async function POST(request: Request) {
  const session = await resolveSession(request);
  if (!session) {
    return NextResponse.json(
      { error: "Нужно открыть приложение через Telegram-бота" },
      { status: 401 },
    );
  }

  const user = await ensureUser(session);
  return NextResponse.json({
    user: await withReferralCount(toUserWithProfile(user)),
    demo: session.demo,
    botUsername: BOT_USERNAME || null,
  });
}
