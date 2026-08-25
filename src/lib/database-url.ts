/**
 * Имена переменных, которые обычно создают Vercel Postgres / Neon.
 * DATABASE_URL остаётся основным и имеет наивысший приоритет.
 */
export const DATABASE_URL_ENV_KEYS = [
  "DATABASE_URL",
  "POSTGRES_URL",
  "POSTGRES_URL_NON_POOLING",
  "POSTGRES_PRISMA_URL",
] as const;

type Environment = Record<string, string | undefined>;

/** Возвращает первую непустую строку подключения к PostgreSQL. */
export function databaseUrlFromEnv(env: Environment = process.env): string | null {
  for (const key of DATABASE_URL_ENV_KEYS) {
    const value = env[key]?.trim();
    if (value) return value;
  }
  return null;
}

export function databaseConfigurationHint(): string {
  return `Set ${DATABASE_URL_ENV_KEYS.join(" or ")} in the deployment environment.`;
}
