import { describe, expect, it } from "vitest";
import { NEUTRAL_PREFERENCE_WEIGHTS } from "@/lib/data/profile";
import {
  isDevelopment,
  isHighPriority,
  relevanceClass,
  significanceOf,
  toDevelopment,
} from "@/lib/developments";
import { assessment, item, topic } from "@/test/fixtures";

describe("relevance vs importance", () => {
  it("applies the topic's sensitivity threshold", () => {
    const a = assessment({ relevance: 45 });
    expect(isDevelopment(a, "broad")).toBe(true);
    expect(isDevelopment(a, "balanced")).toBe(false);
    expect(isDevelopment(assessment({ relevance: 64 }), "strict")).toBe(false);
  });

  it("keeps a highly relevant but minor record out of high priority", () => {
    const a = assessment({ relevance: 92 }, { significance: { level: "minor", reason: "registry update" } });
    expect(isDevelopment(a, "balanced")).toBe(true);
    expect(isHighPriority(a, "balanced")).toBe(false);
  });

  it("marks a relevant, major development high priority", () => {
    const a = assessment({ relevance: 70 }, { significance: { level: "major", reason: "first-in-class" } });
    expect(isHighPriority(a, "balanced")).toBe(true);
    expect(isHighPriority({ ...a, relevance: { score: 55, reason: "" } }, "balanced")).toBe(false);
  });

  it("estimates significance for assessments made before it was rated, and says so", () => {
    const s = significanceOf(assessment({ relevance: 80, novelty: 90, evidence: 80, strategic: 70 }));
    expect(s).toMatchObject({ level: "major", inferred: true });
    expect(significanceOf(assessment({ relevance: 80, novelty: 10, evidence: 20, strategic: 10 })).level).toBe("minor");
  });

  it("buckets relevance for display", () => {
    expect([80, 60, 45, 10].map(relevanceClass)).toEqual(["direct", "related", "adjacent", "unrelated"]);
  });
});

describe("toDevelopment", () => {
  it("is never a development when its topic is gone", () => {
    const d = toDevelopment(item("x", 95), undefined, NEUTRAL_PREFERENCE_WEIGHTS);
    expect(d.isDevelopment).toBe(false);
    expect(d.topicName).toBeNull();
  });

  it("falls back to the old interpretation field for implications", () => {
    const d = toDevelopment(
      item("x", 80, { assessment: { signalInterpretation: ["old"] } }),
      topic(),
      NEUTRAL_PREFERENCE_WEIGHTS,
    );
    expect(d.implications).toEqual(["old"]);
    expect(d.whatChanged).toBeNull();
  });
});
