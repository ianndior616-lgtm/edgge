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
  version?: string;
  platform?: string;
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
  ready: boolean;
  initData: string | null;
  isDemo: boolean;
  webApp: TelegramWebApp | null;
  openLink: (url: string) => void;
};

const TelegramContext = createContext<TelegramContextValue>({
  ready: false,
  initData: null,
  isDemo: true,
  webApp: null,
  openLink: () => {},
});

function readLaunchInitData(): string | null {
  // Telegram normally exposes initData through Telegram.WebApp.initData.
  // As a fallback, read the raw tgWebAppData launch parameter directly
  // from the URL. This also survives clients where the SDK initializes late.
  const sources = [window.location.hash.replace(/^#/, ""), window.location.search.replace(/^\?/, "")];

  for (const source of sources) {
    if (!source) continue;
    try {
      const params = new URLSearchParams(source);
      const raw = params.get("tgWebAppData")?.trim();
      if (raw) return raw;
    } catch {
      // ignore malformed launch params
    }
  }

  return null;
}

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
      const launchInitData = readLaunchInitData();

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
            // not critical
          }
        }
      }

      const rawInitData = wa?.initData?.trim() || launchInitData || "";
      if (rawInitData) {
        setInitData(rawInitData);
        setReady(true);
        return;
      }

      if (attemptsLeft > 0) {
        timer = window.setTimeout(() => tryLoad(attemptsLeft - 1), 250);
        return;
      }

      setReady(true);
    };

    // Allow Telegram Desktop/Web enough time to inject launch context.
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
        return;
      } catch {
        // fall through
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
