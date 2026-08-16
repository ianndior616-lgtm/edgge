"use client";

import type { PublicProfile } from "@/lib/types";

const GRADIENTS = [
  "linear-gradient(135deg, #ef4444, #f97316)",
  "linear-gradient(135deg, #8b5cf6, #d946ef)",
  "linear-gradient(135deg, #10b981, #14b8a6)",
  "linear-gradient(135deg, #0ea5e9, #2563eb)",
  "linear-gradient(135deg, #f59e0b, #ea580c)",
];

function initialsOf(profile: Pick<PublicProfile, "name" | "firstName">): string {
  const source = profile.name?.trim() || profile.firstName || "?";
  return source.slice(0, 1).toUpperCase();
}

/**
 * Аватар игрока: сначала выбранная при регистрации аватарка,
 * затем фото из Telegram, иначе — буква имени на градиенте.
 */
export function Avatar({
  profile,
  size = 48,
}: {
  profile: Pick<
    PublicProfile,
    "name" | "firstName" | "photoUrl" | "avatarUrl" | "dotaAvatarUrl" | "tgId" | "crownUnlocked"
  >;
  size?: number;
}) {
  // Уникальный аватар короны — приоритетнее всего (7-й день стрика)
  if (profile.crownUnlocked) {
    return (
      <div
        className="flex shrink-0 items-center justify-center rounded-full"
        style={{
          width: size,
          height: size,
          fontSize: Math.round(size * 0.52),
          background:
            "linear-gradient(135deg, #a16207 0%, #facc15 45%, #fef08a 55%, #d97706 100%)",
          border: "2px solid #facc15",
          boxShadow:
            "0 0 14px rgba(250, 204, 21, 0.45), inset 0 0 8px rgba(255,255,255,0.35)",
        }}
        aria-label="Королевский аватар"
      >
        👑
      </div>
    );
  }

  // Показываем только загруженные пользователем аватарки (data URL).
  // Старые пути к удалённым пресетам игнорируются.
  const ownAvatar =
    profile.avatarUrl && profile.avatarUrl.startsWith("data:")
      ? profile.avatarUrl
      : null;

  if (ownAvatar) {
    return (
      <img
        src={ownAvatar}
        alt={profile.name ?? ""}
        width={size}
        height={size}
        className="rounded-full object-cover"
        style={{ border: "2px solid var(--border-strong)" }}
      />
    );
  }

  const fallbackAvatar = profile.dotaAvatarUrl || profile.photoUrl;

  if (fallbackAvatar) {
    return (
      <img
        src={fallbackAvatar}
        alt={profile.name ?? ""}
        width={size}
        height={size}
        className="rounded-full object-cover"
        style={{ border: "2px solid var(--border-strong)" }}
      />
    );
  }

  const gradient = GRADIENTS[Math.abs(profile.tgId) % GRADIENTS.length];
  const fontSize = Math.round(size * 0.4);

  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{
        width: size,
        height: size,
        fontSize,
        background: gradient,
        border: "2px solid var(--border-strong)",
      }}
      aria-hidden
    >
      {initialsOf(profile)}
    </div>
  );
}
