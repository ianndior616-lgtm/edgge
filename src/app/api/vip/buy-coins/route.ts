import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { rewardsLog, users } from "@/db/schema";
import { resolveUser } from "@/lib/auth";
import { nextVipUntil, VIP_COIN_PRICE, vipNote } from "@/lib/vip";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await resolveUser(request);
  if (!user) {
    return NextResponse.json(
      { error: "Нужно открыть приложение через Telegram" },
      { status: 401 },
    );
  }

  try {
    const until = await nextVipUntil(user.tgId);

    await db.transaction(async (tx) => {
      const [me] = await tx
        .select({ currency: users.currency, isAdmin: users.isAdmin })
        .from(users)
        .where(eq(users.tgId, user.tgId))
        .limit(1);

      if (!me) throw new Error("USER_NOT_FOUND");
      if (me.isAdmin) return;
      if (me.currency < VIP_COIN_PRICE) throw new Error("NOT_ENOUGH_COINS");

      await tx
        .update(users)
        .set({
          currency: sql`${users.currency} - ${VIP_COIN_PRICE}`,
          updatedAt: new Date(),
        })
        .where(eq(users.tgId, user.tgId));

      await tx.insert(rewardsLog).values({
        tgId: user.tgId,
        kind: "vip_purchase_coin",
        amount: -VIP_COIN_PRICE,
        note: vipNote(until, "method:coins"),
      });
    });

    const [updated] = await db
      .select({ currency: users.currency, isAdmin: users.isAdmin })
      .from(users)
      .where(eq(users.tgId, user.tgId))
      .limit(1);

    return NextResponse.json({
      ok: true,
      vip: true,
      vipUntil: until.toISOString(),
      currency: updated?.currency ?? 0,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_ENOUGH_COINS") {
      return NextResponse.json(
        { error: `Нужно ${VIP_COIN_PRICE} монет для VIP на месяц` },
        { status: 400 },
      );
    }
    console.error("VIP coin purchase failed:", error);
    return NextResponse.json({ error: "Не удалось купить VIP" }, { status: 500 });
  }
}
