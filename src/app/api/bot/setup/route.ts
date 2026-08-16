import { NextResponse } from "next/server";
import { isDemoMode, tgApi } from "@/lib/telegram";

export const dynamic = "force-dynamic";

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

  const origin = new URL(request.url).origin.replace(/\/+$/, "");
  const appUrl = (process.env.APP_URL || origin).trim().replace(/\/+$/, "");

  if (!appUrl.startsWith("https://")) {
    return NextResponse.json(
      { ok: false, reason: "APP_URL must be an https:// URL", appUrl },
      { status: 500 },
    );
  }

  const webhookUrl = `${origin}/api/bot/webhook`;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET || undefined;

  const [webhook, menu, me] = await Promise.all([
    tgApi<{ ok: boolean; description?: string }>("setWebhook", {
      url: webhookUrl,
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
    webhookUrl,
    botUsername: me?.result?.username ?? null,
    webhook,
    menuButton: menu,
  });
}
