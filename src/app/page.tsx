"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AdminPanelView } from "@/components/AdminPanelView";
import { AppLogoText } from "@/components/AppLogoText";
import { ChatsView } from "@/components/ChatsView";
import { ClientErrorBoundary } from "@/components/ClientErrorBoundary";
import { CoinIcon } from "@/components/CoinIcon";
import { OnboardingForm } from "@/components/OnboardingForm";
import { ProfileView } from "@/components/ProfileView";
import { RecommendationsView } from "@/components/RecommendationsView";
import { SettingsView } from "@/components/SettingsView";
import { WheelView } from "@/components/WheelView";
import {
  TelegramProvider,
  useTelegram,
} from "@/components/TelegramProvider";
import { api } from "@/lib/client-api";
import { useTheme } from "@/lib/useTheme";
import { localDayString } from "@/lib/wallet-constants";
import type { CheckinResponse, MeResponse, UserWithProfile } from "@/lib/types";

type Stage = "loading" | "need-tg" | "onboarding" | "app";
type Tab = "recs" | "profile" | "settings" | "chats" | "wheel" | "admin";
type RegMode = "user" | null;

const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? "";

function App() {
  const { ready, initData, isDemo, openLink } = useTelegram();
  const { theme, setTheme } = useTheme();

  const [stage, setStage] = useState<Stage>("loading");
  const [me, setMe] = useState<UserWithProfile | null>(null);
  const [tab, setTab] = useState<Tab>("recs");
  const [toast, setToast] = useState<ReactNode | null>(null);
  const [regMode, setRegMode] = useState<RegMode>(null);

  const showToast = (msg: ReactNode) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2600);
  };

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api<MeResponse>("/api/auth", initData, {
          method: "POST",
          body: {},
        });
        if (cancelled) return;
        setMe(res.user);
        setStage(res.user.profileComplete ? "app" : "onboarding");
      } catch {
        if (!cancelled) setStage("need-tg");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, initData]);

  const handleSaved = (user: UserWithProfile) => {
    setMe(user);
    setStage("app");
  };

  // Автоматический ежедневный чек-ин при входе в приложение:
  // награда растёт со стриком, пропуск дня сбрасывает серию.
  useEffect(() => {
    if (stage !== "app" && stage !== "onboarding") return;
    if (!me) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api<CheckinResponse>("/api/checkin", initData, {
          method: "POST",
          body: { day: localDayString() },
        });
        if (cancelled || res.alreadyClaimed || res.reward <= 0) return;
        setMe((prev) =>
          prev
            ? {
                ...prev,
                currency: res.currency,
                streakDays: res.streakDays,
                lastClaimDay: localDayString(),
                crownUnlocked: res.crownUnlocked,
              }
            : prev,
        );
        showToast(
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
      } catch {
        // чек-ин не критичен
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, initData]);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col">
      {/* Экраны до входа */}
      {stage === "loading" && <SplashScreen />}

      {stage === "need-tg" && <NeedTelegramScreen openLink={openLink} />}

      {/* Приветственный экран перед регистрацией */}
      {stage === "onboarding" && me && regMode === null && (
        <main className="fade-up px-4 pb-16 pt-10">
          <div className="mb-8 flex flex-col items-center text-center">
            <img
              src="/icon.png"
              alt="EdGGe"
              className="logo-ring h-20 w-20 rounded-3xl object-cover"
            />
            <h1
              className="font-display mt-4 text-2xl font-black tracking-wide"
              style={{ color: "var(--text)" }}
            >
              <AppLogoText size="text-2xl" />
            </h1>
            <p className="mt-2 max-w-xs text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
              Привет, {me.firstName || "игрок"}! EdGGe помогает найти тиммейтов
              для Dota 2: укажи свою роль, кого ищешь, ПТС и профиль — дальше
              листай анкеты, ставь лайки и общайся после взаимного мэтча.
            </p>
          </div>

          <div className="space-y-3">
            {[
              ["💘", "Матчи", "Лайк совпал — игрок появится в чатах"],
              ["🎟️", "Рефералы", "Приглашай друзей и получай 10% от их наград"],
              ["🎁", "Ежедневные бонусы", "Заходи каждый день, копи валюту и открывай корону"],
            ].map(([icon, title, text]) => (
              <div
                key={title}
                className="card rounded-2xl p-3.5"
                style={{ background: "var(--surface)", borderColor: "var(--border)" }}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{icon}</span>
                  <div className="min-w-0 flex-1 text-left">
                    <p className="text-sm font-black" style={{ color: "var(--text)" }}>
                      {title}
                    </p>
                    <p className="text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
                      {text}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={() => setRegMode("user")}
              className="btn-cut mt-2 w-full rounded-2xl bg-gradient-to-br from-red-500 to-orange-500 p-4 text-left shadow-xl shadow-red-500/25 transition-transform active:scale-[0.98]"
            >
              <span className="block text-lg font-black text-white">
                🚀 Зарегистрироваться
              </span>
              <span className="mt-0.5 block text-xs text-white/85">
                Заполнить анкету и перейти к рекомендациям
              </span>
            </button>
          </div>

          <p
            className="mt-6 text-center text-[11px] leading-relaxed"
            style={{ color: "var(--dim)" }}
          >
            EdGGe — находи тиммейтов, собирай команду, катай на результат.
          </p>
        </main>
      )}

      {/* Регистрация при первом входе: форма пользователя */}
      {stage === "onboarding" && me && regMode !== null && (
        <main className="fade-up px-4 pb-16 pt-6">
          <div className="mb-5 flex flex-col items-center text-center">
            <img
              src="/icon.png"
              alt="EdGGe"
              className="logo-ring h-16 w-16 rounded-2xl object-cover"
            />
            <h1
              className="font-display mt-3 text-2xl font-black"
              style={{ color: "var(--text)" }}
            >
              Создай анкету
            </h1>
            <p className="mt-1 max-w-xs text-sm" style={{ color: "var(--muted)" }}>
              Выбери аватарку, роль и тех, кого хочешь найти, — лента подберёт
              тиммейтов под тебя.
            </p>
          </div>
          <div
            className="card rounded-2xl p-4"
            style={{ background: "var(--surface)", borderColor: "var(--border)" }}
          >
            <OnboardingForm
              initial={null}
              firstName={me.firstName}
              onSaved={handleSaved}
              onNotice={showToast}
              onBack={() => setRegMode(null)}
            />
          </div>
        </main>
      )}

      {/* Основное приложение */}
      {stage === "app" && me && (
        <main className="flex min-h-[100dvh] flex-col">
          {tab === "recs" && (
            <ClientErrorBoundary fallbackTitle="Рекомендации не загрузились">
              <RecommendationsView me={me} />
            </ClientErrorBoundary>
          )}
          {tab === "profile" && (
            <ClientErrorBoundary fallbackTitle="Профиль не загрузился">
              <ProfileView me={me} onSaved={setMe} onToast={showToast} />
            </ClientErrorBoundary>
          )}
          {tab === "settings" && (
            <ClientErrorBoundary fallbackTitle="Настройки не загрузились">
              <SettingsView
                theme={theme}
                onChangeTheme={setTheme}
                isDemo={isDemo}
                onToast={showToast}
              />
            </ClientErrorBoundary>
          )}
          {tab === "chats" && (
            <ClientErrorBoundary fallbackTitle="Чаты не загрузились">
              <ChatsView onGoRecs={() => setTab("recs")} />
            </ClientErrorBoundary>
          )}
          {tab === "wheel" && <WheelView />}
          {tab === "admin" && me.isAdmin && (
            <ClientErrorBoundary fallbackTitle="Админ-панель не загрузилась">
              <AdminPanelView />
            </ClientErrorBoundary>
          )}
        </main>
      )}

      {/* Кнопка «Рекомендации» над нижней панелью (скрыта внутри ленты) */}
      {stage === "app" && tab !== "recs" && (
        <button
          type="button"
          onClick={() => setTab("recs")}
          className="btn-cut pop-in fixed bottom-[calc(4.6rem+env(safe-area-inset-bottom))] left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-full bg-gradient-to-r from-red-500 to-orange-500 px-6 py-3 text-sm font-black text-white shadow-xl shadow-red-500/40 transition-transform active:scale-95"
        >
          🔥 Рекомендации
        </button>
      )}

      {/* Нижняя навигация: Профиль / Настройки / Чаты */}
      {stage === "app" && (
        <nav
          className="fixed inset-x-0 bottom-0 z-40 border-t shadow-[0_-8px_24px_rgba(0,0,0,0.25)]"
          style={{
            background: "color-mix(in srgb, var(--bg) 88%, transparent)",
            borderColor: "var(--border)",
            backdropFilter: "blur(12px)",
            paddingBottom: "env(safe-area-inset-bottom)",
          }}
        >
          <div className="mx-auto flex max-w-md gap-2 px-3 pt-2">
            <NavButton
              active={tab === "profile"}
              onClick={() => setTab("profile")}
              icon="👤"
              label="Профиль"
            />
            <NavButton
              active={tab === "settings"}
              onClick={() => setTab("settings")}
              icon="⚙️"
              label="Настройки"
            />
            <NavButton
              active={tab === "chats"}
              onClick={() => setTab("chats")}
              icon="💬"
              label="Чаты"
            />
            <NavButton
              active={tab === "wheel"}
              onClick={() => setTab("wheel")}
              icon="🎡"
              label="Фортуна"
            />
            {me?.isAdmin && (
              <NavButton
                active={tab === "admin"}
                onClick={() => setTab("admin")}
                icon="🛡️"
                label="Админ"
              />
            )}
          </div>
        </nav>
      )}

      {/* Тост */}
      {toast && (
        <div className="fade-up fixed inset-x-0 bottom-24 z-50 flex justify-center px-4">
          <div
            className="rounded-xl border px-4 py-2.5 text-sm shadow-2xl"
            style={{
              background: "var(--surface)",
              borderColor: "var(--border)",
              color: "var(--text)",
            }}
          >
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}

function NavButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-2 text-[12px] font-bold transition-all active:scale-95"
      style={{
        background: active
          ? "#ffffff"
          : "color-mix(in srgb, #ffffff 82%, transparent)",
        color: "#1e293b",
        border: active
          ? "2px solid var(--accent)"
          : "2px solid transparent",
        boxShadow: active
          ? "0 6px 20px rgba(0,0,0,0.3)"
          : "0 2px 10px rgba(0,0,0,0.15)",
      }}
    >
      <span className="text-xl leading-none">{icon}</span>
      {label}
    </button>
  );
}

function SplashScreen() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4">
      <img
        src="/icon.png"
        alt="EdGGe"
        className="h-16 w-16 rounded-2xl object-cover shadow-2xl shadow-red-500/40"
      />
      <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-500 border-t-red-500" />
    </div>
  );
}

function NeedTelegramScreen({
  openLink,
}: {
  openLink: (url: string) => void;
}) {
  return (
    <main className="fade-up flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="text-5xl">📱</div>
      <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>
        Открой приложение через бота
      </h1>
      <p className="max-w-xs text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
        EdGGe работает внутри Telegram. Зайди в бота, нажми кнопку «Открыть
        EdGGe» — и регистрация произойдёт автоматически.
      </p>
      {BOT_USERNAME ? (
        <button
          type="button"
          onClick={() => openLink(`https://t.me/${BOT_USERNAME}`)}
          className="mt-2 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-red-500/25 transition-transform active:scale-95"
        >
          🤖 Перейти в бота @{BOT_USERNAME}
        </button>
      ) : (
        <div
          className="mt-2 rounded-xl border px-4 py-3 text-xs"
          style={{ borderColor: "var(--border)", color: "var(--muted)" }}
        >
          Задайте <code style={{ color: "var(--accent)" }}>TELEGRAM_BOT_TOKEN</code> и{" "}
          <code style={{ color: "var(--accent)" }}>NEXT_PUBLIC_TELEGRAM_BOT_USERNAME</code>{" "}
          в .env и откройте приложение из бота.
        </div>
      )}
    </main>
  );
}

export default function Page() {
  return (
    <TelegramProvider>
      <App />
    </TelegramProvider>
  );
}
