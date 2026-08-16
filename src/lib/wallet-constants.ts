/** Константы и чистые функции кошелька/рефералов (без импорта БД —
 *  можно безопасно использовать и в клиентских компонентах). */

/** Награды за стрик: 1-й день — 5, … 7-й день — 100 */
export const DAILY_REWARDS = [5, 10, 20, 25, 35, 50, 100];

/** Вехи рефералов: количество → единоразовый бонус */
export const REFERRAL_MILESTONES: {
  count: number;
  bonus: number;
  arcana?: boolean;
  label: string;
}[] = [
  { count: 5, bonus: 100, label: "100 🪙" },
  { count: 10, bonus: 250, label: "250 🪙" },
  { count: 15, bonus: 400, label: "400 🪙" },
  { count: 50, bonus: 0, arcana: true, label: "🛡️ Аркана" },
];

/** Награда за день N стрика (после 7-го дня — всегда 100) */
export function rewardForStreak(day: number): number {
  const idx = Math.min(Math.max(day - 1, 0), DAILY_REWARDS.length - 1);
  return DAILY_REWARDS[idx];
}

/** Локальная дата в формате YYYY-MM-DD */
export function localDayString(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/** Предыдущий день от YYYY-MM-DD */
export function dayBefore(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
}

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Генерация реферального кода вида VV-XXXXXX */
export function generateReferralCode(): string {
  let s = "";
  for (let i = 0; i < 6; i++) {
    s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return `VV-${s}`;
}

export const REFERRAL_CODE_RE = /^VV-[A-Z0-9]{6}$/;
