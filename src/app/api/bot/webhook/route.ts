import { NextResponse } from "next/server";
import { db } from "@/db";
import { rewardsLog, users } from "@/db/schema";
import {
  isDemoMode,
  sendMenuMessage,
  sendStartMessage,
  tgApi,
} from "@/lib/telegram";
import {
  isTelegramUsernameOptional,
  normalizeTelegramUsername,
} from "@/lib/telegram-username";
import {
  nextVipUntil,
  vipChargeAlreadyProcessed,
  vipNote,
} from "@/lib/vip";

export const dynamic = "force-dynamic";

type TgFrom = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
};

type TgChat = { id: number };

type SuccessfulPayment = {
  currency: string;
  total_amount: number;
  invoice_payload: string;
  telegram_payment_charge_id: string;
};

type TgMessage = {
  message_id: number;
  chat: TgChat;
  text?: string;
  from?: TgFrom;
  successful_payment?: SuccessfulPayment;
};

type PreCheckoutQuery = {
  id: string;
  from: TgFrom;
  currency: string;
  total_amount: number;
  invoice_payload: string;
};

type TgUpdate = {
  update_id: number;
  message?: TgMessage;
  edited_message?: TgMessage;
  pre_checkout_query?: PreCheckoutQuery;
};

async function upsertFromTelegram(from: TgFrom | undefined, chatId: number) {
  if (!from) return;

  // Обычным пользователям нужен @username для связи после мэтча. Для главного
  // администратора действует точечное исключение по подписанному Telegram ID.
  const username = normalizeTelegramUsername(from.username);
  if (!username && !isTelegramUsernameOptional(from.id)) return;

  try {
    await db
      .insert(users)
      .values({
        tgId: from.id,
        username,
        firstName: from.first_name ?? "",
        lastName: from.last_name ?? null,
      })
      .onConflictDoUpdate({
        target: users.tgId,
        set: {
          username,
          firstName: from.first_name ?? "",
          lastName: from.last_name ?? null,
          updatedAt: new Date(),
        },
      });
  } catch {
    // не критично для ответа боту
  }
  void chatId;
}

async function handleVipPayment(message: TgMessage): Promise<void> {
  const payment = message.successful_payment;
  const payer = message.from;
  if (!payment || !payer) return;
  if (payment.currency !== "XTR" || payment.invoice_payload !== "edgge_vip_monthly") return;

  if (await vipChargeAlreadyProcessed(payment.telegram_payment_charge_id)) return;

  await upsertFromTelegram(payer, message.chat.id);
  const until = await nextVipUntil(payer.id);

  await db.insert(rewardsLog).values({
    tgId: payer.id,
    kind: "vip_purchase_stars",
    amount: 0,
    note: vipNote(
      until,
      `method:stars;charge:${payment.telegram_payment_charge_id};stars:${payment.total_amount}`,
    ),
  });

  await tgApi("sendMessage", {
    chat_id: message.chat.id,
    text: `👑 VIP активирован до ${until.toLocaleDateString("ru-RU")}!\n\nОткрой EdGGe заново — привилегии уже доступны.`,
  });
}

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

  const pre = update.pre_checkout_query;
  if (pre) {
    const valid = pre.currency === "XTR" && pre.invoice_payload === "edgge_vip_monthly";
    await tgApi("answerPreCheckoutQuery", {
      pre_checkout_query_id: pre.id,
      ok: valid,
      ...(valid ? {} : { error_message: "Некорректная покупка VIP" }),
    });
    return NextResponse.json({ ok: true });
  }

  const origin = new URL(request.url).origin;
  const appUrl = process.env.APP_URL || origin;
  const msg = update.message ?? update.edited_message;

  if (msg?.successful_payment) {
    try {
      await handleVipPayment(msg);
    } catch (err) {
      console.error("Failed to activate VIP after payment:", err);
      return NextResponse.json({ ok: false }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

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
