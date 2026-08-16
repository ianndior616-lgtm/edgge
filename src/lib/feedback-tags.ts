export const FEEDBACK_TAGS = [
  { id: "not_toxic", label: "Не токсичный" },
  { id: "good_communication", label: "Хорошая коммуникация" },
  { id: "strong_player", label: "Сильный игрок" },
  { id: "shotcaller", label: "Коллер" },
  { id: "team_player", label: "Играет на команду" },
] as const;

export type FeedbackTagId = (typeof FEEDBACK_TAGS)[number]["id"];

export type FeedbackTagStat = {
  id: FeedbackTagId;
  label: string;
  count: number;
};

const FEEDBACK_TAG_IDS = new Set<string>(FEEDBACK_TAGS.map((tag) => tag.id));

export function isFeedbackTagId(value: unknown): value is FeedbackTagId {
  return typeof value === "string" && FEEDBACK_TAG_IDS.has(value);
}

export function feedbackTagLabel(id: FeedbackTagId): string {
  return FEEDBACK_TAGS.find((tag) => tag.id === id)?.label ?? id;
}
