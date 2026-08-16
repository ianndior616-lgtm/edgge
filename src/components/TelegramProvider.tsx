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
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const tryLoad = (attemptsLeft: number) => {
      const wa = window.Telegram?.WebApp ?? null;
      if (wa) {
        setWebApp(wa);
        try {
          wa.ready();
          wa.expand();
          wa.setHeaderColor?.("#0b0e17");
          wa.setBackgroundColor?.("#070b14");
        } catch {
          // не критично
        }
        setReady(true);
        return;
      }
      if (attemptsLeft > 0) {
        window.setTimeout(() => tryLoad(attemptsLeft - 1), 250);
      } else {
        // Открыто вне Telegram — работаем в демо-режиме
        setReady(true);
      }
    };
    tryLoad(12);
  }, []);

  const initData =
    webApp?.initData && webApp.initData.length > 0 ? webApp.initData : null;
  const isDemo = !initData;

  const openLink = (url: string) => {
    if (webApp?.openTelegramLink) {
      try {
        webApp.openTelegramLink(url);
        return;
      } catch {
        // переходим к запасному варианту
      }
    }
    window.open(url, "_blank", "noopener,noreferrer");
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
