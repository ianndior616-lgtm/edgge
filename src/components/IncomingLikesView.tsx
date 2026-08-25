"use client";

import { useCallback, useEffect, useState } from "react";
import { Avatar } from "./Avatar";
import { ProfileCard } from "./ProfileCard";
import { useTelegram } from "./TelegramProvider";
import { api } from "@/lib/client-api";
import type {
  IncomingLikesResponse,
  LikeResponse,
  PublicProfile,
} from "@/lib/types";

/**
 * Отдельная вкладка с анкетами, которые уже поставили лайк текущему игроку.
 * Ответный лайк вызывает тот же защищённый endpoint, что и свайп в ленте,
 * поэтому мэтч создаётся одинаково в обоих сценариях.
 */
export function IncomingLikesView({
  onGoRecs,
  onGoChats,
}: {
  onGoRecs: () => void;
  onGoChats: () => void;
}) {
  const { initData } = useTelegram();
  const [profiles, setProfiles] = useState<PublicProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingTgId, setPendingTgId] = useState<number | null>(null);
  const [matchedProfile, setMatchedProfile] = useState<PublicProfile | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<IncomingLikesResponse>(
        "/api/likes/incoming",
        initData,
      );
      setProfiles(data.profiles);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Не удалось загрузить входящие лайки",
      );
    } finally {
      setLoading(false);
    }
  }, [initData]);

  useEffect(() => {
    void load();
  }, [load]);

  const likeBack = async (profile: PublicProfile) => {
    if (pendingTgId !== null) return;
    setPendingTgId(profile.tgId);
    try {
      const result = await api<LikeResponse>("/api/like", initData, {
        method: "POST",
        body: { tgId: profile.tgId, liked: true },
      });
      setProfiles((current) =>
        current.filter((item) => item.tgId !== profile.tgId),
      );
      setError(null);
      if (result.match) {
        setMatchedProfile(result.matchedProfile ?? profile);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Не удалось ответить взаимностью",
      );
    } finally {
      setPendingTgId(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md px-4 pb-28 pt-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1
            className="font-display fade-up text-xl font-extrabold"
            style={{ color: "var(--text)" }}
          >
            ❤️ Входящие лайки
          </h1>
          <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
            Эти игроки уже заинтересовались тобой. Поставь ответный лайк, чтобы
            открыть взаимный мэтч и перейти в Telegram.
          </p>
        </div>
        {!loading && profiles.length > 0 && (
          <span
            className="shrink-0 rounded-full border px-2.5 py-1 text-xs font-black"
            style={{
              borderColor: "color-mix(in srgb, var(--accent) 45%, var(--border))",
              background: "var(--accent-soft)",
              color: "var(--accent)",
            }}
          >
            {profiles.length}
          </span>
        )}
      </div>

      {loading ? (
        <div
          className="flex flex-col items-center gap-3 py-16"
          style={{ color: "var(--muted)" }}
        >
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-500 border-t-[var(--accent)]" />
          <p className="text-sm">Загружаем лайки…</p>
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          ⚠️ {error}{" "}
          <button type="button" onClick={() => void load()} className="font-semibold underline">
            Повторить
          </button>
        </div>
      ) : profiles.length === 0 ? (
        <div
          className="fade-up rounded-2xl border border-dashed px-6 py-14 text-center"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="text-5xl">💌</div>
          <p className="mt-3 text-lg font-bold" style={{ color: "var(--text)" }}>
            Новых лайков пока нет
          </p>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            Листай рекомендации — чем больше активности, тем выше шанс найти
            подходящего тиммейта.
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
          {profiles.map((profile) => {
            const pending = pendingTgId === profile.tgId;
            return (
              <ProfileCard
                key={profile.tgId}
                profile={profile}
                showContact={false}
                footer={
                  <button
                    type="button"
                    disabled={pendingTgId !== null}
                    onClick={() => void likeBack(profile)}
                    className="btn-cut flex-1 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-3 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {pending ? "Создаём мэтч…" : "💘 Ответить взаимностью"}
                  </button>
                }
              />
            );
          })}
        </div>
      )}

      {matchedProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm">
          <div
            className="pop-in w-full max-w-sm rounded-3xl border p-6 text-center shadow-2xl"
            style={{ background: "var(--surface)", borderColor: "var(--border)" }}
          >
            <div className="text-5xl">💘</div>
            <h2
              className="font-display mt-3 text-2xl font-black"
              style={{ color: "var(--text)" }}
            >
              Это взаимно!
            </h2>
            <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
              {matchedProfile.name ?? matchedProfile.firstName} уже лайкнул(а)
              тебя. Мэтч добавлен в «Чаты».
            </p>
            <div className="mt-4 flex justify-center">
              <Avatar profile={matchedProfile} size={64} />
            </div>
            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                onClick={onGoChats}
                className="btn-cut rounded-xl bg-gradient-to-r from-red-500 to-orange-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-red-500/25 transition-transform active:scale-95"
              >
                💬 Перейти в чаты
              </button>
              <button
                type="button"
                onClick={() => setMatchedProfile(null)}
                className="rounded-xl border px-4 py-3 text-sm font-semibold transition-colors"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--surface2)",
                  color: "var(--text)",
                }}
              >
                Продолжить смотреть лайки
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
