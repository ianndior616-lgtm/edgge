import { NextResponse } from "next/server";
import { isDemoMode, tgApi } from "@/lib/telegram";

export const dynamic = "force-dynamic";

/**
 * Настройка бота: ставит webhook на /api/bot/webhook и кнопку меню чата,
 * открывающую Mini App. Вызывается один раз после деплоя:
 *   curl https://your-domain/api/bot/setup
 * Адрес приложения берётся из APP_URL или из origin запроса.
 */
export async function GET(request: Request) {
  const configuredSetupSecret = process.env.BOT_SETUP_SECRET?.trim();
  if (configuredSetupSecret) {
    const supplied =
      request.headers.get("x-setup-secret") ??
      new URL(request.url).searchParams.get("secret") ??
      "";
    if (supplied !== configuredSetupSecret) {
      return NextResponse.json({ ok: false, reason: "forbidden" }, { status: 403 });
    }
  }

  if (isDemoMode()) {
    return NextResponse.json(
      { ok: false, reason: "TELEGRAM_BOT_TOKEN is not set" },
      { status: 503 },
    );
  }

  const origin = new URL(request.url).origin;
  const appUrl = process.env.APP_URL || origin;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET || undefined;

  const [webhook, menu, me] = await Promise.all([
    tgApi<{ ok: boolean; description?: string }>("setWebhook", {
      url: `${origin}/api/bot/webhook`,
      ...(secret ? { secret_token: secret } : {}),
    }).catch((e) => ({ ok: false, description: String(e) })),
    tgApi<{ ok: boolean; description?: string }>("setChatMenuButton", {
      menu_button: {
        type: "web_app",
        text: "🎮 Найти тиммейта",
        web_app: { url: appUrl },
      },
    }).catch((e) => ({ ok: false, description: String(e) })),
    tgApi<{ ok: boolean; result?: { username?: string } }>("getMe").catch(
      () => null,
    ),
  ]);

  return NextResponse.json({
    ok: webhook.ok && menu.ok,
    appUrl,
    webhookUrl: `${origin}/api/bot/webhook`,
    botUsername: me?.result?.username ?? null,
    webhook,
    menuButton: menu,
  });
}
