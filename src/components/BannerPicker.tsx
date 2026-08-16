"use client";

import { useRef, useState } from "react";
import {
  BANNER_PALETTES,
  DEFAULT_BANNER_CSS,
  bannerCss,
} from "@/lib/banners";
import { formatBanner } from "@/lib/image-utils";

/**
 * Выбор картинки карточки рекомендаций:
 * своё изображение с устройства или базовая палитра/градиент.
 */
export function BannerPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isImage = value?.startsWith("data:");
  const paletteCss = bannerCss(value);
  const background = isImage ? undefined : (paletteCss ?? DEFAULT_BANNER_CSS);
  const label = isImage
    ? "Твоя картинка"
    : paletteCss
      ? BANNER_PALETTES.find((p) => p.id === value)?.name ?? "Палитра"
      : "Цвет роли (стандарт)";

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);

    if (!file.type.startsWith("image/")) {
      setError("Выбери файл изображения (JPG, PNG, WebP)");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("Файл слишком большой — до 8 МБ");
      return;
    }

    setBusy(true);
    try {
      const dataUrl = await formatBanner(file);
      onChange(dataUrl);
    } catch {
      setError("Не удалось обработать изображение — попробуй другой файл");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      {/* Превью */}
      <div
        className="relative h-20 w-full overflow-hidden rounded-xl"
        style={{
          background,
          border: "1px solid var(--border)",
        }}
      >
        {isImage && (
          <img
            src={value!}
            alt="Картинка карточки"
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        <span
          className="absolute bottom-1.5 left-2 rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur"
        >
          {label}
        </span>
      </div>

      {/* Палитры */}
      <div className="grid grid-cols-6 gap-1.5">
        <button
          type="button"
          onClick={() => onChange(null)}
          title="Цвет роли (стандарт)"
          className="h-8 w-full rounded-lg transition-transform active:scale-90"
          style={{
            background: DEFAULT_BANNER_CSS,
            border:
              value === null
                ? "2px solid var(--accent)"
                : "1px solid var(--border)",
            boxShadow:
              value === null
                ? "0 0 0 2px color-mix(in srgb, var(--accent) 30%, transparent)"
                : undefined,
          }}
        />
        {BANNER_PALETTES.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onChange(p.id)}
            title={p.name}
            className="h-8 w-full rounded-lg transition-transform active:scale-90"
            style={{
              background: p.css,
              border:
                value === p.id
                  ? "2px solid var(--accent)"
                  : "1px solid var(--border)",
              boxShadow:
                value === p.id
                  ? "0 0 0 2px color-mix(in srgb, var(--accent) 30%, transparent)"
                  : undefined,
            }}
          />
        ))}
      </div>

      {/* Кнопки */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="flex-1 rounded-xl border px-3 py-2 text-xs font-semibold transition-all active:scale-[0.98] disabled:opacity-60"
          style={{
            borderColor: "var(--border)",
            background: "var(--surface2)",
            color: "var(--text)",
          }}
        >
          {busy ? "⏳ Обрабатываем…" : isImage ? "📁 Заменить картинку" : "📁 Загрузить свою картинку"}
        </button>
        {value !== null && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="rounded-xl border px-3 py-2 text-xs font-semibold transition-opacity hover:opacity-80"
            style={{
              borderColor: "var(--border)",
              background: "transparent",
              color: "var(--muted)",
            }}
          >
            ✕ Сбросить
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFile}
        />
      </div>

      {error && (
        <p className="text-xs text-red-500">⚠️ {error}</p>
      )}
    </div>
  );
}
