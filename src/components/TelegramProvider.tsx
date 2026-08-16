"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type TelegramWebApp = {
  initData: string;
  initDataUnsafe?: {
    user?: {
      id: number;
      first_name?: string;
      last_name?: string;
      username?: string;
    };
    start_param?: string;
  };
  colorScheme?: "light" | "dark";
  ready: () => void;
  expand: () => void;
  close?: () => void;
  openTelegramLink: (url: string) => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

type TelegramContextValue = {
  /** true, когда SDK проверен (или стало ясно, что открыто вне Telegram) */
  ready: boolean;
  /** initData Telegram (null вне Telegram — демо-режим) */
  initData: string | null;
  isDemo: boolean;
  webApp: TelegramWebApp | null;
  /** Открывает ссылку через Telegram или в новой вкладке */
  openLink: (url: string) => void;
};

const TelegramContext = createContext<TelegramContextValue>({
  ready: false,
  initData: null,
  isDemo: true,
  webApp: null,
  openLink: () => {},
});

export function TelegramProvider({ children }: { children: ReactNode }) {
  const [webApp, setWebApp] = useState<TelegramWebApp | null>(null);
  const [initData, setInitData] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    let configured = false;

    const tryLoad = (attemptsLeft: number) => {
      if (cancelled) return;

      const wa = window.Telegram?.WebApp ?? null;

      if (wa) {
        setWebApp(wa);

        if (!configured) {
          configured = true;
          try {
            wa.ready();
            wa.expand();
            wa.setHeaderColor?.("#0b0e17");
            wa.setBackgroundColor?.("#070b14");
          } catch {
            // не критично
          }
        }

        // В некоторых клиентах объект WebApp появляется раньше, чем Telegram
        // заполняет initData. Не считаем инициализацию завершённой, пока не
        // дождались самих подписанных данных пользователя.
        const rawInitData = wa.initData?.trim() ?? "";
        if (rawInitData) {
          setInitData(rawInitData);
          setReady(true);
          return;
        }
      }

      if (attemptsLeft > 0) {
        timer = window.setTimeout(() => tryLoad(attemptsLeft - 1), 250);
        return;
      }

      // SDK/данные так и не появились: считаем, что страница открыта вне
      // полноценного Telegram Mini App-контекста.
      setReady(true);
    };

    // Ждём до ~10 секунд: Telegram Desktop/Web иногда отдаёт контекст не сразу.
    tryLoad(40);

    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, []);

  const isDemo = !initData;

  const openLink = (url: string) => {
    if (webApp?.openTelegramLink) {
      try {
        webApp.openTelegramLink(url);
        // После перехода в чат закрываем текущий Mini App, чтобы пользователь
        // действительно увидел бота, а не оставался на прежнем экране.
        window.setTimeout(() => {
          try {
            webApp.close?.();
          } catch {
            // не критично
          }
        }, 150);
        return;
      } catch {
        // переходим к запасному варианту
      }
    }
    window.location.href = url;
  };

  return (
    <TelegramContext.Provider
      value={{ ready, initData, isDemo, webApp, openLink }}
    >
      {children}
    </TelegramContext.Provider>
  );
}

export function useTelegram(): TelegramContextValue {
  return useContext(TelegramContext);
}
