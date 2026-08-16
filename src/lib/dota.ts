import type { RoleId } from "./types";

export type RoleInfo = {
  id: RoleId;
  label: string;
  short: string;
  emoji: string;
  desc: string;
  /** классы для чипа фильтра */
  chip: string;
  /** классы для бейджа роли на карточке */
  badge: string;
};

export const ROLES: RoleInfo[] = [
  {
    id: "pos1",
    label: "Керри",
    short: "1",
    emoji: "⚔️",
    desc: "Позиция 1 — Carry",
    chip: "border-red-500/40 bg-red-500/15 text-red-300",
    badge: "bg-red-500/15 text-red-300 border-red-500/40",
  },
  {
    id: "pos2",
    label: "Мид",
    short: "2",
    emoji: "🔮",
    desc: "Позиция 2 — Mid",
    chip: "border-violet-500/40 bg-violet-500/15 text-violet-300",
    badge: "bg-violet-500/15 text-violet-300 border-violet-500/40",
  },
  {
    id: "pos3",
    label: "Оффлейн",
    short: "3",
    emoji: "🛡️",
    desc: "Позиция 3 — Offlane",
    chip: "border-emerald-500/40 bg-emerald-500/15 text-emerald-300",
    badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  },
  {
    id: "pos4",
    label: "Полусаппорт",
    short: "4",
    emoji: "🧙",
    desc: "Позиция 4 — Support",
    chip: "border-amber-500/40 bg-amber-500/15 text-amber-300",
    badge: "bg-amber-500/15 text-amber-300 border-amber-500/40",
  },
  {
    id: "pos5",
    label: "Саппорт",
    short: "5",
    emoji: "💖",
    desc: "Позиция 5 — Full Support",
    chip: "border-sky-500/40 bg-sky-500/15 text-sky-300",
    badge: "bg-sky-500/15 text-sky-300 border-sky-500/40",
  },
];

export const ROLE_IDS = new Set<string>(ROLES.map((r) => r.id));

export function roleById(id: string | null | undefined): RoleInfo | null {
  return ROLES.find((r) => r.id === id) ?? null;
}

/** Медали по ПТС (примерные границы рейтинга) */
export const MEDALS: { min: number; name: string; tierClass: string }[] = [
  { min: 0, name: "Рекрут", tierClass: "text-slate-300" },
  { min: 770, name: "Страж", tierClass: "text-lime-400" },
  { min: 1540, name: "Рыцарь", tierClass: "text-emerald-400" },
  { min: 2310, name: "Герой", tierClass: "text-teal-400" },
  { min: 3080, name: "Легенда", tierClass: "text-sky-400" },
  { min: 3850, name: "Властелин", tierClass: "text-blue-400" },
  { min: 4620, name: "Божество", tierClass: "text-violet-400" },
  { min: 5420, name: "Титан", tierClass: "text-fuchsia-400" },
  { min: 6160, name: "Бессмертный", tierClass: "text-amber-400" },
];

export function medalForMmr(mmr: number): {
  name: string;
  tierClass: string;
} {
  let medal = MEDALS[0];
  for (const m of MEDALS) {
    if (mmr >= m.min) medal = m;
  }
  return medal;
}

export function formatMmr(mmr: number | null | undefined): string {
  if (mmr == null) return "—";
  return new Intl.NumberFormat("ru-RU").format(mmr);
}

/** Популярные герои для подсказок при выборе мейн-героев */
export const HEROES: string[] = [
  "Pudge", "Phantom Assassin", "Sniper", "Invoker", "Juggernaut",
  "Anti-Mage", "Drow Ranger", "Crystal Maiden", "Lina", "Shadow Fiend",
  "Storm Spirit", "Ember Spirit", "Void Spirit", "Earth Spirit", "Spirit Breaker",
  "Queen of Pain", "Huskar", "Axe", "Legion Commander", "Wraith King",
  "Slark", "Ursa", "Faceless Void", "Phantom Lancer", "Terrorblade",
  "Naga Siren", "Spectre", "Medusa", "Luna", "Gyrocopter",
  "Troll Warlord", "Templar Assassin", "Tinker", "Zeus", "Puck",
  "Batrider", "Dragon Knight", "Sand King", "Tidehunter", "Mars",
  "Centaur Warrunner", "Timbersaw", "Underlord", "Bristleback", "Undying",
  "Warlock", "Witch Doctor", "Lion", "Shadow Shaman", "Disruptor",
  "Rubick", "Ancient Apparition", "Dazzle", "Oracle", "Io",
  "Chen", "Enchantress", "Nature's Prophet", "Meepo", "Broodmother",
  "Chaos Knight", "Doom", "Night Stalker", "Outworld Destroyer", "Death Prophet",
  "Necrophos", "Viper", "Razor", "Bloodseeker", "Riki",
  "Bounty Hunter", "Weaver", "Morphling", "Monkey King", "Pangolier",
  "Grimstroke", "Snapfire", "Hoodwink", "Dawnbreaker", "Marci",
  "Muerta", "Ringmaster", "Kez", "Primal Beast", "Abaddon",
  "Lifestealer", "Kunkka", "Skywrath Mage", "Silencer", "Jakiro",
  "Ogre Magi", "Venomancer", "Magnus", "Slardar", "Sven",
];
