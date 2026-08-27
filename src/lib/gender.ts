import type { GenderId } from "./types";

export const GENDERS: { id: GenderId; label: string; shortLabel: string }[] = [
  { id: "male", label: "Мужской", shortLabel: "Мужчина" },
  { id: "female", label: "Женский", shortLabel: "Женщина" },
];

export const GENDER_IDS = new Set<GenderId>(GENDERS.map((gender) => gender.id));

export function isGenderId(value: unknown): value is GenderId {
  return typeof value === "string" && GENDER_IDS.has(value as GenderId);
}

export function genderLabel(value: GenderId | null): string {
  if (value === "male") return "♂ Мужчина";
  if (value === "female") return "♀ Женщина";
  return "Пол не указан";
}
