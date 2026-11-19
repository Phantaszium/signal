/**
 * PaperPuffin's ranking model.
 *
 * Two stages:
 *
 *   1. prefilterScore — a cheap lexical match of every ingested record against
 *      a monitored topic. It decides which few dozen items are worth sending
 *      to the AI at all; most of the volume is dropped here. How much it takes
 *      to pass depends on the topic's sensitivity.
 *   2. rankEvaluated — combines the AI's per-dimension judgement (relevance,
 *      novelty, evidence, strategic significance) with the user's learned
 *      preference weights into one transparent composite score.
 *
 * The preference dimension is computed here rather than by the model so that
 * feedback re-ranks instantly, on the client, without another AI call.
 */

import type {
  EvaluatedItem,
  Publication,
  PreferenceWeights,
  ScoreBreakdown,
  ScoreExplanation,
  ScoredPublication,
  Sensitivity,
  Tier,
  TopicProfile,
} from "@/lib/types";

/** Relative contribution of each dimension to the composite ranking score. */
export const DIMENSION_WEIGHTS: Record<keyof ScoreBreakdown, number> = {
  researchRelevance: 0.32,
  userPreferenceFit: 0.22,
  evidenceStrength: 0.18,
  novelty: 0.16,
  strategicSignificance: 0.12,
};

export const DIMENSION_LABELS: Record<keyof ScoreBreakdown, string> = {
  researchRelevance: "Research relevance",
  novelty: "Novelty",
  evidenceStrength: "Evidence strength",
  userPreferenceFit: "Fit with your reading history",
  strategicSignificance: "Field impact",
};

/**
 * Lexical prefilter score a record needs on a broad topic: any one keyword,
 * gene, organism, disease or organisation match. A technique alone is not
 * enough. The per-run candidate cap, not this floor, is what bounds AI cost.
 */
export const PREFILTER_FLOOR = 15;

export const TIER_THRESHOLDS = { high: 74, notable: 54 } as const;

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

function corpusOf(pub: Publication): string {
  return [pub.title, pub.summary, pub.abstract, ...pub.tags, ...pub.organizations]
    .join(" ")
    .toLowerCase();
}

const escapeRegExp = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Case-insensitive term match on word boundaries, so a short gene symbol like
 * "MET" does not match "metastatic".
 */
function hits(corpus: string, term: string): boolean {
  const t = term.trim().toLowerCase();
  if (!t) return false;
  return new RegExp(`(^|[^a-z0-9])${escapeRegExp(t)}($|[^a-z0-9])`).test(corpus);
}

// --------------------------------------------------------------- dimensions

export interface PrefilterResult {
  score: number;
  /** Whether the record goes on to AI assessment for this topic. */
  passes: boolean;
  /** The exclusion term that ruled it out, if any. */
  excludedBy: string | null;
  reasons: string[];
  matched: string[];
}

/**
 * Stage 1: lexical match against one topic. Fast and free, so it runs on
 * every ingested record.
 *
 * Sensitivity sets the bar: broad passes any single profile term; balanced
 * needs a keyword, gene or organism (a shared disease or company name alone
 * is too often a coincidence); strict needs one of those plus a second term.
 */
export function prefilterScore(
  pub: Publication,
  profile: TopicProfile,
  sensitivity: Sensitivity = "broad",
): PrefilterResult {
  const corpus = corpusOf(pub);
  const reasons: string[] = [];
  const matched: string[] = [];

  const excludedBy = profile.exclusions.find((e) => hits(corpus, e)) ?? null;

  let score = 8; // small floor so nothing is exactly zero

  // Core program keywords (and their synonyms) carry the most weight.
  const keywordHits = [...profile.keywords, ...profile.synonyms].filter((k) => hits(corpus, k));
  score += keywordHits.length * 15;
  matched.push(...keywordHits);
  if (keywordHits.length) {
    reasons.push(`Matches ${keywordHits.length} keyword(s): ${keywordHits.join(", ")}`);
  }

  const geneHits = profile.genes.filter((g) => hits(corpus, g));
  score += geneHits.length * 7;
  matched.push(...geneHits);
  if (geneHits.length) reasons.push(`Names tracked genes/proteins: ${geneHits.join(", ")}`);

  const organismHits = profile.organisms.filter((o) => hits(corpus, o));
  score += organismHits.length * 12;
  matched.push(...organismHits);
  if (organismHits.length) reasons.push(`Involves tracked organisms: ${organismHits.join(", ")}`);

  const diseaseHits = profile.diseases.filter((d) => hits(corpus, d));
  score += diseaseHits.length * 9;
  matched.push(...diseaseHits);
  if (diseaseHits.length) reasons.push(`In a tracked disease setting: ${diseaseHits.join(", ")}`);

  const techniqueHits = profile.techniques.filter((t) => hits(corpus, t));
  score += techniqueHits.length * 4;

  const orgHits = profile.organizations.filter((org) =>
    org.split("/").some((part) => part.trim() && hits(corpus, part.trim())),
  );
  score += orgHits.length * 8;
  if (orgHits.length) reasons.push(`Involves tracked organisations: ${orgHits.join(", ")}`);
  matched.push(...techniqueHits);
  if (techniqueHits.length) reasons.push(`Uses methods you work with: ${techniqueHits.join(", ")}`);

  const core = keywordHits.length + geneHits.length + organismHits.length;
  const all = core + diseaseHits.length + techniqueHits.length + orgHits.length;
  if (!core) reasons.push("No keyword, tracked gene or organism appears in the text");

  const clears =
    sensitivity === "broad" ? score >= PREFILTER_FLOOR : sensitivity === "balanced" ? core >= 1 : core >= 1 && all >= 2;
  if (excludedBy) reasons.push(`Mentions an excluded term: ${excludedBy}`);

  return {
    score: clamp(score),
    passes: clears && !excludedBy,
    excludedBy,
    reasons,
    matched: Array.from(new Set(matched)),
  };
}

