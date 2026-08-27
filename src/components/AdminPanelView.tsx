"use client";

import { useEffect, useState } from "react";
import { AdminEditForm } from "./AdminEditForm";
import { Avatar } from "./Avatar";
import { CoinIcon } from "./CoinIcon";
import { useTelegram } from "./TelegramProvider";
import { api } from "@/lib/client-api";
import { formatMmr, roleById } from "@/lib/dota";
import { genderLabel } from "@/lib/gender";
import { reportReasonLabel } from "@/lib/report-reasons";
import type { AdminReportsResponse, AdminUsersResponse, AdminUserView, ReportView } from "@/lib/types";

const INPUT_CLS =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--surface2)] px-3.5 py-2.5 text-sm text-[var(--text)] outline-none transition-colors placeholder:text-[var(--muted)] focus:border-[var(--accent)]";

/** Админская панель: поиск, редактирование, скрытие и блокировка анкет. */
export function AdminPanelView() {
  const { initData } = useTelegram();
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<AdminUserView[]>([]);
  const [reportsList, setReportsList] = useState<ReportView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [banConfirmId, setBanConfirmId] = useState<number | null>(null);
  const [actionBusyTgId, setActionBusyTgId] = useState<number | null>(null);

  const load = async (query: string) => {
    setLoading(true);
    try {
      const [data, reportsData] = await Promise.all([
        api<AdminUsersResponse>(
          `/api/admin/users?q=${encodeURIComponent(query)}`,
          initData,
        ),
        api<AdminReportsResponse>("/api/admin/reports", initData),
      ]);
      setUsers(data.users);
      setReportsList(reportsData.reports);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Не удалось загрузить пользователей",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void load(q), 300);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, initData]);

  const toggleActive = async (u: AdminUserView) => {
    if (u.isBanned || actionBusyTgId === u.tgId) return;
    setActionBusyTgId(u.tgId);
    try {
      const res = await api<{ user: AdminUserView }>(
        `/api/admin/users/${u.tgId}`,
        initData,
        { method: "PUT", body: { isActive: !u.isActive } },
      );
      setUsers((prev) =>
        prev.map((x) => (x.tgId === u.tgId ? res.user : x)),
      );
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось изменить видимость");
    } finally {
      setActionBusyTgId(null);
    }
  };

  const toggleBan = async (u: AdminUserView) => {
    if (actionBusyTgId === u.tgId) return;

    // Блокировка — разрушительное действие, поэтому просим второй тап.
    if (!u.isBanned && banConfirmId !== u.tgId) {
      setBanConfirmId(u.tgId);
      window.setTimeout(
        () => setBanConfirmId((id) => (id === u.tgId ? null : id)),
        3500,
      );
      return;
    }

    setActionBusyTgId(u.tgId);
    setBanConfirmId(null);
    try {
      const res = await api<{ user: AdminUserView }>(
        `/api/admin/users/${u.tgId}`,
        initData,
        { method: "PUT", body: { isBanned: !u.isBanned } },
      );
      setUsers((prev) =>
        prev.map((x) => (x.tgId === u.tgId ? res.user : x)),
      );
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось изменить блокировку");
    } finally {
      setActionBusyTgId(null);
    }
  };

  /** Ручная выдача арканы (50 качественных рефералов) */
  const grantArcana = async (u: AdminUserView) => {
    try {
      const res = await api<{ user: AdminUserView }>(
        `/api/admin/users/${u.tgId}`,
        initData,
        { method: "PUT", body: { arcanaIssued: true } },
      );
      setUsers((prev) =>
        prev.map((x) => (x.tgId === u.tgId ? res.user : x)),
      );
    } catch {
      // ignore
    }
  };

  return (
    <div className="mx-auto w-full max-w-md px-4 pb-28 pt-5">
      <h1 className="font-display fade-up mb-1 text-xl font-extrabold" style={{ color: "var(--text)" }}>
        🛡️ Админская панель
      </h1>
      <p className="mb-4 text-xs" style={{ color: "var(--muted)" }}>
        Все зарегистрированные пользователи: поиск, редактирование, скрытие и блокировка.
      </p>

      {/* Поиск */}
      <input
        className={`${INPUT_CLS} mb-3`}
        placeholder="🔍 Поиск по имени или @username…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      {!loading && !error && (
        <div className="mb-3 space-y-2">
          <SummaryBlock
            title="🟢 Активные сейчас"
            items={users.filter((u) => u.online).map((u) => u.name ?? u.firstName)}
            empty="Сейчас никого онлайн нет"
          />
          <SummaryBlock
            title="🛡️ Админы"
            items={users.filter((u) => u.isAdmin).map((u) => u.name ?? u.firstName)}
            empty="Админов в списке нет"
          />
          <ReportsBlock reports={reportsList} />
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center gap-3 py-14" style={{ color: "var(--muted)" }}>
          <div
            className="h-8 w-8 animate-spin rounded-full border-2"
            style={{ borderColor: "var(--border-strong)", borderTopColor: "var(--accent)" }}
          />
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">
          ⚠️ {error}
        </div>
      ) : users.length === 0 ? (
        <div
          className="rounded-2xl border border-dashed px-6 py-12 text-center"
          style={{ borderColor: "var(--border)", color: "var(--muted)" }}
        >
          <div className="text-4xl">🔎</div>
          <p className="mt-2 text-sm">Никого не нашли по запросу «{q}»</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          <p className="text-xs" style={{ color: "var(--dim)" }}>
            Показано: {users.length}
          </p>
          {users.map((u) => {
            const expanded = expandedId === u.id;
            const editing = editingId === u.id;
            const role = roleById(u.role);
            const actionBusy = actionBusyTgId === u.tgId;
            return (
              <div
                key={u.id}
                className="card rounded-2xl p-3.5"
              >
                {/* Строка пользователя */}
                <button
                  type="button"
                  onClick={() => {
                    setExpandedId(expanded ? null : u.id);
                    setEditingId(null);
                  }}
                  className="flex w-full items-center gap-3 text-left"
                >
                  <Avatar profile={u} size={46} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-bold" style={{ color: "var(--text)" }}>
                        {u.name ?? u.firstName}
                      </span>
                      {u.age != null && (
                        <span className="text-xs" style={{ color: "var(--muted)" }}>
                          {u.age}
                        </span>
                      )}
                      {u.gender && (
                        <span className="text-[10px]" style={{ color: "var(--muted)" }}>
                          {u.gender === "male" ? "♂" : "♀"}
                        </span>
                      )}
                      {role && (
                        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${role.badge}`}>
                          {role.emoji} {role.label}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs" style={{ color: "var(--muted)" }}>
                      @{u.username ?? "—"}
                      {u.mmr != null && <> · 🏅 {formatMmr(u.mmr)} ПТС</>}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                      style={{
                        background: u.isActive ? "var(--accent-soft)" : "var(--surface2)",
                        color: u.isActive ? "var(--accent)" : "var(--dim)",
                        border: `1px solid ${u.isActive ? "color-mix(in srgb, var(--accent) 40%, transparent)" : "var(--border)"}`,
                      }}
                    >
                      {u.isActive ? "Активна" : "Скрыта"}
                    </span>
                    {u.isBanned && (
                      <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-bold text-red-400">
                        🚫 Забанена
                      </span>
                    )}
                    {u.isAdmin && (
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-400">
                        🛡️ Админ
                      </span>
                    )}
                    <span className="text-[10px]" style={{ color: "var(--dim)" }}>
                      {expanded ? "▲" : "▼"}
                    </span>
                  </div>
                </button>

                {/* Полная информация */}
                {expanded && !editing && (
                  <div className="mt-3 space-y-2 border-t pt-3" style={{ borderColor: "var(--border)" }}>
                    <InfoRow label="Telegram ID" value={String(u.tgId)} />
                    <InfoRow label="Имя" value={u.name ?? "—"} />
                    <InfoRow label="Пол" value={genderLabel(u.gender)} />
                    {u.lastName && <InfoRow label="Фамилия" value={u.lastName} />}
                    <InfoRow label="Username" value={`@${u.username ?? "нет"}`} />
                    <InfoRow
                      label="Модерация"
                      value={u.isBanned ? "🚫 анкета заблокирована" : "✅ без ограничений"}
                    />
                    <InfoRow
                      label="Баланс"
                      value={
                        <span className="inline-flex items-center gap-1">
                          <CoinIcon size={11} /> {u.currency}
                        </span>
                      }
                    />
                    <InfoRow label="Стрик" value={`🔥 ${u.streakDays} дн.`} />
                    <InfoRow label="Корона" value={u.crownUnlocked ? "👑 открыта" : "нет"} />
                    <InfoRow
                      label="Код реферала"
                      value={u.referralCode ?? "—"}
                    />
                    <InfoRow
                      label="Привёл рефералов"
                      value={String(u.referralCount)}
                    />
                    <InfoRow
                      label="Качеств. рефералы (аркана)"
                      value={`${u.qualifiedReferralCount}/50`}
                    />
                    <InfoRow label="Сейчас онлайн" value={u.online ? "да" : "нет"} />
                    <InfoRow
                      label="Жалоб"
                      value={String(u.reportCount)}
                    />
                    <InfoRow
                      label="Оценка тиммейта"
                      value={
                        u.averageRating == null
                          ? "нет оценок"
                          : `${u.averageRating.toFixed(1)}★ (${u.ratingsCount})`
                      }
                    />
                    <InfoRow
                      label="Фото Telegram"
                      value={u.photoUrl ? "есть" : "нет"}
                    />
                    <InfoRow
                      label="Своя аватарка"
                      value={u.avatarUrl?.startsWith("data:") ? "загружена" : "нет"}
                    />
                    <InfoRow
                      label="Зарегистрирован"
                      value={u.createdAt ? fmtDateTime(u.createdAt) : "—"}
                    />
                    <InfoRow
                      label="Анкета заполнена"
                      value={u.onboardedAt ? fmtDateTime(u.onboardedAt) : "не завершена"}
                    />
                    <InfoRow
                      label="Обновлён"
                      value={u.updatedAt ? fmtDateTime(u.updatedAt) : "—"}
                    />
                    {u.lookingFor.length > 0 && (
                      <div>
                        <p className="text-[11px] font-semibold" style={{ color: "var(--dim)" }}>
                          Кого ищет:
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {u.lookingFor.map((id) => {
                            const r = roleById(id);
                            return r ? (
                              <span
                                key={id}
                                className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${r.badge}`}
                              >
                                {r.emoji} {r.label}
                              </span>
                            ) : null;
                          })}
                        </div>
                      </div>
                    )}
                    {u.description && (
                      <p className="text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
                        📝 {u.description}
                      </p>
                    )}
                    {u.profileLink && (
                      <a
                        href={u.profileLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex max-w-full items-center gap-1 truncate text-xs hover:underline"
                        style={{ color: "var(--accent)" }}
                      >
                        🔗 {u.profileLink.replace(/^https?:\/\//, "")}
                      </a>
                    )}

                    {/* Аркана за 50 активных рефералов со стриком 7+ дней — выдача вручную */}
                    {u.arcanaIssued ? (
                      <div
                        className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold"
                        style={{
                          background: "rgba(250, 204, 21, 0.12)",
                          border: "1px solid rgba(250, 204, 21, 0.4)",
                          color: "#eab308",
                        }}
                      >
                        🛡️ Аркана выдана
                      </div>
                    ) : u.qualifiedReferralCount >= 50 ? (
                      <button
                        type="button"
                        onClick={() => void grantArcana(u)}
                        className="btn-cut w-full rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 px-3 py-2.5 text-xs font-black text-white shadow-lg shadow-amber-500/25 transition-transform active:scale-[0.98]"
                      >
                        🛡️ Выдать аркану (50 активных рефералов)
                      </button>
                    ) : null}

                    {u.isBanned && (
                      <p
                        className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] leading-relaxed text-red-400"
                      >
                        Блокировка скрывает анкету, отключает действия в приложении и убирает её из старых мэтчей.
                      </p>
                    )}

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        disabled={actionBusy}
                        onClick={() => {
                          setEditingId(u.id);
                          setExpandedId(null);
                        }}
                        className="rounded-xl border px-3 py-2 text-xs font-semibold transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-60"
                        style={{ borderColor: "var(--border)", background: "var(--surface2)", color: "var(--text)" }}
                      >
                        ✏️ Редактировать
                      </button>
                      <button
                        type="button"
                        disabled={u.isBanned || actionBusy}
                        onClick={() => void toggleActive(u)}
                        className="rounded-xl border px-3 py-2 text-xs font-semibold transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-60"
                        style={{
                          borderColor: u.isActive ? "color-mix(in srgb, var(--accent) 40%, transparent)" : "var(--border)",
                          background: u.isActive ? "var(--accent-soft)" : "var(--surface2)",
                          color: u.isActive ? "var(--accent)" : "var(--text)",
                        }}
                      >
                        {u.isBanned
                          ? "🚫 Заблокирована"
                          : u.isActive
                            ? "🙈 Скрыть"
                            : "👀 Показать"}
                      </button>
                      <button
                        type="button"
                        disabled={actionBusy}
                        onClick={() => void toggleBan(u)}
                        className="col-span-2 rounded-xl border px-3 py-2.5 text-xs font-black transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-60"
                        style={{
                          borderColor: u.isBanned ? "rgba(16, 185, 129, 0.45)" : "rgba(239, 68, 68, 0.45)",
                          background: u.isBanned ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)",
                          color: u.isBanned ? "#34d399" : "#f87171",
                        }}
                      >
                        {actionBusy
                          ? "Обновляем…"
                          : u.isBanned
                            ? "✅ Разбанить анкету"
                            : banConfirmId === u.tgId
                              ? "⚠️ Подтвердить блокировку"
                              : "🚫 Забанить анкету"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Редактирование */}
                {editing && (
                  <div className="mt-3 border-t pt-3" style={{ borderColor: "var(--border)" }}>
                    <AdminEditForm
                      user={u}
                      onCancel={() => setEditingId(null)}
                      onSaved={(updated) => {
                        setUsers((prev) =>
                          prev.map((x) => (x.tgId === updated.tgId ? updated : x)),
                        );
                        setEditingId(null);
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: import("react").ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="shrink-0 text-[11px] font-semibold" style={{ color: "var(--dim)" }}>
        {label}:
      </span>
      <span className="truncate text-xs" style={{ color: "var(--text)" }}>
        {value}
      </span>
    </div>
  );
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SummaryBlock({
  title,
  items,
  empty,
}: {
  title: string;
  items: string[];
  empty: string;
}) {
  return (
    <div className="card rounded-2xl p-3">
      <p className="text-xs font-black" style={{ color: "var(--text)" }}>
        {title}
      </p>
      {items.length > 0 ? (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {items.slice(0, 12).map((x) => (
            <span
              key={x}
              className="rounded-full border px-2 py-0.5 text-[10px] font-semibold"
              style={{
                borderColor: "var(--border)",
                background: "var(--surface2)",
                color: "var(--muted)",
              }}
            >
              {x}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-1 text-[11px]" style={{ color: "var(--dim)" }}>
          {empty}
        </p>
      )}
    </div>
  );
}

function ReportsBlock({ reports }: { reports: ReportView[] }) {
  return (
    <div className="card rounded-2xl p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-black" style={{ color: "var(--text)" }}>
          🚩 Жалобы
        </p>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-bold"
          style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
        >
          {reports.length}
        </span>
      </div>
      {reports.length === 0 ? (
        <p className="mt-1 text-[11px]" style={{ color: "var(--dim)" }}>
          Открытых жалоб нет
        </p>
      ) : (
        <div className="mt-2 space-y-1.5">
          {reports.slice(0, 5).map((r) => (
            <div
              key={r.id}
              className="rounded-xl border px-2.5 py-2"
              style={{ borderColor: "var(--border)", background: "var(--surface2)" }}
            >
              <p className="text-[11px] font-bold" style={{ color: "var(--text)" }}>
                {r.reported.name ?? r.reported.firstName} · {reportReasonLabel(r.reason)}
              </p>
              <p className="text-[10px]" style={{ color: "var(--dim)" }}>
                Жалоба от: {r.reporter?.name ?? r.reporter?.firstName ?? "неизвестно"} · {fmtDateTime(r.createdAt)}
              </p>
            </div>
          ))}
          {reports.length > 5 && (
            <p className="text-[10px]" style={{ color: "var(--dim)" }}>
              + ещё {reports.length - 5} жалоб в списке
            </p>
          )}
        </div>
      )}
    </div>
  );
}
