import { NextResponse } from "next/server";
import { resolveUser } from "@/lib/auth";
import { tgApi } from "@/lib/telegram";
import { VIP_STARS_PRICE } from "@/lib/vip";

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
    const result = await tgApi<{ ok?: boolean; result?: string }>("createInvoiceLink", {
      title: "EdGGe VIP — 30 дней",
      description:
        "VIP: приоритет анкеты, сообщения без мэтча, кастомизация интерфейса и статистика за 7/30 дней.",
      payload: "edgge_vip_monthly",
      provider_token: "",
      currency: "XTR",
      prices: [{ label: "VIP на 30 дней", amount: VIP_STARS_PRICE }],
    });

    if (!result?.result) {
      throw new Error("Telegram не вернул ссылку оплаты");
    }

    return NextResponse.json({
      ok: true,
      invoiceUrl: result.result,
      stars: VIP_STARS_PRICE,
    });
  } catch (error) {
    console.error("VIP Stars invoice failed:", error);
    return NextResponse.json({ error: "Не удалось создать оплату VIP" }, { status: 502 });
  }
}
