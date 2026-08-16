"use client";

import { useRef, useState } from "react";
import { BannerPicker } from "./BannerPicker";
import { useTelegram } from "./TelegramProvider";
import { api } from "@/lib/client-api";
import { MEDALS, ROLES, formatMmr } from "@/lib/dota";
import { formatAvatar } from "@/lib/image-utils";
import type {
  DotaProfileImportResponse,
  PublicProfile,
  RoleId,
  UserWithProfile,
} from "@/lib/types";

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
  /** Дополнительное уведомление (например, «аватарку не удалось сохранить») */
  onNotice?: (msg: string) => void;
  /** Назад к приветственному экрану */
  onBack?: () => void;
}) {
  const { initData } = useTelegram();

  const [friendCode, setFriendCode] = useState("");
  const [name, setName] = useState(initial?.name ?? firstName ?? "");
  const nameEditedRef = useRef(Boolean(initial?.name));
  const [role, setRole] = useState<RoleId | null>(initial?.role ?? null);
  const [lookingFor, setLookingFor] = useState<RoleId[]>(
    initial?.lookingFor ?? [],
  );
  // Своя загруженная аватарка (data URL). Если её нет — используется
  // фото из Telegram (photoUrl) или буква имени.
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    initial?.avatarUrl?.startsWith("data:") ? initial.avatarUrl : null,
  );
  // Картинка карточки рекомендаций: своё изображение или палитра
  const [banner, setBanner] = useState<string | null>(initial?.banner ?? null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [mmr, setMmr] = useState<string>(
    initial?.mmr != null ? String(initial.mmr) : "",
  );
  const mmrEditedRef = useRef(initial?.mmr != null);
  const [dotaAvatarPreview, setDotaAvatarPreview] = useState<string | null>(
    initial?.dotaAvatarUrl ?? null,
  );
  const lastDotaLookupRef = useRef("");
  const lastDotaDataRef = useRef<DotaProfileImportResponse["profile"] | null>(null);
  const [age, setAge] = useState<string>(
    initial?.age != null ? String(initial.age) : "",
  );
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

  /** Выбор файла с устройства: читаем, обрезаем по центру, сжимаем */
  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);

    if (!file.type.startsWith("image/")) {
      setError("Выбери файл изображения (JPG, PNG, WebP)");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("Файл слишком большой — до 8 МБ");
      return;
    }

    setAvatarBusy(true);
    try {
      const dataUrl = await formatAvatar(file);
      setAvatarUrl(dataUrl);
    } catch {
      setError(
        "Не удалось обработать изображение — попробуй другой файл (JPG/PNG)",
      );
    } finally {
      setAvatarBusy(false);
    }
  };

  const tryAutoloadDotaProfile = async () => {
    const value = link.trim();
    if (!/^https?:\/\/.+/i.test(value)) return null;
    if (value === lastDotaLookupRef.current && lastDotaDataRef.current) {
      return lastDotaDataRef.current;
    }
    lastDotaLookupRef.current = value;

    try {
      const result = await api<DotaProfileImportResponse>(
        "/api/dota/profile",
        initData,
        { method: "POST", body: { profile: value } },
      );
      const dota = result.profile;
      lastDotaDataRef.current = dota;

      // Не перетираем то, что пользователь уже специально изменил сам.
      if (!nameEditedRef.current && dota.personaName) setName(dota.personaName);
      if (!mmrEditedRef.current && dota.mmrEstimate != null) {
        setMmr(String(dota.mmrEstimate));
      }
      if (!avatarUrl && dota.avatarUrl) setDotaAvatarPreview(dota.avatarUrl);

      onNotice?.(
        dota.mmrEstimate != null
          ? "✅ Dota-профиль найден: ник, аватар и доступная статистика подгружены"
          : "✅ Dota-профиль найден: ник, аватар и доступная статистика подгружены. Точный MMR укажи вручную",
      );
      return dota;
    } catch {
      // Автозагрузка — дополнительная функция. Ошибка внешнего API не должна
      // мешать пользователю заполнить анкету вручную.
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!role) return setError("Выбери свою роль в команде");
    if (lookingFor.length === 0)
      return setError("Выбери хотя бы одну роль, которую ищешь в тиммейты");
    const ageNum = Number(age);
    if (!Number.isInteger(ageNum) || ageNum < 12 || ageNum > 80)
      return setError("Укажи возраст (от 12 до 80 лет)");
    if (!/^https?:\/\/.+/i.test(link.trim()))
      return setError(
        "Укажи ссылку на профиль (Steam / Dotabuff / Stratz), начиная с http:// или https://",
      );

    let effectiveName = name.trim();
    let mmrNum = mmr.trim() === "" ? Number.NaN : Number(mmr);
    if (
      !effectiveName ||
      !Number.isInteger(mmrNum) ||
      mmrNum < 0 ||
      mmrNum > 20000
    ) {
      const dota = await tryAutoloadDotaProfile();
      if (!effectiveName && dota?.personaName) effectiveName = dota.personaName;
      if (
        (!Number.isInteger(mmrNum) || mmrNum < 0 || mmrNum > 20000) &&
        dota?.mmrEstimate != null
      ) {
        mmrNum = dota.mmrEstimate;
      }
    }

    if (!effectiveName) return setError("Укажи своё имя");
    if (!Number.isInteger(mmrNum) || mmrNum < 0 || mmrNum > 20000)
      return setError("Укажи свой ПТС (0 – 20000)");

    const friend = friendCode.trim().toUpperCase();
    const baseBody = {
      name: effectiveName,
      role,
      lookingFor,
      avatarUrl,
      banner,
      mmr: mmrNum,
      age: ageNum,
      profileLink: link.trim(),
      description: description.trim(),
      isActive: true,
      ...(friend ? { referralCode: friend } : {}),
    };

    setSaving(true);
    try {
      // Первая попытка — с аватаркой
      try {
        const user = await api<UserWithProfile>("/api/profile", initData, {
          method: "PUT",
          body: baseBody,
        });
        onSaved(user);
        if (friend) {
          onNotice?.("🎟️ Код друга применён — теперь он получает 10% от твоих наград");
        }
        return;
      } catch (err) {
        // Если это сетевая ошибка и есть аватарка или картинка карточки —
        // пробуем сохранить анкету БЕЗ них, чтобы регистрация точно прошла
        if (!avatarUrl && !banner) throw err;
        if (!isNetworkError(err)) throw err;
      }

      const user = await api<UserWithProfile>("/api/profile", initData, {
        method: "PUT",
        body: { ...baseBody, avatarUrl: null, banner: null },
      });
      onSaved(user);
      onNotice?.(
        "Анкета сохранена, но картинки не удалось отправить — добавь их позже в профиле",
      );
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Выбор типа регистрации (назад) */}
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="mb-1 text-xs font-semibold transition-opacity hover:opacity-70"
          style={{ color: "var(--muted)" }}
        >
          ← Выбрать другой тип регистрации
        </button>
      )}

      {/* Аватар */}
      <div>
        <span className={LABEL_CLS}>Аватарка</span>
        <div className="flex items-center gap-3">
          {/* Превью */}
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full text-2xl font-bold"
            style={{
              border:
                avatarUrl || dotaAvatarPreview || initial?.photoUrl
                  ? "2px solid var(--accent)"
                  : "2px dashed var(--border-strong)",
              background: "var(--surface2)",
              color: "var(--muted)",
            }}
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Моя аватарка"
                className="h-full w-full object-cover"
              />
            ) : dotaAvatarPreview ? (
              <img
                src={dotaAvatarPreview}
                alt="Аватар Dota-профиля"
                className="h-full w-full object-cover"
              />
            ) : initial?.photoUrl ? (
              <img
                src={initial.photoUrl}
                alt="Фото из Telegram"
                className="h-full w-full object-cover"
              />
            ) : (
              initialsOf(name)
            )}
          </div>

          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={avatarBusy}
              className="w-full rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-60"
              style={{
                borderColor: "var(--border)",
                background: "var(--surface2)",
                color: "var(--text)",
              }}
            >
              {avatarBusy
                ? "⏳ Обрабатываем…"
                : avatarUrl
                  ? "📁 Заменить фото"
                  : "📁 Загрузить фото"}
            </button>
            {(avatarUrl || initial?.photoUrl) && (
              <button
                type="button"
                onClick={() => setAvatarUrl(null)}
                className="mt-1.5 w-full rounded-xl border px-3.5 py-2 text-xs font-semibold transition-all"
                style={{
                  borderColor: "var(--border)",
                  background: "transparent",
                  color: "var(--muted)",
                }}
              >
                ✕ Убрать фото
              </button>
            )}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarFile}
          />
        </div>
        <p className="mt-1.5 text-xs" style={{ color: "var(--dim)", opacity: 0.85 }}>
          Загрузи своё фото — оно автоматически обрежется по центру до квадрата.
          {initial?.photoUrl && !avatarUrl && " Сейчас стоит фото из Telegram."}
        </p>
      </div>

      {/* Картинка карточки */}
      <div>
        <span className={LABEL_CLS}>
          Картинка карточки{" "}
          <span className="opacity-60">(верх карточки в рекомендациях)</span>
        </span>
        <BannerPicker
          value={banner}
          onChange={(v) => {
            setBanner(v);
            setError(null);
          }}
        />
        <p className="mt-1.5 text-xs" style={{ color: "var(--dim)", opacity: 0.85 }}>
          Можно загрузить свою картинку или выбрать готовый градиент. Если
          ничего не выбрать — будет цвет твоей роли.
        </p>
      </div>

      {/* Код друга */}
      <div>
        <label className={LABEL_CLS} htmlFor="pf-friend">
          🎟️ Код друга{" "}
          <span className="opacity-60">(если есть, необязательно)</span>
        </label>
        <input
          id="pf-friend"
          className={`${INPUT_CLS} uppercase`}
          placeholder="VV-XXXXXX"
          value={friendCode}
          maxLength={9}
          autoComplete="off"
          onChange={(e) => setFriendCode(e.target.value)}
        />
        <p className="mt-1.5 text-xs" style={{ color: "var(--dim)", opacity: 0.85 }}>
          Друг получит 10% от каждой твоей награды в валюте.
        </p>
      </div>

      {/* Имя */}
      <div>
        <label className={LABEL_CLS} htmlFor="pf-name">
          Имя
        </label>
        <input
          id="pf-name"
          className={INPUT_CLS}
          placeholder="Как тебя зовут?"
          value={name}
          maxLength={40}
          onChange={(e) => {
            nameEditedRef.current = true;
            setName(e.target.value);
          }}
        />
      </div>

      {/* Моя роль */}
      <div>
        <span className={LABEL_CLS}>Твоя роль в команде</span>
        <div className="grid grid-cols-5 gap-2">
          {ROLES.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRole(r.id)}
              className={`flex flex-col items-center gap-1 rounded-xl border px-1 py-2.5 text-center transition-all ${
                role === r.id
                  ? "border-red-500/70 bg-red-500/15 shadow-lg shadow-red-500/10"
                  : "border-[var(--border)] bg-[var(--surface2)] hover:opacity-80"
              }`}
            >
              <span className="text-lg leading-none">{r.emoji}</span>
              <span
                className={`text-[10px] font-semibold leading-tight ${
                  role === r.id ? "text-white" : "text-[var(--muted)]"
                }`}
              >
                {r.label}
              </span>
            </button>
          ))}
        </div>
        {role && (
          <p className="mt-1.5 text-xs" style={{ color: "var(--muted)" }}>
            {roleDesc(role)}
          </p>
        )}
      </div>

      {/* Кого ищу */}
      <div>
        <span className={LABEL_CLS}>
          Кого ищешь в тиммейты?{" "}
          <span className="opacity-60">(можно несколько)</span>
        </span>
        <div className="flex flex-wrap gap-2">
          {ROLES.map((r) => {
            const selected = lookingFor.includes(r.id);
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => toggleLookingFor(r.id)}
                className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${
                  selected
                    ? "border-red-500/70 bg-red-500/15 text-white shadow-lg shadow-red-500/10"
                    : "border-[var(--border)] bg-[var(--surface2)] text-[var(--muted)]"
                }`}
              >
                {r.emoji} {r.label}
                {selected && <span className="ml-1">✓</span>}
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-xs" style={{ color: "var(--dim)", opacity: 0.8 }}>
          🔒 Другие не увидят, кого ты ищешь — это влияет только на подборку.
        </p>
      </div>

      {/* ПТС */}
      <div>
        <label className={LABEL_CLS} htmlFor="pf-mmr">
          ПТС (MMR){" "}
          {mmrSliderValue > 0 && (
            <span className="opacity-70">— {formatMmr(mmrSliderValue)}</span>
          )}
        </label>
        <input
          id="pf-mmr"
          type="range"
          min={0}
          max={12000}
          step={50}
          value={mmrSliderValue}
          onChange={(e) => {
            mmrEditedRef.current = true;
            setMmr(e.target.value);
          }}
          className="w-full accent-red-500"
        />
        <div className="mt-2 flex gap-2">
          <input
            type="number"
            className={INPUT_CLS}
            placeholder="Например: 3500"
            value={mmr}
            min={0}
            max={20000}
            inputMode="numeric"
            onChange={(e) => {
              mmrEditedRef.current = true;
              setMmr(e.target.value);
            }}
          />
          <div
            className="flex w-40 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface2)] text-xs text-[var(--muted)]"
          >
            {medalHint(mmrSliderValue)}
          </div>
        </div>
      </div>

      {/* Возраст */}
      <div>
        <label className={LABEL_CLS} htmlFor="pf-age">
          Возраст
        </label>
        <input
          id="pf-age"
          type="number"
          className={INPUT_CLS}
          placeholder="Например: 22"
          value={age}
          min={12}
          max={80}
          inputMode="numeric"
          onChange={(e) => setAge(e.target.value)}
        />
      </div>

      {/* Ссылка на профиль */}
      <div>
        <label className={LABEL_CLS} htmlFor="pf-link">
          Ссылка на профиль (Steam / Dotabuff / Stratz)
        </label>
        <input
          id="pf-link"
          className={INPUT_CLS}
          placeholder="https://ru.dotabuff.com/players/…"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          onBlur={() => void tryAutoloadDotaProfile()}
        />
      </div>

      {/* О себе */}
      <div>
        <label className={LABEL_CLS} htmlFor="pf-desc">
          О себе{" "}
          <span className="opacity-60">({description.length}/300, необязательно)</span>
        </label>
        <textarea
          id="pf-desc"
          className={`${INPUT_CLS} resize-none`}
          rows={3}
          placeholder="Когда играешь, что ищешь в тиммейте…"
          value={description}
          maxLength={300}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-500">
          ⚠️ {error}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface2)] px-4 py-3 text-sm font-semibold text-[var(--text)] transition-opacity hover:opacity-80"
          >
            Отмена
          </button>
        )}
        <button
          type="submit"
          disabled={saving}
          className="btn-cut flex-1 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-red-500/25 transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          {saving
            ? "Сохраняем…"
            : initial
              ? "💾 Сохранить анкету"
              : "🚀 Создать анкету и начать"}
        </button>
      </div>
    </form>
  );
}

function roleDesc(id: RoleId): string {
  return ROLES.find((x) => x.id === id)?.desc ?? "";
}

function medalHint(mmr: number): string {
  let medal = MEDALS[0];
  for (const m of MEDALS) {
    if (mmr >= m.min) medal = m;
  }
  return `🏅 ${medal.name}`;
}

function initialsOf(value: string): string {
  return (value.trim() || "?").slice(0, 1).toUpperCase();
}

/** Сетевые ошибки fetch (разрыв соединения, таймаут и т.п.) */
function isNetworkError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : "";
  return /failed to fetch|networkerror|load failed|network request failed|timeout/i.test(
    msg,
  );
}

/** Понятные сообщения вместо сырых «Failed to fetch» */
function friendlyError(err: unknown): string {
  if (isNetworkError(err)) {
    return "Проблема с сетью — данные не отправились. Проверь соединение и попробуй ещё раз.";
  }
  return err instanceof Error && err.message
    ? err.message
    : "Не удалось сохранить анкету";
}
