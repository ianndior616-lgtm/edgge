import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, type NewUser } from "@/db/schema";
import {
  PROFILE_BODY_LIMIT,
  hasOnlyAllowedKeys,
  normalizeHttpUrl,
  rejectLargeBody,
} from "@/lib/api-guards";
import { resolveUser } from "@/lib/auth";
import { isValidAvatar, normalizeLookingFor } from "@/lib/avatars";
import { isPaletteId } from "@/lib/banners";
import { ROLE_IDS } from "@/lib/dota";
import { isGenderId } from "@/lib/gender";
import { toUserWithProfile, withReferralCount } from "@/lib/serialize";
import { REFERRAL_CODE_RE } from "@/lib/wallet-constants";
import { checkMilestones } from "@/lib/wallet";
import type { ProfileUpdate } from "@/lib/types";

export const dynamic = "force-dynamic";

const ALLOWED_PROFILE_KEYS = [
  "name",
  "gender",
  "role",
  "lookingFor",
  "avatarUrl",
  "banner",
  "mmr",
  "age",
  "profileLink",
  "description",
  "isActive",
  "adminCode",
  "referralCode",
] as const;

function bad(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

/** Сохраняет анкету. Все игровые поля заполняются самим пользователем. */
export async function PUT(request: Request) {
  const tooLarge = rejectLargeBody(request, PROFILE_BODY_LIMIT);
  if (tooLarge) return tooLarge;

  const current = await resolveUser(request);
  if (!current) {
    return NextResponse.json(
      { error: "Нужно открыть приложение через Telegram-бота" },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return bad("Некорректный JSON");
  }

  if (!hasOnlyAllowedKeys(body, ALLOWED_PROFILE_KEYS)) {
    return bad("Некорректные поля запроса");
  }

  const b = (body ?? {}) as ProfileUpdate;
  const patch: Partial<NewUser> = {};
  let pendingReferrerTgId: number | null = null;

  if ("referralCode" in b) {
    const code = typeof b.referralCode === "string" ? b.referralCode.trim().toUpperCase() : "";
    if (code) {
      if (!REFERRAL_CODE_RE.test(code))
        return bad("Некорректный формат кода — он выглядит как VV-XXXXXX");
      const [friend] = await db
        .select()
        .from(users)
        .where(eq(users.referralCode, code))
        .limit(1);
      if (!friend) return bad("Такого кода не существует — проверь написание");
      if (friend.tgId === current.tgId) return bad("Нельзя ввести собственный код");
      if (current.referredByTgId) return bad("Код друга уже привязан к твоей анкете");
      pendingReferrerTgId = friend.tgId;
    }
  }

  if ("adminCode" in b) {
    const code = typeof b.adminCode === "string" ? b.adminCode.trim() : "";
    if (code !== "") {
      const rawExpected = process.env.ADMIN_ACCESS_CODE?.trim();
      const expected =
        rawExpected && !["disabled", "none", "null", "-"].includes(rawExpected.toLowerCase())
          ? rawExpected
          : "";
      if (!expected || code !== expected) {
        return NextResponse.json({ error: "Неверный код доступа" }, { status: 403 });
      }
      patch.isAdmin = true;
    }
  }

  if ("name" in b) {
    if (typeof b.name !== "string" || b.name.trim().length === 0) return bad("Укажи имя");
    if (b.name.trim().length > 40) return bad("Имя слишком длинное (до 40 символов)");
    patch.name = b.name.trim();
  }

  if ("gender" in b) {
    if (!isGenderId(b.gender)) return bad("Выбери пол");
    patch.gender = b.gender;
  }

  if ("role" in b) {
    if (typeof b.role !== "string" || !ROLE_IDS.has(b.role)) return bad("Выбери роль (позиция 1–5)");
    patch.role = b.role as NewUser["role"];
  }

  if ("mmr" in b) {
    const n = Number(b.mmr);
    if (!Number.isInteger(n) || n < 0 || n > 20000) return bad("ПТС должно быть числом от 0 до 20000");
    patch.mmr = n;
  }

  if ("age" in b) {
    const n = Number(b.age);
    if (!Number.isInteger(n) || n < 12 || n > 80) return bad("Возраст должен быть от 12 до 80 лет");
    patch.age = n;
  }

  if ("lookingFor" in b) {
    const roles = normalizeLookingFor(b.lookingFor);
    if (roles === null) return bad("Выбери до 5 ролей из списка, которые ищешь в тиммейты");
    patch.lookingFor = roles;
  }

  if ("avatarUrl" in b) {
    const av = b.avatarUrl;
    if (av === null) patch.avatarUrl = null;
    else if (isValidAvatar(av)) patch.avatarUrl = av;
    else return bad("Аватарка должна быть изображением (JPEG/PNG/WebP) до ~300 КБ");
  }

  if ("banner" in b) {
    const bn = b.banner;
    if (bn === null) patch.banner = null;
    else if (isPaletteId(bn) || isValidAvatar(bn)) patch.banner = bn;
    else return bad("Картинка карточки должна быть изображением (JPEG/PNG/WebP) или палитрой");
  }

  if ("profileLink" in b) {
    const link = normalizeHttpUrl(b.profileLink);
    if (link === false) return bad("Ссылка на профиль должна быть безопасной http:// или https:// ссылкой");
    // Ссылка хранится только как ссылка. Имя/MMR/ранг из внешнего API не перетираем.
    patch.profileLink = link;
  }

  if ("description" in b) {
    const desc = typeof b.description === "string" ? b.description.trim() : "";
    if (desc.length > 300) return bad("Описание слишком длинное (до 300 символов)");
    patch.description = desc || null;
  }

  if ("isActive" in b) {
    if (typeof b.isActive !== "boolean") return bad("isActive должен быть boolean");
    patch.isActive = b.isActive;
  }

  const [updated] = await db
    .update(users)
    .set({
      ...patch,
      ...(pendingReferrerTgId ? { referredByTgId: pendingReferrerTgId } : {}),
      updatedAt: new Date(),
    })
    .where(
      pendingReferrerTgId
        ? and(eq(users.tgId, current.tgId), isNull(users.referredByTgId))
        : eq(users.tgId, current.tgId),
    )
    .returning();

  if (!updated) return bad("Код друга уже привязан к твоей анкете");

  if (pendingReferrerTgId) await checkMilestones(pendingReferrerTgId);

  let finalRow = updated;
  const withProfile = toUserWithProfile(updated);
  if (withProfile.profileComplete && updated.onboardedAt == null) {
    const [marked] = await db
      .update(users)
      .set({ onboardedAt: new Date() })
      .where(eq(users.tgId, current.tgId))
      .returning();
    finalRow = marked;
  }

  // ВАЖНО: клиент ожидает сам объект пользователя, а не { user: ... }.
  return NextResponse.json(await withReferralCount(toUserWithProfile(finalRow)));
}
