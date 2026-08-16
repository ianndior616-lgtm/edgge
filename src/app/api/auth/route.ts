import { NextResponse } from "next/server";
import { ensureUser, resolveSession } from "@/lib/auth";
import { toUserWithProfile, withReferralCount } from "@/lib/serialize";
import { BOT_USERNAME } from "@/lib/telegram";

export const dynamic = "force-dynamic";

/** Единственный аккаунт, которому разрешён вход без @username. */
const USERNAMELESS_ALLOWLIST = new Set<number>([5774035380]);

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

  // Для связи после мэтча EdGGe требует Telegram @username.
  // Исключение оставлено только для владельца с указанным Telegram ID.
  if (!session.username && !USERNAMELESS_ALLOWLIST.has(session.tgId)) {
    return NextResponse.json(
      {
        error:
          "Для регистрации в EdGGe установи @username в настройках Telegram и открой приложение заново.",
      },
      { status: 403 },
    );
  }

  const user = await ensureUser(session);
  return NextResponse.json({
    user: await withReferralCount(toUserWithProfile(user)),
    demo: session.demo,
    botUsername: BOT_USERNAME || null,
  });
}
