/**
 * Core data models for Signal.
 *
 * Everything in the app flows through these shapes:
 *   MonitoringTopic   — one research question the scientist wants watched
 *   Publication       — a normalized item from any source (PubMed, bioRxiv, ...)
 *   EvaluatedItem     — a Publication plus the AI's stored assessment of it
 *   ScoredPublication — an EvaluatedItem ranked with the user's preferences
 */

export type PublicationType = "journal" | "preprint" | "trial" | "regulatory";

export type PublicationOrigin = "pubmed" | "biorxiv" | "medrxiv" | "clinicaltrials" | "europepmc";

/** The sources a topic can be monitored on. Same keys as PublicationOrigin. */
export type SourceKey = PublicationOrigin;

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
  /** Which feed the record came from. */
  origin: PublicationOrigin;
  url?: string;
  doi?: string;

  // --- Structured detail for the item detail page, written by the AI assessment ---
  keyFindings?: string[];
  studyDesign?: string;
  modelSystem?: string;
  limitations?: string[];
  /** Direct claims attributable to the authors. */
  authorsReport?: string[];
  /** Signal's inference — explicitly NOT attributed to the authors. */
  signalInterpretation?: string[];
  /**
   * Plain-English explanation of the work for a non-specialist teammate.
   */
  plainEnglish?: string;

  // --- Ranking hints extracted by the AI assessment. Inputs to the preference model. ---
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

/** A research profile plus the fields that only matter for monitoring. */
export interface TopicProfile extends ResearchProfile {
  /** Alternative spellings and phrasings of the keywords; searched alongside them. */
  synonyms: string[];
  organisms: string[];
  /** Records mentioning any of these are never sent for assessment. */
  exclusions: string[];
}

/**
 * How much a record must bear on the topic to count as a development, and how
 * strictly the free lexical prefilter screens records before the AI sees them.
 */
export type Sensitivity = "broad" | "balanced" | "strict";

/** One monitored research topic. A user can have several. */
export interface MonitoringTopic {
  id: string;
  profile: TopicProfile;
  sensitivity: Sensitivity;
  sources: SourceKey[];
  active: boolean;
  backfilledAt: string | null;
  lastCheckedAt: string | null;
  createdAt: string;
}

/**
 * How often the user gets a digest of developments. "important_only" sends no
 * periodic digest, only alerts for high-priority developments.
 */
export type DigestFrequency = "daily" | "weekly" | "monthly" | "important_only" | "off";

/** How much a development changes what is known, independent of relevance. */
export type Significance = "major" | "moderate" | "minor";

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

/** One dimension of the model's judgement, with the reason that drove it. */
export interface AssessedDimension {
  score: number;
  reason: string;
}

/**
 * What the AI returns for one publication against one researcher's profile.
 * Stored as JSON on the evaluation row; combined with the learned preference
 * weights at read time to produce a ScoredPublication.
 */
export interface AiAssessment {
  relevance: AssessedDimension;
  novelty: AssessedDimension;
  evidence: AssessedDimension;
  strategic: AssessedDimension;
  whyThisMatters: string;
  summary: string;
  plainEnglish: string;
  keyFindings: string[];
  studyDesign: string;
  modelSystem: string;
  limitations: string[];
  authorsReport: string[];
  /** Replaced by `implications`; kept so earlier assessments still render. */
  signalInterpretation?: string[];
  signals: Required<Omit<PublicationSignals, "cohortSize">> & { cohortSize: number | null };
  matchedInterests: string[];
  matchedOrganizations: string[];
  tags: string[];
  model: string;
  evaluatedAt: string;
  // --- Added with monitoring topics; absent on assessments made before then. ---
  /** The topic the AI judged this record bears on most. */
  topicId?: string;
  significance?: { level: Significance; reason: string };
  /** The new finding or event, as the record reports it. */
  whatChanged?: string;
  /** Signal's interpretation of what it could mean for the topic. */
  implications?: string[];
  /** Suggested follow-ups. Speculative by nature, and labelled so. */
  nextSteps?: string[];
}

/** A publication with its stored assessment, as loaded for one user. */
export interface EvaluatedItem {
  publication: Publication;
  assessment: AiAssessment;
  runId: string | null;
  topicId: string | null;
  /** When Signal assessed it, which is when it became known to the user. */
  evaluatedAt: string;
}
