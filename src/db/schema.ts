import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Пользователи, зарегистрировавшиеся через Telegram-бота.
 * tgId — идентификатор пользователя в Telegram (приходит из initData).
 * Остальные поля — анкета для поиска тиммейта.
 */
export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    tgId: bigint("tg_id", { mode: "number" }).notNull().unique(),
    username: text("username"),
    firstName: text("first_name").notNull().default(""),
    lastName: text("last_name"),
    photoUrl: text("photo_url"),

    // --- Анкета ---
    name: text("name"),
    role: text("role"), // pos1..pos5 — моя роль
    // Роли, которые ищу в тиммейты (в рекомендациях НЕ отображаются,
    // но влияют на подборку: обе стороны должны подходить друг другу)
    lookingFor: text("looking_for")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    // Загруженная пользователем аватарка (data URL) или null — тогда
    // берётся фото из Telegram (photoUrl) или заглавная буква имени
    avatarUrl: text("avatar_url"),
    // Картинка карточки в рекомендациях: data URL (своё изображение),
    // "palette:N" (базовая палитра/градиент) или null (цвет роли)
    banner: text("banner"),
    // Момент завершения регистрации через приложение (заполнение анкеты).
    // В рекомендации попадают только пользователи с заполненной анкетой.
    onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
    // Администратор (регистрация по коду доступа) — видит админ-панель
    isAdmin: boolean("is_admin").notNull().default(false),

    // --- Кошелёк и рефералы ---
    currency: integer("currency").notNull().default(0),
    /** Собственный реферальный код пользователя (VV-XXXXXX) */
    referralCode: text("referral_code"),
    /** Кто привёл этого пользователя (tgId реферера) */
    referredByTgId: bigint("referred_by_tg_id", { mode: "number" }),
    /** День последнего получения ежедневной награды (YYYY-MM-DD) */
    lastClaimDay: text("last_claim_day"),
    /** Текущая серия ежедневных входов */
    streakDays: integer("streak_days").notNull().default(0),
    /** Разблокирован уникальный аватар короны (7-й день стрика) */
    crownUnlocked: boolean("crown_unlocked").notNull().default(false),
    /** Аркана выдана администрацией вручную (50 качественных рефералов) */
    arcanaIssued: boolean("arcana_issued").notNull().default(false),
    /** Последняя активность в приложении (для "сейчас онлайн") */
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    mmr: integer("mmr"), // ПТС / MMR
    age: integer("age"),
    profileLink: text("profile_link"), // Steam / Dotabuff / Stratz
    description: text("description"),

    // --- Автоматически синхронизируемые публичные данные Dota ---
    dotaAccountId: bigint("dota_account_id", { mode: "number" }),
    dotaSteamId: text("dota_steam_id"),
    dotaName: text("dota_name"),
    dotaAvatarUrl: text("dota_avatar_url"),
    dotaCountryCode: text("dota_country_code"),
    dotaRankTier: integer("dota_rank_tier"),
    dotaLeaderboardRank: integer("dota_leaderboard_rank"),
    dotaMmrEstimate: integer("dota_mmr_estimate"),
    dotaWins: integer("dota_wins"),
    dotaLosses: integer("dota_losses"),
    dotaMainHeroes: text("dota_main_heroes")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    dotaLastSyncAt: timestamp("dota_last_sync_at", { withTimezone: true }),

    isActive: boolean("is_active").notNull().default(true),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("users_role_mmr_idx").on(t.role, t.mmr),
    uniqueIndex("users_referral_code_uidx").on(t.referralCode),
  ],
);

/**
 * Реакции на анкеты: liked=true — лайк, liked=false — «мимо».
 * Взаимный лайк = совпадение (матч), которое попадает в «Чаты».
 */
export const likes = pgTable(
  "likes",
  {
    id: serial("id").primaryKey(),
    likerTgId: bigint("liker_tg_id", { mode: "number" }).notNull(),
    likedTgId: bigint("liked_tg_id", { mode: "number" }).notNull(),
    liked: boolean("liked").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("likes_pair_idx").on(t.likerTgId, t.likedTgId),
    index("likes_liked_idx").on(t.likedTgId),
  ],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Like = typeof likes.$inferSelect;
export type NewLike = typeof likes.$inferInsert;

/**
 * Журнал начислений валюты: ежедневные награды, реферальный доход,
 * вехи рефералов, выдача арканы админом.
 */
export const rewardsLog = pgTable(
  "rewards_log",
  {
    id: serial("id").primaryKey(),
    tgId: bigint("tg_id", { mode: "number" }).notNull(),
    kind: text("kind").notNull(), // daily | referral_income | milestone | arcana
    amount: integer("amount").notNull().default(0),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("rewards_tg_idx").on(t.tgId, t.kind)],
);

export const reports = pgTable(
  "reports",
  {
    id: serial("id").primaryKey(),
    reporterTgId: bigint("reporter_tg_id", { mode: "number" }).notNull(),
    reportedTgId: bigint("reported_tg_id", { mode: "number" }).notNull(),
    reason: text("reason").notNull(),
    status: text("status").notNull().default("open"), // open | reviewed
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("reports_reported_idx").on(t.reportedTgId, t.status),
    uniqueIndex("reports_pair_reason_uidx").on(
      t.reporterTgId,
      t.reportedTgId,
      t.reason,
    ),
  ],
);

export const ratings = pgTable(
  "ratings",
  {
    id: serial("id").primaryKey(),
    raterTgId: bigint("rater_tg_id", { mode: "number" }).notNull(),
    ratedTgId: bigint("rated_tg_id", { mode: "number" }).notNull(),
    stars: integer("stars").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("ratings_pair_uidx").on(t.raterTgId, t.ratedTgId)],
);

export type Report = typeof reports.$inferSelect;
export type Rating = typeof ratings.$inferSelect;
