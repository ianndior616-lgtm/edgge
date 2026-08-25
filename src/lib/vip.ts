import { and, desc, eq, like } from "drizzle-orm";
import { db } from "@/db";
import { rewardsLog } from "@/db/schema";

export const VIP_COIN_PRICE = 1000;
export const VIP_DURATION_DAYS = 30;
export const VIP_STARS_PRICE = Math.max(1, Number(process.env.VIP_STARS_PRICE || 150));


function parseVipUntil(note: string | null): Date | null {
  const match = note?.match(/vip_until:([^;\s]+)/);
  if (!match) return null;
  const date = new Date(match[1]);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function vipUntilOf(tgId: number): Promise<Date | null> {
  const rows = await db
    .select({ note: rewardsLog.note, createdAt: rewardsLog.createdAt })
    .from(rewardsLog)
    .where(
      and(
        eq(rewardsLog.tgId, tgId),
        like(rewardsLog.kind, "vip_purchase_%"),
      ),
    )
    .orderBy(desc(rewardsLog.createdAt))
    .limit(20);

  let latest: Date | null = null;
  for (const row of rows) {
    const until = parseVipUntil(row.note);
    if (until && (!latest || until > latest)) latest = until;
  }
  return latest;
}

export async function isVipUser(tgId: number, isAdmin = false): Promise<boolean> {
  if (isAdmin) return true;
  const until = await vipUntilOf(tgId);
  return Boolean(until && until.getTime() > Date.now());
}

export async function nextVipUntil(tgId: number): Promise<Date> {
  const current = await vipUntilOf(tgId);
  const base = current && current.getTime() > Date.now() ? current : new Date();
  return new Date(base.getTime() + VIP_DURATION_DAYS * 24 * 60 * 60 * 1000);
}

export function vipNote(until: Date, extra?: string): string {
  return `vip_until:${until.toISOString()}${extra ? `;${extra}` : ""}`;
}

export async function vipChargeAlreadyProcessed(chargeId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: rewardsLog.id })
    .from(rewardsLog)
    .where(
      and(
        eq(rewardsLog.kind, "vip_purchase_stars"),
        like(rewardsLog.note, `%charge:${chargeId}%`),
      ),
    )
    .limit(1);
  return Boolean(row);
}
