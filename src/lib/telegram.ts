import { createHmac, timingSafeEqual } from "crypto";

export const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
export const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME ?? "";

/** Режим без токена бота — приложение работает с демо-пользователем */
export function isDemoMode(): boolean {
  return !BOT_TOKEN;
}

export type TgUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  language_code?: string;
};

/**
 * Проверка подписи initData от Telegram Mini App (WebAppData).
 * Возвращает пользователя или null, если данные недействительны.
 */
export function validateInitData(initData: string): TgUser | null {
  if (!BOT_TOKEN || !initData) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;

  const authDate = Number(params.get("auth_date") ?? 0);
  const nowSec = Math.floor(Date.now() / 1000);
  if (!authDate || nowSec - authDate > 86400) return null;

  params.delete("hash");
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  const secretKey = createHmac("sha256", "WebAppData")
    .update(BOT_TOKEN)
    .digest();
  const computed = createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest();

  const expected = Buffer.from(hash, "hex");
  const actual = Buffer.from(computed);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }

  const userRaw = params.get("user");
  if (!userRaw) return null;
  try {
    const u = JSON.parse(userRaw) as Record<string, unknown>;
    const id = Number(u.id);
    if (!Number.isFinite(id)) return null;
    return {
      id,
      first_name: typeof u.first_name === "string" ? u.first_name : "",
      last_name: typeof u.last_name === "string" ? u.last_name : undefined,
      username: typeof u.username === "string" ? u.username : undefined,
      photo_url: typeof u.photo_url === "string" ? u.photo_url : undefined,
      language_code:
        typeof u.language_code === "string" ? u.language_code : undefined,
    };
  } catch {
    return null;
  }
}

/** Универсальный вызов Bot API */
export async function tgApi<T = unknown>(
  method: string,
  body: Record<string, unknown> = {},
): Promise<T> {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Telegram API ${method}: HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

/** Приветственное сообщение со стартовой кнопкой приложения */
export async function sendStartMessage(
  chatId: number,
  firstName: string,
  appUrl: string,
): Promise<void> {
  const name = firstName ? firstName.replace(/([*_`\[\]()])/g, "") : "игрок";
  await tgApi("sendMessage", {
    chat_id: chatId,
    text:
      `Привет, ${name}! 👋\n\n` +
      "Добро пожаловать в *EdGGe* — поиск тиммейтов для Dota 2.\n\n" +
      "Здесь ты можешь:\n" +
      "🎭 Выбрать аватарку и заполнить анкету: роль, ПТС, возраст\n" +
      "🎯 Выбрать роли, которые ищешь в тиммейты\n" +
      "💘 Листать рекомендации — при взаимном лайке открывается чат\n\n" +
      "Нажми кнопку ниже, чтобы открыть приложение 👇",
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [{ text: "🎮 Открыть EdGGe", web_app: { url: appUrl } }],
      ],
    },
  });
}

/** Кнопка-напоминание, если пользователь написал текст вместо /start */
export async function sendMenuMessage(
  chatId: number,
  appUrl: string,
): Promise<void> {
  await tgApi("sendMessage", {
    chat_id: chatId,
    text: "🎮 Нажми кнопку ниже, чтобы открыть приложение и найти тиммейта:",
    reply_markup: {
      inline_keyboard: [
        [{ text: "🎮 Открыть EdGGe", web_app: { url: appUrl } }],
      ],
    },
  });
}
