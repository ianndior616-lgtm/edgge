import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { tgApi } from "@/lib/telegram";

export const dynamic = "force-dynamic";

function errorInfo(error: unknown): { message: string; code?: string } {
  let current: unknown = error;
  let lastMessage = "Unknown database error";
  let code: string | undefined;

  for (let depth = 0; depth < 5 && current; depth++) {
    if (current instanceof Error) {
      if (current.message) lastMessage = current.message;
      const maybeCode = (current as Error & { code?: unknown }).code;
      if (typeof maybeCode === "string") code = maybeCode;
      current = (current as Error & { cause?: unknown }).cause;
      continue;
    }

    if (typeof current === "object") {
      const obj = current as { message?: unknown; code?: unknown; cause?: unknown };
      if (typeof obj.message === "string" && obj.message) lastMessage = obj.message;
      if (typeof obj.code === "string") code = obj.code;
      current = obj.cause;
      continue;
    }

    break;
  }

  return { message: lastMessage.slice(0, 500), ...(code ? { code } : {}) };
}

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

  const [me, webhook, menuButton, database] = await Promise.all([
    tgApi("getMe").catch((error) => ({ ok: false, error: String(error) })),
    tgApi("getWebhookInfo").catch((error) => ({ ok: false, error: String(error) })),
    tgApi("getChatMenuButton").catch((error) => ({ ok: false, error: String(error) })),
    db
      .select()
      .from(users)
      .limit(1)
      .then((rows) => ({ ok: true, usersTableReadable: true, sampleRows: rows.length }))
      .catch((error) => ({ ok: false, usersTableReadable: false, ...errorInfo(error) })),
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
    database,
    me,
    webhook,
    menuButton,
  });
}
