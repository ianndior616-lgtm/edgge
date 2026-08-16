"use client";

import { useId } from "react";

/**
 * Валюта EdGGe — монета с квадратным вырезом по центру
 * (в стиле китайской монеты «кэш»).
 */
export function CoinIcon({
  size = 16,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const gradientId = `vv-coin-g-${uid}`;
  const maskId = `vv-coin-m-${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      style={{ display: "inline-block", verticalAlign: "-0.14em" }}
      aria-label="Монета EdGGe"
      role="img"
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="48%" stopColor="#facc15" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
        <mask id={maskId}>
          <rect width="24" height="24" fill="black" />
          <circle cx="12" cy="12" r="9.6" fill="white" />
          <rect x="8.4" y="8.4" width="7.2" height="7.2" fill="black" />
        </mask>
      </defs>

      {/* Тело монеты с квадратным отверстием */}
      <path
        d="M12 2 A10 10 0 1 1 12 22 A10 10 0 1 1 12 2 Z M8.3 8.3 h7.4 v7.4 h-7.4 Z"
        fill={`url(#${gradientId})`}
        fillRule="evenodd"
        stroke="#a16207"
        strokeWidth="1.2"
      />

      {/* Блик сверху */}
      <ellipse
        cx="9.4"
        cy="7.6"
        rx="3.6"
        ry="2"
        fill="#ffffff"
        opacity="0.32"
        mask={`url(#${maskId})`}
      />
    </svg>
  );
}
