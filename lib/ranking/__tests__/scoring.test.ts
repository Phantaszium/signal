import { describe, expect, it } from "vitest";
import { NEUTRAL_PREFERENCE_WEIGHTS } from "@/lib/data/profile";
import { MAX_HIGH_ITEMS, prefilterScore, rankBriefing, rankEvaluated } from "@/lib/ranking/scoring";
import type { AiAssessment, EvaluatedItem, Publication, ResearchProfile } from "@/lib/types";

const profile: ResearchProfile = {
  program: "KRAS G12D / NSCLC",
  description: "",
  keywords: ["KRAS G12D", "acquired resistance"],
  genes: ["KRAS", "MET"],
  diseases: ["lung adenocarcinoma"],
  techniques: [],
  organizations: ["Mirati/BMS"],
};

function pub(id: string, text: string, extra: Partial<Publication> = {}): Publication {
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

function assessment(scores: { relevance: number; novelty?: number; evidence?: number; strategic?: number }): AiAssessment {
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
    signalInterpretation: [],
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
  };
}

const item = (id: string, relevance: number, rest = {}): EvaluatedItem => ({
  publication: pub(id, `Paper ${id}`),
  assessment: assessment({ relevance, ...rest }),
  briefingId: "b1",
});

describe("prefilterScore", () => {
  it("matches short gene symbols only on word boundaries", () => {
    expect(prefilterScore(pub("a", "Metastatic methods in mice"), profile).matched).toEqual([]);
    expect(prefilterScore(pub("b", "MET amplification drives escape"), profile).matched).toEqual(["MET"]);
  });

  it("ranks program keywords above incidental gene mentions", () => {
    const keyword = prefilterScore(pub("a", "Acquired resistance to KRAS G12D inhibitors"), profile);
    const gene = prefilterScore(pub("b", "A KRAS survey"), profile);
    expect(keyword.score).toBeGreaterThan(gene.score);
  });

  it("matches either half of a slash-separated organisation", () => {
    const r = prefilterScore(pub("a", "Trial", { organizations: ["Bristol Myers Squibb", "BMS"] }), profile);
    expect(r.reasons.join(" ")).toContain("Mirati/BMS");
  });
});

describe("rankEvaluated", () => {
  it("uses the AI's dimension scores and summary", () => {
    const s = rankEvaluated(item("x", 90), NEUTRAL_PREFERENCE_WEIGHTS);
    expect(s.scores.researchRelevance).toBe(90);
    expect(s.publication.summary).toBe("AI summary");
    expect(s.explanations.find((e) => e.dimension === "novelty")?.reasons).toEqual(["scored 70"]);
  });

  it("responds to preference weights without another AI call", () => {
    const low = rankEvaluated(item("x", 80), { ...NEUTRAL_PREFERENCE_WEIGHTS, mechanistic: 0.15 });
    const high = rankEvaluated(item("x", 80), { ...NEUTRAL_PREFERENCE_WEIGHTS, mechanistic: 0.95 });
    expect(high.signalScore).toBeGreaterThan(low.signalScore);
  });
});

describe("rankBriefing", () => {
  it("drops items below the relevance floor and dismissed items", () => {
    const r = rankBriefing(
      [item("keep", 80), item("low", 20), item("gone", 95)],
      NEUTRAL_PREFERENCE_WEIGHTS,
      new Set(["gone"]),
    );
    expect(r.relevant.map((s) => s.publication.id)).toEqual(["keep"]);
  });

  it("caps the HIGH tier", () => {
    const items = Array.from({ length: 6 }, (_, i) =>
      item(`p${i}`, 99, { novelty: 99, evidence: 99, strategic: 99 }),
    );
    const r = rankBriefing(items, { ...NEUTRAL_PREFERENCE_WEIGHTS, mechanistic: 0.98, acquiredResistance: 0.98 });
    expect(r.high).toHaveLength(MAX_HIGH_ITEMS);
    expect(r.notable.length + r.context.length).toBe(3);
  });
});
