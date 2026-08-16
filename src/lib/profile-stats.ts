import { and, count, eq, sql, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { likes, rewardsLog } from "@/db/schema";
import type { ProfileStats, ProfileStatsPeriod } from "./types";

const PROFILE_VIEW_KIND = "profile_view";
const DAY_MS = 24 * 60 * 60 * 1000;

function asNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function rate(likesCount: number, viewsCount: number): number {
  if (viewsCount <= 0) return 0;
  return Math.min(100, Math.round((likesCount / viewsCount) * 1000) / 10);
}

function period(views: unknown, likesCount: unknown): ProfileStatsPeriod {
  const normalizedViews = asNumber(views);
  const normalizedLikes = asNumber(likesCount);
  return {
    views: normalizedViews,
    likes: normalizedLikes,
    likeRate: rate(normalizedLikes, normalizedViews),
  };
}

export const EMPTY_PROFILE_STATS: ProfileStats = {
  views: 0,
  likes: 0,
  matches: 0,
  likeRate: 0,
  vip: null,
};

/** Один просмотр от одного пользователя учитывается не чаще одного раза в UTC-день. */
export async function recordProfileView(
  viewerTgId: number,
  viewedTgId: number,
): Promise<void> {
  if (viewerTgId === viewedTgId) return;

  const day = new Date().toISOString().slice(0, 10);
  const note = `viewer:${viewerTgId};day:${day}`;
  const [existing] = await db
    .select({ id: rewardsLog.id })
    .from(rewardsLog)
    .where(
      and(
        eq(rewardsLog.tgId, viewedTgId),
        eq(rewardsLog.kind, PROFILE_VIEW_KIND),
        eq(rewardsLog.note, note),
      ),
    )
    .limit(1);

  if (existing) return;
  await db.insert(rewardsLog).values({
    tgId: viewedTgId,
    kind: PROFILE_VIEW_KIND,
    amount: 0,
    note,
  });
}

export async function profileStatsOf(
  tgId: number,
  includeVip: boolean,
): Promise<ProfileStats> {
  const now = Date.now();
  const since7Days = new Date(now - 7 * DAY_MS);
  const since30Days = new Date(now - 30 * DAY_MS);
  const reciprocalLikes = alias(likes, "stats_reciprocal_likes");

  const [viewRows, likeRows, matchRows] = await Promise.all([
    db
      .select({
        total: sql<number>`count(distinct ${rewardsLog.note})`,
        last7Days: sql<number>`count(distinct ${rewardsLog.note}) filter (where ${rewardsLog.createdAt} >= ${since7Days})`,
        last30Days: sql<number>`count(distinct ${rewardsLog.note}) filter (where ${rewardsLog.createdAt} >= ${since30Days})`,
      })
      .from(rewardsLog)
      .where(
        and(
          eq(rewardsLog.tgId, tgId),
          eq(rewardsLog.kind, PROFILE_VIEW_KIND),
        ),
      ),
    db
      .select({
        total: count(),
        last7Days: sql<number>`count(*) filter (where ${likes.createdAt} >= ${since7Days})`,
        last30Days: sql<number>`count(*) filter (where ${likes.createdAt} >= ${since30Days})`,
      })
      .from(likes)
      .where(and(eq(likes.likedTgId, tgId), eq(likes.liked, true))),
    db
      .select({ total: count() })
      .from(likes)
      .innerJoin(
        reciprocalLikes,
        and(
          eq(reciprocalLikes.likerTgId, likes.likedTgId),
          eq(reciprocalLikes.likedTgId, likes.likerTgId),
        ),
      )
      .where(
        and(
          eq(likes.likerTgId, tgId),
          or(
            and(eq(likes.liked, true), eq(reciprocalLikes.liked, true)),
            eq(likes.createdAt, reciprocalLikes.createdAt),
          ),
        ),
      ),
  ]);

  const views = asNumber(viewRows[0]?.total);
  const likesCount = asNumber(likeRows[0]?.total);
  const last7Days = period(
    viewRows[0]?.last7Days,
    likeRows[0]?.last7Days,
  );
  const last30Days = period(
    viewRows[0]?.last30Days,
    likeRows[0]?.last30Days,
  );

  return {
    views,
    likes: likesCount,
    matches: asNumber(matchRows[0]?.total),
    likeRate: rate(likesCount, views),
    vip: includeVip ? { last7Days, last30Days } : null,
  };
}
