import type { RoleId } from "./types";

/**
 * Пользователь сам загружает аватарку со своего устройства —
 * она приходит как data URL (JPEG) после автоматической обрезки
 * по центру и сжатия на клиенте.
 */
const PREFIXES = [
  "data:image/jpeg;base64,",
  "data:image/png;base64,",
  "data:image/webp;base64,",
];

/** Максимальный размер data URL (символов) ≈ 300 КБ картинки */
const MAX_AVATAR_DATA_URL_LENGTH = 400_000;

/** Безопасная проверка base64 без регексов (без риска зависания) */
export function isValidAvatar(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (value.length === 0 || value.length > MAX_AVATAR_DATA_URL_LENGTH)
    return false;
  const prefix = PREFIXES.find((p) => value.startsWith(p));
  if (!prefix) return false;

  const body = value.slice(prefix.length);
  if (body.length === 0) return false;
  for (let i = 0; i < body.length; i++) {
    const c = body.charCodeAt(i);
    const ok =
      (c >= 48 && c <= 57) || // 0-9
      (c >= 65 && c <= 90) || // A-Z
      (c >= 97 && c <= 122) || // a-z
      c === 43 || // +
      c === 47 || // /
      c === 61; // =
    if (!ok) return false;
  }
  return true;
}

/** Проверка массива ролей на корректность */
export function normalizeLookingFor(value: unknown): RoleId[] | null {
  if (!Array.isArray(value)) return null;
  const ids = new Set<string>(["pos1", "pos2", "pos3", "pos4", "pos5"]);
  const clean: RoleId[] = [];
  for (const v of value) {
    if (typeof v !== "string" || !ids.has(v)) return null;
    if (!clean.includes(v as RoleId)) clean.push(v as RoleId);
  }
  if (clean.length > 5) return null;
  return clean;
}
