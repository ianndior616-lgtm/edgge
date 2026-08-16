import { and, count, eq, gte, isNull, sql } from "drizzle-orm";
import { pool } from "@/db";
import { db } from "@/db";
import { rewardsLog, users } from "@/db/schema";
import {
  REFERRAL_MILESTONES,
  generateReferralCode,
} from "./wallet-constants";

/** Записывает начисление в журнал */
export async function logReward(
  tgId: number,
  kind: string,
  amount: number,
  note?: string,
): Promise<void> {
  await db
    .insert(rewardsLog)
    .values({ tgId, kind, amount, note: note ?? null });
}

/** Начисляет валюту (атомарный инкремент) */
export async function addCurrency(tgId: number, amount: number): Promise<void> {
  if (!Number.isInteger(amount) || amount <= 0 || amount > 1_000_000) return;
  await db
    .update(users)
    .set({ currency: sql`${users.currency} + ${amount}` as never })
    .where(eq(users.tgId, tgId));
}

/**
 * Начисляет рефереру 10% от заработка его реферала
 * (максимум один уровень вверх).
 */
export async function shareWithReferrer(
  referrerTgId: number,
  amount: number,
  note: string,
): Promise<void> {
  if (!Number.isInteger(amount) || amount <= 0) return;
  const share = Math.max(1, Math.round(amount * 0.1));
  await addCurrency(referrerTgId, share);
  await logReward(referrerTgId, "referral_income", share, note.slice(0, 200));
}

/** Число рефералов пользователя */
export async function countReferrals(tgId: number): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(users)
    .where(eq(users.referredByTgId, tgId));
  return row?.n ?? 0;
}

/**
 * Качественные рефералы для арканы: активная анкета + 7 дней стрика
 * (то есть пользователь действительно заходил и забирал ежедневку неделю).
 */
export async function countQualifiedReferrals(tgId: number): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(users)
    .where(
      and(
        eq(users.referredByTgId, tgId),
        eq(users.isActive, true),
        gte(users.streakDays, 7),
      ),
    );
  return row?.n ?? 0;
}

/** Выдаёт/возвращает реферальный код пользователя (создаёт при отсутствии) */
export async function getOrCreateReferralCode(
  tgId: number,
): Promise<string | null> {
  const [row] = await db
    .select({ code: users.referralCode })
    .from(users)
    .where(eq(users.tgId, tgId))
    .limit(1);
  if (row?.code) return row.code;

  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateReferralCode();
    try {
      const updated = await db
        .update(users)
        .set({ referralCode: code })
        .where(and(eq(users.tgId, tgId), isNull(users.referralCode)))
        .returning({ code: users.referralCode });
      if (updated[0]?.code) return updated[0].code;

      // кто-то успел создать код параллельно — читаем и возвращаем
      const [fresh] = await db
        .select({ code: users.referralCode })
        .from(users)
        .where(eq(users.tgId, tgId))
        .limit(1);
      if (fresh?.code) return fresh.code;
    } catch {
      // редкая коллизия уникального кода — пробуем ещё раз
    }
  }
  return null;
}

/**
 * Проверяет вехи рефералов и начисляет единоразовые бонусы.
 * Веха 30 — аркана: выдаётся вручную администратором, поэтому
 * валюта не начисляется.
 *
 * Пользователь-реферер блокируется SELECT FOR UPDATE, чтобы две параллельные
 * регистрации не начислили одну и ту же веху дважды.
 */
export async function checkMilestones(referrerTgId: number): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("select tg_id from users where tg_id = $1 for update", [
      referrerTgId,
    ]);

    const totalRes = await client.query<{ n: number }>(
      "select count(*)::int as n from users where referred_by_tg_id = $1",
      [referrerTgId],
    );
    const total = totalRes.rows[0]?.n ?? 0;

    for (const m of REFERRAL_MILESTONES) {
      if (total < m.count || m.arcana) continue;
      const note = `milestone:${m.count}`;
      const exists = await client.query(
        "select id from rewards_log where tg_id = $1 and kind = 'milestone' and note = $2 limit 1",
        [referrerTgId, note],
      );
      if (exists.rowCount && exists.rowCount > 0) continue;

      await client.query("update users set currency = currency + $2 where tg_id = $1", [
        referrerTgId,
        m.bonus,
      ]);
      await client.query(
        "insert into rewards_log (tg_id, kind, amount, note) values ($1, 'milestone', $2, $3)",
        [referrerTgId, m.bonus, note],
      );
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error("checkMilestones failed", err);
  } finally {
    client.release();
  }
}
