"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar } from "./Avatar";
import { useTelegram } from "./TelegramProvider";
import { api } from "@/lib/client-api";
import { bannerCss } from "@/lib/banners";
import { formatMmr, medalForMmr, roleById } from "@/lib/dota";
import { REPORT_REASONS } from "@/lib/report-reasons";
import type {
  LikeResponse,
  LookingNowResponse,
  PublicProfile,
  RecommendationsResponse,
  UserWithProfile,
} from "@/lib/types";

const ROLE_BANNER: Record<string, string> = {
  pos1: "from-red-600/90 via-rose-500/50 to-transparent",
  pos2: "from-violet-600/90 via-purple-500/50 to-transparent",
  pos3: "from-emerald-600/90 via-teal-500/50 to-transparent",
  pos4: "from-amber-500/90 via-yellow-500/50 to-transparent",
  pos5: "from-sky-600/90 via-cyan-500/50 to-transparent",
};

const SWIPE_THRESHOLD = 90;

function isInteractiveTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    Boolean(
      target.closest(
        "button, a, input, textarea, select, [role='button'], [data-no-swipe='true']",
      ),
    )
  );
}

/** Полноэкранная лента рекомендаций: можно и свайпать, и нажимать кнопки. */
export function RecommendationsView({ me }: { me: UserWithProfile }) {
  const { initData, openLink } = useTelegram();

  const [deck, setDeck] = useState<PublicProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const [leaving, setLeaving] = useState<"like" | "nope" | null>(null);
  const [busy, setBusy] = useState(false);
  const [match, setMatch] = useState<PublicProfile | null>(null);
  const [reportProfile, setReportProfile] = useState<PublicProfile | null>(null);
  const [reportBusy, setReportBusy] = useState(false);
  const [lookingNow, setLookingNowState] = useState(Boolean(me.isLookingNow));
  const [lookingNowBusy, setLookingNowBusy] = useState(false);

  const dragging = useRef(false);
  const start = useRef({ x: 0, y: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<RecommendationsResponse>(
        "/api/recommendations",
        initData,
      );
      setDeck(data.profiles);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить анкеты");
    } finally {
      setLoading(false);
    }
  }, [initData]);

  useEffect(() => {
    load();
  }, [load]);

  const visibleProfileTgId = deck[0]?.tgId ?? null;
  useEffect(() => {
    if (!visibleProfileTgId) return;
    void api<{ ok: boolean }>("/api/profile-view", initData, {
      method: "POST",
      body: { tgId: visibleProfileTgId },
    }).catch(() => undefined);
  }, [visibleProfileTgId, initData]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const status = await api<LookingNowResponse>("/api/looking-now", initData);
        if (!cancelled) setLookingNowState(status.active);
      } catch {
        // Статус не критичен для загрузки ленты.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initData]);

  const toggleLookingNow = async () => {
    if (lookingNowBusy) return;
    setLookingNowBusy(true);
    try {
      const status = await api<LookingNowResponse>("/api/looking-now", initData, {
        method: "POST",
        body: { enabled: !lookingNow },
      });
      setLookingNowState(status.active);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось изменить статус");
    } finally {
      setLookingNowBusy(false);
    }
  };

  const act = (dir: "like" | "nope") => {
    const card = deck[0];
    if (!card || leaving || busy) return;
    setBusy(true);
    setLeaving(dir);

    window.setTimeout(async () => {
      try {
        const res = await api<LikeResponse>("/api/like", initData, {
          method: "POST",
          body: { tgId: card.tgId, liked: dir === "like" },
        });
        if (dir === "like" && res.match && res.matchedProfile) {
          setMatch(res.matchedProfile);
        }
      } catch {
        // не критично — карточка уже ушла
      }
      setDeck((d) => d.slice(1));
      setDrag({ x: 0, y: 0 });
      setLeaving(null);
      setBusy(false);
    }, 300);
  };

  const openProfileChat = (profile: PublicProfile) => {
    openLink(
      profile.username
        ? `https://t.me/${profile.username}`
        : `tg://user?id=${profile.tgId}`,
    );
  };

  const submitReport = async (reason: string) => {
    if (!reportProfile || reportBusy) return;
    setReportBusy(true);
    try {
      await api<{ ok: boolean }>("/api/report", initData, {
        method: "POST",
        body: { reportedTgId: reportProfile.tgId, reason },
      });
      const reportedTgId = reportProfile.tgId;
      setReportProfile(null);
      setDeck((d) => d.filter((p) => p.tgId !== reportedTgId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отправить жалобу");
    } finally {
      setReportBusy(false);
    }
  };

  const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (leaving || busy || deck.length === 0 || isInteractiveTarget(e.target)) return;
    dragging.current = true;
    start.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (!dragging.current) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    setDrag({ x: dx, y: dy * 0.18 });
  };

  const finishPointer = () => {
    if (!dragging.current) return;
    dragging.current = false;
    if (drag.x > SWIPE_THRESHOLD) act("like");
    else if (drag.x < -SWIPE_THRESHOLD) act("nope");
    else setDrag({ x: 0, y: 0 });
  };

  const likeOpacity = drag.x > 0 ? Math.min(1, drag.x / 110) : 0;
  const nopeOpacity = drag.x < 0 ? Math.min(1, -drag.x / 110) : 0;

  return (
    <div className="px-4 pb-24 pt-12">
      <div className="fixed left-1/2 top-[10px] z-30 -translate-x-1/2">
        <button
          type="button"
          onClick={toggleLookingNow}
          disabled={lookingNowBusy}
          className="flex h-8 items-center justify-center whitespace-nowrap rounded-full border px-3 text-[11px] font-black shadow-md backdrop-blur-md transition-all active:scale-95 disabled:opacity-60"
          style={{
            background: lookingNow
              ? "rgba(16, 185, 129, 0.14)"
              : "color-mix(in srgb, var(--surface) 92%, transparent)",
            borderColor: lookingNow
              ? "rgba(52, 211, 153, 0.55)"
              : "var(--border)",
            color: lookingNow ? "#6ee7b7" : "var(--muted)",
          }}
        >
          {lookingNowBusy
            ? "Обновляем…"
            : lookingNow
              ? "🟢 Ищу пати сейчас · выключить"
              : "⚪ Ищу пати сейчас · на 2 часа"}
        </button>
      </div>

      <div className="relative mx-auto h-[48dvh] max-h-[460px] min-h-[320px] w-full max-w-md">
        {loading ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-[var(--muted)]">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-500 border-t-[var(--accent)]" />
            <p className="text-sm">Подбираем анкеты…</p>
          </div>
        ) : error ? (
          <div className="mx-auto mt-10 max-w-sm rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            ⚠️ {error}{" "}
            <button type="button" onClick={() => void load()} className="underline">
              Повторить
            </button>
          </div>
        ) : deck.length === 0 ? (
          <EmptyDeck onReload={load} />
        ) : (
          deck.slice(0, 3).map((p, i) => (
            <CardLayer
              key={p.id}
              profile={p}
              index={i}
              dragging={i === 0 && dragging.current}
              drag={i === 0 ? drag : { x: 0, y: 0 }}
              leaving={i === 0 ? leaving : null}
              likeOpacity={i === 0 ? likeOpacity : 0}
              nopeOpacity={i === 0 ? nopeOpacity : 0}
              onPointerDown={i === 0 ? onPointerDown : undefined}
              onPointerMove={i === 0 ? onPointerMove : undefined}
              onPointerUp={i === 0 ? finishPointer : undefined}
              onAct={i === 0 ? act : undefined}
              onReport={i === 0 ? () => setReportProfile(p) : undefined}
              onMessage={i === 0 && me.isVip ? () => openProfileChat(p) : undefined}
            />
          ))
        )}
      </div>

      {!loading && !error && deck.length > 0 && (
        <div className="mx-auto mt-4 flex max-w-md flex-col items-center gap-1.5">
          <span
            className="rounded-full border px-3 py-1 text-[11px] font-semibold"
            style={{ borderColor: "var(--border)", color: "var(--muted)" }}
          >
            Осталось анкет: {deck.length}
          </span>
          <p className="text-center text-xs" style={{ color: "var(--dim)" }}>
            Свайп вправо или ❤️ — лайк · влево или ✕ — мимо. Взаимный лайк = мэтч 💘
          </p>
        </div>
      )}

      {reportProfile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm"
          onClick={() => (reportBusy ? undefined : setReportProfile(null))}
        >
          <div
            className="pop-in w-full max-w-sm rounded-3xl border p-5 shadow-2xl"
            style={{ background: "var(--surface)", borderColor: "var(--border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-lg font-black" style={{ color: "var(--text)" }}>
              🚩 Пожаловаться на анкету
            </h2>
            <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
              Выбери причину. Жалоба попадёт в админ-панель.
            </p>
            <div className="mt-4 grid gap-2">
              {REPORT_REASONS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => void submitReport(r.id)}
                  disabled={reportBusy}
                  className="rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-60"
                  style={{
                    background: "var(--surface2)",
                    borderColor: "var(--border)",
                    color: "var(--text)",
                  }}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={reportBusy}
              onClick={() => setReportProfile(null)}
              className="mt-3 w-full rounded-xl border px-3 py-2.5 text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-60"
              style={{ borderColor: "var(--border)", color: "var(--muted)" }}
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {match && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm">
          <div
            className="pop-in w-full max-w-sm rounded-3xl border p-6 text-center shadow-2xl"
            style={{ background: "var(--surface)", borderColor: "var(--border)" }}
          >
            <div className="text-5xl">💘</div>
            <h2 className="font-display mt-3 text-2xl font-black" style={{ color: "var(--text)" }}>
              Это взаимно!
            </h2>
            <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
              Ты и {match.name ?? match.firstName} лайкнули друг друга — самое время найти тиммейта.
            </p>
            <div className="mt-5 flex items-center justify-center gap-4">
              <Avatar profile={me} size={64} />
              <span className="text-2xl">❤️</span>
              <Avatar profile={match} size={64} />
            </div>
            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => openProfileChat(match)}
                className="btn-cut rounded-xl bg-gradient-to-r from-red-500 to-orange-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-red-500/25 transition-transform active:scale-95"
              >
                💬 Написать в Telegram
              </button>
              <button
                type="button"
                onClick={() => setMatch(null)}
                className="rounded-xl border px-4 py-3 text-sm font-semibold transition-colors"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--surface2)",
                  color: "var(--text)",
                }}
              >
                Продолжить листать
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CardLayer({
  profile,
  index,
  dragging,
  drag,
  leaving,
  likeOpacity,
  nopeOpacity,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onAct,
  onReport,
  onMessage,
}: {
  profile: PublicProfile;
  index: number;
  dragging: boolean;
  drag: { x: number; y: number };
  leaving: "like" | "nope" | null;
  likeOpacity: number;
  nopeOpacity: number;
  onPointerDown?: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerMove?: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerUp?: () => void;
  onAct?: (dir: "like" | "nope") => void;
  onReport?: () => void;
  onMessage?: () => void;
}) {
  const role = roleById(profile.role);
  const medal = profile.mmr != null ? medalForMmr(profile.mmr) : null;
  const bannerImage =
    profile.banner && profile.banner.startsWith("data:") ? profile.banner : null;
  const bannerBg =
    profile.banner && !bannerImage
      ? (bannerCss(profile.banner) ?? ROLE_BANNER[profile.role ?? ""] ?? ROLE_BANNER.pos1)
      : ROLE_BANNER[profile.role ?? ""] ?? ROLE_BANNER.pos1;

  const translateX = leaving ? (leaving === "like" ? 640 : -640) : drag.x;
  const translateY = leaving ? 40 : drag.y;
  const rotate = leaving ? (leaving === "like" ? 24 : -24) : drag.x / 22;

  return (
    <article
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className="no-select absolute inset-0 flex flex-col overflow-hidden rounded-3xl border shadow-2xl"
      style={{
        background: "var(--surface)",
        borderColor: profile.isVip ? "rgba(250, 204, 21, 0.7)" : "var(--border)",
        boxShadow: profile.isVip
          ? "0 18px 45px rgba(250, 204, 21, 0.10), 0 20px 45px rgba(0,0,0,0.38)"
          : "0 20px 45px rgba(0,0,0,0.4)",
        zIndex: 10 - index,
        touchAction: "pan-y",
        transform: `translate(${translateX}px, ${translateY}px) rotate(${rotate}deg) ${
          index > 0 ? `scale(${1 - index * 0.04}) translateY(${index * 10}px)` : ""
        }`,
        transition: dragging ? "none" : "transform .3s cubic-bezier(.2,.8,.3,1)",
        filter: index > 0 ? "brightness(0.72)" : undefined,
        cursor: dragging ? "grabbing" : "grab",
      }}
    >
      <div className="relative h-[28%] min-h-[120px] shrink-0 overflow-hidden">
        {bannerImage ? (
          <img src={bannerImage} alt="" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
        ) : (
          <div className="absolute inset-0" style={{ background: bannerBg }} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent" />

        {(profile.isVip || profile.isLookingNow) && (
          <div className="absolute left-3 top-3 z-10 flex flex-col items-start gap-1.5">
            {profile.isVip && (
              <span className="rounded-full border border-yellow-300/50 bg-black/55 px-2.5 py-1 text-[10px] font-black tracking-[0.12em] text-yellow-300 backdrop-blur-md">
                VIP
              </span>
            )}
            {profile.isLookingNow && (
              <span className="rounded-full border border-emerald-300/45 bg-black/60 px-2.5 py-1 text-[10px] font-black text-emerald-300 backdrop-blur-md">
                🟢 Ищу пати сейчас
              </span>
            )}
          </div>
        )}

        {onReport && (
          <button
            type="button"
            data-no-swipe="true"
            onClick={(e) => {
              e.stopPropagation();
              onReport();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute right-3 top-3 z-10 rounded-full bg-red-600/90 px-3 py-1.5 text-[11px] font-black text-white shadow-lg shadow-red-600/30 backdrop-blur transition-transform active:scale-95"
          >
            🚩 Репорт
          </button>
        )}

        <div
          className="pointer-events-none absolute left-5 top-5 -rotate-12 rounded-lg border-[3px] border-emerald-400 px-3 py-1 text-xl font-black uppercase tracking-wider text-emerald-300"
          style={{ opacity: likeOpacity }}
        >
          Нравится
        </div>
        <div
          className="pointer-events-none absolute right-5 top-5 rotate-12 rounded-lg border-[3px] border-red-500 px-3 py-1 text-xl font-black uppercase tracking-wider text-red-400"
          style={{ opacity: nopeOpacity }}
        >
          Мимо
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto p-3.5">
        <div className="flex items-center gap-2.5">
          <Avatar profile={profile} size={38} />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="truncate text-lg font-extrabold leading-tight" style={{ color: "var(--text)" }}>
                {profile.name ?? profile.firstName}
                {profile.age != null && (
                  <span className="ml-2 text-sm font-semibold" style={{ color: "var(--muted)" }}>
                    {profile.age}
                  </span>
                )}
              </h2>
              {profile.isVip && (
                <span className="shrink-0 rounded-md bg-yellow-400/10 px-1.5 py-0.5 text-[9px] font-black text-yellow-400">
                  VIP
                </span>
              )}
            </div>
            {profile.username && (
              <p className="truncate text-[11px] font-medium" style={{ color: "var(--accent)" }}>
                @{profile.username}
              </p>
            )}
          </div>
        </div>

        {medal && (
          <div className="flex flex-wrap items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold" style={{ background: "var(--surface2)" }}>
            {role && (
              <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${role.badge}`}>
                {role.emoji} {role.label}
              </span>
            )}
            <span>🏅</span>
            <span style={{ color: "var(--text)" }}>{medal.name}</span>
            <span style={{ color: "var(--muted)" }}>· {formatMmr(profile.mmr)} ПТС</span>
          </div>
        )}

        {profile.description && (
          <p className="line-clamp-3 text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
            {profile.description}
          </p>
        )}

        {profile.feedbackTags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {profile.feedbackTags.map((tag) => (
              <span
                key={tag.id}
                className="rounded-full border px-2 py-0.5 text-[9px] font-semibold"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--surface2)",
                  color: "var(--muted)",
                }}
              >
                {tag.label} · {tag.count}×
              </span>
            ))}
          </div>
        )}

        {profile.profileLink && (
          <a
            href={profile.profileLink}
            target="_blank"
            rel="noopener noreferrer"
            data-no-swipe="true"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className="mt-auto block w-full break-all whitespace-normal pt-1.5 text-[11px] font-medium leading-relaxed hover:underline"
            style={{ color: "var(--accent)" }}
          >
            🔗 {profile.profileLink.replace(/^https?:\/\//, "")}
          </a>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-center gap-5 px-4 pb-3.5 pt-1.5" data-no-swipe="true">
        <ActionButton kind="nope" onClick={() => onAct?.("nope")} />
        {onMessage && (
          <button
            type="button"
            aria-label="Написать без мэтча"
            data-no-swipe="true"
            onClick={(e) => {
              e.stopPropagation();
              onMessage();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-yellow-300/35 bg-yellow-400/10 text-xl text-yellow-300 shadow-lg shadow-black/20 transition-transform active:scale-90"
          >
            ✉️
          </button>
        )}
        <ActionButton kind="like" onClick={() => onAct?.("like")} />
      </div>
    </article>
  );
}

function ActionButton({
  kind,
  onClick,
}: {
  kind: "like" | "nope";
  onClick?: () => void;
}) {
  const isLike = kind === "like";
  return (
    <button
      type="button"
      data-no-swipe="true"
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      aria-label={isLike ? "Лайк" : "Мимо"}
      className={`flex h-14 w-14 items-center justify-center rounded-full text-xl shadow-xl shadow-black/30 transition-transform active:scale-90 ${
        isLike
          ? "bg-gradient-to-br from-emerald-500 to-teal-600"
          : "border border-slate-300 bg-white text-slate-700"
      }`}
    >
      {isLike ? (
        <svg viewBox="0 0 24 24" fill="#ffffff" className="h-7 w-7 drop-shadow" aria-hidden>
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
      ) : (
        "✕"
      )}
    </button>
  );
}

function EmptyDeck({ onReload }: { onReload: () => void }) {
  const { initData } = useTelegram();
  const [resetting, setResetting] = useState(false);

  const reset = async () => {
    setResetting(true);
    try {
      await api<{ ok: boolean }>("/api/like", initData, { method: "DELETE" });
    } catch {
      // ignore
    }
    setResetting(false);
    onReload();
  };

  return (
    <div
      className="fade-up mx-auto flex h-full flex-col items-center justify-center gap-3 text-center"
      style={{ color: "var(--muted)" }}
    >
      <div className="text-6xl">🕸️</div>
      <p className="font-display text-lg font-bold" style={{ color: "var(--text)" }}>
        Анкеты закончились
      </p>
      <p className="max-w-xs text-sm">
        Ты посмотрел все доступные анкеты. Сбрось оценки — и лента наполнится заново.
      </p>
      <button
        type="button"
        onClick={reset}
        disabled={resetting}
        className="mt-2 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-red-500/25 transition-transform active:scale-95 disabled:opacity-60"
      >
        {resetting ? "Сбрасываем…" : "🔄 Показать заново"}
      </button>
    </div>
  );
}
