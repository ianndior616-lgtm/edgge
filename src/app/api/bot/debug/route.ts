import { NextResponse } from "next/server";
import { tgApi } from "@/lib/telegram";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const configuredSetupSecret = process.env.BOT_SETUP_SECRET?.trim();
  const supplied =
    request.headers.get("x-setup-secret") ??
    new URL(request.url).searchParams.get("secret") ??
    "";

  if (configuredSetupSecret && supplied !== configuredSetupSecret) {
    return NextResponse.json({ ok: false, reason: "forbidden" }, { status: 403 });
  }

  const appUrl = (process.env.APP_URL || new URL(request.url).origin).replace(/\/+$/, "");

  const [me, webhook, menuButton] = await Promise.all([
    tgApi("getMe").catch((error) => ({ ok: false, error: String(error) })),
    tgApi("getWebhookInfo").catch((error) => ({ ok: false, error: String(error) })),
    tgApi("getChatMenuButton").catch((error) => ({ ok: false, error: String(error) })),
  ]);

  return NextResponse.json({
    ok: true,
    appUrl,
    expectedWebhookUrl: `${appUrl}/api/bot/webhook`,
    env: {
      telegramBotTokenSet: Boolean(process.env.TELEGRAM_BOT_TOKEN),
      telegramBotUsername: process.env.TELEGRAM_BOT_USERNAME || null,
      nextPublicTelegramBotUsername:
        process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || null,
      webhookSecretSet: Boolean(process.env.TELEGRAM_WEBHOOK_SECRET),
    },
    me,
    webhook,
    menuButton,
  });
}
