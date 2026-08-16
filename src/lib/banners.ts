/**
 * Базовые палитры/градиенты для карточки в рекомендациях.
 * Пользователь может загрузить свою картинку или выбрать один из них.
 */
export type BannerPalette = {
  id: string;
  name: string;
  css: string;
};

export const BANNER_PALETTES: BannerPalette[] = [
  {
    id: "palette:1",
    name: "Закат",
    css: "linear-gradient(135deg, #7f1d1d 0%, #dc2626 50%, #f59e0b 100%)",
  },
  {
    id: "palette:2",
    name: "Ночь",
    css: "linear-gradient(135deg, #0f172a 0%, #312e81 55%, #6366f1 100%)",
  },
  {
    id: "palette:3",
    name: "Лес",
    css: "linear-gradient(135deg, #064e3b 0%, #059669 55%, #14b8a6 100%)",
  },
  {
    id: "palette:4",
    name: "Глубина",
    css: "linear-gradient(135deg, #0c4a6e 0%, #0369a1 50%, #06b6d4 100%)",
  },
  {
    id: "palette:5",
    name: "Сумрак",
    css: "linear-gradient(135deg, #4a044e 0%, #a21caf 55%, #f472b6 100%)",
  },
  {
    id: "palette:6",
    name: "Изумруд",
    css: "linear-gradient(135deg, #022c22 0%, #065f46 50%, #34d399 100%)",
  },
];

/** Стандартный градиент (цвет роли), если картинка не выбрана */
export const DEFAULT_BANNER_CSS =
  "linear-gradient(135deg, #1b2537 0%, #111a2c 100%)";

export function isPaletteId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    BANNER_PALETTES.some((p) => p.id === value)
  );
}

/** CSS-фон для выбранной картинки (null для своих изображений и стандарта) */
export function bannerCss(banner: string | null): string | null {
  if (!banner || banner.startsWith("data:")) return null;
  return BANNER_PALETTES.find((p) => p.id === banner)?.css ?? null;
}
