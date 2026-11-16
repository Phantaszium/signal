import { describe, expect, it } from "vitest";
import { parseEvaluation } from "@/lib/ai/evaluate";
import { itemBlock, SYSTEM_PROMPT, topicsBlock } from "@/lib/ai/prompt";
import { profile, pub, topic } from "@/test/fixtures";

const valid = {
  topic: "T2",
  relevance: { score: 104.6, reason: "r" },
  significance: { level: "major", reason: "first-in-class" },
  novelty: { score: -3, reason: "n" },
  evidence: { score: 55.4, reason: "e" },
  strategic: { score: 40, reason: "s" },
  summary: "s",
  whatChanged: "The authors report X.",
  whyThisMatters: "w",
  implications: ["i"],
  nextSteps: ["Read the methods."],
  plainEnglish: "p",
  keyFindings: ["k"],
  studyDesign: "d",
  modelSystem: "m",
  limitations: ["l"],
  authorsReport: ["a"],
  signals: {
    mechanistic: true,
    inVitroOnly: false,
    clinical: true,
    negativeResult: false,
    acquiredResistance: false,
    cohortSize: 120,
  },
  matchedInterests: [],
  matchedOrganizations: [],
  tags: ["t"],
};

const message = (text: string, stop_reason = "end_turn") => ({
  stop_reason,
  model: "claude-opus-5-5",
  content: [{ type: "thinking" }, { type: "text", text }],
});

describe("parseEvaluation", () => {
  it("parses and clamps a valid response, mapping the topic label to its id", () => {
    const r = parseEvaluation(message(JSON.stringify(valid)), ["a", "b"]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.assessment.relevance.score).toBe(100);
    expect(r.assessment.novelty.score).toBe(0);
    expect(r.assessment.evidence.score).toBe(55);
    expect(r.assessment.model).toBe("claude-opus-5-5");
    expect(r.assessment.topicId).toBe("b");
    expect(r.assessment.significance).toEqual({ level: "major", reason: "first-in-class" });
    expect(r.assessment.nextSteps).toEqual(["Read the methods."]);
  });

  it("leaves the topic unset when the label is not one of the request's topics", () => {
    const r = parseEvaluation(message(JSON.stringify({ ...valid, topic: "T9" })), ["a", "b"]);
    expect(r.ok && r.assessment.topicId).toBeUndefined();
  });

  it("reports refusals, truncation and malformed output", () => {
    expect(parseEvaluation(message("", "refusal"), [])).toEqual({ ok: false, reason: "declined by model" });
    expect(parseEvaluation(message("{", "max_tokens"), [])).toEqual({ ok: false, reason: "response truncated" });
    expect(parseEvaluation(message("not json"), [])).toEqual({ ok: false, reason: "response was not JSON" });
    expect(parseEvaluation(message(JSON.stringify({ relevance: 1 })), [])).toEqual({
      ok: false,
      reason: "response did not match schema",
    });
  });
});

describe("prompts", () => {
  it("keeps the system prompt free of per-request content so it caches", () => {
    expect(SYSTEM_PROMPT).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it("labels every topic and includes synonyms, organisms and exclusions", () => {
    const block = topicsBlock([
      topic({ id: "a" }),
      topic({
        id: "b",
        profile: profile({
          program: "Spectinomycin resistance",
          keywords: ["spectinomycin"],
          synonyms: ["Trobicin"],
          organisms: ["Vibrio natriegens"],
          exclusions: ["gonorrhoea treatment guidelines"],
        }),
      }),
    ]);
    expect(block).toContain('<topic label="T1">');
    expect(block).toContain('<topic label="T2">');
    expect(block).toContain("Keywords: spectinomycin; Trobicin");
    expect(block).toContain("Organisms: Vibrio natriegens");
    expect(block).toContain("Not of interest: gonorrhoea treatment guidelines");
  });

  it("describes the record and its type", () => {
    const i = itemBlock(pub("x", "T", { type: "preprint", origin: "biorxiv" }));
    expect(i).toContain("Preprint (not peer reviewed)");
    expect(i).toContain("(no abstract available)");
  });
});
