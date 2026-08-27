CREATE TABLE "likes" (
	"id" serial PRIMARY KEY NOT NULL,
	"liker_tg_id" bigint NOT NULL,
	"liked_tg_id" bigint NOT NULL,
	"liked" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ratings" (
	"id" serial PRIMARY KEY NOT NULL,
	"rater_tg_id" bigint NOT NULL,
	"rated_tg_id" bigint NOT NULL,
	"stars" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"reporter_tg_id" bigint NOT NULL,
	"reported_tg_id" bigint NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rewards_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"tg_id" bigint NOT NULL,
	"kind" text NOT NULL,
	"amount" integer DEFAULT 0 NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"tg_id" bigint NOT NULL,
	"username" text,
	"first_name" text DEFAULT '' NOT NULL,
	"last_name" text,
	"photo_url" text,
	"name" text,
	"role" text,
	"looking_for" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"avatar_url" text,
	"banner" text,
	"onboarded_at" timestamp with time zone,
	"is_admin" boolean DEFAULT false NOT NULL,
	"currency" integer DEFAULT 0 NOT NULL,
	"referral_code" text,
	"referred_by_tg_id" bigint,
	"last_claim_day" text,
	"streak_days" integer DEFAULT 0 NOT NULL,
	"crown_unlocked" boolean DEFAULT false NOT NULL,
	"arcana_issued" boolean DEFAULT false NOT NULL,
	"last_seen_at" timestamp with time zone,
	"mmr" integer,
	"age" integer,
	"profile_link" text,
	"description" text,
	"dota_account_id" bigint,
	"dota_steam_id" text,
	"dota_name" text,
	"dota_avatar_url" text,
	"dota_country_code" text,
	"dota_rank_tier" integer,
	"dota_leaderboard_rank" integer,
	"dota_mmr_estimate" integer,
	"dota_wins" integer,
	"dota_losses" integer,
	"dota_main_heroes" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"dota_last_sync_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_tg_id_unique" UNIQUE("tg_id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "likes_pair_idx" ON "likes" USING btree ("liker_tg_id","liked_tg_id");--> statement-breakpoint
CREATE INDEX "likes_liked_idx" ON "likes" USING btree ("liked_tg_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ratings_pair_uidx" ON "ratings" USING btree ("rater_tg_id","rated_tg_id");--> statement-breakpoint
CREATE INDEX "reports_reported_idx" ON "reports" USING btree ("reported_tg_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "reports_pair_reason_uidx" ON "reports" USING btree ("reporter_tg_id","reported_tg_id","reason");--> statement-breakpoint
CREATE INDEX "rewards_tg_idx" ON "rewards_log" USING btree ("tg_id","kind");--> statement-breakpoint
CREATE INDEX "users_role_mmr_idx" ON "users" USING btree ("role","mmr");--> statement-breakpoint
CREATE UNIQUE INDEX "users_referral_code_uidx" ON "users" USING btree ("referral_code");