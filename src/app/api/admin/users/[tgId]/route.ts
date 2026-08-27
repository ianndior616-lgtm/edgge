import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, type NewUser } from "@/db/schema";
import {
  SMALL_BODY_LIMIT,
  hasOnlyAllowedKeys,
  normalizeHttpUrl,
  rejectLargeBody,
} from "@/lib/api-guards";
import { resolveUser } from "@/lib/auth";
import { normalizeLookingFor } from "@/lib/avatars";
import { ROLE_IDS } from "@/lib/dota";
import { isGenderId } from "@/lib/gender";
import { toAdminUserView } from "@/lib/serialize";
import {
  isUserBanned,
  logReward,
  setUserBanned,
} from "@/lib/wallet";
import type { AdminUserUpdate } from "@/lib/types";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ tgId: string }> };

const ALLOWED_ADMIN_UPDATE_KEYS = [
  "name",
  "gender",
  "role",
  "lookingFor",
  "mmr",
  "age",
  "profileLink",
  "description",
  "isActive",
  "isBanned",
  "arcanaIssued",
] as const;

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Админ-панель: редактирование и модерация анкеты любого пользователя.
 * Бан хранится отдельным событием модерации, а также сразу скрывает анкету
 * из рекомендаций. Разбан не включает видимость автоматически: её можно
 * вернуть в этом же запросе или отдельной кнопкой «Показать».
 */
export async function PUT(request: Request, ctx: RouteContext) {
  const tooLarge = rejectLargeBody(request, SMALL_BODY_LIMIT);
  if (tooLarge) return tooLarge;

  const admin = await resolveUser(request);
  if (!admin) {
    return NextResponse.json(
      { error: "Нужно открыть приложение через Telegram-бота" },
      { status: 401 },
    );
  }
  if (!admin.isAdmin) {
    return NextResponse.json(
      { error: "Только для администраторов" },
      { status: 403 },
    );
  }

  const { tgId: rawTgId } = await ctx.params;
  const targetTgId = Number(rawTgId);
  if (!Number.isSafeInteger(targetTgId) || targetTgId <= 0) {
    return bad("Некорректный tgId");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return bad("Некорректный JSON");
  }
  if (!hasOnlyAllowedKeys(body, ALLOWED_ADMIN_UPDATE_KEYS)) {
    return bad("Некорректные поля запроса");
  }
  const update = body as AdminUserUpdate;

  const [target] = await db
    .select()
    .from(users)
    .where(eq(users.tgId, targetTgId))
    .limit(1);
  if (!target) {
    return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
  }

  const currentlyBanned = await isUserBanned(targetTgId);
  let requestedBanned: boolean | null = null;
  if ("isBanned" in update) {
    if (typeof update.isBanned !== "boolean") {
      return bad("isBanned должен быть boolean");
    }
    if (update.isBanned && targetTgId === admin.tgId) {
      return bad("Нельзя заблокировать собственную анкету");
    }
    requestedBanned = update.isBanned;
  }
  const willBeBanned = requestedBanned ?? currentlyBanned;

  const patch: Partial<NewUser> = {};

  if ("name" in update) {
    if (typeof update.name !== "string" || update.name.trim().length === 0)
      return bad("Укажи имя");
    if (update.name.trim().length > 40)
      return bad("Имя слишком длинное (до 40 символов)");
    patch.name = update.name.trim();
  }

  if ("gender" in update) {
    if (!isGenderId(update.gender)) return bad("Выбери пол");
    patch.gender = update.gender;
  }

  if ("role" in update) {
    if (typeof update.role !== "string" || !ROLE_IDS.has(update.role))
      return bad("Выбери роль (позиция 1–5)");
    patch.role = update.role as NewUser["role"];
  }

  if ("lookingFor" in update) {
    const roles = normalizeLookingFor(update.lookingFor);
    if (roles === null) return bad("Выбери до 5 ролей из списка");
    patch.lookingFor = roles;
  }

  if ("mmr" in update) {
    const n = Number(update.mmr);
    if (!Number.isInteger(n) || n < 0 || n > 20000)
      return bad("ПТС должно быть числом от 0 до 20000");
    patch.mmr = n;
  }

  if ("age" in update) {
    const n = Number(update.age);
    if (!Number.isInteger(n) || n < 12 || n > 80)
      return bad("Возраст должен быть от 12 до 80 лет");
    patch.age = n;
  }

  if ("profileLink" in update) {
    const link = normalizeHttpUrl(update.profileLink);
    if (link === false) {
      return bad(
        "Ссылка на профиль должна быть безопасной http:// или https:// ссылкой",
      );
    }
    patch.profileLink = link;
  }

  if ("description" in update) {
    const description =
      typeof update.description === "string" ? update.description.trim() : "";
    if (description.length > 300)
      return bad("Описание слишком длинное (до 300 символов)");
    patch.description = description || null;
  }

  if ("isActive" in update) {
    if (typeof update.isActive !== "boolean")
      return bad("isActive должен быть boolean");
    if (update.isActive && willBeBanned) {
      return bad("Сначала разбань анкету, затем включи её видимость", 409);
    }
    patch.isActive = update.isActive;
  }

  // Блокировка всегда скрывает профиль, даже если клиент не передал isActive.
  if (requestedBanned === true) patch.isActive = false;

  // Ручная выдача арканы (50 активных рефералов со стриком 7+ дней).
  if ("arcanaIssued" in update) {
    if (typeof update.arcanaIssued !== "boolean")
      return bad("arcanaIssued должен быть boolean");
    patch.arcanaIssued = update.arcanaIssued;
  }

  let updated = target;
  if (Object.keys(patch).length > 0) {
    const [changed] = await db
      .update(users)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(users.tgId, targetTgId))
      .returning();
    if (!changed) {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
    }
    updated = changed;
  }

  if (requestedBanned !== null && requestedBanned !== currentlyBanned) {
    await setUserBanned(targetTgId, requestedBanned);
    const [fresh] = await db
      .select()
      .from(users)
      .where(eq(users.tgId, targetTgId))
      .limit(1);
    if (fresh) updated = fresh;
  }

  if (patch.arcanaIssued === true) {
    await logReward(targetTgId, "arcana", 0, "Аркана выдана администрацией");
  }

  return NextResponse.json({ user: await toAdminUserView(updated) });
}
