import { NextResponse } from "next/server";
import { isDatabaseConfigurationError } from "@/db";
import {
  ensureUser,
  resolveSession,
  syncTelegramIdentity,
} from "@/lib/auth";
import { toUserWithProfile, withReferralCount } from "@/lib/serialize";
import { BOT_USERNAME } from "@/lib/telegram";
import { TELEGRAM_USERNAME_REQUIRED_MESSAGE } from "@/lib/telegram-username";
import { isUserBanned } from "@/lib/wallet";
import { ensureMigrationsApplied } from "@/lib/run-migrations";

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
    // Telegram подписал эти данные: если @username удалён, убираем старую
    // публичную ссылку и скрываем анкету, чтобы по ней не создавались мэтчи.
    await syncTelegramIdentity(session).catch(() => undefined);
    return NextResponse.json(
      { error: TELEGRAM_USERNAME_REQUIRED_MESSAGE },
      { status: 403 },
    );
  }

  try {
    await ensureMigrationsApplied();
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
  } catch (error) {
    if (isDatabaseConfigurationError(error)) {
      return NextResponse.json(
        {
          error:
            "База данных не настроена. В Vercel добавьте DATABASE_URL или POSTGRES_URL, затем примените схему Drizzle.",
        },
        { status: 503 },
      );
    }
    throw error;
  }
}
