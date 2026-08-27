import { NextResponse } from "next/server";
import {
  checkDatabaseConfigured,
  runMigrations,
} from "@/lib/run-migrations";

export const dynamic = "force-dynamic";

/**
 * Применение схемы БД (миграций) без CLI — для production на Vercel.
 *
 * Использование после деплоя и подключения базы (Vercel → Storage):
 *   curl 'https://<your-domain>/api/admin/migrate?secret=<BOT_SETUP_SECRET>'
 * или с заголовком:
 *   curl -H 'x-setup-secret: <BOT_SETUP_SECRET>' \
 *        'https://<your-domain>/api/admin/migrate'
 *
 * Та же проверка секрета, что и у /api/bot/setup. Если BOT_SETUP_SECRET не
 * задан — заголовок не требуется (рекомендуется задать секрет в проде).
 * Эндпоинт идемпотентен: уже применённые миграции пропускаются.
 */
async function handle(request: Request) {
  const configuredSetupSecret = process.env.BOT_SETUP_SECRET?.trim();
  if (configuredSetupSecret) {
    const supplied =
      request.headers.get("x-setup-secret") ??
      new URL(request.url).searchParams.get("secret") ??
      "";
    if (supplied !== configuredSetupSecret) {
      return NextResponse.json({ ok: false, reason: "forbidden" }, { status: 403 });
    }
  }

  const config = await checkDatabaseConfigured();
  if (!config.ok) {
    return NextResponse.json(
      { ok: false, reason: "database_not_configured", error: config.hint },
      { status: 503 },
    );
  }

  try {
    const result = await runMigrations();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("MIGRATION ERROR:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { ok: false, reason: "migration_failed", error: message },
      { status: 500 },
    );
  }
}

export const GET = handle;
export const POST = handle;
