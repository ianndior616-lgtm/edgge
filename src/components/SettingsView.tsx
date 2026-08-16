"use client";

import { useState } from "react";
import { useTelegram } from "./TelegramProvider";
import { api } from "@/lib/client-api";
import { THEMES } from "@/lib/theme";
import type { ThemeId } from "@/lib/types";
import type { CustomTheme } from "@/lib/useTheme";

const CUSTOM_FIELDS: Array<{
  key: keyof CustomTheme;
  label: string;
  hint: string;
}> = [
  { key: "bg", label: "Фон приложения", hint: "Главный фон EdGGe" },
  { key: "surface", label: "Карточки", hint: "Профили, панели и окна" },
  { key: "surface2", label: "Вторичные блоки", hint: "Поля и внутренние панели" },
  { key: "text", label: "Основной текст", hint: "Заголовки и важный текст" },
  { key: "accent", label: "Кнопки / акцент", hint: "Основной цвет действий" },
  { key: "accent2", label: "Второй цвет кнопок", hint: "Градиент и подсветка" },
];

export function SettingsView({
  theme,
  onChangeTheme,
  isDemo,
  onToast,
  fullCustomUnlocked,
  customTheme,
  defaultCustomTheme,
  onChangeCustomTheme,
  onResetCustomTheme,
}: {
  theme: ThemeId;
  onChangeTheme: (theme: ThemeId) => void;
  isDemo: boolean;
  onToast: (msg: string) => void;
  fullCustomUnlocked: boolean;
  customTheme: CustomTheme | null;
  defaultCustomTheme: CustomTheme;
  onChangeCustomTheme: (theme: CustomTheme) => void;
  onResetCustomTheme: () => void;
}) {
  const { initData, openLink } = useTelegram();
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [buying, setBuying] = useState<"coins" | "stars" | null>(null);

  const handleReset = async () => {
    if (!confirmReset) {
      setConfirmReset(true);
      window.setTimeout(() => setConfirmReset(false), 3000);
      return;
    }
    setConfirmReset(false);
    setResetting(true);
    try {
      await api<{ ok: boolean }>("/api/like", initData, { method: "DELETE" });
      onToast("Оценки сброшены — лента обновится 🔄");
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Не удалось сбросить");
    } finally {
      setResetting(false);
    }
  };

  const buyWithCoins = async () => {
    setBuying("coins");
    try {
      await api<{ ok: boolean; vipUntil: string }>("/api/vip/buy-coins", initData, {
        method: "POST",
        body: {},
      });
      onToast("👑 VIP активирован на 30 дней");
      window.setTimeout(() => window.location.reload(), 700);
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Не удалось купить VIP");
    } finally {
      setBuying(null);
    }
  };

  const buyWithStars = async () => {
    setBuying("stars");
    try {
      const res = await api<{ ok: boolean; invoiceUrl: string; stars: number }>(
        "/api/vip/buy-stars",
        initData,
        { method: "POST", body: {} },
      );
      openLink(res.invoiceUrl);
      onToast(`Открыта оплата VIP за ${res.stars} ⭐`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Не удалось открыть оплату");
    } finally {
      setBuying(null);
    }
  };

  const effectiveCustom = customTheme ?? defaultCustomTheme;

  return (
    <div className="mx-auto w-full max-w-md px-4 pb-28 pt-5">
      <h1
        className="font-display fade-up mb-4 text-xl font-extrabold"
        style={{ color: "var(--text)" }}
      >
        Настройки
      </h1>

      <section
        className="fade-up rounded-2xl border p-4 shadow-xl"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <h2 className="mb-3 text-sm font-bold" style={{ color: "var(--text)" }}>
          🎨 Тема оформления
        </h2>
        <div className="space-y-2.5">
          {THEMES.map((t) => {
            const active = theme === t.id && !customTheme;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onChangeTheme(t.id)}
                className="flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all"
                style={{
                  borderColor: active ? "var(--accent)" : "var(--border)",
                  background: active ? "var(--surface2)" : "transparent",
                }}
              >
                <span className="h-10 w-10 shrink-0 rounded-lg shadow-inner" style={{ background: t.swatch }} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold" style={{ color: "var(--text)" }}>{t.label}</span>
                  <span className="block text-xs" style={{ color: "var(--muted)" }}>{t.desc}</span>
                </span>
                {active && <span className="text-lg font-black" style={{ color: "var(--accent)" }}>✓</span>}
              </button>
            );
          })}
        </div>
      </section>

      <section
        className="fade-up mt-4 rounded-2xl border p-4 shadow-xl"
        style={{
          background: "var(--surface)",
          borderColor: "rgba(250, 204, 21, 0.45)",
          boxShadow: "0 10px 32px rgba(250, 204, 21, 0.08)",
        }}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-black text-yellow-400">👑 VIP</h2>
            <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
              Приоритет анкеты в рекомендациях, сообщения без мэтча и полный кастом интерфейса.
            </p>
          </div>
          <span className="rounded-full border border-yellow-400/40 bg-yellow-400/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-yellow-400">
            {fullCustomUnlocked ? "ACTIVE" : "30 DAYS"}
          </span>
        </div>

        {!fullCustomUnlocked && (
          <div className="grid gap-2">
            <button
              type="button"
              disabled={buying !== null}
              onClick={() => void buyWithCoins()}
              className="rounded-xl bg-gradient-to-r from-yellow-500 to-amber-600 px-4 py-3 text-sm font-black text-black transition-transform active:scale-[0.98] disabled:opacity-50"
            >
              {buying === "coins" ? "Покупаем…" : "🪙 1000 монет / месяц"}
            </button>
            <button
              type="button"
              disabled={buying !== null}
              onClick={() => void buyWithStars()}
              className="rounded-xl border border-yellow-400/35 bg-yellow-400/10 px-4 py-3 text-sm font-black text-yellow-300 transition-transform active:scale-[0.98] disabled:opacity-50"
            >
              {buying === "stars" ? "Открываем Telegram…" : "⭐ Telegram Stars · ≈300 ₽ / месяц"}
            </button>
            <p className="text-center text-[10px] leading-relaxed" style={{ color: "var(--dim)" }}>
              Оплата деньгами внутри Telegram проходит через Stars; итоговую цену Telegram показывает перед оплатой.
            </p>
          </div>
        )}

        {fullCustomUnlocked && (
          <>
            <div className="space-y-2.5">
              {CUSTOM_FIELDS.map((field) => (
                <label
                  key={field.key}
                  className="flex items-center gap-3 rounded-xl border px-3 py-2.5"
                  style={{ borderColor: "var(--border)", background: "var(--surface2)" }}
                >
                  <input
                    type="color"
                    value={effectiveCustom[field.key]}
                    onChange={(e) => onChangeCustomTheme({ ...effectiveCustom, [field.key]: e.target.value })}
                    className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border-0 bg-transparent p-0"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold" style={{ color: "var(--text)" }}>{field.label}</span>
                    <span className="block text-[11px]" style={{ color: "var(--muted)" }}>{field.hint}</span>
                  </span>
                  <code className="text-[10px]" style={{ color: "var(--dim)" }}>{effectiveCustom[field.key]}</code>
                </label>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                onResetCustomTheme();
                onToast("VIP-оформление сброшено до стандартной темы");
              }}
              className="mt-3 w-full rounded-xl border px-4 py-2.5 text-sm font-bold transition-transform active:scale-[0.98]"
              style={{ borderColor: "var(--border)", color: "var(--text)" }}
            >
              ↩️ Сбросить оформление
            </button>
          </>
        )}
      </section>

      <section
        className="fade-up mt-4 rounded-2xl border p-4 shadow-xl"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <h2 className="mb-1 text-sm font-bold" style={{ color: "var(--text)" }}>🗂️ Данные</h2>
        <p className="mb-3 text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
          Сбросить оценки «нравится / мимо» — лента рекомендаций наполнится заново. Совпадения в чатах при этом сохранятся.
        </p>
        <button
          type="button"
          onClick={handleReset}
          disabled={resetting}
          className={`w-full rounded-xl border px-4 py-3 text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-60 ${confirmReset ? "border-red-500 bg-red-500/15 text-red-400" : ""}`}
          style={confirmReset ? undefined : { borderColor: "var(--border)", color: "var(--text)" }}
        >
          {resetting ? "Сбрасываем…" : confirmReset ? "Точно сбросить? Нажми ещё раз" : "🔄 Начать сначала"}
        </button>
      </section>

      <section
        className="fade-up mt-4 rounded-2xl border p-4 shadow-xl"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <h2 className="mb-1 text-sm font-bold" style={{ color: "var(--text)" }}>ℹ️ О приложении</h2>
        <p className="text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
          EdGGe — Telegram Mini App для поиска тиммейтов в Dota 2.
        </p>
        {isDemo && (
          <p className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-600">
            Демо-режим: приложение открыто вне Telegram, анкеты — примеры.
          </p>
        )}
      </section>
    </div>
  );
}
