import { and, eq, like } from "drizzle-orm";
import { db } from "@/db";
import { rewardsLog } from "@/db/schema";
import {
  FEEDBACK_TAGS,
  feedbackTagLabel,
  isFeedbackTagId,
  type FeedbackTagId,
  type FeedbackTagStat,
} from "./feedback-tags";

const FEEDBACK_KIND = "rating_tag";

function parseTag(note: string | null): FeedbackTagId | null {
  const raw = note?.match(/(?:^|;)tag:([^;]+)/)?.[1];
  return isFeedbackTagId(raw) ? raw : null;
}

export function parseFeedbackTags(input: unknown): FeedbackTagId[] | null {
  if (input == null) return [];
  if (!Array.isArray(input)) return null;
  if (input.length > 2) return null;

  const unique = [...new Set(input)];
  if (unique.length !== input.length || !unique.every(isFeedbackTagId)) return null;
  return unique as FeedbackTagId[];
}

export async function saveFeedbackTags(
  raterTgId: number,
  ratedTgId: number,
  tags: FeedbackTagId[],
): Promise<void> {
  if (tags.length === 0) return;

  await db.insert(rewardsLog).values(
    tags.map((tag) => ({
      tgId: ratedTgId,
      kind: FEEDBACK_KIND,
      amount: 0,
      note: `rater:${raterTgId};tag:${tag}`,
    })),
  );
}

export async function feedbackTagsFromRater(
  raterTgId: number,
  ratedTgId: number,
): Promise<FeedbackTagId[]> {
  const rows = await db
    .select({ note: rewardsLog.note })
    .from(rewardsLog)
    .where(
      and(
        eq(rewardsLog.tgId, ratedTgId),
        eq(rewardsLog.kind, FEEDBACK_KIND),
        like(rewardsLog.note, `%rater:${raterTgId};%`),
      ),
    );

  return rows
    .map((row) => parseTag(row.note))
    .filter((tag): tag is FeedbackTagId => tag != null);
}

export async function feedbackTagStatsOf(tgId: number): Promise<FeedbackTagStat[]> {
  const rows = await db
    .select({ note: rewardsLog.note })
    .from(rewardsLog)
    .where(
      and(
        eq(rewardsLog.tgId, tgId),
        eq(rewardsLog.kind, FEEDBACK_KIND),
      ),
    );

  const counts = new Map<FeedbackTagId, number>();
  for (const row of rows) {
    const tag = parseTag(row.note);
    if (!tag) continue;
    counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }

  return FEEDBACK_TAGS.map((tag) => ({
    id: tag.id,
    label: feedbackTagLabel(tag.id),
    count: counts.get(tag.id) ?? 0,
  }))
    .filter((tag) => tag.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
}
