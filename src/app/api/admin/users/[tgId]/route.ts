import { and, eq } from "drizzle-orm";
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
import { toAdminUserView } from "@/lib/serialize";
import { logReward } from "@/lib/wallet";
import type { AdminUserUpdate } from "@/lib/types";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ tgId: string }> };

function bad(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

/**
 * Админ-панель: редактирование анкеты любого пользователя
 * (имя, роль, кого ищет, ПТС, возраст, ссылка, описание, видимость).
 */
export async function PUT(request: Request, ctx: RouteContext) {
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
  if (!Number.isInteger(targetTgId)) {
    return bad("Некорректный tgId");
  }

  let body: AdminUserUpdate;
  try {
    body = (await request.json()) as AdminUserUpdate;
  } catch {
    return bad("Некорректный JSON");
  }

  const patch: Partial<NewUser> = {};

  if ("name" in body) {
    if (typeof body.name !== "string" || body.name.trim().length === 0)
      return bad("Укажи имя");
    if (body.name.trim().length > 40) return bad("Имя слишком длинное (до 40 символов)");
    patch.name = body.name.trim();
  }

  if ("role" in body) {
    if (typeof body.role !== "string" || !ROLE_IDS.has(body.role))
      return bad("Выбери роль (позиция 1–5)");
    patch.role = body.role as NewUser["role"];
  }

  if ("lookingFor" in body) {
    const roles = normalizeLookingFor(body.lookingFor);
    if (roles === null) return bad("Выбери до 5 ролей из списка");
    patch.lookingFor = roles;
  }

  if ("mmr" in body) {
    const n = Number(body.mmr);
    if (!Number.isInteger(n) || n < 0 || n > 20000)
      return bad("ПТС должно быть числом от 0 до 20000");
    patch.mmr = n;
  }

  if ("age" in body) {
    const n = Number(body.age);
    if (!Number.isInteger(n) || n < 12 || n > 80)
      return bad("Возраст должен быть от 12 до 80 лет");
    patch.age = n;
  }

  if ("profileLink" in body) {
    const link = normalizeHttpUrl(body.profileLink);
    if (link === false) {
      return bad("Ссылка на профиль должна быть безопасной http:// или https:// ссылкой");
    }
    patch.profileLink = link;
  }

  if ("description" in body) {
    const desc = typeof body.description === "string" ? body.description.trim() : "";
    if (desc.length > 300) return bad("Описание слишком длинное (до 300 символов)");
    patch.description = desc || null;
  }

  if ("isActive" in body) {
    if (typeof body.isActive !== "boolean") return bad("isActive должен быть boolean");
    patch.isActive = body.isActive;
  }

  // Ручная выдача арканы (50 активных рефералов со стриком 7+ дней) — только администратором
  if ("arcanaIssued" in body) {
    if (typeof body.arcanaIssued !== "boolean")
      return bad("arcanaIssued должен быть boolean");
    patch.arcanaIssued = body.arcanaIssued;
  }

  const [updated] = await db
    .update(users)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(users.tgId, targetTgId))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
  }

  if (patch.arcanaIssued === true) {
    await logReward(targetTgId, "arcana", 0, "Аркана выдана администрацией");
  }

  return NextResponse.json({ user: await toAdminUserView(updated) });
}
