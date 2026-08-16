"use client";

import { useState } from "react";
import { useTelegram } from "./TelegramProvider";
import { api } from "@/lib/client-api";
import { THEMES } from "@/lib/theme";
import type { ThemeId } from "@/lib/types";

/** Вкладка «Настройки»: темы оформления + сброс оценок */
export function SettingsView({
  theme,
  onChangeTheme,
  isDemo,
  onToast,
}: {
  theme: ThemeId;
  onChangeTheme: (theme: ThemeId) => void;
  isDemo: boolean;
  onToast: (msg: string) => void;
}) {
  const { initData } = useTelegram();
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);

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

  return (
    <div className="mx-auto w-full max-w-md px-4 pb-28 pt-5">
      <h1
        className="font-display fade-up mb-4 text-xl font-extrabold"
        style={{ color: "var(--text)" }}
      >
        ⚙️ Настройки
      </h1>

      {/* Тема */}
      <section
        className="fade-up rounded-2xl border p-4 shadow-xl"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <h2 className="mb-3 text-sm font-bold" style={{ color: "var(--text)" }}>
          🎨 Тема оформления
        </h2>
        <div className="space-y-2.5">
          {THEMES.map((t) => {
            const active = theme === t.id;
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
                <span
                  className="h-10 w-10 shrink-0 rounded-lg shadow-inner"
                  style={{ background: t.swatch }}
                />
                <span className="min-w-0 flex-1">
                  <span
                    className="block text-sm font-bold"
                    style={{ color: "var(--text)" }}
                  >
                    {t.label}
                  </span>
                  <span className="block text-xs" style={{ color: "var(--muted)" }}>
                    {t.desc}
                  </span>
                </span>
                {active && (
                  <span
                    className="text-lg font-black"
                    style={{ color: "var(--accent)" }}
                  >
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Данные */}
      <section
        className="fade-up mt-4 rounded-2xl border p-4 shadow-xl"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <h2 className="mb-1 text-sm font-bold" style={{ color: "var(--text)" }}>
          🗂️ Данные
        </h2>
        <p className="mb-3 text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
          Сбросить оценки «нравится / мимо» — лента рекомендаций наполнится
          заново. Совпадения в чатах при этом сохранятся.
        </p>
        <button
          type="button"
          onClick={handleReset}
          disabled={resetting}
          className={`w-full rounded-xl border px-4 py-3 text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-60 ${
            confirmReset ? "border-red-500 bg-red-500/15 text-red-400" : ""
          }`}
          style={
            confirmReset
              ? undefined
              : { borderColor: "var(--border)", color: "var(--text)" }
          }
        >
          {resetting
            ? "Сбрасываем…"
            : confirmReset
              ? "Точно сбросить? Нажми ещё раз"
              : "🔄 Начать сначала"}
        </button>
      </section>

      {/* О приложении */}
      <section
        className="fade-up mt-4 rounded-2xl border p-4 shadow-xl"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <h2 className="mb-1 text-sm font-bold" style={{ color: "var(--text)" }}>
          ℹ️ О приложении
        </h2>
        <p className="text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
          EdGGe — Telegram Mini App для поиска тиммейтов в Dota 2.
          Регистрация происходит автоматически при открытии приложения через
          бота.
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
