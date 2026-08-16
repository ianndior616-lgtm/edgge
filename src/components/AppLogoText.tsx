"use client";

/** Логотип текстом: Ed + позолоченные GG + e */
export function AppLogoText({
  className = "",
  size = "text-sm",
}: {
  className?: string;
  size?: string;
}) {
  return (
    <span
      className={`font-display font-extrabold tracking-wide ${size} ${className}`}
      style={{ color: "var(--text)" }}
    >
      Ed
      <span
        style={{
          background: "linear-gradient(135deg, #fef08a 0%, #facc15 45%, #d97706 100%)",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
          textShadow: "0 0 10px rgba(250, 204, 21, 0.25)",
        }}
      >
        GG
      </span>
      e
    </span>
  );
}
