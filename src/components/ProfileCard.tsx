"use client";

import type { ReactNode } from "react";
import { Avatar } from "./Avatar";
import { useTelegram } from "./TelegramProvider";
import { bannerCss, DEFAULT_BANNER_CSS } from "@/lib/banners";
import { formatMmr, medalForMmr, roleById } from "@/lib/dota";
import type { PublicProfile } from "@/lib/types";

export function ProfileCard({
  profile,
  onContact,
  showContact = true,
  footer,
}: {
  profile: PublicProfile;
  onContact?: () => void;
  showContact?: boolean;
  footer?: ReactNode;
}) {
  const { openLink } = useTelegram();
  const role = roleById(profile.role);
  const medal = profile.mmr != null ? medalForMmr(profile.mmr) : null;

  const handleContact = () => {
    if (onContact) {
      onContact();
      return;
    }
    openLink(
      profile.username
        ? `https://t.me/${profile.username}`
        : `tg://user?id=${profile.tgId}`,
    );
  };

  const bannerImage =
    profile.banner && profile.banner.startsWith("data:")
      ? profile.banner
      : null;

  return (
    <article
      className="fade-up overflow-hidden rounded-2xl border shadow-xl"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      {/* Превью картинки карточки (как в рекомендациях) */}
      {profile.banner && (
        <div className="relative h-24 w-full overflow-hidden">
          {bannerImage ? (
            <img
              src={bannerImage}
              alt="Картинка карточки"
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div
              className="absolute inset-0"
              style={{ background: bannerCss(profile.banner) ?? DEFAULT_BANNER_CSS }}
            />
          )}
          <span className="absolute bottom-1.5 left-2 rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
            🎴 Картинка карточки
          </span>
        </div>
      )}

      {/* Шапка */}
      <div className="p-4">
      <div className="flex items-start gap-3">
        <Avatar profile={profile} size={52} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-[15px] font-bold" style={{ color: "var(--text)" }}>
              {profile.name ?? profile.firstName}
            </h3>
            {profile.age != null && (
              <span className="text-xs" style={{ color: "var(--muted)" }}>
                {profile.age}
              </span>
            )}
          </div>
          {profile.username && (
            <p className="truncate text-xs font-medium" style={{ color: "var(--accent)" }}>
              @{profile.username}
            </p>
          )}
        </div>
        {role && (
          <span
            className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${role.badge}`}
          >
            {role.emoji} {role.label}
          </span>
        )}
      </div>

      {/* ПТС */}
      <div
        className="mt-3 flex items-center gap-2 rounded-xl px-3 py-2"
        style={{ background: "var(--surface2)" }}
      >
        <span className="text-sm">🏅</span>
        <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>
          {formatMmr(profile.mmr)} ПТС
        </span>
        {medal && (
          <span className={`text-xs font-medium ${medal.tierClass}`}>
            · {medal.name}
          </span>
        )}
      </div>

      {/* Описание */}
      {profile.description && (
        <p
          className="mt-3 text-[13px] leading-relaxed"
          style={{ color: "var(--muted)" }}
        >
          {profile.description}
        </p>
      )}

      {/* Ссылка на профиль */}
      {profile.profileLink && (
        <a
          href={profile.profileLink}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex max-w-full items-center gap-1.5 truncate text-xs font-medium hover:underline"
          style={{ color: "var(--accent)" }}
          onClick={(e) => e.stopPropagation()}
        >
          🔗 {profile.profileLink.replace(/^https?:\/\//, "")}
        </a>
      )}

      {/* Действия */}
      <div className="mt-4 flex items-center gap-2">
        {showContact && (
          <button
            type="button"
            onClick={handleContact}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-red-500/20 transition-transform active:scale-95"
          >
            💬 Написать
          </button>
        )}
        {footer}
      </div>
      </div>
    </article>
  );
}
