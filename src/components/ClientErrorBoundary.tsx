"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type State = { hasError: boolean };

/** Локальная защита вкладок: ошибка в профиле/чатах не роняет всё приложение. */
export class ClientErrorBoundary extends Component<
  { children: ReactNode; fallbackTitle?: string },
  State
> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Client section error", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto flex min-h-[60dvh] w-full max-w-md flex-col items-center justify-center px-6 text-center">
          <div className="text-5xl">🛠️</div>
          <h2
            className="font-display mt-4 text-xl font-black"
            style={{ color: "var(--text)" }}
          >
            {this.props.fallbackTitle ?? "Раздел временно не загрузился"}
          </h2>
          <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
            Данные сохранены. Нажми кнопку ниже, чтобы перерисовать раздел.
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false })}
            className="btn-cut mt-4 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-red-500/25"
          >
            Попробовать снова
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
