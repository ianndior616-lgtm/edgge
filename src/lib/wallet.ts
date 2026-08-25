import { and, count, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { pool } from "@/db";
import { db } from "@/db";
import { rewardsLog, users } from "@/db/schema";
import {
  REFERRAL_MILESTONES,
  generateReferralCode,
} from "./wallet-constants";

export async function logReward(
  tgId: number,
  kind: string,
  amount: number,
  note?: string,
): Promise<void> {
  await db.insert(rewardsLog).values({
    tgId,
    kind,
    amount,
    note: note ?? null,
  });
}

export async function addCurrency(tgId: number, amount: number): Promise<void> {
  if (!Number.isInteger(amount) || amount <= 0 || amount > 1_000_000) return;
  await db
    .update(users)
    .set({ currency: sql`${users.currency} + ${amount}` as never })
    .where(eq(users.tgId, tgId));
}

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

export async function countReferrals(tgId: number): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(users)
    .where(eq(users.referredByTgId, tgId));
  return row?.n ?? 0;
}

/**
 * Активный день реферала засчитывается, если он:
 *  - забрал ежедневную награду, ИЛИ
 *  - сделал не меньше 10 свайпов за календарный день.
 *
 * Используем rewards_log как журнал активности, поэтому отдельная таблица
 * и миграция не нужны.
 */
export async function countReferralActiveDays(tgId: number): Promise<number> {
  const result = await pool.query<{ n: number }>(
    `with daily_days as (
       select (created_at at time zone 'UTC')::date as d
         from rewards_log
        where tg_id = $1 and kind = 'daily'
        group by 1
     ),
     swipe_days as (
       select (created_at at time zone 'UTC')::date as d
         from rewards_log
        where tg_id = $1 and kind = 'swipe'
        group by 1
       having count(*) >= 10
     ),
     active_days as (
       select d from daily_days
       union
       select d from swipe_days
     )
     select count(*)::int as n from active_days`,
    [tgId],
  );
  return result.rows[0]?.n ?? 0;
}

/** Записываем просмотр/реакцию на карточку для реферальной активности. */
export async function recordSwipeActivity(tgId: number): Promise<void> {
  await logReward(tgId, "swipe", 0, "profile_swipe");
}

/** Качественный реферал = зарегистрирован и набрал 7 активных дней. */
export async function countQualifiedReferrals(tgId: number): Promise<number> {
  const rows = await db
    .select({ tgId: users.tgId })
    .from(users)
    .where(
      and(
        eq(users.referredByTgId, tgId),
        isNotNull(users.onboardedAt),
      ),
    );

  if (rows.length === 0) return 0;
  const progress = await Promise.all(
    rows.map((row) => countReferralActiveDays(row.tgId)),
  );
  return progress.filter((days) => days >= 7).length;
}

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

      const [fresh] = await db
        .select({ code: users.referralCode })
        .from(users)
        .where(eq(users.tgId, tgId))
        .limit(1);
      if (fresh?.code) return fresh.code;
    } catch {
      // редкая коллизия кода — пробуем ещё раз
    }
  }
  return null;
}

/** Состояние бана хранится в rewards_log как последний moderation event. */
export async function isUserBanned(tgId: number): Promise<boolean> {
  const result = await pool.query<{ note: string | null }>(
    `select note
       from rewards_log
      where tg_id = $1 and kind = 'moderation'
      order by created_at desc, id desc
      limit 1`,
    [tgId],
  );
  return result.rows[0]?.note === "banned";
}

export async function setUserBanned(
  tgId: number,
  banned: boolean,
): Promise<void> {
  // Событие модерации и скрытие анкеты должны появляться вместе: иначе между
  // двумя запросами профиль мог бы снова попасть в рекомендации.
  await db.transaction(async (tx) => {
    await tx.insert(rewardsLog).values({
      tgId,
      kind: "moderation",
      amount: 0,
      note: banned ? "banned" : "unbanned",
    });
    await tx
      .update(users)
      .set({
        ...(banned ? { isActive: false } : {}),
        updatedAt: new Date(),
      })
      .where(eq(users.tgId, tgId));
  });
}

/** Вехи начисляются только по качественным рефералам. */
export async function checkMilestones(referrerTgId: number): Promise<void> {
  const qualified = await countQualifiedReferrals(referrerTgId);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("select tg_id from users where tg_id = $1 for update", [
      referrerTgId,
    ]);

    for (const m of REFERRAL_MILESTONES) {
      if (qualified < m.count || m.arcana) continue;
      const note = `milestone:${m.count}`;
      const exists = await client.query(
        "select id from rewards_log where tg_id = $1 and kind = 'milestone' and note = $2 limit 1",
        [referrerTgId, note],
      );
      if (exists.rowCount && exists.rowCount > 0) continue;

      await client.query(
        "update users set currency = currency + $2 where tg_id = $1",
        [referrerTgId, m.bonus],
      );
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
