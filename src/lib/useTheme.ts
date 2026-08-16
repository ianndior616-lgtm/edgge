"use client";

import { useEffect, useState } from "react";
import { THEME_KEY, isThemeId } from "./theme";
import type { ThemeId } from "./types";

/** Управление темой оформления (сохраняется в localStorage) */
export function useTheme() {
  const [theme, setThemeState] = useState<ThemeId>("dark");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(THEME_KEY);
      const initial = isThemeId(saved) ? saved : "dark";
      setThemeState(initial);
      document.documentElement.dataset.theme = initial;
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
  };

  return { theme, setTheme };
}
