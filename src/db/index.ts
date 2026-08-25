import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import {
  databaseConfigurationHint,
  databaseUrlFromEnv,
} from "@/lib/database-url";

let activePool: Pool | null = null;

/** Ошибка отсутствующей конфигурации БД, безопасная для показа в API. */
export class DatabaseConfigurationError extends Error {
  constructor() {
    super(`Database connection is not configured. ${databaseConfigurationHint()}`);
    this.name = "DatabaseConfigurationError";
  }
}

/**
 * Создаёт соединение только при первом реальном обращении к БД.
 *
 * Next.js импортирует обработчики API во время `next build`, в том числе для
 * preview-деплоев Vercel. Переменная подключения может быть намеренно доступна
 * лишь в runtime/production-среде, поэтому импорт модуля не должен падать.
 */
function getPool(): Pool {
  const connectionString = databaseUrlFromEnv();
  if (!connectionString) throw new DatabaseConfigurationError();

  if (!activePool) {
    // Маленький пул безопаснее для serverless-инстансов Vercel: каждый warm
    // runtime переиспользует одно соединение вместо открытия десятков.
    activePool = new Pool({
      connectionString,
      max: 1,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
    });
  }
  return activePool;
}

/**
 * Совместимый с pg Pool ленивый прокси. Все существующие вызовы db и pool
 * сохраняют прежний API, но чтение строки подключения откладывается до запроса.
 */
export const pool = new Proxy({} as Pool, {
  get(_target, property) {
    const target = getPool();
    const value = Reflect.get(target, property, target);
    return typeof value === "function" ? value.bind(target) : value;
  },
});

/** Проверяет цепочку cause: Drizzle оборачивает ошибку конфигурации в query error. */
export function isDatabaseConfigurationError(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; current && depth < 8; depth += 1) {
    if (current instanceof DatabaseConfigurationError) return true;
    if (typeof current !== "object") return false;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

let activeDb: ReturnType<typeof drizzle> | null = null;

/**
 * Drizzle тоже создаём лениво, но уже поверх настоящего Pool. Это важно для
 * transaction(): Drizzle должен распознать объект именно как pg.Pool и взять
 * один клиент через connect(), а не выполнять BEGIN/COMMIT через proxy.
 */
function getDb(): ReturnType<typeof drizzle> {
  if (!activeDb) activeDb = drizzle(getPool());
  return activeDb;
}

/** Ленивый facade, сохраняющий API db до первой database-операции. */
export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, property) {
    const target = getDb();
    const value = Reflect.get(target, property, target);
    return typeof value === "function" ? value.bind(target) : value;
  },
});
