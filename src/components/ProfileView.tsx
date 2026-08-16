"use client";

import { useState, type ReactNode } from "react";
import { BannerPicker } from "./BannerPicker";
import { CoinIcon } from "./CoinIcon";
import { OnboardingForm } from "./OnboardingForm";
import { ProfileCard } from "./ProfileCard";
import { useTelegram } from "./TelegramProvider";
import { api } from "@/lib/client-api";
import { roleById } from "@/lib/dota";
import {
  DAILY_REWARDS,
  REFERRAL_CODE_RE,
  REFERRAL_MILESTONES,
  localDayString,
  rewardForStreak,
} from "@/lib/wallet-constants";
import type { CheckinResponse, UserWithProfile } from "@/lib/types";

const CARD_STYLE = {
  background: "var(--surface)",
  borderColor: "var(--border)",
} as const;

/** Вкладка «Профиль»: анкета + кошелёк, ежедневная награда, рефералы */
export function ProfileView({
  me,
  onSaved,
  onToast,
}: {
  me: UserWithProfile;
  onSaved: (user: UserWithProfile) => void;
  onToast: (msg: ReactNode) => void;
}) {
  const { initData } = useTelegram();
  const [editing, setEditing] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [banner, setBanner] = useState<string | null>(me.banner ?? null);
  const [bannerSaving, setBannerSaving] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [friendCode, setFriendCode] = useState("");
  const [binding, setBinding] = useState(false);

  // Нормализация защищает профиль от падений, если после старого деплоя
  // или частичного API-ответа какое-то поле внезапно пришло undefined.
  const safeLookingFor = Array.isArray(me.lookingFor) ? me.lookingFor : [];
  const currency = Number.isFinite(me.currency) ? me.currency : 0;
  const streakDays = Number.isFinite(me.streakDays) ? me.streakDays : 0;
  const referralCount = Number.isFinite(me.referralCount) ? me.referralCount : 0;
  const qualifiedReferralCount = Number.isFinite(me.qualifiedReferralCount)
    ? me.qualifiedReferralCount
    : 0;
  const today = localDayString();
  const claimedToday = me.lastClaimDay === today;
  const nextReward = rewardForStreak(streakDays + 1);

  /* ---------- Ежедневная награда ---------- */
  const handleClaim = async () => {
    if (claiming) return;
    setClaiming(true);
    try {
      const res = await api<CheckinResponse>("/api/checkin", initData, {
        method: "POST",
        body: { day: today },
      });
      if (res.alreadyClaimed) {
        onToast("Сегодняшняя награда уже получена 🎁");
      } else {
        onSaved({
          ...me,
          currency: res.currency,
          streakDays: res.streakDays,
          lastClaimDay: today,
          crownUnlocked: res.crownUnlocked,
        });
        onToast(
          res.crownJustUnlocked ? (
            <span className="inline-flex items-center gap-1">
              👑 Королевский аватар открыт! +{res.reward}{" "}
              <CoinIcon size={14} />
            </span>
          ) : (
            <span className="inline-flex items-center gap-1">
              🎁 +{res.reward} <CoinIcon size={14} /> — день{" "}
              {res.streakDays} подряд
            </span>
          ),
        );
      }
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Не удалось получить награду");
    } finally {
      setClaiming(false);
    }
  };

  /* ---------- Видимость анкеты ---------- */
  const handleToggleActive = async () => {
    if (toggling) return;
    setToggling(true);
    const next = !me.isActive;
    try {
      await api<{ user?: { isActive?: boolean } }>("/api/profile", initData, {
        method: "PUT",
        body: { isActive: next },
      });
      onSaved({ ...me, isActive: next });
      onToast(
        next
          ? "Анкета снова видна в рекомендациях 👀"
          : "Анкета скрыта из рекомендаций 🙈",
      );
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Не удалось обновить");
    } finally {
      setToggling(false);
    }
  };

  /* ---------- Картинка карточки ---------- */
  const saveBanner = async () => {
    if (bannerSaving) return;
    setBannerSaving(true);
    try {
      const user = await api<UserWithProfile>("/api/profile", initData, {
        method: "PUT",
        body: { banner },
      });
      onSaved(user);
      onToast("Картинка карточки сохранена 🎴");
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Не удалось сохранить");
    } finally {
      setBannerSaving(false);
    }
  };

  /* ---------- Рефералы ---------- */
  const copyCode = async () => {
    if (!me.referralCode) return;
    try {
      await navigator.clipboard.writeText(me.referralCode);
      onToast("Код скопирован 📋");
    } catch {
      onToast(`Твой код: ${me.referralCode}`);
    }
  };

  const bindFriendCode = async () => {
    const code = friendCode.trim().toUpperCase();
    if (!REFERRAL_CODE_RE.test(code)) {
      onToast("Формат кода: VV-XXXXXX");
      return;
    }
    setBinding(true);
    try {
      const user = await api<UserWithProfile>("/api/profile", initData, {
        method: "PUT",
        body: { referralCode: code },
      });
      onSaved(user);
      setFriendCode("");
      onToast("🎟️ Код друга применён! Теперь он получает 10% от твоих наград");
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Не удалось привязать код");
    } finally {
      setBinding(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md px-4 pb-28 pt-5">
      <h1
        className="font-display fade-up mb-4 text-xl font-extrabold"
        style={{ color: "var(--text)" }}
      >
        👤 Мой профиль
      </h1>

      {editing ? (
        <div
          className="fade-up rounded-2xl border p-4 shadow-xl"
          style={CARD_STYLE}
        >
          <h2 className="mb-4 text-lg font-bold" style={{ color: "var(--text)" }}>
            ✏️ Редактировать анкету
          </h2>
          <OnboardingForm
            initial={me}
            firstName={me.firstName}
            onSaved={(user) => {
              onSaved(user);
              setEditing(false);
              onToast("Анкета сохранена 🎉");
            }}
            onCancel={() => setEditing(false)}
            onNotice={onToast}
          />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Кошелёк */}
          <div
            className="fade-up rounded-2xl border p-4 shadow-xl"
            style={CARD_STYLE}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
                  Баланс
                </p>
                <p className="flex items-center gap-1.5 text-2xl font-black" style={{ color: "var(--text)" }}>
                  <CoinIcon size={22} /> {currency}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
                  Стрик входов
                </p>
                <p className="text-2xl font-black" style={{ color: "var(--text)" }}>
                  🔥 {streakDays} дн.
                </p>
              </div>
            </div>
            {me.crownUnlocked && (
              <div
                className="mt-3 flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold"
                style={{
                  background: "rgba(250, 204, 21, 0.12)",
                  border: "1px solid rgba(250, 204, 21, 0.4)",
                  color: "#eab308",
                }}
              >
                👑 Королевский аватар разблокирован — красуется на твоей аватарке!
              </div>
            )}
          </div>

          {/* Ежедневная награда */}
          <div
            className="fade-up rounded-2xl border p-4 shadow-xl"
            style={CARD_STYLE}
          >
            <p className="text-sm font-bold" style={{ color: "var(--text)" }}>
              🎁 Ежедневная награда
            </p>
            <p className="mt-0.5 text-[11px]" style={{ color: "var(--dim)", opacity: 0.85 }}>
              Заходи каждый день — награда растёт. Пропустишь день — серия сбросится.
            </p>

            {/* 7 дней */}
            <div className="mt-3 grid grid-cols-7 gap-1.5">
              {DAILY_REWARDS.map((r, i) => {
                const day = i + 1;
                const done = streakDays >= day;
                const isToday = !claimedToday && streakDays + 1 === day;
                return (
                  <div key={day} className="flex flex-col items-center gap-1">
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-black"
                      style={{
                        background: done
                          ? "linear-gradient(135deg, var(--accent), var(--accent-2))"
                          : "var(--surface2)",
                        color: done ? "#fff" : "var(--dim)",
                        border: isToday
                          ? "2px solid var(--accent)"
                          : "1px solid var(--border)",
                        boxShadow: isToday
                          ? "0 0 10px color-mix(in srgb, var(--accent) 40%, transparent)"
                          : undefined,
                      }}
                    >
                      {day === 7 ? "👑" : day}
                    </div>
                    <span
                      className="flex items-center justify-center gap-0.5 text-[9px] font-semibold"
                      style={{ color: done ? "var(--text)" : "var(--dim)" }}
                    >
                      {r} <CoinIcon size={8} />
                    </span>
                  </div>
                );
              })}
            </div>

            {claimedToday ? (
              <div
                className="mt-3 rounded-xl px-3 py-2.5 text-center text-sm font-bold"
                style={{ background: "var(--surface2)", color: "var(--muted)" }}
              >
                ✓ Сегодняшняя награда получена
              </div>
            ) : (
              <button
                type="button"
                onClick={handleClaim}
                disabled={claiming}
                className="btn-cut mt-3 w-full rounded-xl bg-gradient-to-r from-red-500 to-orange-500 px-4 py-3 text-sm font-black text-white shadow-lg shadow-red-500/25 transition-transform active:scale-[0.98] disabled:opacity-60"
              >
                {claiming ? (
                  "Получаем…"
                ) : (
                  <span className="inline-flex items-center gap-1.5">
                    🎁 Забрать +{nextReward} <CoinIcon size={16} /> (день{" "}
                    {streakDays + 1})
                  </span>
                )}
              </button>
            )}
          </div>

          {/* Анкета */}
          <ProfileCard
            profile={me}
            showContact={false}
            footer={
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="flex-1 rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition-colors"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--surface2)",
                  color: "var(--text)",
                }}
              >
                ✏️ Изменить анкету
              </button>
            }
          />

          {/* Картинка карточки */}
          <div
            className="rounded-2xl border p-4 shadow-xl"
            style={CARD_STYLE}
          >
            <p className="mb-1 text-sm font-bold" style={{ color: "var(--text)" }}>
              🎴 Картинка карточки
            </p>
            <p className="mb-3 text-[11px]" style={{ color: "var(--dim)", opacity: 0.85 }}>
              Так выглядит верх твоей карточки в рекомендациях: своя картинка
              или готовый градиент.
            </p>
            <BannerPicker value={banner} onChange={setBanner} />
            <button
              type="button"
              onClick={saveBanner}
              disabled={bannerSaving}
              className="btn-cut mt-3 w-full rounded-xl bg-gradient-to-r from-red-500 to-orange-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-red-500/25 transition-transform active:scale-[0.98] disabled:opacity-60"
            >
              {bannerSaving ? "Сохраняем…" : "💾 Сохранить картинку"}
            </button>
          </div>

          {/* Кого ищу */}
          {safeLookingFor.length > 0 && (
            <div
              className="rounded-2xl border p-4 shadow-xl"
              style={CARD_STYLE}
            >
              <p className="mb-2 text-sm font-bold" style={{ color: "var(--text)" }}>
                🔎 Кого ты ищешь в тиммейты
              </p>
              <div className="flex flex-wrap gap-1.5">
                {safeLookingFor.map((id) => {
                  const r = roleById(id);
                  if (!r) return null;
                  return (
                    <span
                      key={id}
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${r.badge}`}
                    >
                      {r.emoji} {r.label}
                    </span>
                  );
                })}
              </div>
              <p className="mt-2 text-[11px]" style={{ color: "var(--dim)", opacity: 0.85 }}>
                🔒 Это видят только в твоей анкете — в рекомендациях других
                игроков этот блок скрыт.
              </p>
            </div>
          )}

          {/* Рефералы */}
          <div
            className="rounded-2xl border p-4 shadow-xl"
            style={CARD_STYLE}
          >
            <p className="text-sm font-bold" style={{ color: "var(--text)" }}>
              🎟️ Рефералы
            </p>

            {/* Свой код */}
            <div className="mt-3 flex items-center gap-2">
              <div
                className="flex-1 rounded-xl px-3 py-2.5 text-center font-mono text-lg font-black tracking-widest"
                style={{ background: "var(--surface2)", color: "var(--text)" }}
              >
                {me.referralCode ?? "—"}
              </div>
              <button
                type="button"
                onClick={copyCode}
                className="rounded-xl border px-3 py-2.5 text-xs font-bold transition-opacity hover:opacity-80"
                style={{ borderColor: "var(--border)", background: "var(--surface2)", color: "var(--text)" }}
              >
                📋 Копировать
              </button>
            </div>
            <p className="mt-1.5 text-[11px]" style={{ color: "var(--dim)", opacity: 0.85 }}>
              Поделись кодом с другом — получай 10% от каждой его награды.
            </p>

            {/* Счётчик */}
            <div className="mt-3">
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
                  Привёл рефералов
                </span>
                <span className="text-lg font-black" style={{ color: "var(--accent)" }}>
                  {referralCount}
                </span>
              </div>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full" style={{ background: "var(--surface2)" }}>
                <div
                  className="h-full rounded-full bg-gradient-to-r from-red-500 to-orange-500 transition-all"
                  style={{ width: `${Math.min(100, (qualifiedReferralCount / 50) * 100)}%` }}
                />
              </div>
              <p className="mt-1 text-[10px]" style={{ color: "var(--dim)" }}>
                Для арканы нужны 50 активных рефералов со стриком 7+ дней: {qualifiedReferralCount}/50
              </p>

              {/* Вехи */}
              <div className="mt-3 grid grid-cols-4 gap-1.5">
                {REFERRAL_MILESTONES.map((m) => {
                  const reached = m.arcana
                    ? qualifiedReferralCount >= m.count
                    : referralCount >= m.count;
                  return (
                    <div
                      key={m.count}
                      className="rounded-xl px-2 py-2 text-center"
                      style={{
                        background: reached
                          ? "var(--accent-soft)"
                          : "var(--surface2)",
                        border: `1px solid ${reached ? "color-mix(in srgb, var(--accent) 40%, transparent)" : "var(--border)"}`,
                      }}
                    >
                      <p className="text-[10px] font-black" style={{ color: reached ? "var(--accent)" : "var(--dim)" }}>
                        {m.count} 🧑‍🤝‍🧑
                      </p>
                      <p
                        className="mt-0.5 flex items-center justify-center gap-0.5 text-[10px] font-semibold"
                        style={{ color: "var(--text)" }}
                      >
                        {m.arcana ? (
                          m.label
                        ) : (
                          <>
                            {m.bonus} <CoinIcon size={9} />
                          </>
                        )}
                      </p>
                      {reached && m.arcana && (
                        <p className="mt-0.5 text-[9px]" style={{ color: "var(--dim)" }}>
                          выдаст админ
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Ввод кода друга */}
            {me.referredByTgId == null && (
              <div className="mt-3 flex gap-2">
                <input
                  className="input flex-1 uppercase"
                  placeholder="Код друга: VV-XXXXXX"
                  value={friendCode}
                  maxLength={9}
                  onChange={(e) => setFriendCode(e.target.value)}
                />
                <button
                  type="button"
                  onClick={bindFriendCode}
                  disabled={binding}
                  className="rounded-xl border px-3 py-2 text-xs font-bold transition-opacity hover:opacity-80 disabled:opacity-60"
                  style={{ borderColor: "var(--border)", background: "var(--surface2)", color: "var(--text)" }}
                >
                  {binding ? "…" : "Привязать"}
                </button>
              </div>
            )}
          </div>

          {/* Видимость */}
          <button
            type="button"
            onClick={handleToggleActive}
            disabled={toggling}
            className="flex w-full items-center justify-between rounded-2xl border px-4 py-3.5 text-sm shadow-xl transition-opacity disabled:opacity-60"
            style={CARD_STYLE}
          >
            <span style={{ color: "var(--text)" }}>
              {me.isActive
                ? "Анкета видна в рекомендациях"
                : "Анкета скрыта из рекомендаций"}
            </span>
            <span
              className="relative h-6 w-11 rounded-full transition-colors"
              style={{
                background: me.isActive ? "var(--accent)" : "var(--surface2)",
                border: "1px solid var(--border)",
              }}
            >
              <span
                className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all"
                style={{ left: me.isActive ? 22 : 2 }}
              />
            </span>
          </button>

          <div
            className="rounded-2xl border p-4 text-xs leading-relaxed"
            style={{ borderColor: "var(--border)", color: "var(--muted)" }}
          >
            💡 Твою анкету видят другие игроки в рекомендациях. Лайкай чужие
            анкеты — при взаимности вы попадёте друг к другу в «Чаты».
          </div>
        </div>
      )}
    </div>
  );
}
