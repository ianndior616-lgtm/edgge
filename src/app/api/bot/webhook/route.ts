import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import {
  isDemoMode,
  sendMenuMessage,
  sendStartMessage,
  tgApi,
} from "@/lib/telegram";

export const dynamic = "force-dynamic";

type TgFrom = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
};

type TgChat = { id: number };

type TgMessage = {
  message_id: number;
  chat: TgChat;
  text?: string;
  from?: TgFrom;
};

type TgUpdate = {
  update_id: number;
  message?: TgMessage;
  edited_message?: TgMessage;
};

/** Сохраняет пользователя, написавшего боту (idempotent) */
async function upsertFromTelegram(from: TgFrom | undefined, chatId: number) {
  if (!from) return;
  try {
    await db
      .insert(users)
      .values({
        tgId: from.id,
        username: from.username ?? null,
        firstName: from.first_name ?? "",
        lastName: from.last_name ?? null,
      })
      .onConflictDoNothing({ target: users.tgId });
  } catch {
    // не критично для ответа боту
  }
  void chatId;
}

/**
 * Webhook Telegram-бота: на /start (или команду) отправляем приветствие
 * с кнопкой, открывающей Mini App. Адрес ставится через /api/bot/setup.
 */
export async function POST(request: Request) {
  if (isDemoMode()) {
    return NextResponse.json(
      { ok: false, reason: "TELEGRAM_BOT_TOKEN is not set" },
      { status: 503 },
    );
  }

  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (
    secret &&
    request.headers.get("x-telegram-bot-api-secret-token") !== secret
  ) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let update: TgUpdate;
  try {
    update = (await request.json()) as TgUpdate;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const origin = new URL(request.url).origin;
  const appUrl = process.env.APP_URL || origin;
  const msg = update.message ?? update.edited_message;

  if (msg?.chat?.id) {
    await upsertFromTelegram(msg.from, msg.chat.id);
    try {
      if (msg.text?.startsWith("/")) {
        await sendStartMessage(msg.chat.id, msg.from?.first_name ?? "", appUrl);
      } else {
        await sendMenuMessage(msg.chat.id, appUrl);
      }
    } catch (err) {
      console.error("Failed to answer webhook:", err);
      return NextResponse.json({ ok: false }, { status: 502 });
    }
  }

  return NextResponse.json({ ok: true });
}

/** Информация о настройке бота */
export async function GET() {
  if (isDemoMode()) {
    return NextResponse.json(
      { ok: false, reason: "TELEGRAM_BOT_TOKEN is not set" },
      { status: 503 },
    );
  }
  const info = await tgApi<{
    result?: { url?: string; pending_update_count?: number };
  }>("getWebhookInfo").catch(() => null);
  return NextResponse.json({
    ok: true,
    tokenSet: true,
    webhookUrl: info?.result?.url ?? null,
    pendingUpdates: info?.result?.pending_update_count ?? null,
  });
}
