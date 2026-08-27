import { PRIMARY_ADMIN_TG_ID } from "./admin";

/**
 * В EdGGe связь после мэтча строится через публичную ссылку t.me.
 * Поэтому пустой Telegram @username нельзя считать допустимой регистрацией.
 */
export const TELEGRAM_USERNAME_REQUIRED_MESSAGE =
  "Для регистрации в EdGGe установи @username в настройках Telegram и открой приложение заново.";

/** Администратор, которому разрешено пользоваться ботом без публичного @username. */
export const TELEGRAM_USERNAME_OPTIONAL_TG_ID = PRIMARY_ADMIN_TG_ID;

export function isTelegramUsernameOptional(tgId: number): boolean {
  return tgId === TELEGRAM_USERNAME_OPTIONAL_TG_ID;
}

/** Нормализует username, который Telegram передаёт без символа @. */
export function normalizeTelegramUsername(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const username = value.trim();
  return username.length > 0 ? username : null;
}
