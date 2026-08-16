export function configuredAdminIds(): Set<number> {
  const raw = process.env.ADMIN_TG_IDS ?? "";
  const ids = new Set<number>();
  for (const item of raw.split(",")) {
    const id = Number(item.trim());
    if (Number.isSafeInteger(id) && id > 0) ids.add(id);
  }
  return ids;
}

export function isConfiguredAdmin(tgId: number): boolean {
  return configuredAdminIds().has(tgId);
}
