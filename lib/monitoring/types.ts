import type { SourceKey } from "@/lib/types";

/**
 * What a monitoring run records, per topic and per source, so that "nothing
 * found" can always be told apart from "could not check" and from "found
 * things, none relevant". Stored as JSON on monitor_runs.diagnostics.
 */

export type SourceStatus =
  /** Queried and read in full. */
  | "ok"
  /** Queried, but more records matched than were read (result or time limit). */
  | "partial"
  /** Could not be queried; nothing from it was checked. */
  | "failed";

export interface SourceCheck {
  status: SourceStatus;
  /** Records the source reported for the query and window. */
  scanned: number;
  /** Records actually read. */
  fetched: number;
  /** Records from this source that passed the topic's filter. */
  matched: number;
  /**
   * The bioRxiv/medRxiv feeds are read once per run and shared by every
   * topic, rather than searched per topic.
   */
  shared?: boolean;
  note?: string;
}

export interface TopicCheck {
  topicId: string;
  name: string;
  window: { from: string; to: string };
  /** This run was the topic's first, longer look-back. */
  backfill: boolean;
  sources: Partial<Record<SourceKey, SourceCheck>>;
  /** Records the topic-specific searches returned (not counting the shared feeds). */
  fetched: number;
  /** Unique records that passed the topic's filter, across all sources. */
  matched: number;
  /** Records ruled out by the topic's exclusion terms. */
  excluded: number;
  /** Matched records already assessed in an earlier run, so not paid for again. */
  alreadyAssessed: number;
  /** New matched records sent for AI assessment in this run. */
  queued: number;
  /**
   * Their ids. The AI may file a record under a different topic than the one
   * it was retrieved for; this keeps "assessed" counted against the topic
   * that searched for it. Absent on runs recorded before it was added.
   */
  queuedIds?: string[];
  /**
   * New matched records ranked below this run's assessment limit. Those still
   * inside a later check's window get another chance; older ones do not.
   */
  deferred: number;
  // Filled in when the run's assessments are complete.
  assessed?: number;
  failedAssessments?: number;
  developments?: number;
  highPriority?: number;
}

export interface RunDiagnostics {
  /** Topic ids in the order they were labelled (T1, T2...) for the AI. */
  topicOrder: string[];
  topics: TopicCheck[];
  durationMs?: number;
}

export type RunMode = "scheduled" | "manual";
export type RunStatus = "running" | "evaluating" | "complete" | "failed";

export interface RunRecord {
  id: string;
  userId: string;
  mode: RunMode;
  status: RunStatus;
  diagnostics: RunDiagnostics;
  batchId: string | null;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
}
