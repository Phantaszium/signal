/**
 * A topic's current monitoring status, from the user's recent runs. Shared by
 * the dashboard and digests so both say the same thing.
 */

import { diagnoseTopic, type TopicDiagnosis } from "@/lib/monitoring/diagnosis";
import type { RunRecord, TopicCheck } from "@/lib/monitoring/types";

export interface TopicStatus {
  diagnosis: TopicDiagnosis | null;
  /** The run the status comes from, if any. */
  run: Pick<RunRecord, "id" | "mode" | "status" | "createdAt" | "completedAt" | "error"> | null;
  check: TopicCheck | null;
}

/**
 * The newest run decides. A failed run reports the topic as not checked,
 * even if an earlier run had found it quiet: an old "nothing new" must never
 * stand in for a check that did not happen.
 */
export function topicStatus(topicId: string, runsNewestFirst: RunRecord[]): TopicStatus {
  for (const run of runsNewestFirst) {
    const check = run.diagnostics.topics.find((c) => c.topicId === topicId) ?? null;
    if (run.status === "failed") {
      return {
        run,
        check,
        diagnosis: {
          state: "failed",
          headline: "Last check failed",
          detail: run.error ?? "The check stopped before it finished. This is not the same as finding nothing.",
          failedSources: [],
          partialSources: [],
        },
      };
    }
    // Runs from before per-topic diagnostics, or before this topic existed.
    if (!check) continue;
    return { run, check, diagnosis: diagnoseTopic(check, run.status) };
  }
  return { run: null, check: null, diagnosis: null };
}
