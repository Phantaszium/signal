/**
 * Signal's ranking model.
 *
 * Design goal: transparent and cheap to improve, not clever. Every dimension
 * is a bounded 0–100 function of (publication signals x research profile x
 * learned preferences), and every dimension reports the reasons that moved it
 * so the UI can show its work.
 *
 * To improve ranking later, replace the body of a `score*` function or swap
 * DIMENSION_WEIGHTS. Nothing in the UI hardcodes a score.
 */

import type {
  Publication,
  PreferenceWeights,
  ResearchProfile,
  ScoreBreakdown,
  ScoreExplanation,
  ScoredPublication,
  Tier,
} from "@/lib/types";

/** Relative contribution of each dimension to the composite Signal score. */
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
  userPreferenceFit: "User preference fit",
  strategicSignificance: "Strategic significance",
};

/** Below this research-relevance score an item never reaches the briefing. */
export const RELEVANCE_FLOOR = 38;

export const TIER_THRESHOLDS = { high: 74, notable: 54 } as const;

/**
 * Briefing discipline: the product promise is "3 important", so the HIGH
 * section is capped regardless of how many items clear the threshold.
 */
export const MAX_HIGH_ITEMS = 3;

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

function corpusOf(pub: Publication): string {
  return [pub.title, pub.summary, pub.abstract, ...pub.tags]
    .join(" ")
    .toLowerCase();
}

/** Case-insensitive whole-ish term match. */
function hits(corpus: string, term: string): boolean {
  return corpus.includes(term.toLowerCase());
}

function daysOld(publishedAt: string, now: Date): number {
  const ms = now.getTime() - new Date(publishedAt).getTime();
  return Math.max(0, ms / 86_400_000);
}

// --------------------------------------------------------------- dimensions

function scoreResearchRelevance(
  pub: Publication,
  profile: ResearchProfile,
): { score: number; reasons: string[]; matched: string[] } {
  const corpus = corpusOf(pub);
  const reasons: string[] = [];
  const matched: string[] = [];
  let score = 8; // small floor so nothing is exactly zero

  // Core program keywords carry the most weight.
  const keywordHits = profile.keywords.filter((k) => hits(corpus, k));
  score += keywordHits.length * 15;
  matched.push(...keywordHits);
  if (keywordHits.length) {
    reasons.push(`Matches ${keywordHits.length} program keyword(s): ${keywordHits.join(", ")}`);
  }

  const geneHits = profile.genes.filter((g) => hits(corpus, g));
  score += geneHits.length * 7;
  matched.push(...geneHits);
  if (geneHits.length) reasons.push(`Names tracked genes/proteins: ${geneHits.join(", ")}`);

  const diseaseHits = profile.diseases.filter((d) => hits(corpus, d));
  score += diseaseHits.length * 9;
  matched.push(...diseaseHits);
  if (diseaseHits.length) reasons.push(`In a tracked disease setting: ${diseaseHits.join(", ")}`);

  const techniqueHits = profile.techniques.filter((t) => hits(corpus, t));
  score += techniqueHits.length * 4;
  matched.push(...techniqueHits);
  if (techniqueHits.length) reasons.push(`Uses methods you work with: ${techniqueHits.join(", ")}`);

  if (!keywordHits.length && !geneHits.length) {
    reasons.push("No program keyword or tracked gene appears in the text");
  }

  return { score: clamp(score), reasons, matched: Array.from(new Set(matched)) };
}

function scoreNovelty(
  pub: Publication,
  now: Date,
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  const prior = pub.signals?.noveltyPrior ?? 50;
  let score = prior;
  reasons.push(`Claim novelty assessed at ${prior}/100 at ingestion`);

  const age = daysOld(pub.publishedAt, now);
  if (age <= 3) {
    score += 8;
    reasons.push("Published in the last 72 hours");
  } else if (age > 21) {
    score -= 10;
    reasons.push("More than three weeks old");
  }

  if (pub.signals?.replication === "independent") {
    score -= 5;
    reasons.push("Independently replicated — confirmatory rather than new");
  }

  return { score: clamp(score), reasons };
}

