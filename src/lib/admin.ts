/** Главный администратор проекта; доступ не зависит от переменных Vercel. */
export const PRIMARY_ADMIN_TG_ID = 5_774_035_380;

export function configuredAdminIds(): Set<number> {
  const raw = process.env.ADMIN_TG_IDS ?? "";
  const ids = new Set<number>([PRIMARY_ADMIN_TG_ID]);
  for (const item of raw.split(",")) {
    const id = Number(item.trim());
    if (Number.isSafeInteger(id) && id > 0) ids.add(id);
  }
  return ids;
}

export function isConfiguredAdmin(tgId: number): boolean {
  return configuredAdminIds().has(tgId);
}
