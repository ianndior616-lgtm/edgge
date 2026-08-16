import { NextResponse } from "next/server";
import { pool } from "@/db";
import { resolveUser } from "@/lib/auth";
import {
  dayBefore,
  localDayString,
  rewardForStreak,
} from "@/lib/wallet-constants";
import { shareWithReferrer } from "@/lib/wallet";

export const dynamic = "force-dynamic";

type LockedUser = {
  tg_id: number;
  username: string | null;
  first_name: string;
  last_claim_day: string | null;
  streak_days: number;
  currency: number;
  crown_unlocked: boolean;
  referred_by_tg_id: number | null;
};

/**
 * Ежедневная награда за вход (стрик):
 * день 1 — 5, 2 — 10, 3 — 20, 4 — 25, 5 — 35, 6 — 50, 7 — 100 + корона.
 * Пропуск одного дня сбрасывает серию.
 * Реферер пользователя получает 10% от награды.
 *
 * Важно: день берётся только с сервера. Клиент не может подставить дату.
 * Строка пользователя блокируется SELECT FOR UPDATE, чтобы два параллельных
 * запроса не начислили валюту дважды.
 */
export async function POST(request: Request) {
  const user = await resolveUser(request);
  if (!user) {
    return NextResponse.json(
      { error: "Нужно открыть приложение через Telegram-бота" },
      { status: 401 },
    );
  }

  const day = localDayString();
  const client = await pool.connect();

  let reward = 0;
  let streak = 0;
  let currency = 0;
  let crownUnlocked = false;
  let crownJustUnlocked = false;
  let referredByTgId: number | null = null;
  let noteName = user.username ?? user.firstName ?? "реферала";

  try {
    await client.query("BEGIN");
    const lock = await client.query<LockedUser>(
      `select tg_id, username, first_name, last_claim_day, streak_days, currency,
              crown_unlocked, referred_by_tg_id
         from users
        where tg_id = $1
        for update`,
      [user.tgId],
    );
    const row = lock.rows[0];
    if (!row) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
    }

    // Уже получал сегодня
    if (row.last_claim_day === day) {
      await client.query("COMMIT");
      return NextResponse.json({
        alreadyClaimed: true,
        reward: 0,
        streakDays: row.streak_days,
        currency: row.currency,
        crownUnlocked: row.crown_unlocked,
        crownJustUnlocked: false,
        nextReward: rewardForStreak(row.streak_days + 1),
      });
    }

    streak = row.last_claim_day === dayBefore(day) ? row.streak_days + 1 : 1;
    reward = rewardForStreak(streak);
    crownJustUnlocked = streak >= 7 && !row.crown_unlocked;
    referredByTgId = row.referred_by_tg_id;
    noteName = row.username ?? row.first_name ?? noteName;

    const updated = await client.query<{
      currency: number;
      streak_days: number;
      crown_unlocked: boolean;
    }>(
      `update users
          set last_claim_day = $2,
              streak_days = $3,
              currency = currency + $4,
              crown_unlocked = case when $5 then true else crown_unlocked end,
              updated_at = now()
        where tg_id = $1
        returning currency, streak_days, crown_unlocked`,
      [row.tg_id, day, streak, reward, crownJustUnlocked],
    );

    const fresh = updated.rows[0];
    currency = fresh.currency;
    crownUnlocked = fresh.crown_unlocked;

    await client.query(
      `insert into rewards_log (tg_id, kind, amount, note)
       values ($1, 'daily', $2, $3)`,
      [row.tg_id, reward, `day:${streak}`],
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error("checkin failed", err);
    return NextResponse.json(
      { error: "Не удалось получить ежедневную награду" },
      { status: 500 },
    );
  } finally {
    client.release();
  }

  // Реферер получает 10% от награды (после успешного коммита награды)
  if (referredByTgId) {
    await shareWithReferrer(
      referredByTgId,
      reward,
      `ежедневная награда ${noteName}`,
    ).catch(() => undefined);
  }

  return NextResponse.json({
    alreadyClaimed: false,
    reward,
    streakDays: streak,
    currency,
    crownUnlocked,
    crownJustUnlocked,
    nextReward: rewardForStreak(streak + 1),
  });
}
