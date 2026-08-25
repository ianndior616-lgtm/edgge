import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

let activePool: Pool | null = null;

/**
 * Создаёт соединение только при первом реальном обращении к БД.
 *
 * Next.js импортирует обработчики API во время `next build`, в том числе для
 * preview-деплоев Vercel. DATABASE_URL может быть намеренно доступен лишь в
 * runtime/production-среде, поэтому нельзя падать уже на этапе импорта модуля.
 */
function getPool(): Pool {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is required. Configure it in the deployment environment before using database routes.",
    );
  }

  if (!activePool) {
    activePool = new Pool({ connectionString });
  }
  return activePool;
}

/**
 * Совместимый с pg Pool ленивый прокси. Все существующие вызовы db и pool
 * сохраняют прежний API, но чтение DATABASE_URL откладывается до запроса.
 */
export const pool = new Proxy({} as Pool, {
  get(_target, property) {
    const target = getPool();
    const value = Reflect.get(target, property, target);
    return typeof value === "function" ? value.bind(target) : value;
  },
});

// Передаём клиент через config-объект, чтобы Drizzle не обращался к lazy proxy
// при собственной инициализации во время build.
export const db = drizzle({ client: pool });
