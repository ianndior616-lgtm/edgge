import { NextResponse } from "next/server";

/** Верхний лимит JSON-тела для профильных запросов (аватар + баннер). */
export const PROFILE_BODY_LIMIT = 950_000;

/** Верхний лимит тела маленьких JSON-запросов. */
export const SMALL_BODY_LIMIT = 32_000;

/** Проверка Content-Length до чтения body — защищает от тяжёлых payload. */
export function rejectLargeBody(
  request: Request,
  limit = SMALL_BODY_LIMIT,
): NextResponse | null {
  const raw = request.headers.get("content-length");
  if (!raw) return null;
  const n = Number(raw);
  if (Number.isFinite(n) && n > limit) {
    return NextResponse.json(
      { error: "Слишком большой запрос" },
      { status: 413 },
    );
  }
  return null;
}

/** Белый список ключей JSON-объекта. Лишние поля отсекаются ошибкой. */
export function hasOnlyAllowedKeys(
  value: unknown,
  allowed: readonly string[],
): boolean {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const set = new Set(allowed);
  return Object.keys(value as Record<string, unknown>).every((k) => set.has(k));
}

/** Безопасная ссылка профиля: только http/https, без логинов/паролей, до 200 символов. */
export function normalizeHttpUrl(value: unknown): string | null | false {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return null;
  if (raw.length > 200) return false;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    if (url.username || url.password) return false;
    return url.toString();
  } catch {
    return false;
  }
}

/** Чтобы не светить внутренние ошибки наружу. */
export function publicError(message = "Ошибка запроса", status = 400) {
  return NextResponse.json({ error: message }, { status });
}
