import { NextResponse } from "next/server";
import { ensureUser, resolveSession } from "@/lib/auth";
import { lookingNowUntilOf, setLookingNow } from "@/lib/looking-now";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await resolveSession(request);
  if (!session) {
    return NextResponse.json(
      { error: "Нужно открыть приложение через Telegram-бота" },
      { status: 401 },
    );
  }

  await ensureUser(session);
  const until = await lookingNowUntilOf(session.tgId);

  return NextResponse.json({
    active: Boolean(until),
    until: until?.toISOString() ?? null,
  });
}

export async function POST(request: Request) {
  const session = await resolveSession(request);
  if (!session) {
    return NextResponse.json(
      { error: "Нужно открыть приложение через Telegram-бота" },
      { status: 401 },
    );
  }

  const user = await ensureUser(session);
  if (!user.onboardedAt) {
    return NextResponse.json(
      { error: "Сначала заполни анкету" },
      { status: 409 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as { enabled?: unknown };
  const enabled = body.enabled === true;
  const until = await setLookingNow(session.tgId, enabled);

  return NextResponse.json({
    active: Boolean(until),
    until: until?.toISOString() ?? null,
  });
}
