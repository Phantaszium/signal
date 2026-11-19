import { describe, expect, it } from "vitest";
import { NEUTRAL_PREFERENCE_WEIGHTS } from "@/lib/data/profile";
import { prefilterScore, rankEvaluated } from "@/lib/ranking/scoring";
import { item, profile, pub } from "@/test/fixtures";

describe("prefilterScore", () => {
  it("matches short gene symbols only on word boundaries", () => {
    expect(prefilterScore(pub("a", "Metastatic methods in mice"), profile()).matched).toEqual([]);
    expect(prefilterScore(pub("b", "MET amplification drives escape"), profile()).matched).toEqual(["MET"]);
  });

  it("ranks program keywords above incidental gene mentions", () => {
    const keyword = prefilterScore(pub("a", "Acquired resistance to KRAS G12D inhibitors"), profile());
    const gene = prefilterScore(pub("b", "A KRAS survey"), profile());
    expect(keyword.score).toBeGreaterThan(gene.score);
  });

  it("matches either half of a slash-separated organisation", () => {
    const r = prefilterScore(pub("a", "Trial", { organizations: ["Bristol Myers Squibb", "BMS"] }), profile());
    expect(r.reasons.join(" ")).toContain("Mirati/BMS");
  });

  it("counts synonyms as keywords and organisms as core terms", () => {
    const p = profile({ keywords: ["spectinomycin"], synonyms: ["Trobicin"], organisms: ["Vibrio natriegens"] });
    expect(prefilterScore(pub("a", "Trobicin uptake"), p, "balanced").passes).toBe(true);
    expect(prefilterScore(pub("b", "Growth of Vibrio natriegens"), p, "balanced").passes).toBe(true);
  });

  describe("sensitivity", () => {
    // Like the STI-clinic papers in the first empty briefing, which shared
    // only the disease name with the profile.
    const disease = pub("d", "Screening outcomes in lung adenocarcinoma clinics");
    const keyword = pub("k", "KRAS G12D tumours");
    const keywordPlus = pub("kp", "KRAS G12D tumours in lung adenocarcinoma");

    it("broad passes any single profile term except a technique", () => {
      expect(prefilterScore(disease, profile(), "broad").passes).toBe(true);
      expect(prefilterScore(pub("t", "Uses CRISPR"), profile({ techniques: ["CRISPR"] }), "broad").passes).toBe(false);
    });

    it("balanced needs a keyword, gene or organism; a shared disease alone is not enough", () => {
      expect(prefilterScore(disease, profile(), "balanced").passes).toBe(false);
      expect(prefilterScore(keyword, profile(), "balanced").passes).toBe(true);
    });

    it("strict needs a core term plus a second term", () => {
      expect(prefilterScore(pub("k2", "KRAS G12D"), profile({ genes: [] }), "strict").passes).toBe(false);
      expect(prefilterScore(keywordPlus, profile(), "strict").passes).toBe(true);
    });
  });

  it("excludes records mentioning an exclusion term, whatever else they match", () => {
    const r = prefilterScore(
      pub("x", "KRAS G12D in colorectal cancer"),
      profile({ exclusions: ["colorectal cancer"] }),
      "broad",
    );
    expect(r.passes).toBe(false);
    expect(r.excludedBy).toBe("colorectal cancer");
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
