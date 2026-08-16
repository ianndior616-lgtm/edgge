"use client";

import { useState } from "react";
import { useTelegram } from "./TelegramProvider";
import { api } from "@/lib/client-api";
import { ROLES } from "@/lib/dota";
import type { AdminUserUpdate, AdminUserView, RoleId } from "@/lib/types";

const INPUT_CLS =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--surface2)] px-3.5 py-2.5 text-sm text-[var(--text)] outline-none transition-colors placeholder:text-[var(--muted)] focus:border-[var(--accent)]";
const LABEL_CLS = "mb-1.5 block text-[13px] font-medium text-[var(--muted)]";

/** Форма редактирования анкеты пользователя (админ-панель) */
export function AdminEditForm({
  user,
  onSaved,
  onCancel,
}: {
  user: AdminUserView;
  onSaved: (user: AdminUserView) => void;
  onCancel: () => void;
}) {
  const { initData } = useTelegram();

  const [name, setName] = useState(user.name ?? "");
  const [role, setRole] = useState<RoleId | null>(user.role);
  const [lookingFor, setLookingFor] = useState<RoleId[]>(user.lookingFor);
  const [mmr, setMmr] = useState(user.mmr != null ? String(user.mmr) : "");
  const [age, setAge] = useState(user.age != null ? String(user.age) : "");
  const [link, setLink] = useState(user.profileLink ?? "");
  const [description, setDescription] = useState(user.description ?? "");
  const [isActive, setIsActive] = useState(user.isActive);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleLookingFor = (r: RoleId) =>
    setLookingFor((prev) =>
      prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r],
    );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) return setError("Укажи имя");
    if (!role) return setError("Выбери роль");
    const mmrNum = Number(mmr);
    if (!Number.isInteger(mmrNum) || mmrNum < 0 || mmrNum > 20000)
      return setError("ПТС должно быть числом от 0 до 20000");
    const ageNum = Number(age);
    if (!Number.isInteger(ageNum) || ageNum < 12 || ageNum > 80)
      return setError("Возраст должен быть от 12 до 80 лет");
    if (!/^https?:\/\/.+/i.test(link.trim()))
      return setError("Ссылка на профиль должна начинаться с http:// или https://");

    setSaving(true);
    try {
      const body: AdminUserUpdate = {
        name: name.trim(),
        role,
        lookingFor,
        mmr: mmrNum,
        age: ageNum,
        profileLink: link.trim(),
        description: description.trim(),
        isActive,
      };
      const res = await api<{ user: AdminUserView }>(
        `/api/admin/users/${user.tgId}`,
        initData,
        { method: "PUT", body },
      );
      onSaved(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border p-4" style={{ borderColor: "color-mix(in srgb, var(--accent) 35%, transparent)", background: "var(--surface)" }}>
      <div>
        <label className={LABEL_CLS} htmlFor={`ae-name-${user.tgId}`}>Имя</label>
        <input
          id={`ae-name-${user.tgId}`}
          className={INPUT_CLS}
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div>
        <span className={LABEL_CLS}>Роль</span>
        <div className="grid grid-cols-5 gap-1.5">
          {ROLES.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRole(r.id)}
              className={`rounded-lg border px-1 py-2 text-center text-[10px] font-semibold transition-all ${
                role === r.id
                  ? "border-red-500/70 bg-red-500/15 text-white"
                  : "border-[var(--border)] bg-[var(--surface2)] text-[var(--muted)]"
              }`}
            >
              {r.emoji}
              <br />
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className={LABEL_CLS}>Кого ищет</span>
        <div className="flex flex-wrap gap-1.5">
          {ROLES.map((r) => {
            const selected = lookingFor.includes(r.id);
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => toggleLookingFor(r.id)}
                className={`rounded-lg border px-2 py-1 text-[11px] font-semibold transition-all ${
                  selected
                    ? "border-red-500/70 bg-red-500/15 text-white"
                    : "border-[var(--border)] bg-[var(--surface2)] text-[var(--muted)]"
                }`}
              >
                {r.emoji} {r.label}
                {selected && " ✓"}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={LABEL_CLS} htmlFor={`ae-mmr-${user.tgId}`}>ПТС</label>
          <input
            id={`ae-mmr-${user.tgId}`}
            className={INPUT_CLS}
            type="number"
            value={mmr}
            min={0}
            max={20000}
            inputMode="numeric"
            onChange={(e) => setMmr(e.target.value)}
          />
        </div>
        <div>
          <label className={LABEL_CLS} htmlFor={`ae-age-${user.tgId}`}>Возраст</label>
          <input
            id={`ae-age-${user.tgId}`}
            className={INPUT_CLS}
            type="number"
            value={age}
            min={12}
            max={80}
            inputMode="numeric"
            onChange={(e) => setAge(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className={LABEL_CLS} htmlFor={`ae-link-${user.tgId}`}>Ссылка на профиль</label>
        <input
          id={`ae-link-${user.tgId}`}
          className={INPUT_CLS}
          value={link}
          onChange={(e) => setLink(e.target.value)}
        />
      </div>

      <div>
        <label className={LABEL_CLS} htmlFor={`ae-desc-${user.tgId}`}>
          О себе ({description.length}/300)
        </label>
        <textarea
          id={`ae-desc-${user.tgId}`}
          className={`${INPUT_CLS} resize-none`}
          rows={2}
          value={description}
          maxLength={300}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="flex items-center justify-between rounded-xl border px-3 py-2.5" style={{ borderColor: "var(--border)", background: "var(--surface2)" }}>
        <span className="text-xs font-semibold" style={{ color: "var(--text)" }}>
          Анкета видна в рекомендациях
        </span>
        <button
          type="button"
          onClick={() => setIsActive((v) => !v)}
          className="relative h-6 w-11 rounded-full transition-colors"
          style={{ background: isActive ? "var(--accent)" : "var(--border-strong)" }}
        >
          <span
            className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all"
            style={{ left: isActive ? 22 : 2 }}
          />
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-500">
          ⚠️ {error}
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-[var(--border)] bg-[var(--surface2)] px-4 py-3 text-sm font-semibold text-[var(--text)]"
        >
          Отмена
        </button>
        <button
          type="submit"
          disabled={saving}
          className="btn-cut flex-1 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-red-500/25 disabled:opacity-60"
        >
          {saving ? "Сохраняем…" : "💾 Сохранить изменения"}
        </button>
      </div>
    </form>
  );
}