function scoreEvidenceStrength(pub: Publication): {
  score: number;
  reasons: string[];
} {
  const reasons: string[] = [];
  const s = pub.signals ?? {};
  let score = 40;

  if (pub.type === "journal") {
    score += 12;
    reasons.push("Peer-reviewed journal article");
  } else if (pub.type === "preprint") {
    score -= 6;
    reasons.push("Preprint — not yet peer reviewed");
  } else if (pub.type === "trial") {
    score += 6;
    reasons.push("Trial record with reported outcomes");
  }

  if (s.clinical) {
    score += 14;
    reasons.push("Includes human/clinical data");
  }
  if (s.inVitroOnly) {
    score -= 18;
    reasons.push("In-vitro only — no in-vivo or patient validation");
  }
  if (s.cohortSize && s.cohortSize >= 100) {
    score += 12;
    reasons.push(`Substantial cohort (n = ${s.cohortSize})`);
  } else if (s.cohortSize && s.cohortSize < 20) {
    score -= 6;
    reasons.push(`Small sample (n = ${s.cohortSize})`);
  }
  if (s.negativeResult && s.cohortSize && s.cohortSize >= 100) {
    score += 10;
    reasons.push("Adequately powered negative result");
  }
  if (s.replication === "independent") {
    score += 10;
    reasons.push("Findings replicated across independent cohorts");
  } else if (s.replication === "internal") {
    score += 4;
    reasons.push("Internally replicated across models");
  }

  return { score: clamp(score), reasons };
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

function scoreStrategicSignificance(
  pub: Publication,
  profile: ResearchProfile,
): { score: number; reasons: string[]; matchedOrgs: string[] } {
  const reasons: string[] = [];
  const corpus = `${corpusOf(pub)} ${pub.organizations.join(" ").toLowerCase()}`;
  let score = pub.signals?.strategicPrior ?? 35;
  reasons.push(`Competitive/programmatic weight assessed at ${score}/100`);

  const matchedOrgs = profile.organizations.filter((org) =>
    org
      .split("/")
      .some((part) => hits(corpus, part.trim())),
  );
  if (matchedOrgs.length) {
    score += Math.min(20, matchedOrgs.length * 8);
    reasons.push(`Involves tracked organisation(s): ${matchedOrgs.join(", ")}`);
  }
  if (pub.type === "regulatory") {
    score += 10;
    reasons.push("Regulatory development affecting program design");
  }
  if (pub.type === "trial") {
    score += 8;
    reasons.push("Clinical trial readout");
  }

  return { score: clamp(score), reasons, matchedOrgs };
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

export interface ScoreInput {
  profile: ResearchProfile;
  weights: PreferenceWeights;
  now?: Date;
}

/** Score a single publication. Pure — safe to run on server or client. */
export function scorePublication(
  pub: Publication,
  { profile, weights, now = new Date() }: ScoreInput,
): ScoredPublication {
  const relevance = scoreResearchRelevance(pub, profile);
  const novelty = scoreNovelty(pub, now);
  const evidence = scoreEvidenceStrength(pub);
  const preference = scoreUserPreferenceFit(pub, weights);
  const strategic = scoreStrategicSignificance(pub, profile);

  const scores: ScoreBreakdown = {
    researchRelevance: relevance.score,
    novelty: novelty.score,
    evidenceStrength: evidence.score,
    userPreferenceFit: preference.score,
    strategicSignificance: strategic.score,
  };

  const signalScore = computeSignalScore(scores);

  const explanations: ScoreExplanation[] = [
    {
      dimension: "researchRelevance",
      label: DIMENSION_LABELS.researchRelevance,
      score: relevance.score,
      weight: DIMENSION_WEIGHTS.researchRelevance,
      reasons: relevance.reasons,
    },
    {
      dimension: "userPreferenceFit",
      label: DIMENSION_LABELS.userPreferenceFit,
      score: preference.score,
      weight: DIMENSION_WEIGHTS.userPreferenceFit,
      reasons: preference.reasons,
    },
    {
      dimension: "evidenceStrength",
      label: DIMENSION_LABELS.evidenceStrength,
      score: evidence.score,
      weight: DIMENSION_WEIGHTS.evidenceStrength,
      reasons: evidence.reasons,
    },
    {
      dimension: "novelty",
      label: DIMENSION_LABELS.novelty,
      score: novelty.score,
      weight: DIMENSION_WEIGHTS.novelty,
      reasons: novelty.reasons,
    },
    {
      dimension: "strategicSignificance",
      label: DIMENSION_LABELS.strategicSignificance,
      score: strategic.score,
      weight: DIMENSION_WEIGHTS.strategicSignificance,
      reasons: strategic.reasons,
    },
  ];

  return {
    publication: pub,
    scores,
    signalScore,
    tier: assignTier(signalScore),
    whyThisMatters: "", // filled by the explain module
    explanations,
    matchedInterests: relevance.matched,
    matchedOrganizations: strategic.matchedOrgs,
  };
}
