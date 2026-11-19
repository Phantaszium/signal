import type { AiAssessment, EvaluatedItem, MonitoringTopic, Publication, TopicProfile } from "@/lib/types";

/** Shared builders for unit tests. */

export function profile(overrides: Partial<TopicProfile> = {}): TopicProfile {
  return {
    program: "KRAS G12D / NSCLC",
    description: "",
    keywords: ["KRAS G12D", "acquired resistance"],
    synonyms: [],
    genes: ["KRAS", "MET"],
    organisms: [],
    diseases: ["lung adenocarcinoma"],
    techniques: [],
    organizations: ["Mirati/BMS"],
    exclusions: [],
    ...overrides,
  };
}

export function topic(overrides: Partial<MonitoringTopic> = {}): MonitoringTopic {
  return {
    id: "t1",
    profile: profile(),
    sensitivity: "balanced",
    sources: ["pubmed", "clinicaltrials", "biorxiv", "medrxiv", "europepmc"],
    active: true,
    backfilledAt: "2026-11-01T00:00:00Z",
    lastCheckedAt: "2026-11-10T09:00:00Z",
    createdAt: "2026-11-01T00:00:00Z",
    ...overrides,
  };
}

export function pub(id: string, text: string, extra: Partial<Publication> = {}): Publication {
  return {
    id,
    title: text,
    source: "Test Journal",
    publishedAt: "2026-11-05",
    type: "journal",
    authors: [],
    summary: "",
    abstract: "",
    tags: [],
    organizations: [],
    origin: "pubmed",
    ...extra,
  };
}

export function assessment(
  scores: { relevance: number; novelty?: number; evidence?: number; strategic?: number },
  extra: Partial<AiAssessment> = {},
): AiAssessment {
  const d = (score: number) => ({ score, reason: `scored ${score}` });
  return {
    relevance: d(scores.relevance),
    novelty: d(scores.novelty ?? 70),
    evidence: d(scores.evidence ?? 70),
    strategic: d(scores.strategic ?? 70),
    whyThisMatters: "Because.",
    summary: "AI summary",
    plainEnglish: "Plain.",
    keyFindings: [],
    studyDesign: "",
    modelSystem: "",
    limitations: [],
    authorsReport: [],
    signals: {
      mechanistic: true,
      inVitroOnly: false,
      clinical: false,
      negativeResult: false,
      acquiredResistance: true,
      cohortSize: null,
    },
    matchedInterests: ["KRAS"],
    matchedOrganizations: [],
    tags: ["KRAS"],
    model: "test",
    evaluatedAt: "2026-11-06T00:00:00Z",
    ...extra,
  };
}

export function item(
  id: string,
  relevance: number,
  opts: { topicId?: string | null; evaluatedAt?: string; assessment?: Partial<AiAssessment>; scores?: object } = {},
): EvaluatedItem {
  return {
    publication: pub(id, `Paper ${id}`),
    assessment: assessment({ relevance, ...(opts.scores ?? {}) }, opts.assessment),
    runId: "r1",
    topicId: opts.topicId === undefined ? "t1" : opts.topicId,
    evaluatedAt: opts.evaluatedAt ?? "2026-11-06T00:00:00Z",
  };
}
