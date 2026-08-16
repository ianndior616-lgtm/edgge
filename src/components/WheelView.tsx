"use client";

/** Заглушка раздела Колесо фортуны */
export function WheelView() {
  return (
    <div className="mx-auto flex min-h-[70dvh] w-full max-w-md flex-col items-center justify-center px-4 pb-28 pt-5 text-center">
      <div className="text-6xl">🎡</div>
      <h1
        className="font-display mt-4 text-2xl font-black"
        style={{ color: "var(--text)" }}
      >
        Колесо фортуны
      </h1>
      <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
        В разработке...
      </p>
    </div>
  );
}
