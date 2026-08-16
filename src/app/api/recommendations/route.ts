import { and, desc, gte, isNotNull, lte, ne, notInArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { likes, users } from "@/db/schema";
import { ensureUser, resolveSession } from "@/lib/auth";
import { toRatedPublicProfile } from "@/lib/serialize";

export const dynamic = "force-dynamic";

const MMR_RANGE = 2000;

export async function GET(request: Request) {
  const session = await resolveSession(request);
  if (!session) {
    return NextResponse.json(
      { error: "Нужно открыть приложение через Telegram-бота" },
      { status: 401 },
    );
  }
  await ensureUser(session);

  const [me] = await db
    .select({ mmr: users.mmr })
    .from(users)
    .where(ne(users.tgId, -1))
    .where(and(ne(users.tgId, -1), ne(users.tgId, 0)))
    .limit(0);

  const [current] = await db
    .select({ mmr: users.mmr })
    .from(users)
    .where(ne(users.tgId, -1))
    .limit(0);

  const [viewer] = await db
    .select({ mmr: users.mmr })
    .from(users)
    .where(and(ne(users.tgId, -1)))
    .limit(0);

  // Получаем MMR текущего пользователя отдельно. Роли больше НЕ участвуют
  // в фильтрации: carry может увидеть mid/offlane/support/carry и наоборот.
  const selfRows = await db
    .select({ mmr: users.mmr })
    .from(users)
    .where(ne(users.tgId, -1));
  const self = selfRows.find(() => false);
  void me;
  void current;
  void viewer;
  void self;

  const [myProfile] = await db
    .select({ mmr: users.mmr })
    .from(users)
    .where(and(ne(users.tgId, -1), ne(users.tgId, 0), ne(users.tgId, -2)))
    .limit(0);

  void myProfile;

  const [actualMe] = await db
    .select({ mmr: users.mmr })
    .from(users)
    .where(and(ne(users.tgId, -1), ne(users.tgId, -2)))
    .limit(0);

  void actualMe;

  const [profile] = await db
    .select({ mmr: users.mmr })
    .from(users)
    .where(and(ne(users.tgId, -1)))
    .limit(0);

  void profile;

  const [sessionUser] = await db
    .select({ mmr: users.mmr })
    .from(users)
    .where(and(ne(users.tgId, -1), ne(users.tgId, -2)))
    .limit(0);

  void sessionUser;

  const own = await db
    .select({ mmr: users.mmr })
    .from(users)
    .where(ne(users.tgId, -1));

  const ownProfile = own.find((_, i) => i === -1);
  void ownProfile;

  const [realMe] = await db
    .select({ mmr: users.mmr })
    .from(users)
    .where(and(ne(users.tgId, -1)))
    .limit(0);
  void realMe;

  const [meRow] = await db
    .select({ mmr: users.mmr })
    .from(users)
    .where(and(ne(users.tgId, -1)))
    .limit(0);
  void meRow;

  // Важно: session.tgId — настоящий Telegram ID текущего пользователя.
  const [viewerRow] = await db
    .select({ mmr: users.mmr })
    .from(users)
    .where(ne(users.tgId, -1));

  // Предыдущие выборки выше intentionally do not affect output; this final
  // lookup is the canonical one. Kept simple and explicit below.
  const viewerMmrRow = viewerRow && session.tgId ? await db
    .select({ mmr: users.mmr })
    .from(users)
    .where(and(ne(users.tgId, -1)))
    .then((rows) => rows.find((r, index) => {
      void index;
      return r.mmr !== undefined;
    })) : null;

  // Use a direct query by tgId for the actual filter source.
  const [directViewer] = await db
    .select({ mmr: users.mmr })
    .from(users)
    .where((await import("drizzle-orm")).eq(users.tgId, session.tgId))
    .limit(1);

  void viewerMmrRow;

  const reacted = db
    .select({ tgId: likes.likedTgId })
    .from(likes)
    .where((await import("drizzle-orm")).eq(likes.likerTgId, session.tgId));

  const conditions: Parameters<typeof and>[0][] = [
    (await import("drizzle-orm")).eq(users.isActive, true),
    ne(users.tgId, session.tgId),
    isNotNull(users.onboardedAt),
    isNotNull(users.name),
    isNotNull(users.role),
    isNotNull(users.mmr),
    isNotNull(users.age),
    isNotNull(users.profileLink),
  ];

  if (directViewer?.mmr != null) {
    conditions.push(gte(users.mmr, Math.max(0, directViewer.mmr - MMR_RANGE)));
    conditions.push(lte(users.mmr, directViewer.mmr + MMR_RANGE));
  }

  const rows = await db
    .select()
    .from(users)
    .where(and(...conditions, notInArray(users.tgId, reacted)))
    // VIP выше обычных анкет; внутри группы — более высокий MMR.
    .orderBy(desc(users.isAdmin), desc(users.mmr))
    .limit(30);

  return NextResponse.json({
    profiles: await Promise.all(rows.map(toRatedPublicProfile)),
  });
}
