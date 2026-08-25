"use client";

import { useEffect, useState } from "react";
import { Avatar } from "./Avatar";
import { useTelegram } from "./TelegramProvider";
import { api } from "@/lib/client-api";
import { formatMmr, roleById } from "@/lib/dota";
import {
  FEEDBACK_TAGS,
  type FeedbackTagId,
} from "@/lib/feedback-tags";
import type { MatchesResponse, MatchItem, RatingResponse } from "@/lib/types";

/** Вкладка «Чаты»: совпадения — игроки, ответившие взаимностью */
export function ChatsView({ onGoRecs }: { onGoRecs: () => void }) {
  const { initData, openLink } = useTelegram();
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [ratingsByTg, setRatingsByTg] = useState<Record<number, number>>({});
  const [feedbackByTg, setFeedbackByTg] = useState<Record<number, FeedbackTagId[]>>({});
  const [ratingBusyTgId, setRatingBusyTgId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api<MatchesResponse>("/api/matches", initData);
      setMatches(data.matches);
      setRatingsByTg(
        Object.fromEntries(
          data.matches
            .filter((m) => m.myRating != null)
            .map((m) => [m.profile.tgId, m.myRating as number]),
        ),
      );
      setFeedbackByTg(
        Object.fromEntries(
          data.matches.map((m) => [m.profile.tgId, m.myFeedbackTags ?? []]),
        ),
      );
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить чаты");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initData]);

  const remove = async (tgId: number) => {
    if (confirmId !== tgId) {
      setConfirmId(tgId);
      window.setTimeout(
        () => setConfirmId((c) => (c === tgId ? null : c)),
        3000,
      );
      return;
    }
    setConfirmId(null);
    try {
      await api<{ ok: boolean }>(`/api/matches?tgId=${tgId}`, initData, {
        method: "DELETE",
      });
      setMatches((prev) => prev.filter((m) => m.profile.tgId !== tgId));
    } catch {
      // ignore
    }
  };

  const toggleFeedbackTag = (tgId: number, tag: FeedbackTagId) => {
    if (ratingsByTg[tgId] || ratingBusyTgId === tgId) return;

    setFeedbackByTg((prev) => {
      const current = prev[tgId] ?? [];
      if (current.includes(tag)) {
        return { ...prev, [tgId]: current.filter((id) => id !== tag) };
      }
      if (current.length >= 2) return prev;
      return { ...prev, [tgId]: [...current, tag] };
    });
  };

  const rate = async (tgId: number, stars: number) => {
    if (ratingsByTg[tgId] || ratingBusyTgId === tgId) return;
    setRatingBusyTgId(tgId);
    try {
      const res = await api<RatingResponse>("/api/rating", initData, {
        method: "POST",
        body: {
          tgId,
          stars,
          tags: feedbackByTg[tgId] ?? [],
        },
      });
      setRatingsByTg((prev) => ({
        ...prev,
        [tgId]: res.myRating ?? stars,
      }));
      setFeedbackByTg((prev) => ({
        ...prev,
        [tgId]: res.myFeedbackTags ?? prev[tgId] ?? [],
      }));
      setError(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось поставить оценку");
    } finally {
      setRatingBusyTgId(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md px-4 pb-28 pt-5">
      <h1
        className="font-display fade-up mb-4 text-xl font-extrabold"
        style={{ color: "var(--text)" }}
      >
        💬 Чаты
      </h1>

      {loading ? (
        <div className="flex flex-col items-center gap-3 py-16" style={{ color: "var(--muted)" }}>
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-500 border-t-[var(--accent)]" />
          <p className="text-sm">Загружаем совпадения…</p>
        </div>
      ) : error ? (
        <div className="mb-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          ⚠️ {error}
        </div>
      ) : null}

      {!loading && matches.length === 0 ? (
        <div
          className="fade-up rounded-2xl border border-dashed px-6 py-14 text-center"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="text-5xl">💘</div>
          <p className="mt-3 text-lg font-bold" style={{ color: "var(--text)" }}>
            Пока пусто
          </p>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            Здесь появятся игроки, с которыми у вас взаимный лайк.
          </p>
          <button
            type="button"
            onClick={onGoRecs}
            className="mt-4 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-red-500/25 transition-transform active:scale-95"
          >
            🔥 Смотреть анкеты
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {matches.map((m) => {
            const p = m.profile;
            const role = roleById(p.role);
            const fixedRating = ratingsByTg[p.tgId] ?? m.myRating ?? 0;
            const ratingLocked = fixedRating > 0;
            const ratingBusy = ratingBusyTgId === p.tgId;
            const selectedTags = feedbackByTg[p.tgId] ?? m.myFeedbackTags ?? [];

            return (
              <div
                key={p.id}
                className="fade-up rounded-2xl border p-4 shadow-xl"
                style={{
                  background: "var(--surface)",
                  borderColor: "var(--border)",
                }}
              >
                <div className="flex items-start gap-3">
                  <Avatar profile={p} size={48} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[15px] font-bold" style={{ color: "var(--text)" }}>
                        {p.name ?? p.firstName}
                      </span>
                      {role && (
                        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${role.badge}`}>
                          {role.emoji} {role.label}
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-medium" style={{ color: "var(--accent)" }}>
                      {p.username ? `@${p.username}` : "@username недоступен"}
                    </p>
                    <p className="mt-0.5 text-xs" style={{ color: "var(--muted)" }}>
                      🏅 {formatMmr(p.mmr)} ПТС
                      {p.age != null ? ` · ${p.age}` : ""}
                      {m.matchedAt
                        ? ` · 💘 ${new Date(m.matchedAt).toLocaleDateString("ru-RU", {
                            day: "numeric",
                            month: "short",
                          })}`
                        : ""}
                    </p>
                    {p.averageRating != null && (
                      <p className="mt-1 text-xs" style={{ color: "#facc15" }}>
                        ★ {p.averageRating.toFixed(1)} · {p.ratingsCount} оценок
                      </p>
                    )}
                  </div>
                </div>

                {p.feedbackTags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {p.feedbackTags.map((tag) => (
                      <span
                        key={tag.id}
                        className="rounded-full border px-2 py-1 text-[10px] font-semibold"
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

                <div
                  className="mt-3 rounded-xl border px-3 py-3"
                  style={{ borderColor: "var(--border)", background: "var(--surface2)" }}
                >
                  <p className="text-[11px] font-semibold" style={{ color: "var(--muted)" }}>
                    {ratingLocked
                      ? "Твоя оценка и характеристики сохранены навсегда"
                      : "Выбери до 2 характеристик и поставь оценку — изменить потом нельзя"}
                  </p>

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {FEEDBACK_TAGS.map((tag) => {
                      const selected = selectedTags.includes(tag.id);
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          disabled={ratingLocked || ratingBusy}
                          onClick={() => toggleFeedbackTag(p.tgId, tag.id)}
                          className="rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-all disabled:cursor-default disabled:opacity-100"
                          style={{
                            borderColor: selected
                              ? "color-mix(in srgb, var(--accent) 65%, var(--border))"
                              : "var(--border)",
                            background: selected
                              ? "var(--accent-soft)"
                              : "var(--surface)",
                            color: selected ? "var(--accent)" : "var(--muted)",
                          }}
                        >
                          {selected ? "✓ " : ""}{tag.label}
                        </button>
                      );
                    })}
                  </div>

                  {!ratingLocked && (
                    <p className="mt-2 text-[10px]" style={{ color: "var(--dim)" }}>
                      Выбрано: {selectedTags.length}/2
                    </p>
                  )}

                  <div className="mt-2 flex items-center gap-1.5">
                    {[1, 2, 3, 4, 5].map((s) => {
                      const selected = fixedRating >= s;
                      return (
                        <button
                          key={s}
                          type="button"
                          disabled={ratingLocked || ratingBusy}
                          onClick={() => void rate(p.tgId, s)}
                          className="text-xl transition-transform active:scale-90 disabled:cursor-default disabled:opacity-100"
                          aria-label={`Оценить на ${s}`}
                          style={{ color: selected ? "#facc15" : "var(--dim)" }}
                        >
                          ★
                        </button>
                      );
                    })}
                    {ratingLocked && (
                      <span className="ml-1 text-[11px]" style={{ color: "var(--muted)" }}>
                        {fixedRating}/5 🔒
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    disabled={!p.username}
                    onClick={() => {
                      if (p.username) openLink(`https://t.me/${p.username}`);
                    }}
                    className="flex-1 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 px-3 py-2.5 text-sm font-bold text-white shadow-lg shadow-red-500/20 transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {p.username ? "💬 Написать" : "@username недоступен"}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(p.tgId)}
                    className="rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors"
                    style={{
                      borderColor: confirmId === p.tgId ? "#ef4444" : "var(--border)",
                      background: "var(--surface2)",
                      color: confirmId === p.tgId ? "#ef4444" : "var(--muted)",
                    }}
                  >
                    {confirmId === p.tgId ? "Точно?" : "✕"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
