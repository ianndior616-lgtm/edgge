import type { ThemeId } from "./types";

export const THEME_KEY = "dotaparty-theme";

export const THEMES: {
  id: ThemeId;
  label: string;
  desc: string;
  swatch: string;
}[] = [
  {
    id: "dark",
    label: "Тёмная",
    desc: "Глубокая ночь с неоновыми акцентами",
    swatch: "linear-gradient(135deg, #070b14 0%, #111a2c 55%, #ff4d5e 100%)",
  },
  {
    id: "light",
    label: "Светлая",
    desc: "Чистый светлый интерфейс",
    swatch: "linear-gradient(135deg, #eef2f7 0%, #ffffff 55%, #e02f3c 100%)",
  },
  {
    id: "dota",
    label: "Оригинальная",
    desc: "Чёрный + красный + золото — стиль Dota 2",
    swatch: "linear-gradient(135deg, #0a0a0b 0%, #17171a 45%, #ff3b30 78%, #d4af37 100%)",
  },
];

export function isThemeId(value: unknown): value is ThemeId {
  return value === "dark" || value === "light" || value === "dota";
}
