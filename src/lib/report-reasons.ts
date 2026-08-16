import type { ReportReason } from "./types";

export const REPORT_REASONS: { id: ReportReason; label: string }[] = [
  { id: "ads", label: "За рекламу" },
  { id: "scam", label: "Скам" },
  { id: "meaningless", label: "Анкета не имеет смысла" },
  { id: "insult", label: "Оскорбление" },
  { id: "unpleasant", label: "Неприятный контент" },
  { id: "politics", label: "Политика" },
];

export const REPORT_REASON_IDS = new Set(REPORT_REASONS.map((r) => r.id));

export function reportReasonLabel(id: string): string {
  return REPORT_REASONS.find((r) => r.id === id)?.label ?? id;
}
