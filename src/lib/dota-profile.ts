const STEAM64_BASE = 76561197960265728n;
const MAX_ACCOUNT_ID = 4_294_967_295n;

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

type OpenDotaPlayer = {
  profile?: {
    account_id?: number;
    personaname?: string;
    steamid?: string;
    avatarfull?: string;
    avatarmedium?: string;
    avatar?: string;
    profileurl?: string;
    loccountrycode?: string;
  } | null;
  rank_tier?: number | null;
  leaderboard_rank?: number | null;
  mmr_estimate?: { estimate?: number | null } | null;
};

type OpenDotaWl = { win?: number; lose?: number };
type OpenDotaHero = { hero_id?: number; games?: number; win?: number };
type OpenDotaHeroConstant = { localized_name?: string; name?: string };

function asAccountId(value: bigint): number | null {
  if (value < 0n || value > MAX_ACCOUNT_ID) return null;
  return Number(value);
}

function numericToAccountId(raw: string): number | null {
  if (!/^\d{1,20}$/.test(raw)) return null;
  try {
    const n = BigInt(raw);
    if (n >= STEAM64_BASE) return asAccountId(n - STEAM64_BASE);
    return asAccountId(n);
  } catch {
    return null;
  }
}

/**
 * Извлекает Dota account_id из DotaBuff / STRATZ / OpenDota / Steam64 ссылки.
 * Для steamcommunity.com/id/<vanity> нужен STEAM_WEB_API_KEY, поэтому такой URL
 * разрешается отдельно через Steam Web API.
 */
export function accountIdFromDotaInput(input: string): number | null {
  const raw = input.trim();
  const direct = numericToAccountId(raw);
  if (direct != null) return direct;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const parts = url.pathname.split("/").filter(Boolean);

  if (
    host === "dotabuff.com" ||
    host.endsWith(".dotabuff.com") ||
    host === "stratz.com" ||
    host.endsWith(".stratz.com") ||
    host === "opendota.com" ||
    host.endsWith(".opendota.com")
  ) {
    const idx = parts.findIndex((p) => p.toLowerCase() === "players");
    if (idx >= 0 && parts[idx + 1]) return numericToAccountId(parts[idx + 1]);
  }

  if (host === "steamcommunity.com" && parts[0]?.toLowerCase() === "profiles") {
    return parts[1] ? numericToAccountId(parts[1]) : null;
  }

  return null;
}

async function resolveSteamVanity(input: string): Promise<number | null> {
  const rawKey = process.env.STEAM_WEB_API_KEY?.trim();
  const key = rawKey && !["disabled", "none", "null", "-"].includes(rawKey.toLowerCase()) ? rawKey : "";
  if (!key) return null;

  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.hostname.toLowerCase().replace(/^www\./, "") !== "steamcommunity.com") {
    return null;
  }

  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0]?.toLowerCase() !== "id" || !parts[1]) return null;

  const endpoint = new URL("https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/");
  endpoint.searchParams.set("key", key);
  endpoint.searchParams.set("vanityurl", parts[1]);

  const response = await fetch(endpoint, { cache: "no-store" });
  if (!response.ok) return null;
  const data = (await response.json()) as {
    response?: { success?: number; steamid?: string };
  };
  if (data.response?.success !== 1 || !data.response.steamid) return null;
  return numericToAccountId(data.response.steamid);
}

function openDotaUrl(path: string): string {
  const url = new URL(`https://api.opendota.com/api${path}`);
  const rawKey = process.env.OPENDOTA_API_KEY?.trim();
  const key = rawKey && !["disabled", "none", "null", "-"].includes(rawKey.toLowerCase()) ? rawKey : "";
  if (key) url.searchParams.set("api_key", key);
  return url.toString();
}

async function fetchJson<T>(url: string): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7_000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
      headers: { accept: "application/json" },
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

let heroNamesCache: { at: number; names: Map<number, string> } | null = null;

async function heroNames(): Promise<Map<number, string>> {
  if (heroNamesCache && Date.now() - heroNamesCache.at < 24 * 60 * 60 * 1000) {
    return heroNamesCache.names;
  }

  const data = await fetchJson<Record<string, OpenDotaHeroConstant>>(
    openDotaUrl("/constants/heroes"),
  );
  const names = new Map<number, string>();
  if (data) {
    for (const [idRaw, hero] of Object.entries(data)) {
      const id = Number(idRaw);
      const name = hero.localized_name?.trim();
      if (Number.isInteger(id) && name) names.set(id, name);
    }
  }
  heroNamesCache = { at: Date.now(), names };
  return names;
}

export async function importDotaProfile(input: string): Promise<DotaProfileImport | null> {
  let accountId = accountIdFromDotaInput(input);
  if (accountId == null) accountId = await resolveSteamVanity(input);
  if (accountId == null) return null;

  const [player, wl, heroes, names] = await Promise.all([
    fetchJson<OpenDotaPlayer>(openDotaUrl(`/players/${accountId}`)),
    fetchJson<OpenDotaWl>(openDotaUrl(`/players/${accountId}/wl`)),
    fetchJson<OpenDotaHero[]>(openDotaUrl(`/players/${accountId}/heroes`)),
    heroNames(),
  ]);

  if (!player?.profile) return null;

  const mainHeroes = (heroes ?? [])
    .filter((h) => Number.isInteger(h.hero_id) && (h.games ?? 0) > 0)
    .sort((a, b) => (b.games ?? 0) - (a.games ?? 0))
    .slice(0, 5)
    .map((h) => names.get(h.hero_id as number))
    .filter((name): name is string => Boolean(name));

  const estimate = Number(player.mmr_estimate?.estimate);
  const rankTier = Number(player.rank_tier);
  const leaderboardRank = Number(player.leaderboard_rank);

  return {
    accountId,
    steamId: player.profile.steamid?.trim() || null,
    personaName: player.profile.personaname?.trim() || null,
    avatarUrl:
      player.profile.avatarfull?.trim() ||
      player.profile.avatarmedium?.trim() ||
      player.profile.avatar?.trim() ||
      null,
    steamProfileUrl: player.profile.profileurl?.trim() || null,
    countryCode: player.profile.loccountrycode?.trim() || null,
    rankTier: Number.isInteger(rankTier) ? rankTier : null,
    leaderboardRank: Number.isInteger(leaderboardRank) ? leaderboardRank : null,
    mmrEstimate: Number.isInteger(estimate) && estimate >= 0 ? estimate : null,
    wins: Number.isInteger(wl?.win) ? wl!.win! : null,
    losses: Number.isInteger(wl?.lose) ? wl!.lose! : null,
    mainHeroes,
  };
}
