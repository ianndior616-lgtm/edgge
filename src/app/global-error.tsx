"use client";

import { useEffect } from "react";

/**
 * Страховка на уровне корня: даже критичная ошибка не оставит
 * пользователя с пустым экраном — будет экран с перезагрузкой.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <html lang="ru">
      <body>
        <div
          className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center"
          style={{ background: "#0a0a0b", color: "#f2f2f2" }}
        >
          <div className="text-5xl">😵</div>
          <h1 className="text-xl font-bold">Приложение упало</h1>
          <p className="max-w-xs text-sm" style={{ color: "#a5a5ad" }}>
            Что-то пошло не так. Нажми «Перезагрузить» — твоя анкета никуда не
            делась.
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
      </body>
    </html>
  );
}
