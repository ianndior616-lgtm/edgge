"use client";

import { useEffect } from "react";

/**
 * Ошибки внутри страницы больше не роняют всё приложение:
 * вместо белого экрана (и ошибки Telegram «This page couldn't load»)
 * показываем дружелюбный экран с кнопками восстановления.
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error:", error);
  }, [error]);

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center"
      style={{ background: "#0a0a0b", color: "#f2f2f2" }}
    >
      <div className="text-5xl">😵</div>
      <h1 className="text-xl font-bold">Что-то пошло не так</h1>
      <p className="max-w-xs text-sm" style={{ color: "#a5a5ad" }}>
        Произошла ошибка при отображении приложения. Попробуй перезагрузить —
        данные твоей анкеты сохранены.
      </p>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-xl bg-gradient-to-r from-red-500 to-orange-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-red-500/25 transition-transform active:scale-95"
        >
          Попробовать снова
        </button>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-xl border px-5 py-3 text-sm font-semibold transition-opacity hover:opacity-80"
          style={{ borderColor: "rgba(255,255,255,0.2)", color: "#f2f2f2" }}
        >
          Перезагрузить
        </button>
      </div>
    </div>
  );
}
