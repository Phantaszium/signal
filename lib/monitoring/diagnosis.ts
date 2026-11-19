/**
 * Turn a run's per-topic diagnostics into the plain statement shown in
 * Monitoring status. The order of checks matters: a failed source is
 * reported before anything else, so a topic is never described as quiet
 * when part of it could not be checked.
 */

import type { RunStatus, SourceCheck, TopicCheck } from "@/lib/monitoring/types";
import type { SourceKey } from "@/lib/types";

export const SOURCE_LABEL: Record<SourceKey, string> = {
  pubmed: "PubMed",
  clinicaltrials: "ClinicalTrials.gov",
  biorxiv: "bioRxiv",
  medrxiv: "medRxiv",
  europepmc: "Europe PMC preprints",
};

export type TopicState =
  /** The run is still assessing candidates. */
  | "pending"
  /** At least one development was found. */
  | "developments"
  /** Every source was checked and nothing qualified. */
  | "quiet"
  /** Some sources could not be checked; what was checked is reported. */
  | "incomplete"
  /** No source could be checked. */
  | "failed";

export interface TopicDiagnosis {
  state: TopicState;
  headline: string;
  /** Why: the funnel step where records stopped, in a sentence. */
  detail: string | null;
  failedSources: string[];
  partialSources: string[];
}

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;

function sourcesWith(check: TopicCheck, status: SourceCheck["status"]): string[] {
  return (Object.entries(check.sources) as [SourceKey, SourceCheck][])
    .filter(([, s]) => s.status === status)
    .map(([key]) => SOURCE_LABEL[key]);
}

/** Where records stopped in the funnel, for a topic with no developments. */
function quietReason(check: TopicCheck): string {
  const window = `${check.window.from} and ${check.window.to}`;
  if (check.matched === 0 && check.fetched === 0) {
    return `The sources returned no records containing this topic's terms between ${window}.`;
  }
  if (check.matched === 0) {
    return `${plural(check.fetched, "record")} came back from the searches, but none matched the topic closely enough to assess${
      check.excluded ? ` (${plural(check.excluded, "was", "were")} excluded by your exclusion terms)` : ""
    }.`;
  }
  if (check.queued === 0 && check.deferred === 0) {
    return `${plural(check.matched, "matching record")} found, all already assessed in earlier checks.`;
  }
  const assessed = check.assessed ?? 0;
  if (assessed === 0) return "No candidate could be assessed yet.";
  const deferred = check.deferred
    ? ` ${plural(check.deferred, "lower-ranked match", "lower-ranked matches")} ${check.deferred === 1 ? "was" : "were"} over this check's assessment limit.`
    : "";
  const base = `${plural(assessed, "candidate")} assessed; none was relevant enough to recommend.${deferred}`;
  // Hundreds of term matches and nothing relevant: the terms are doing the
  // damage, not the field being quiet.
  if (check.matched >= 100 && assessed >= 10) {
    return `${base} ${plural(check.matched, "record")} matched this topic's terms, which usually means some terms are too general. Remove the broadest ones or switch the topic to Strict.`;
  }
  return base;
}

export function diagnoseTopic(check: TopicCheck, runStatus: RunStatus): TopicDiagnosis {
  const failedSources = sourcesWith(check, "failed");
  const partialSources = sourcesWith(check, "partial");
  const total = Object.keys(check.sources).length;
  const base = { failedSources, partialSources };

  if (total > 0 && failedSources.length === total) {
    return {
      ...base,
      state: "failed",
      headline: "Could not be checked",
      detail: `${failedSources.join(", ")} could not be reached. This is not the same as finding nothing.`,
    };
  }

  // When only the daily bioRxiv/medRxiv feeds failed, the topic search on
  // Europe PMC still covered those servers' older preprints.
  const feedsOnly =
    failedSources.length > 0 &&
    Object.values(check.sources).every((s) => s.status !== "failed" || s.shared) &&
    check.sources.europepmc?.status !== undefined &&
    check.sources.europepmc.status !== "failed";
  const incompleteNote = failedSources.length
    ? `${failedSources.join(", ")} could not be reached, so this check is incomplete.${
        feedsOnly
          ? " Preprints from those servers more than a few days old were still searched through Europe PMC."
          : ""
      }`
    : null;

  if (runStatus === "failed") {
    return {
      ...base,
      state: "failed",
      headline: "Check failed",
      detail: "The check stopped before it finished, so this topic was not fully checked. This is not the same as finding nothing.",
    };
  }

  // A run still assessing other topics' candidates has nothing left to do
  // for a topic with none queued: its result is already final.
  if (runStatus === "running" || (runStatus === "evaluating" && check.queued > 0)) {
    return {
      ...base,
      state: "pending",
      headline: check.queued
        ? `Assessing ${plural(check.queued, "candidate")}`
        : "Checking sources",
      detail: incompleteNote,
    };
  }

  // Candidates the AI could not assess were not checked either: they are
  // retried, but until then the topic is not fully checked.
  const failedAssessments = check.failedAssessments ?? 0;
  const assessmentNote = failedAssessments
    ? `${plural(failedAssessments, "candidate")} could not be assessed and will be retried in the next check.`
    : null;
  const notes = [incompleteNote, assessmentNote].filter(Boolean).join(" ") || null;
  const incomplete = failedSources.length > 0 || failedAssessments > 0;

  const developments = check.developments ?? 0;
  if (developments > 0) {
    const high = check.highPriority ?? 0;
    return {
      ...base,
      state: incomplete ? "incomplete" : "developments",
      headline: `${plural(developments, "new recommended paper")}${high ? `, ${high} worth reading first` : ""}`,
      detail: notes,
    };
  }

  if (incomplete) {
    return {
      ...base,
      state: "incomplete",
      headline: "Partly checked",
      detail: `${notes} ${quietReason(check)}`,
    };
  }

  return {
    ...base,
    state: "quiet",
    headline: "No new papers worth recommending",
    detail: quietReason(check),
  };
}
