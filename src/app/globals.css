@import "tailwindcss";

/* ==== Токены тем ==== */

:root {
  /* тёмная тема по умолчанию */
  --bg: #070b14;
  --surface: #111a2c;
  --surface2: #1b2537;
  --border: rgba(255, 255, 255, 0.09);
  --border-strong: rgba(255, 255, 255, 0.24);
  --text: #e9edf5;
  --muted: #93a1b7;
  --dim: #5f6c80;
  --accent: #ff4d5e;
  --accent2: #ff8a3d;
  --accent-soft: rgba(255, 77, 94, 0.14);
  --nav-bg: #ffffff;
  --nav-border: rgba(15, 23, 42, 0.12);
  --nav-text: #1e293b;
  --glow1: rgba(255, 71, 87, 0.16);
  --glow2: rgba(124, 58, 237, 0.12);
  color-scheme: dark;
}

[data-theme="dark"] {
  --bg: #070b14;
  --surface: #111a2c;
  --surface2: #1b2537;
  --border: rgba(255, 255, 255, 0.09);
  --border-strong: rgba(255, 255, 255, 0.24);
  --text: #e9edf5;
  --muted: #93a1b7;
  --dim: #5f6c80;
  --accent: #ff4d5e;
  --accent2: #ff8a3d;
  --accent-soft: rgba(255, 77, 94, 0.14);
  --nav-bg: #ffffff;
  --nav-border: rgba(15, 23, 42, 0.12);
  --nav-text: #1e293b;
  --glow1: rgba(255, 71, 87, 0.16);
  --glow2: rgba(124, 58, 237, 0.12);
  color-scheme: dark;
}

[data-theme="light"] {
  --bg: #eef2f7;
  --surface: #ffffff;
  --surface2: #f1f5f9;
  --border: #dbe3ee;
  --border-strong: rgba(15, 23, 42, 0.28);
  --text: #101a2c;
  --muted: #5d6b80;
  --dim: #8b98ab;
  --accent: #e02f3c;
  --accent2: #f97316;
  --accent-soft: rgba(224, 47, 60, 0.1);
  --nav-bg: #ffffff;
  --nav-border: #e2e8f0;
  --nav-text: #334155;
  --glow1: rgba(224, 47, 60, 0.1);
  --glow2: rgba(99, 102, 241, 0.08);
  color-scheme: light;
}

[data-theme="dota"] {
  --bg: #0a0a0b;
  --surface: #17171a;
  --surface2: #222226;
  --border: rgba(255, 255, 255, 0.12);
  --border-strong: rgba(255, 255, 255, 0.3);
  --text: #f2f2f2;
  --muted: #a5a5ad;
  --dim: #7a7a82;
  --accent: #ff3b30;
  --accent2: #d4af37;
  --accent-soft: rgba(255, 59, 48, 0.15);
  --nav-bg: #fdfbf5;
  --nav-border: rgba(0, 0, 0, 0.18);
  --nav-text: #232323;
  --glow1: rgba(255, 59, 48, 0.18);
  --glow2: rgba(212, 175, 55, 0.1);
  color-scheme: dark;
}

/* ==== База ==== */

html,
body {
  min-height: 100%;
}

body {
  min-height: 100dvh;
  background-color: var(--bg);
  color: var(--text);
  background-image:
    radial-gradient(
      900px 420px at 50% -10%,
      var(--glow1),
      transparent 60%
    ),
    radial-gradient(700px 380px at 100% 0%, var(--glow2), transparent 55%);
  background-attachment: fixed;
  font-family:
    ui-sans-serif,
    system-ui,
    -apple-system,
    "Segoe UI",
    Roboto,
    "Helvetica Neue",
    Arial,
    sans-serif;
  -webkit-tap-highlight-color: transparent;
  transition: background-color 0.25s ease, color 0.25s ease;
}

*::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
*::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.35);
  border-radius: 999px;
}
*::-webkit-scrollbar-track {
  background: transparent;
}

@keyframes fadeUp {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

.fade-up {
  animation: fadeUp 0.35s ease both;
}

@keyframes popIn {
  0% {
    opacity: 0;
    transform: scale(0.85);
  }
  60% {
    transform: scale(1.04);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

.pop-in {
  animation: popIn 0.3s ease both;
}

.no-select {
  user-select: none;
  -webkit-user-select: none;
}

input[type="number"]::-webkit-outer-spin-button,
input[type="number"]::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
input[type="number"] {
  -moz-appearance: textfield;
  appearance: textfield;
}

select {
  -webkit-appearance: none;
  appearance: none;
}

/* ==== Компонентные классы ==== */

/* ===== Фирменный стиль EdGGe ===== */

/* Дисплейный шрифт для заголовков (Russo One с fallback'ами) */
.font-display {
  font-family: "Russo One", "Arial Black", "Segoe UI", system-ui, sans-serif;
  letter-spacing: 0.035em;
}

/* Рунический водяной знак на фоне — едва заметная «изюминка» */
body::after {
  content: "EdGGe";
  position: fixed;
  top: -14px;
  right: -30px;
  font-size: 112px;
  letter-spacing: 4px;
  color: var(--accent);
  opacity: 0.05;
  pointer-events: none;
  z-index: 0;
  user-select: none;
  white-space: nowrap;
}

/* Рунический знак в углу карточек */
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 1.25rem;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.18);
  position: relative;
}
.card::after {
  content: "ᛟ";
  position: absolute;
  top: 4px;
  right: 12px;
  font-size: 30px;
  line-height: 1;
  color: var(--accent);
  opacity: 0.08;
  pointer-events: none;
  user-select: none;
}

/* Срезанный угол у главных кнопок — фирменный приём */
.btn-cut {
  clip-path: polygon(
    0 0,
    100% 0,
    100% calc(100% - 10px),
    calc(100% - 10px) 100%,
    0 100%
  );
}

/* Светящееся кольцо логотипа */
.logo-ring {
  border: 2px solid var(--accent);
  box-shadow:
    0 0 18px color-mix(in srgb, var(--accent) 45%, transparent),
    inset 0 0 10px color-mix(in srgb, var(--accent) 20%, transparent);
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border-radius: 0.85rem;
  padding: 0.7rem 1rem;
  font-size: 0.875rem;
  font-weight: 700;
  transition:
    transform 0.1s ease,
    opacity 0.15s ease;
}
.btn:active {
  transform: scale(0.97);
}
.btn:disabled {
  opacity: 0.6;
}

.btn-accent {
  background: linear-gradient(135deg, var(--accent), var(--accent2));
  color: #ffffff;
  box-shadow: 0 8px 20px color-mix(in srgb, var(--accent) 35%, transparent);
}

.btn-ghost {
  background: var(--surface2);
  border: 1px solid var(--border);
  color: var(--text);
}


