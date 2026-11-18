/**
 * What counts as a development, and how it is classified.
 *
 * Relevance and importance are deliberately separate:
 *   relevance    — how directly a record bears on one of the user's topics
 *                  (the AI's 0–100 relevance score, bucketed for display);
 *   significance — how much it changes what is known, independent of the user
 *                  (the AI's major / moderate / minor judgement).
 * A development is any assessed record whose relevance clears its topic's
 * sensitivity threshold. Nothing below that threshold is ever shown as one,
 * however quiet a period has been.
 */

import { rankEvaluated } from "@/lib/ranking/scoring";
import type {
  AiAssessment,
  EvaluatedItem,
  MonitoringTopic,
  PreferenceWeights,
  ScoredPublication,
  Sensitivity,
  Significance,
} from "@/lib/types";

/** Minimum AI relevance for a record to count as a development, per topic sensitivity. */
export const RELEVANCE_THRESHOLD: Record<Sensitivity, number> = {
  broad: 40,
  balanced: 50,
  strict: 65,
};

export const SENSITIVITY_LABEL: Record<Sensitivity, { label: string; detail: string }> = {
  broad: {
    label: "Broad",
    detail: "Include useful background (relevance 40+). Good for learning a new field.",
  },
  balanced: {
    label: "Balanced",
    detail:
      "Papers in the same area as your question (relevance 50+). Recommended for most topics.",
  },
  strict: {
    label: "Strict",
    detail:
      "Only papers that bear directly on your question (relevance 65+). Fewer, closer matches.",
  },
};

export type RelevanceClass = "direct" | "related" | "adjacent" | "unrelated";

export function relevanceClass(score: number): RelevanceClass {
  if (score >= 75) return "direct";
  if (score >= 55) return "related";
  if (score >= 40) return "adjacent";
  return "unrelated";
}

export const RELEVANCE_LABEL: Record<RelevanceClass, string> = {
  direct: "Directly relevant",
  related: "Related",
  adjacent: "Adjacent",
  unrelated: "Not relevant",
};

export const SIGNIFICANCE_LABEL: Record<Significance, string> = {
  major: "Major",
  moderate: "Moderate",
  minor: "Minor",
};

/**
 * The AI's significance judgement. Assessments made before significance was
 * part of the schema fall back to a reading of novelty, evidence and
 * strategic weight, and say so.
 */
export function significanceOf(a: AiAssessment): {
  level: Significance;
  reason: string;
  inferred: boolean;
} {
  if (a.significance) return { ...a.significance, inferred: false };
  const mean = (a.novelty.score + a.evidence.score + a.strategic.score) / 3;
  const level: Significance = mean >= 70 ? "major" : mean >= 45 ? "moderate" : "minor";
  return {
    level,
    reason: "Estimated from novelty, evidence and strategic scores (assessed before significance was rated directly).",
    inferred: true,
  };
}

export function isDevelopment(a: AiAssessment, sensitivity: Sensitivity): boolean {
  return a.relevance.score >= RELEVANCE_THRESHOLD[sensitivity];
}

/**
 * High priority: clearly relevant and a major development, or very highly
 * relevant and at least a moderate one. This is what triggers alerts.
 */
export function isHighPriority(a: AiAssessment, sensitivity: Sensitivity): boolean {
  if (!isDevelopment(a, sensitivity)) return false;
  const { level } = significanceOf(a);
  const relevance = a.relevance.score;
  return (relevance >= 60 && level === "major") || (relevance >= 85 && level !== "minor");
}

// ------------------------------------------------------------ for display

/** A ranked assessment with everything the UI shows about it as a development. */
export interface Development extends ScoredPublication {
  topicId: string | null;
  /** Null when the topic has since been deleted. */
  topicName: string | null;
  evaluatedAt: string;
  relevance: RelevanceClass;
  significance: ReturnType<typeof significanceOf>;
  /** Clears its topic's relevance threshold. */
  isDevelopment: boolean;
  highPriority: boolean;
  whatChanged: string | null;
  implications: string[];
  nextSteps: string[];
  /** Study guides already written for this paper, by explanation level. */
  guides: NonNullable<AiAssessment["guides"]>;
}

export function toDevelopment(
  item: EvaluatedItem,
  topic: MonitoringTopic | undefined,
  weights: PreferenceWeights,
): Development {
  const scored = rankEvaluated(item, weights);
  const a = item.assessment;
  return {
    ...scored,
    topicId: item.topicId,
    topicName: topic?.profile.program ?? null,
    evaluatedAt: item.evaluatedAt,
    relevance: relevanceClass(a.relevance.score),
    significance: significanceOf(a),
    isDevelopment: topic ? isDevelopment(a, topic.sensitivity) : false,
    highPriority: topic ? isHighPriority(a, topic.sensitivity) : false,
    whatChanged: a.whatChanged ?? null,
    implications: a.implications ?? a.signalInterpretation ?? [],
    nextSteps: a.nextSteps ?? [],
    guides: a.guides ?? {},
  };
}

/** High priority first, then the composite score. */
export function byPriority(a: Development, b: Development): number {
  return Number(b.highPriority) - Number(a.highPriority) || b.signalScore - a.signalScore;
}
