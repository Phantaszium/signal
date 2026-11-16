/**
 * Digest scheduling and selection. A digest is assembled from developments
 * Signal has already found and assessed in the period: nothing in it is
 * generated for the digest, and nothing below a topic's relevance threshold
 * is ever added to fill it.
 */

import { isDevelopment, isHighPriority, significanceOf } from "@/lib/developments";
import { rankEvaluated } from "@/lib/ranking/scoring";
import type {
  DigestFrequency,
  EvaluatedItem,
  MonitoringTopic,
  PreferenceWeights,
  ScoredPublication,
  Significance,
} from "@/lib/types";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export const PERIOD_MS: Partial<Record<DigestFrequency, number>> = {
  daily: DAY,
  weekly: 7 * DAY,
  monthly: 30 * DAY,
};

export const FREQUENCY_LABEL: Record<DigestFrequency, { label: string; detail: string }> = {
  daily: { label: "Daily digest", detail: "Each morning, when there is something new." },
  weekly: { label: "Weekly digest", detail: "Once a week, including weeks with nothing new." },
  monthly: { label: "Monthly digest", detail: "Once a month." },
  important_only: {
    label: "Important developments only",
    detail: "No digest. An email only when Signal finds a high-priority development.",
  },
  off: { label: "No email", detail: "Read everything in the app." },
};

/** Cron runs are not exactly 24h apart, so a period counts as elapsed a little early. */
const SLACK_MS = 2 * HOUR;

export function digestDue(frequency: DigestFrequency, lastDigestAt: string | null, now: number): boolean {
  const period = PERIOD_MS[frequency];
  if (!period) return false;
  if (!lastDigestAt) return true;
  return now - Date.parse(lastDigestAt) >= period - SLACK_MS;
}

/** The period a digest covers: since the last one, but never more than two periods back. */
export function digestWindow(
  frequency: DigestFrequency,
  lastDigestAt: string | null,
  now: number,
): { start: number; end: number } {
  const period = PERIOD_MS[frequency] ?? DAY;
  const earliest = now - 2 * period;
  const start = lastDigestAt ? Math.max(Date.parse(lastDigestAt), earliest) : now - period;
  return { start, end: now };
}

export interface DigestEntry {
  item: ScoredPublication;
  topicId: string;
  significance: Significance;
  highPriority: boolean;
}

/**
 * The developments a digest includes: assessed in the window, above their
 * topic's threshold, not dismissed. High priority first, then by score.
 */
export function selectDigestEntries(
  items: EvaluatedItem[],
  topics: MonitoringTopic[],
  weights: PreferenceWeights,
  dismissed: ReadonlySet<string>,
  window: { start: number; end: number },
): DigestEntry[] {
  const byId = new Map(topics.map((t) => [t.id, t]));
  return items
    .filter((i) => {
      const at = Date.parse(i.evaluatedAt);
      const topic = i.topicId ? byId.get(i.topicId) : undefined;
      return (
        topic &&
        at >= window.start &&
        at < window.end &&
        !dismissed.has(i.publication.id) &&
        isDevelopment(i.assessment, topic.sensitivity)
      );
    })
    .map((i) => {
      const topic = byId.get(i.topicId!)!;
      return {
        item: rankEvaluated(i, weights),
        topicId: topic.id,
        significance: significanceOf(i.assessment).level,
        highPriority: isHighPriority(i.assessment, topic.sensitivity),
      };
    })
    .sort(
      (a, b) =>
        Number(b.highPriority) - Number(a.highPriority) || b.item.signalScore - a.item.signalScore,
    );
}
