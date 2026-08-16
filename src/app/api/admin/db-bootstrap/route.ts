import { NextResponse } from "next/server";
import { pool } from "@/db";

export const dynamic = "force-dynamic";

const bootstrapSql = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  tg_id BIGINT NOT NULL UNIQUE,
  username TEXT,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT,
  photo_url TEXT,
  name TEXT,
  role TEXT,
  looking_for TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  avatar_url TEXT,
  banner TEXT,
  onboarded_at TIMESTAMPTZ,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  currency INTEGER NOT NULL DEFAULT 0,
  referral_code TEXT,
  referred_by_tg_id BIGINT,
  last_claim_day TEXT,
  streak_days INTEGER NOT NULL DEFAULT 0,
  crown_unlocked BOOLEAN NOT NULL DEFAULT FALSE,
  arcana_issued BOOLEAN NOT NULL DEFAULT FALSE,
  last_seen_at TIMESTAMPTZ,
  mmr INTEGER,
  age INTEGER,
  profile_link TEXT,
  description TEXT,
  dota_account_id BIGINT,
  dota_steam_id TEXT,
  dota_name TEXT,
  dota_avatar_url TEXT,
  dota_country_code TEXT,
  dota_rank_tier INTEGER,
  dota_leaderboard_rank INTEGER,
  dota_mmr_estimate INTEGER,
  dota_wins INTEGER,
  dota_losses INTEGER,
  dota_main_heroes TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  dota_last_sync_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS users_role_mmr_idx ON users (role, mmr);
CREATE UNIQUE INDEX IF NOT EXISTS users_referral_code_uidx ON users (referral_code);

CREATE TABLE IF NOT EXISTS likes (
  id SERIAL PRIMARY KEY,
  liker_tg_id BIGINT NOT NULL,
  liked_tg_id BIGINT NOT NULL,
  liked BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS likes_pair_idx ON likes (liker_tg_id, liked_tg_id);
CREATE INDEX IF NOT EXISTS likes_liked_idx ON likes (liked_tg_id);

CREATE TABLE IF NOT EXISTS rewards_log (
  id SERIAL PRIMARY KEY,
  tg_id BIGINT NOT NULL,
  kind TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS rewards_tg_idx ON rewards_log (tg_id, kind);

CREATE TABLE IF NOT EXISTS reports (
  id SERIAL PRIMARY KEY,
  reporter_tg_id BIGINT NOT NULL,
  reported_tg_id BIGINT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS reports_reported_idx ON reports (reported_tg_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS reports_pair_reason_uidx
  ON reports (reporter_tg_id, reported_tg_id, reason);

CREATE TABLE IF NOT EXISTS ratings (
  id SERIAL PRIMARY KEY,
  rater_tg_id BIGINT NOT NULL,
  rated_tg_id BIGINT NOT NULL,
  stars INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ratings_pair_uidx ON ratings (rater_tg_id, rated_tg_id);
`;

export async function GET(request: Request) {
  const configuredSecret = process.env.BOT_SETUP_SECRET?.trim();
  const supplied =
    request.headers.get("x-setup-secret") ??
    new URL(request.url).searchParams.get("secret") ??
    "";

  if (!configuredSecret || supplied !== configuredSecret) {
    return NextResponse.json({ ok: false, reason: "forbidden" }, { status: 403 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(bootstrapSql);
    const check = await client.query<{ table_name: string }>(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('users', 'likes', 'rewards_log', 'reports', 'ratings')
      ORDER BY table_name
    `);
    await client.query("COMMIT");

    return NextResponse.json({
      ok: true,
      createdOrVerified: check.rows.map((row) => row.table_name),
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error("Database bootstrap failed:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}
