import { NextResponse } from "next/server";
import { ensureUser, resolveSession } from "@/lib/auth";
import { toUserWithProfile, withReferralCount } from "@/lib/serialize";
import { BOT_USERNAME } from "@/lib/telegram";
import { TELEGRAM_USERNAME_REQUIRED_MESSAGE } from "@/lib/telegram-username";
import { isUserBanned } from "@/lib/wallet";

export const dynamic = "force-dynamic";

/**
 * Авторизация: проверяет initData Telegram (заголовок x-init-data)
 * и возвращает текущего пользователя с его анкетой и кошельком.
 */
export async function POST(request: Request) {
  // Здесь намеренно не требуем username внутри resolveSession, чтобы вместо
  // неясного 401 показать пользователю инструкцию, как исправить профиль.
  const session = await resolveSession(request, { requireUsername: false });
  if (!session) {
    return NextResponse.json(
      { error: "Нужно открыть приложение через Telegram-бота" },
      { status: 401 },
    );
  }

  if (!session.username) {
    return NextResponse.json(
      { error: TELEGRAM_USERNAME_REQUIRED_MESSAGE },
      { status: 403 },
    );
  }

  const user = await ensureUser(session);
  if (await isUserBanned(user.tgId)) {
    return NextResponse.json(
      { error: "Анкета заблокирована администратором" },
      { status: 403 },
    );
  }

  return NextResponse.json({
    user: await withReferralCount(toUserWithProfile(user)),
    demo: session.demo,
    botUsername: BOT_USERNAME || null,
  });
}
