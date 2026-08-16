import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { rewardsLog } from "@/db/schema";

export const LOOKING_NOW_KIND = "looking_now";
export const LOOKING_NOW_DURATION_MS = 2 * 60 * 60 * 1000;

function parseUntil(note: string | null): Date | null {
  const match = note?.match(/until:([^;\s]+)/);
  if (!match) return null;
  const date = new Date(match[1]);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function lookingNowUntilOf(tgId: number): Promise<Date | null> {
  const [row] = await db
    .select({ note: rewardsLog.note })
    .from(rewardsLog)
    .where(
      and(
        eq(rewardsLog.tgId, tgId),
        eq(rewardsLog.kind, LOOKING_NOW_KIND),
      ),
    )
    .orderBy(desc(rewardsLog.createdAt))
    .limit(1);

  if (!row?.note?.startsWith("looking_now:")) return null;
  if (row.note.includes("state:off")) return null;

  const until = parseUntil(row.note);
  if (!until || until.getTime() <= Date.now()) return null;
  return until;
}

export async function isLookingNow(tgId: number): Promise<boolean> {
  return Boolean(await lookingNowUntilOf(tgId));
}

export async function setLookingNow(
  tgId: number,
  enabled: boolean,
): Promise<Date | null> {
  if (!enabled) {
    await db.insert(rewardsLog).values({
      tgId,
      kind: LOOKING_NOW_KIND,
      amount: 0,
      note: "looking_now:state:off",
    });
    return null;
  }

  const until = new Date(Date.now() + LOOKING_NOW_DURATION_MS);
  await db.insert(rewardsLog).values({
    tgId,
    kind: LOOKING_NOW_KIND,
    amount: 0,
    note: `looking_now:state:on;until:${until.toISOString()}`,
  });
  return until;
}
