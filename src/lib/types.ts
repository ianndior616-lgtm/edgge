import type { FeedbackTagId, FeedbackTagStat } from "./feedback-tags";

/** Позиции в Dota 2 */
export type RoleId = "pos1" | "pos2" | "pos3" | "pos4" | "pos5";

/** Идентификаторы тем оформления */
export type ThemeId = "dark" | "light" | "dota";

export type ProfileStatsPeriod = {
  views: number;
  likes: number;
  likeRate: number;
};

export type ProfileStats = {
  views: number;
  likes: number;
  matches: number;
  likeRate: number;
  /** Детализация по периодам доступна только владельцу с VIP. */
  vip: {
    last7Days: ProfileStatsPeriod;
    last30Days: ProfileStatsPeriod;
  } | null;
};

/** Публичная анкета игрока (то, что видят другие) */
export type PublicProfile = {
  id: number;
  tgId: number;
  username: string | null;
  firstName: string;
  photoUrl: string | null;
  avatarUrl: string | null;
  banner: string | null;
  name: string | null;
  role: RoleId | null;
  mmr: number | null;
  age: number | null;
  profileLink: string | null;
  description: string | null;
  dotaAccountId: number | null;
  dotaSteamId: string | null;
  dotaName: string | null;
  dotaAvatarUrl: string | null;
  dotaCountryCode: string | null;
  dotaRankTier: number | null;
  dotaLeaderboardRank: number | null;
  dotaMmrEstimate: number | null;
  dotaWins: number | null;
  dotaLosses: number | null;
  dotaMainHeroes: string[];
  dotaLastSyncAt: string | null;
  isActive: boolean;
  /** VIP-статус анкеты. */
  isVip: boolean;
  /** Игрок прямо сейчас ищет пати; статус автоматически истекает. */
  isLookingNow: boolean;
  crownUnlocked: boolean;
  createdAt: string | null;
  /** Средняя оценка после мэтчей */
  averageRating: number | null;
  ratingsCount: number;
  /** Самые частые характеристики, которые дали после мэтчей. */
  feedbackTags: FeedbackTagStat[];
};

/** Текущий пользователь: анкета + приватные данные */
export type UserWithProfile = PublicProfile & {
  profileComplete: boolean;
  lookingFor: RoleId[];
  isAdmin: boolean;
  currency: number;
  streakDays: number;
  lastClaimDay: string | null;
  referralCode: string | null;
  referredByTgId: number | null;
  /** Код друга, который привёл пользователя */
  referredByCode: string | null;
  /** Сколько людей вообще ввели мой код */
  referralCount: number;
  /** Сколько рефералов прошли 7 активных дней */
  qualifiedReferralCount: number;
  /** Мой прогресс как реферала: активных дней из 7 */
  referralProgressDays: number;
  /** До какого момента активен статус «Ищу пати сейчас». */
  lookingNowUntil: string | null;
  /** Приватная статистика, видимая только владельцу анкеты. */
  profileStats: ProfileStats;
};

export type CheckinResponse = {
  alreadyClaimed: boolean;
  reward: number;
  streakDays: number;
  currency: number;
  crownUnlocked: boolean;
  crownJustUnlocked: boolean;
  nextReward: number;
};

export type LookingNowResponse = {
  active: boolean;
  until: string | null;
};

export type AdminUserView = PublicProfile & {
  lastName: string | null;
  lookingFor: RoleId[];
  isAdmin: boolean;
  isBanned: boolean;
  onboardedAt: string | null;
  updatedAt: string | null;
  currency: number;
  streakDays: number;
  lastClaimDay: string | null;
  referralCode: string | null;
  referralCount: number;
  qualifiedReferralCount: number;
  lastSeenAt: string | null;
  online: boolean;
  arcanaIssued: boolean;
  reportCount: number;
  averageRating: number | null;
  ratingsCount: number;
};

export type AdminUsersResponse = {
  users: AdminUserView[];
};

export type AdminUserUpdate = {
  name?: string;
  role?: RoleId;
  lookingFor?: RoleId[];
  mmr?: number;
  age?: number;
  profileLink?: string;
  description?: string;
  isActive?: boolean;
  isBanned?: boolean;
  arcanaIssued?: boolean;
};

export type ReportReason =
  | "ads"
  | "scam"
  | "meaningless"
  | "insult"
  | "unpleasant"
  | "politics";

export type ReportView = {
  id: number;
  reason: ReportReason;
  status: string;
  createdAt: string;
  reporter: PublicProfile | null;
  reported: PublicProfile;
};

export type AdminReportsResponse = {
  reports: ReportView[];
};

export type RatingResponse = {
  ok: boolean;
  averageRating: number | null;
  ratingsCount: number;
  myRating: number | null;
  myFeedbackTags: FeedbackTagId[];
};

export type VerifyResponse = {
  ok: boolean;
};

export type MeResponse = {
  user: UserWithProfile;
  demo: boolean;
  botUsername: string | null;
};

export type ProfilesResponse = {
  profiles: PublicProfile[];
};

export type RecommendationsResponse = {
  profiles: PublicProfile[];
};

export type IncomingLikesResponse = {
  profiles: PublicProfile[];
};

export type LikeResponse = {
  match: boolean;
  matchedProfile?: PublicProfile;
};

export type MatchItem = {
  profile: PublicProfile;
  matchedAt: string | null;
  myRating: number | null;
  myFeedbackTags: FeedbackTagId[];
};

export type MatchesResponse = {
  matches: MatchItem[];
};

export type DotaProfileImport = {
  accountId: number;
  steamId: string | null;
  personaName: string | null;
  avatarUrl: string | null;
  steamProfileUrl: string | null;
  countryCode: string | null;
  rankTier: number | null;
  leaderboardRank: number | null;
  mmrEstimate: number | null;
  wins: number | null;
  losses: number | null;
  mainHeroes: string[];
};

export type DotaProfileImportResponse = { profile: DotaProfileImport };

export type ProfileUpdate = {
  name?: string;
  role?: RoleId;
  lookingFor?: RoleId[];
  avatarUrl?: string | null;
  banner?: string | null;
  mmr?: number;
  age?: number;
  profileLink?: string;
  description?: string;
  isActive?: boolean;
  adminCode?: string;
  referralCode?: string;
};

export type ReportCreate = {
  reportedTgId: number;
  reason: ReportReason;
};
