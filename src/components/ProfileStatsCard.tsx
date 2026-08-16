import type { ProfileStats, ProfileStatsPeriod } from "@/lib/types";

function number(value: number): string {
  return new Intl.NumberFormat("ru-RU").format(value);
}

export function ProfileStatsCard({
  stats,
  averageRating,
  ratingsCount,
  isVip,
}: {
  stats?: ProfileStats;
  averageRating: number | null;
  ratingsCount: number;
  isVip: boolean;
}) {
  const safeStats: ProfileStats = stats ?? {
    views: 0,
    likes: 0,
    matches: 0,
    likeRate: 0,
    vip: null,
  };
  const vipPeriods: { label: string; value: ProfileStatsPeriod }[] = safeStats.vip
    ? [
        { label: "Последние 7 дней", value: safeStats.vip.last7Days },
        { label: "Последние 30 дней", value: safeStats.vip.last30Days },
      ]
    : [];
  const items = [
    { icon: "👁", label: "Просмотры", value: number(safeStats.views) },
    { icon: "❤️", label: "Лайки", value: number(safeStats.likes) },
    { icon: "💘", label: "Мэтчи", value: number(safeStats.matches) },
    {
      icon: "⭐",
      label: "Средняя оценка",
      value: averageRating == null ? "—" : averageRating.toFixed(1),
      hint: `${number(ratingsCount)} оценок`,
    },
    {
      icon: "🎯",
      label: "Процент лайков",
      value: `${safeStats.likeRate.toFixed(1)}%`,
    },
  ];

  return (
    <section
      className="rounded-2xl border p-4 shadow-xl"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-black" style={{ color: "var(--text)" }}>
            📊 Статистика профиля
          </h2>
          <p className="mt-0.5 text-[10px]" style={{ color: "var(--dim)" }}>
            Просмотр одного игрока засчитывается один раз в день
          </p>
        </div>
        {isVip && (
          <span className="rounded-full border border-yellow-400/40 bg-yellow-400/10 px-2 py-1 text-[9px] font-black text-yellow-400">
            👑 VIP
          </span>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {items.map((item, index) => (
          <div
            key={item.label}
            className={`rounded-xl border px-3 py-2.5 ${index === items.length - 1 ? "col-span-2" : ""}`}
            style={{ background: "var(--surface2)", borderColor: "var(--border)" }}
          >
            <p className="text-[10px] font-semibold" style={{ color: "var(--muted)" }}>
              {item.icon} {item.label}
            </p>
            <div className="mt-0.5 flex items-baseline justify-between gap-2">
              <p className="text-xl font-black" style={{ color: "var(--text)" }}>
                {item.value}
              </p>
              {item.hint && (
                <span className="text-[9px]" style={{ color: "var(--dim)" }}>
                  {item.hint}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {safeStats.vip ? (
        <div className="mt-3 rounded-xl border border-yellow-400/30 bg-yellow-400/[0.06] p-3">
          <p className="text-[11px] font-black text-yellow-400">👑 VIP-аналитика</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {vipPeriods.map(({ label, value }) => (
              <div key={label} className="rounded-lg bg-black/10 px-2.5 py-2">
                <p className="text-[9px] font-bold text-yellow-300">{label}</p>
                <p className="mt-1 text-[10px]" style={{ color: "var(--muted)" }}>
                  👁 {number(value.views)} · ❤️ {number(value.likes)}
                </p>
                <p className="mt-0.5 text-sm font-black" style={{ color: "var(--text)" }}>
                  {value.likeRate.toFixed(1)}%
                </p>
                <span className="text-[8px]" style={{ color: "var(--dim)" }}>
                  конверсия в лайк
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-3 rounded-xl border border-yellow-400/20 bg-yellow-400/[0.04] px-3 py-2.5">
          <p className="text-[10px] font-bold text-yellow-400">
            👑 VIP покажет аналитику отдельно за 7 и 30 дней
          </p>
          <p className="mt-0.5 text-[9px]" style={{ color: "var(--dim)" }}>
            Просмотры, лайки и конверсия по каждому периоду
          </p>
        </div>
      )}
    </section>
  );
}
