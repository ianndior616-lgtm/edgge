import { pool, isDatabaseConfigurationError } from "@/db";
import { MIGRATIONS } from "@/db/migrations";

/**
 * Application-side runner миграций для serverless-окружений (Vercel).
 *
 * Файлы drizzle/*.sql в рантайме Vercel недоступны, поэтому SQL зашит в
 * src/db/migrations.ts и накатывается отсюда. Каждая миграция выполняется в
 * собственной транзакции, после чего регистрируется в таблице _migrations —
 * повторные запуски ничего не ломают.
 */

export interface MigrationResult {
  applied: string[];
  alreadyApplied: string[];
  total: number;
}

/** Проверка конфигурации БД с понятным сообщением (не бросает). */
export async function checkDatabaseConfigured(): Promise<
  { ok: true } | { ok: false; hint: string }
> {
  try {
    await pool.query("select 1");
    return { ok: true };
  } catch (error) {
    if (isDatabaseConfigurationError(error)) {
      return {
        ok: false,
        hint: "DATABASE_URL не задан. Vercel → Storage → подключите базу и передеплойте проект.",
      };
    }
    throw error;
  }
}

/**
 * Накатывает все ещё не применённые миграции по порядку.
 * Бросает исключение при ошибке (соединение, синтаксис SQL и т.п.).
 */
export async function runMigrations(): Promise<MigrationResult> {
  const applied: string[] = [];
  const alreadyApplied: string[] = [];

  // Журнал применённых миграций. Создаём вне транзакции миграций.
  await pool.query(
    `create table if not exists "_migrations" (
       "name" text primary key not null,
       "applied_at" timestamptz not null default now()
     )`,
  );

  const { rows } = await pool.query<{ name: string }>(
    `select "name" from "_migrations"`,
  );
  const done = new Set(rows.map((r) => r.name));

  const client = await pool.connect();
  try {
    for (const migration of MIGRATIONS) {
      if (done.has(migration.name)) {
        alreadyApplied.push(migration.name);
        continue;
      }

      await client.query("begin");
      try {
        await client.query(migration.sql);
        await client.query(
          `insert into "_migrations" ("name") values ($1)`,
          [migration.name],
        );
        await client.query("commit");
        applied.push(migration.name);
      } catch (error) {
        await client.query("rollback").catch(() => undefined);
        throw error;
      }
    }
  } finally {
    client.release();
  }

  return {
    applied,
    alreadyApplied,
    total: MIGRATIONS.length,
  };
}
