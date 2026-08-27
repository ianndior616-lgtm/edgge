import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, type User } from "@/db/schema";
import { DEMO_TG_ID, seedDemoProfiles } from "./demo";
import { normalizeTelegramUsername } from "./telegram-username";
import { isDemoMode, validateInitData } from "./telegram";
import { getOrCreateReferralCode, isUserBanned } from "./wallet";
import { isConfiguredAdmin } from "./admin";

export type SessionUser = {
  tgId: number;
  username: string | null;
  firstName: string;
  lastName: string | null;
  photoUrl: string | null;
  demo: boolean;
};

type ResolveSessionOptions = {
  /**
   * Все рабочие API требуют @username: только так после мэтча гарантированно
   * открывается публичный чат Telegram. /api/auth передаёт false, чтобы
   * показать пользователю понятную причину отказа.
   */
  requireUsername?: boolean;
};

/**
 * Определяет пользователя по заголовку x-init-data (Telegram Mini App).
 * В демо-режиме (без TELEGRAM_BOT_TOKEN) возвращает демо-пользователя.
 */
export async function resolveSession(
  request: Request,
  { requireUsername = true }: ResolveSessionOptions = {},
): Promise<SessionUser | null> {
  if (isDemoMode()) {
    await seedDemoProfiles();
    return {
      tgId: DEMO_TG_ID,
      username: "demo_player",
      firstName: "Демо",
      lastName: null,
      photoUrl: null,
      demo: true,
    };
  }

  const initData = request.headers.get("x-init-data") ?? "";
  const tg = validateInitData(initData);
  if (!tg) return null;

  const session: SessionUser = {
    tgId: tg.id,
    username: normalizeTelegramUsername(tg.username),
    firstName: tg.first_name ?? "",
    lastName: tg.last_name ?? null,
    photoUrl: tg.photo_url ?? null,
    demo: false,
  };

  return requireUsername && !session.username ? null : session;
}

/** Полная строка пользователя из БД (создаётся при первом входе). */
export async function resolveUser(request: Request): Promise<User | null> {
  const session = await resolveSession(request);
  if (!session) return null;

  const user = await ensureUser(session);
  // Бан должен работать одинаково для всех API, а не только для формы профиля.
  return (await isUserBanned(user.tgId)) ? null : user;
}

/**
 * Синхронизирует только подтверждённые Telegram поля. Если пользователь удалил
 * @username, старая ссылка больше не должна оставаться в публичной анкете.
 */
export async function syncTelegramIdentity(session: SessionUser): Promise<void> {
  const username = normalizeTelegramUsername(session.username);
  await db
    .update(users)
    .set({
      username,
      firstName: session.firstName,
      lastName: session.lastName,
      photoUrl: session.photoUrl,
      lastSeenAt: new Date(),
      updatedAt: new Date(),
      ...(!username ? { isActive: false } : {}),
    })
    .where(eq(users.tgId, session.tgId));
}

/** Находит пользователя в БД или создаёт его при первом входе. */
export async function ensureUser(session: SessionUser): Promise<User> {
  const username = normalizeTelegramUsername(session.username);
  if (!username) {
    throw new Error("Telegram username is required for registration");
  }

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.tgId, session.tgId))
    .limit(1);

  if (existing[0]) {
    existing[0].lastSeenAt = new Date();
    const configuredAdmin = isConfiguredAdmin(session.tgId);
    if (configuredAdmin) existing[0].isAdmin = true;
    await db
      .update(users)
      .set({
        lastSeenAt: existing[0].lastSeenAt,
        // Telegram username может измениться — всегда держим ссылку актуальной.
        username,
        firstName: session.firstName,
        lastName: session.lastName,
        photoUrl: session.photoUrl,
        updatedAt: new Date(),
        ...(configuredAdmin ? { isAdmin: true } : {}),
      })
      .where(eq(users.tgId, session.tgId));

    existing[0].username = username;
    existing[0].firstName = session.firstName;
    existing[0].lastName = session.lastName;
    existing[0].photoUrl = session.photoUrl;

    if (!existing[0].referralCode) {
      const code = await getOrCreateReferralCode(session.tgId);
      if (code) existing[0].referralCode = code;
    }
    return existing[0];
  }

  const [created] = await db
    .insert(users)
    .values({
      tgId: session.tgId,
      username,
      firstName: session.firstName,
      lastName: session.lastName,
      photoUrl: session.photoUrl,
      isAdmin: isConfiguredAdmin(session.tgId),
      lastSeenAt: new Date(),
    })
    .returning();

  const code = await getOrCreateReferralCode(created.tgId);
  if (code) created.referralCode = code;
  return created;
}
