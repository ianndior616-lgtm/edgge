"use client";

import { useRef, useState } from "react";
import { BannerPicker } from "./BannerPicker";
import { useTelegram } from "./TelegramProvider";
import { api } from "@/lib/client-api";
import { MEDALS, ROLES, formatMmr } from "@/lib/dota";
import { formatAvatar } from "@/lib/image-utils";
import type { PublicProfile, RoleId, UserWithProfile } from "@/lib/types";

const INPUT_CLS =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--surface2)] px-3.5 py-2.5 text-sm text-[var(--text)] outline-none transition-colors placeholder:text-[var(--muted)] focus:border-[var(--accent)]";
const LABEL_CLS = "mb-1.5 block text-[13px] font-medium text-[var(--muted)]";

export function OnboardingForm({
  initial,
  firstName,
  onSaved,
  onCancel,
  onNotice,
  onBack,
}: {
  initial: (PublicProfile & { lookingFor?: RoleId[] }) | null;
  firstName: string;
  onSaved: (user: UserWithProfile) => void;
  onCancel?: () => void;
  onNotice?: (msg: string) => void;
  onBack?: () => void;
}) {
  const { initData } = useTelegram();
  const [friendCode, setFriendCode] = useState("");
  const [name, setName] = useState(initial?.name ?? firstName ?? "");
  const [role, setRole] = useState<RoleId | null>(initial?.role ?? null);
  const [lookingFor, setLookingFor] = useState<RoleId[]>(initial?.lookingFor ?? []);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    initial?.avatarUrl?.startsWith("data:") ? initial.avatarUrl : null,
  );
  const [banner, setBanner] = useState<string | null>(initial?.banner ?? null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [mmr, setMmr] = useState(initial?.mmr != null ? String(initial.mmr) : "");
  const [age, setAge] = useState(initial?.age != null ? String(initial.age) : "");
  const [link, setLink] = useState(initial?.profileLink ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleLookingFor = (r: RoleId) => {
    setLookingFor((prev) =>
      prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r],
    );
    setError(null);
  };

  const mmrSliderValue = (() => {
    const n = Number(mmr);
    return Number.isFinite(n) ? Math.min(Math.max(n, 0), 12000) : 0;
  })();

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/")) return setError("Выбери JPG, PNG или WebP");
    if (file.size > 8 * 1024 * 1024) return setError("Файл слишком большой — до 8 МБ");
    setAvatarBusy(true);
    try {
      setAvatarUrl(await formatAvatar(file));
    } catch {
      setError("Не удалось обработать изображение — попробуй другой файл");
    } finally {
      setAvatarBusy(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleanName = name.trim();
    const mmrNum = Number(mmr);
    const ageNum = Number(age);

    if (!cleanName) return setError("Укажи своё имя");
    if (!role) return setError("Выбери свою роль в команде");
    if (!Number.isInteger(mmrNum) || mmrNum < 0 || mmrNum > 20000)
      return setError("Укажи свой ПТС (0 – 20000)");
    if (!Number.isInteger(ageNum) || ageNum < 12 || ageNum > 80)
      return setError("Укажи возраст (от 12 до 80 лет)");
    if (!/^https?:\/\/.+/i.test(link.trim()))
      return setError("Укажи ссылку Steam / Dotabuff / Stratz, начиная с https://");

    const friend = friendCode.trim().toUpperCase();
    const body = {
      name: cleanName,
      role,
      // Предпочтения можно менять в любой момент и можно очистить полностью.
      // На рекомендации они больше не влияют — там показываются все роли.
      lookingFor,
      avatarUrl,
      banner,
      mmr: mmrNum,
      age: ageNum,
      profileLink: link.trim(),
      description: description.trim(),
      isActive: true,
      ...(!initial && friend ? { referralCode: friend } : {}),
    };

    setSaving(true);
    try {
      const user = await api<UserWithProfile>("/api/profile", initData, {
        method: "PUT",
        body,
      });
      onSaved(user);
      if (!initial && friend) {
        onNotice?.("🎟️ Код друга привязан. Реферал засчитается после 7 активных дней.");
      }
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {onBack && (
        <button type="button" onClick={onBack} className="mb-1 text-xs font-semibold" style={{ color: "var(--muted)" }}>
          ← Назад
        </button>
      )}

      <div>
        <span className={LABEL_CLS}>Фото анкеты</span>
        <div className="flex items-center gap-3">
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full text-2xl font-bold"
            style={{ border: avatarUrl || initial?.photoUrl ? "2px solid var(--accent)" : "2px dashed var(--border-strong)", background: "var(--surface2)", color: "var(--muted)" }}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="Моя аватарка" className="h-full w-full object-cover" />
            ) : initial?.photoUrl ? (
              <img src={initial.photoUrl} alt="Фото из Telegram" className="h-full w-full object-cover" />
            ) : (
              (name.trim() || "?").slice(0, 1).toUpperCase()
            )}
          </div>
          <div className="min-w-0 flex-1">
            <button type="button" onClick={() => fileRef.current?.click()} disabled={avatarBusy} className="w-full rounded-xl border px-3.5 py-2.5 text-sm font-semibold disabled:opacity-60" style={{ borderColor: "var(--border)", background: "var(--surface2)", color: "var(--text)" }}>
              {avatarBusy ? "⏳ Обрабатываем…" : avatarUrl ? "📁 Заменить фото" : "📁 Загрузить фото"}
            </button>
            {(avatarUrl || initial?.photoUrl) && (
              <button type="button" onClick={() => setAvatarUrl(null)} className="mt-1.5 w-full rounded-xl border px-3.5 py-2 text-xs font-semibold" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
                ✕ Убрать своё фото
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarFile} />
        </div>
      </div>

      <div>
        <span className={LABEL_CLS}>Фон карточки</span>
        <BannerPicker value={banner} onChange={setBanner} />
      </div>

      {!initial && (
        <div>
          <label className={LABEL_CLS} htmlFor="pf-friend">🎟️ Код друга <span className="opacity-60">(необязательно)</span></label>
          <input id="pf-friend" className={`${INPUT_CLS} uppercase`} placeholder="VV-XXXXXX" value={friendCode} maxLength={9} onChange={(e) => setFriendCode(e.target.value)} />
          <p className="mt-1.5 text-xs" style={{ color: "var(--dim)" }}>
            Код привяжется сразу, но реферал станет активным только после 7 активных дней.
          </p>
        </div>
      )}

      <div>
        <label className={LABEL_CLS} htmlFor="pf-name">Имя</label>
        <input id="pf-name" className={INPUT_CLS} placeholder="Как тебя зовут?" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
      </div>

      <div>
        <span className={LABEL_CLS}>Твоя роль</span>
        <div className="grid grid-cols-5 gap-2">
          {ROLES.map((r) => (
            <button key={r.id} type="button" onClick={() => setRole(r.id)} className={`flex flex-col items-center gap-1 rounded-xl border px-1 py-2.5 ${role === r.id ? "border-red-500/70 bg-red-500/15" : "border-[var(--border)] bg-[var(--surface2)]"}`}>
              <span className="text-lg">{r.emoji}</span><span className="text-[10px] font-semibold" style={{ color: role === r.id ? "var(--text)" : "var(--muted)" }}>{r.label}</span>
            </button>
          ))}
        </div>
        {initial && (
          <p className="mt-1.5 text-xs" style={{ color: "var(--dim)" }}>
            Роль можно менять сколько угодно — изменения сразу попадут в твою анкету.
          </p>
        )}
      </div>

      <div>
        <span className={LABEL_CLS}>Кого ищешь? <span className="opacity-60">(необязательно)</span></span>
        <div className="flex flex-wrap gap-2">
          {ROLES.map((r) => {
            const selected = lookingFor.includes(r.id);
            return (
              <button key={r.id} type="button" onClick={() => toggleLookingFor(r.id)} className={`rounded-xl border px-3 py-2 text-xs font-semibold ${selected ? "border-red-500/70 bg-red-500/15 text-white" : "border-[var(--border)] bg-[var(--surface2)] text-[var(--muted)]"}`}>
                {r.emoji} {r.label}{selected ? " ✓" : ""}
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-xs" style={{ color: "var(--dim)" }}>
          Это только предпочтение в профиле. В ленте тебе показываются игроки всех ролей.
        </p>
      </div>

      <div>
        <label className={LABEL_CLS} htmlFor="pf-mmr">ПТС (MMR) {mmr ? <span className="opacity-70">— {formatMmr(Number(mmr) || 0)}</span> : null}</label>
        <input id="pf-mmr" type="range" min={0} max={12000} step={50} value={mmrSliderValue} onChange={(e) => setMmr(e.target.value)} className="w-full accent-red-500" />
        <div className="mt-2 flex gap-2">
          <input type="number" className={INPUT_CLS} placeholder="Например: 3500" value={mmr} min={0} max={20000} onChange={(e) => setMmr(e.target.value)} />
          <div className="flex w-40 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface2)] text-xs text-[var(--muted)]">{medalHint(mmrSliderValue)}</div>
        </div>
        <p className="mt-1.5 text-xs" style={{ color: "var(--dim)" }}>
          MMR задаёшь и меняешь ты сам. Рекомендации показывают игроков в диапазоне ±2000 ПТС.
        </p>
      </div>

      <div>
        <label className={LABEL_CLS} htmlFor="pf-age">Возраст</label>
        <input id="pf-age" type="number" className={INPUT_CLS} placeholder="Например: 22" value={age} min={12} max={80} onChange={(e) => setAge(e.target.value)} />
      </div>

      <div>
        <label className={LABEL_CLS} htmlFor="pf-link">Ссылка Steam / Dotabuff / Stratz</label>
        <input id="pf-link" className={INPUT_CLS} placeholder="https://www.dotabuff.com/players/…" value={link} onChange={(e) => setLink(e.target.value)} />
        <p className="mt-1.5 text-xs" style={{ color: "var(--dim)" }}>Это просто ссылка для проверки профиля. Мы не заменяем ей твои имя, фото, MMR или ранг.</p>
      </div>

      <div>
        <label className={LABEL_CLS} htmlFor="pf-desc">О себе <span className="opacity-60">({description.length}/300)</span></label>
        <textarea id="pf-desc" className={`${INPUT_CLS} resize-none`} rows={3} placeholder="Когда играешь, кого ищешь, стиль игры…" value={description} maxLength={300} onChange={(e) => setDescription(e.target.value)} />
      </div>

      {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-500">⚠️ {error}</div>}

      <div className="flex gap-2 pt-1">
        {onCancel && <button type="button" onClick={onCancel} className="rounded-xl border border-[var(--border)] bg-[var(--surface2)] px-4 py-3 text-sm font-semibold text-[var(--text)]">Отмена</button>}
        <button type="submit" disabled={saving} className="btn-cut flex-1 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 px-4 py-3 text-sm font-bold text-white disabled:opacity-60">
          {saving ? "Сохраняем…" : initial ? "💾 Сохранить изменения" : "🚀 Создать анкету"}
        </button>
      </div>
    </form>
  );
}

function medalHint(mmr: number): string {
  let medal = MEDALS[0];
  for (const m of MEDALS) if (mmr >= m.min) medal = m;
  return `🏅 ${medal.name}`;
}

function isNetworkError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : "";
  return /failed to fetch|networkerror|load failed|network request failed|timeout/i.test(msg);
}

function friendlyError(err: unknown): string {
  if (isNetworkError(err)) return "Проблема с сетью — данные не отправились. Попробуй ещё раз.";
  return err instanceof Error && err.message ? err.message : "Не удалось сохранить анкету";
}
