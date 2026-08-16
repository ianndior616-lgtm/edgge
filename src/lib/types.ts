/** Позиции в Dota 2 */
export type RoleId = "pos1" | "pos2" | "pos3" | "pos4" | "pos5";

/** Идентификаторы тем оформления */
export type ThemeId = "dark" | "light" | "dota";

/** Публичная анкета игрока (то, что видят другие) */
export type PublicProfile = {
  id: number;
  tgId: number;
  username: string | null;
  firstName: string;
  photoUrl: string | null;
  /** Пресет аватарки (/avatars/av-N.png) или null — фото Telegram/буква */
  avatarUrl: string | null;
  /** Картинка карточки: data URL, palette:N или null (цвет роли) */
  banner: string | null;
  name: string | null;
  role: RoleId | null;
  mmr: number | null;
  age: number | null;
  profileLink: string | null;
  description: string | null;
  /** Публичные данные Dota, синхронизированные через OpenDota */
  dotaAccountId: number | null;
  dotaSteamId: string | null;
  dotaName: string | null;
  dotaAvatarUrl: string | null;
  dotaCountryCode: string | null;
  dotaRankTier: number | null;
  dotaLeaderboardRank: number | null;
  /** Это оценка OpenDota, а не гарантированно точный текущий MMR */
  dotaMmrEstimate: number | null;
  dotaWins: number | null;
  dotaLosses: number | null;
  dotaMainHeroes: string[];
  dotaLastSyncAt: string | null;
  isActive: boolean;
  /** Разблокирован уникальный аватар короны (7-й день стрика) */
  crownUnlocked: boolean;
  createdAt: string | null;
};

/** Текущий пользователь: анкета + кого он ищет (видно только ему) */
export type UserWithProfile = PublicProfile & {
  profileComplete: boolean;
  /** Роли, которые я ищу в тиммейты (в рекомендациях не показываются) */
  lookingFor: RoleId[];
  /** Администратор (регистрация по коду доступа) */
  isAdmin: boolean;

  // --- Кошелёк и рефералы ---
  currency: number;
  streakDays: number;
  lastClaimDay: string | null;
  /** Собственный реферальный код (VV-XXXXXX) */
  referralCode: string | null;
  /** Кто привёл этого пользователя */
  referredByTgId: number | null;
  /** Сколько рефералов привёл пользователь */
  referralCount: number;
  /** Качественные рефералы для арканы: активны + 7-дневный стрик */
  qualifiedReferralCount: number;
};

/** Ответ ежедневного чек-ина */
export type CheckinResponse = {
  /** Награда сегодня уже получена */
  alreadyClaimed: boolean;
  reward: number;
  streakDays: number;
  currency: number;
  crownUnlocked: boolean;
  /** Корона открыта именно этим чек-ином */
  crownJustUnlocked: boolean;
  nextReward: number;
};

/** Полная карточка пользователя для админ-панели */
export type AdminUserView = PublicProfile & {
  lastName: string | null;
  lookingFor: RoleId[];
  isAdmin: boolean;
  onboardedAt: string | null;
  updatedAt: string | null;
  // --- Кошелёк и рефералы ---
  currency: number;
  streakDays: number;
  lastClaimDay: string | null;
  referralCode: string | null;
  referralCount: number;
  /** Качественные рефералы для арканы: активны + 7-дневный стрик */
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
  /** Ручная выдача арканы (веха 50 качественных рефералов) */
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

export type LikeResponse = {
  match: boolean;
  matchedProfile?: PublicProfile;
};

export type MatchItem = {
  profile: PublicProfile;
  matchedAt: string | null;
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

/** Тело запроса на сохранение анкеты (все поля опциональны) */
export type ProfileUpdate = {
  name?: string;
  role?: RoleId;
  lookingFor?: RoleId[];
  avatarUrl?: string | null;
  /** Картинка карточки: data URL, palette:N или null */
  banner?: string | null;
  mmr?: number;
  age?: number;
  profileLink?: string;
  description?: string;
  isActive?: boolean;
  /** Код доступа администратора (только при админ-регистрации) */
  adminCode?: string;
  /** Код друга (реферальный) — привязывается один раз */
  referralCode?: string;
};

export type ReportCreate = {
  reportedTgId: number;
  reason: ReportReason;
};
