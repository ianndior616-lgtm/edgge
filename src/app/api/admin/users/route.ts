import { and, desc, getTableColumns, ilike, or, sql, type SQL } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { resolveUser } from "@/lib/auth";
import { toAdminUserView } from "@/lib/serialize";

export const dynamic = "force-dynamic";

/**
 * Админ-панель: список всех зарегистрированных пользователей
 * с полной информацией. Поиск по имени, фамилии или @username.
 */
export async function GET(request: Request) {
  const admin = await resolveUser(request);
  if (!admin) {
    return NextResponse.json(
      { error: "Нужно открыть приложение через Telegram-бота" },
      { status: 401 },
    );
  }
  if (!admin.isAdmin) {
    return NextResponse.json(
      { error: "Только для администраторов" },
      { status: 403 },
    );
  }

  const qRaw = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  const q = qRaw.slice(0, 60);
  const conditions: SQL[] = [];
  if (q) {
    const escaped = q.replace(/[\\%_]/g, "\\$&");
    conditions.push(
      or(
        ilike(users.name, `%${escaped}%`) as SQL,
        ilike(users.firstName, `%${escaped}%`) as SQL,
        ilike(users.username, `%${escaped}%`) as SQL,
      ) as SQL,
    );
  }

  const rows = await db
    .select({
      ...getTableColumns(users),
      referralCount: sql<number>`(select count(*)::int from users r where r.referred_by_tg_id = ${users.tgId})`,
    })
    .from(users)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(users.createdAt))
    .limit(200);

  const list = await Promise.all(
    rows.map(async (row) => {
      const view = await toAdminUserView(row);
      return { ...view, referralCount: row.referralCount };
    }),
  );

  return NextResponse.json({ users: list });
}
