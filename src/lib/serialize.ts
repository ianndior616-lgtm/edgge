import { avg, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { ratings, reports, users as usersTable, type User } from "@/db/schema";
import type {
  AdminUserView,
  PublicProfile,
  RoleId,
  UserWithProfile,
} from "./types";
import { countQualifiedReferrals } from "./wallet";

const ROLE_IDS = new Set<string>(["pos1", "pos2", "pos3", "pos4", "pos5"]);

function rolesFrom(row: string[] | null | undefined): RoleId[] {
  return (row ?? []).filter((r): r is RoleId => ROLE_IDS.has(r));
}

export function toPublicProfile(row: User): PublicProfile {
  return {
    id: row.id,
    tgId: row.tgId,
    username: row.username,
    firstName: row.firstName,
    photoUrl: row.photoUrl,
    avatarUrl: row.avatarUrl,
    banner: row.banner,
    name: row.name,
    role: row.role as RoleId | null,
    mmr: row.mmr,
    age: row.age,
    profileLink: row.profileLink,
    description: row.description,
    dotaAccountId: row.dotaAccountId,
    dotaSteamId: row.dotaSteamId,
    dotaName: row.dotaName,
    dotaAvatarUrl: row.dotaAvatarUrl,
    dotaCountryCode: row.dotaCountryCode,
    dotaRankTier: row.dotaRankTier,
    dotaLeaderboardRank: row.dotaLeaderboardRank,
    dotaMmrEstimate: row.dotaMmrEstimate,
    dotaWins: row.dotaWins,
    dotaLosses: row.dotaLosses,
    dotaMainHeroes: row.dotaMainHeroes ?? [],
    dotaLastSyncAt: row.dotaLastSyncAt ? row.dotaLastSyncAt.toISOString() : null,
    isActive: row.isActive,
    crownUnlocked: row.crownUnlocked,
    createdAt: row.createdAt ? row.createdAt.toISOString() : null,
  };
}

export function isProfileComplete(
  p: PublicProfile & { lookingFor: RoleId[] },
): boolean {
  return Boolean(
    p.name &&
      p.role &&
      p.mmr != null &&
      p.age != null &&
      p.profileLink &&
      (p.lookingFor?.length ?? 0) > 0,
  );
}

/** Счётчик рефералов пользователя */
export async function referralCountOf(tgId: number): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(usersTable)
    .where(eq(usersTable.referredByTgId, tgId));
  return row?.n ?? 0;
}

async function reportCountOf(tgId: number): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(reports)
    .where(eq(reports.reportedTgId, tgId));
  return row?.n ?? 0;
}

async function ratingStatsOf(tgId: number): Promise<{
  averageRating: number | null;
  ratingsCount: number;
}> {
  const [row] = await db
    .select({ avg: avg(ratings.stars), n: count() })
    .from(ratings)
    .where(eq(ratings.ratedTgId, tgId));
  return {
    averageRating: row?.avg == null ? null : Number(row.avg),
    ratingsCount: row?.n ?? 0,
  };
}

export function toUserWithProfile(row: User): UserWithProfile {
  const profile = toPublicProfile(row);
  const lookingFor = rolesFrom(row.lookingFor);
  return {
    ...profile,
    lookingFor,
    isAdmin: row.isAdmin,
    currency: row.currency,
    streakDays: row.streakDays,
    lastClaimDay: row.lastClaimDay,
    referralCode: row.referralCode,
    referredByTgId: row.referredByTgId,
    referralCount: 0,
    qualifiedReferralCount: 0,
    profileComplete: isProfileComplete({ ...profile, lookingFor }),
  };
}

/** Обогащает профиль пользователя счётчиками рефералов */
export async function withReferralCount(
  u: UserWithProfile,
): Promise<UserWithProfile> {
  const [referralCount, qualifiedReferralCount] = await Promise.all([
    referralCountOf(u.tgId),
    countQualifiedReferrals(u.tgId),
  ]);
  return { ...u, referralCount, qualifiedReferralCount };
}

/** Полная информация о пользователе для админ-панели */
export async function toAdminUserView(
  row: User,
): Promise<AdminUserView> {
  const rating = await ratingStatsOf(row.tgId);
  const lastSeenAt = row.lastSeenAt ? row.lastSeenAt.toISOString() : null;
  const online = row.lastSeenAt
    ? Date.now() - row.lastSeenAt.getTime() < 5 * 60 * 1000
    : false;

  return {
    ...toPublicProfile(row),
    lastName: row.lastName,
    lookingFor: rolesFrom(row.lookingFor),
    isAdmin: row.isAdmin,
    onboardedAt: row.onboardedAt ? row.onboardedAt.toISOString() : null,
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
    currency: row.currency,
    streakDays: row.streakDays,
    lastClaimDay: row.lastClaimDay,
    referralCode: row.referralCode,
    referralCount: await referralCountOf(row.tgId),
    qualifiedReferralCount: await countQualifiedReferrals(row.tgId),
    lastSeenAt,
    online,
    arcanaIssued: row.arcanaIssued,
    reportCount: await reportCountOf(row.tgId),
    averageRating: rating.averageRating,
    ratingsCount: rating.ratingsCount,
  };
}
