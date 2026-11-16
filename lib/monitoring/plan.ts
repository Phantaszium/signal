/**
 * Pure planning for a monitoring run: which date window each topic is
 * searched over, and how the run's AI budget is shared between topics.
 * No I/O here, so it is unit-tested directly.
 */

import type { MonitoringTopic, Publication } from "@/lib/types";

const DAY = 86_400_000;

/** A new topic's first check looks back this far, so it does not start empty. */
export const BACKFILL_DAYS = 30;
/** Later checks re-read at least this much, to catch records indexed late. */
const MIN_LOOKBACK_DAYS = 2;
/** And never more than this, even after a long gap. */
const MAX_LOOKBACK_DAYS = 14;
/** A topic that was never checked but already backfilled (should not happen) reads a week. */
const DEFAULT_LOOKBACK_DAYS = 7;

const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export interface TopicWindow {
  from: string;
  to: string;
  backfill: boolean;
}

/**
 * The window a topic is searched over. Overlapping the previous check is
 * deliberate and free: records already assessed are skipped before the AI.
 */
export function topicWindow(topic: Pick<MonitoringTopic, "backfilledAt" | "lastCheckedAt">, now: number): TopicWindow {
  const to = isoDay(now);
  if (!topic.backfilledAt) return { from: isoDay(now - BACKFILL_DAYS * DAY), to, backfill: true };
  if (!topic.lastCheckedAt) return { from: isoDay(now - DEFAULT_LOOKBACK_DAYS * DAY), to, backfill: false };
  const since = Date.parse(topic.lastCheckedAt) - DAY;
  const from = Math.max(now - MAX_LOOKBACK_DAYS * DAY, Math.min(since, now - MIN_LOOKBACK_DAYS * DAY));
  return { from: isoDay(from), to, backfill: false };
}

/** Shift an ISO day back by `days`. */
export function daysBefore(iso: string, days: number): string {
  return isoDay(Date.parse(`${iso}T00:00:00Z`) - days * DAY);
}

export interface Candidate {
  publication: Publication;
  prefilter: number;
  /** The topic the record was retrieved and matched for. */
  topicId: string;
  /** Already assessed, but only before this topic existed: assess again. */
  reassess?: boolean;
}

/**
 * Pick which new candidates are assessed this run. Each topic's candidates
 * are taken best-first, round-robin across topics, so a broad topic with
 * hundreds of matches cannot use up the budget of a narrow one. Returns the
 * chosen candidates and, per topic, how many were left over the limit.
 */
export function allocateCandidates(
  perTopic: Map<string, Candidate[]>,
  cap: number,
): { chosen: Candidate[]; deferred: Map<string, number> } {
  const queues = [...perTopic.entries()].map(([topicId, list]) => ({
    topicId,
    list: [...list].sort((a, b) => b.prefilter - a.prefilter),
  }));
  const chosen: Candidate[] = [];
  const taken = new Set<string>();
  let progress = true;
  while (chosen.length < cap && progress) {
    progress = false;
    for (const q of queues) {
      if (chosen.length >= cap) break;
      while (q.list.length) {
        const next = q.list.shift()!;
        // A record new to two topics is assessed once, for the first to reach it.
        if (taken.has(next.publication.id)) continue;
        taken.add(next.publication.id);
        chosen.push(next);
        progress = true;
        break;
      }
    }
  }
  const deferred = new Map(
    queues.map((q) => [q.topicId, q.list.filter((c) => !taken.has(c.publication.id)).length]),
  );
  return { chosen, deferred };
}
