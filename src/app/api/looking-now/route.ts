import { NextResponse } from "next/server";
import { resolveUser } from "@/lib/auth";
import { lookingNowUntilOf, setLookingNow } from "@/lib/looking-now";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await resolveUser(request);
  if (!user) {
    return NextResponse.json(
      { error: "Нужно открыть приложение через Telegram-бота" },
      { status: 401 },
    );
  }

  const until = await lookingNowUntilOf(user.tgId);

  return NextResponse.json({
    active: Boolean(until),
    until: until?.toISOString() ?? null,
  });
}

export async function POST(request: Request) {
  const user = await resolveUser(request);
  if (!user) {
    return NextResponse.json(
      { error: "Нужно открыть приложение через Telegram-бота" },
      { status: 401 },
    );
  }
  if (!user.onboardedAt) {
    return NextResponse.json(
      { error: "Сначала заполни анкету" },
      { status: 409 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as { enabled?: unknown };
  const enabled = body.enabled === true;
  const until = await setLookingNow(user.tgId, enabled);

  return NextResponse.json({
    active: Boolean(until),
    until: until?.toISOString() ?? null,
  });
}
