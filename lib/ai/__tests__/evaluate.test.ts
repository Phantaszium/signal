import { describe, expect, it } from "vitest";
import { parseEvaluation } from "@/lib/ai/evaluate";
import { itemBlock, profileBlock, SYSTEM_PROMPT } from "@/lib/ai/prompt";

const valid = {
  relevance: { score: 104.6, reason: "r" },
  novelty: { score: -3, reason: "n" },
  evidence: { score: 55.4, reason: "e" },
  strategic: { score: 40, reason: "s" },
  whyThisMatters: "w",
  summary: "s",
  plainEnglish: "p",
  keyFindings: ["k"],
  studyDesign: "d",
  modelSystem: "m",
  limitations: ["l"],
  authorsReport: ["a"],
  signalInterpretation: ["i"],
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
  it("parses and clamps a valid response", () => {
    const r = parseEvaluation(message(JSON.stringify(valid)));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.assessment.relevance.score).toBe(100);
    expect(r.assessment.novelty.score).toBe(0);
    expect(r.assessment.evidence.score).toBe(55);
    expect(r.assessment.model).toBe("claude-opus-5-5");
  });

  it("reports refusals, truncation and malformed output", () => {
    expect(parseEvaluation(message("", "refusal"))).toEqual({ ok: false, reason: "declined by model" });
    expect(parseEvaluation(message("{", "max_tokens"))).toEqual({ ok: false, reason: "response truncated" });
    expect(parseEvaluation(message("not json"))).toEqual({ ok: false, reason: "response was not JSON" });
    expect(parseEvaluation(message(JSON.stringify({ relevance: 1 })))).toEqual({
      ok: false,
      reason: "response did not match schema",
    });
  });
});

describe("prompts", () => {
  it("keeps the system prompt free of per-request content so it caches", () => {
    expect(SYSTEM_PROMPT).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it("includes the profile and the record", () => {
    const p = profileBlock({
      program: "KRAS",
      description: "",
      keywords: ["KRAS G12D"],
      genes: [],
      diseases: [],
      techniques: [],
      organizations: [],
    });
    expect(p).toContain("Keywords: KRAS G12D");
    expect(p).toContain("Genes / proteins: (none given)");
    const i = itemBlock({
      id: "x",
      title: "T",
      source: "S",
      publishedAt: "2026-11-05",
      type: "preprint",
      authors: [],
      summary: "",
      abstract: "",
      tags: [],
      organizations: [],
      origin: "biorxiv",
    });
    expect(i).toContain("Preprint (not peer reviewed)");
    expect(i).toContain("(no abstract available)");
  });
});
