import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, type User } from "@/db/schema";
import { DEMO_TG_ID, seedDemoProfiles } from "./demo";
import { isDemoMode, validateInitData } from "./telegram";
import { getOrCreateReferralCode } from "./wallet";
import { isConfiguredAdmin } from "./admin";

const USERNAMELESS_ALLOWLIST = new Set<number>([5774035380]);

export type SessionUser = {
  tgId: number;
  username: string | null;
  firstName: string;
  lastName: string | null;
  photoUrl: string | null;
  demo: boolean;
};

/**
 * Определяет пользователя по заголовку x-init-data (Telegram Mini App).
 * В демо-режиме (без TELEGRAM_BOT_TOKEN) возвращает демо-пользователя.
 */
export async function resolveSession(
  request: Request,
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

  return {
    tgId: tg.id,
    username: tg.username ?? null,
    firstName: tg.first_name ?? "",
    lastName: tg.last_name ?? null,
    photoUrl: tg.photo_url ?? null,
    demo: false,
  };
}

/** Полная строка пользователя из БД (создаётся при первом входе) */
export async function resolveUser(request: Request): Promise<User | null> {
  const session = await resolveSession(request);
  if (!session) return null;
  return ensureUser(session);
}

/** Находит пользователя в БД или создаёт его при первом входе */
export async function ensureUser(session: SessionUser) {
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
        // Если пользователь позже добавил/изменил username — держим его актуальным.
        username: session.username,
        ...(configuredAdmin ? { isAdmin: true } : {}),
      })
      .where(eq(users.tgId, session.tgId));

    existing[0].username = session.username;

    if (!existing[0].referralCode) {
      const code = await getOrCreateReferralCode(session.tgId);
      if (code) existing[0].referralCode = code;
    }
    return existing[0];
  }

  // Новую регистрацию без Telegram @username не создаём вообще.
  // Исключение — только заранее разрешённый аккаунт владельца.
  if (!session.username && !USERNAMELESS_ALLOWLIST.has(session.tgId)) {
    throw new Error("Telegram username is required for registration");
  }

  const [created] = await db
    .insert(users)
    .values({
      tgId: session.tgId,
      username: session.username,
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
