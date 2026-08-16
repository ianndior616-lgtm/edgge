"use client";

import { useEffect, useState } from "react";
import { THEME_KEY, isThemeId } from "./theme";
import type { ThemeId } from "./types";

export type CustomTheme = {
  bg: string;
  surface: string;
  surface2: string;
  text: string;
  accent: string;
  accent2: string;
};

const CUSTOM_THEME_KEY = "edgge.custom-theme.v1";

const DEFAULT_CUSTOM_THEME: CustomTheme = {
  bg: "#070b14",
  surface: "#111a2c",
  surface2: "#1b2537",
  text: "#e9edf5",
  accent: "#ff4d5e",
  accent2: "#ff8a3d",
};

function applyCustomTheme(value: CustomTheme | null) {
  const root = document.documentElement;
  const keys: Array<keyof CustomTheme> = [
    "bg",
    "surface",
    "surface2",
    "text",
    "accent",
    "accent2",
  ];

  if (!value) {
    for (const key of keys) root.style.removeProperty(`--${key}`);
    return;
  }

  for (const key of keys) root.style.setProperty(`--${key}`, value[key]);
  root.style.setProperty(
    "--accent-soft",
    `color-mix(in srgb, ${value.accent} 16%, transparent)`,
  );
  root.style.setProperty(
    "--glow1",
    `color-mix(in srgb, ${value.accent} 18%, transparent)`,
  );
  root.style.setProperty(
    "--glow2",
    `color-mix(in srgb, ${value.accent2} 12%, transparent)`,
  );
}

/** Управление базовой темой + привилегией Full Custom. */
export function useTheme() {
  const [theme, setThemeState] = useState<ThemeId>("dark");
  const [customTheme, setCustomThemeState] = useState<CustomTheme | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(THEME_KEY);
      const initial = isThemeId(saved) ? saved : "dark";
      setThemeState(initial);
      document.documentElement.dataset.theme = initial;

      const rawCustom = window.localStorage.getItem(CUSTOM_THEME_KEY);
      if (rawCustom) {
        const parsed = JSON.parse(rawCustom) as Partial<CustomTheme>;
        const next: CustomTheme = {
          ...DEFAULT_CUSTOM_THEME,
          ...parsed,
        };
        setCustomThemeState(next);
        applyCustomTheme(next);
      }
    } catch {
      document.documentElement.dataset.theme = "dark";
    }
  }, []);

  const setTheme = (next: ThemeId) => {
    setThemeState(next);
    try {
      window.localStorage.setItem(THEME_KEY, next);
    } catch {
      // ignore
    }
    document.documentElement.dataset.theme = next;

    // Выбор готовой темы отключает Full Custom до следующего изменения цветов.
    setCustomThemeState(null);
    applyCustomTheme(null);
    try {
      window.localStorage.removeItem(CUSTOM_THEME_KEY);
    } catch {
      // ignore
    }
  };

  const setCustomTheme = (next: CustomTheme) => {
    setCustomThemeState(next);
    applyCustomTheme(next);
    try {
      window.localStorage.setItem(CUSTOM_THEME_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const resetCustomTheme = () => {
    setCustomThemeState(null);
    applyCustomTheme(null);
    try {
      window.localStorage.removeItem(CUSTOM_THEME_KEY);
    } catch {
      // ignore
    }
  };

  return {
    theme,
    setTheme,
    customTheme,
    setCustomTheme,
    resetCustomTheme,
    defaultCustomTheme: DEFAULT_CUSTOM_THEME,
  };
}
