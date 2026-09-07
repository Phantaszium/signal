/**
 * Core data models for Signal.
 *
 * Everything in the app flows through these three shapes:
 *   ResearchProfile  — what the scientist cares about
 *   Publication      — a normalized item from any source (seed, PubMed, ...)
 *   ScoredPublication — a Publication plus transparent ranking output
 */

export type PublicationType = "journal" | "preprint" | "trial" | "regulatory";

export type Tier = "HIGH" | "NOTABLE" | "CONTEXT";

/** A normalized publication, source-agnostic. */
export interface Publication {
  id: string;
  title: string;
  /** Journal, preprint server, registry, or agency. */
  source: string;
  /** ISO date string (YYYY-MM-DD). */
  publishedAt: string;
  type: PublicationType;
  authors: string[];
  /** One-sentence plain-language summary. */
  summary: string;
  abstract: string;
  tags: string[];
  /** Organizations named in or responsible for the work. */
  organizations: string[];
  /** Provenance: "seed" items are fictional demo data; "pubmed" items are real. */
  origin: "seed" | "pubmed";
  url?: string;
  doi?: string;

  // --- Structured detail used by the item detail page (seed data only) ---
  keyFindings?: string[];
  studyDesign?: string;
  modelSystem?: string;
  limitations?: string[];
  /** Direct claims attributable to the authors. */
  authorsReport?: string[];
  /** Signal's inference — explicitly NOT attributed to the authors. */
  signalInterpretation?: string[];
  /**
   * The "so what" for this researcher, in one clause. The explain module
   * frames it; the corpus supplies the domain content. Optional — items
   * without one (e.g. live PubMed results) fall back to a generated clause.
   */
  implication?: string;

  // --- Ranking hints. Not scores; inputs to the scoring module. ---
  signals?: PublicationSignals;
}

/**
 * Objective-ish attributes extracted at ingestion time. The scoring module
 * turns these into dimension scores; keeping them separate means the model
 * can be retuned without touching the corpus.
 */
export interface PublicationSignals {
  /** Does the work propose a mechanism, or only describe an observation? */
  mechanistic?: boolean;
  /** In-vitro-only evidence (cell lines, no in-vivo or patient data). */
  inVitroOnly?: boolean;
  /** Includes patient / clinical data. */
  clinical?: boolean;
  /** A well-powered negative result. */
  negativeResult?: boolean;
  /** Concerns acquired resistance. */
  acquiredResistance?: boolean;
  /** Approximate cohort or sample size, where meaningful. */
  cohortSize?: number;
  /** 0–100 hand-set novelty prior from ingestion (how new the claim is). */
  noveltyPrior?: number;
  /** 0–100 competitive/market importance prior. */
  strategicPrior?: number;
  /** Peer-review / replication status shorthand. */
  replication?: "none" | "internal" | "independent";
}

/** The five transparent ranking dimensions. */
export interface ScoreBreakdown {
  researchRelevance: number;
  novelty: number;
  evidenceStrength: number;
  userPreferenceFit: number;
  strategicSignificance: number;
}

export interface ScoreExplanation {
  dimension: keyof ScoreBreakdown;
  label: string;
  score: number;
  weight: number;
  /** Human-readable reasons that moved this dimension. */
  reasons: string[];
}

export interface ScoredPublication {
  publication: Publication;
  scores: ScoreBreakdown;
  /** Weighted 0–100 composite. */
  signalScore: number;
  tier: Tier;
  /** The single most important line on the card. */
  whyThisMatters: string;
  explanations: ScoreExplanation[];
  /** Profile terms this item actually hit. */
  matchedInterests: string[];
  matchedOrganizations: string[];
}

export interface ResearchProfile {
  program: string;
  description: string;
  keywords: string[];
  genes: string[];
  diseases: string[];
  techniques: string[];
  organizations: string[];
}

/** Learned preferences — seeded now, updated by feedback. */
export interface LearnedPreference {
  id: string;
  statement: string;
  /** 0–1 confidence, rises as feedback accumulates. */
  confidence: number;
  /** Which signal this preference keys off, for the scoring module. */
  key: PreferenceKey;
}

export type PreferenceKey =
  | "mechanistic"
  | "discountInVitroOnly"
  | "negativeResults"
  | "acquiredResistance"
  | "clinical"
  | "preprints";

/** Weights the preference model applies. Adjusted by user feedback. */
export type PreferenceWeights = Record<PreferenceKey, number>;

export type FeedbackAction = "important" | "save" | "not_relevant" | "read";

export interface FeedbackEvent {
  publicationId: string;
  action: FeedbackAction;
  at: string;
}

/** Funnel counters shown across the whole app. */
export interface FunnelCounts {
  ingested: number;
  likelyRelevant: number;
  important: number;
}

export interface Briefing {
  generatedAt: string;
  funnel: FunnelCounts;
  high: ScoredPublication[];
  notable: ScoredPublication[];
  context: ScoredPublication[];
  /** Where the items came from, surfaced honestly in the UI. */
  sourceMode: "seed" | "pubmed+seed" | "pubmed";
  sourceNote: string;
}