function scoreUserPreferenceFit(
  pub: Publication,
  weights: PreferenceWeights,
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  const s = pub.signals ?? {};
  let score = 45;

  if (s.mechanistic) {
    score += 28 * weights.mechanistic;
    reasons.push("Mechanistic rather than purely descriptive");
  } else {
    score -= 8 * weights.mechanistic;
    reasons.push("Descriptive/observational rather than mechanistic");
  }

  if (s.acquiredResistance) {
    score += 26 * weights.acquiredResistance;
    reasons.push("Concerns acquired resistance — a topic you read consistently");
  }
  if (s.inVitroOnly) {
    score -= 22 * weights.discountInVitroOnly;
    reasons.push("You discount in-vitro-only claims");
  }
  if (s.negativeResult) {
    score += 18 * weights.negativeResults;
    reasons.push("A negative result, which you have said you value");
  }
  if (s.clinical) {
    score += 14 * weights.clinical;
    reasons.push("Contains clinical/translational data");
  }
  if (pub.type === "preprint") {
    score += 6 * weights.preprints;
    reasons.push("You do read preprints");
  }

  return { score: clamp(score), reasons };
}

// ----------------------------------------------------------------- composite

export function computeSignalScore(scores: ScoreBreakdown): number {
  const total = (Object.keys(DIMENSION_WEIGHTS) as (keyof ScoreBreakdown)[]).reduce(
    (acc, key) => acc + scores[key] * DIMENSION_WEIGHTS[key],
    0,
  );
  return Math.round(total);
}

export function assignTier(signalScore: number): Tier {
  if (signalScore >= TIER_THRESHOLDS.high) return "HIGH";
  if (signalScore >= TIER_THRESHOLDS.notable) return "NOTABLE";
  return "CONTEXT";
}

/** Turn an AI assessment into a ranked publication for the given weights. */
export function rankEvaluated(
  item: EvaluatedItem,
  weights: PreferenceWeights,
): ScoredPublication {
  const { assessment: a } = item;
  const publication: Publication = {
    ...item.publication,
    summary: a.summary || item.publication.summary,
    tags: a.tags.length ? a.tags : item.publication.tags,
    keyFindings: a.keyFindings,
    studyDesign: a.studyDesign,
    modelSystem: a.modelSystem,
    limitations: a.limitations,
    authorsReport: a.authorsReport,
    signalInterpretation: a.signalInterpretation,
    plainEnglish: a.plainEnglish,
    signals: { ...a.signals, cohortSize: a.signals.cohortSize ?? undefined },
  };

  const preference = scoreUserPreferenceFit(publication, weights);
  const scores: ScoreBreakdown = {
    researchRelevance: clamp(a.relevance.score),
    novelty: clamp(a.novelty.score),
    evidenceStrength: clamp(a.evidence.score),
    userPreferenceFit: preference.score,
    strategicSignificance: clamp(a.strategic.score),
  };
  const reasons: Record<keyof ScoreBreakdown, string[]> = {
    researchRelevance: [a.relevance.reason],
    userPreferenceFit: preference.reasons,
    evidenceStrength: [a.evidence.reason],
    novelty: [a.novelty.reason],
    strategicSignificance: [a.strategic.reason],
  };

  const signalScore = computeSignalScore(scores);
  const explanations: ScoreExplanation[] = (
    Object.keys(DIMENSION_WEIGHTS) as (keyof ScoreBreakdown)[]
  ).map((dimension) => ({
    dimension,
    label: DIMENSION_LABELS[dimension],
    score: scores[dimension],
    weight: DIMENSION_WEIGHTS[dimension],
    reasons: reasons[dimension],
  }));

  return {
    publication,
    scores,
    signalScore,
    tier: assignTier(signalScore),
    whyThisMatters: a.whyThisMatters,
    explanations,
    matchedInterests: a.matchedInterests,
    matchedOrganizations: a.matchedOrganizations,
  };
}
