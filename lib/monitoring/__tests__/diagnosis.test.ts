import { describe, expect, it } from "vitest";
import { diagnoseTopic } from "@/lib/monitoring/diagnosis";
import { topicStatus } from "@/lib/monitoring/status";
import type { RunRecord, SourceCheck, TopicCheck } from "@/lib/monitoring/types";

const ok = (fetched: number, matched = 0): SourceCheck => ({ status: "ok", scanned: fetched, fetched, matched });
const failed: SourceCheck = { status: "failed", scanned: 0, fetched: 0, matched: 0 };

function check(overrides: Partial<TopicCheck> = {}): TopicCheck {
  return {
    topicId: "t1",
    name: "Topic",
    window: { from: "2026-11-01", to: "2026-11-08" },
    backfill: false,
    sources: { pubmed: ok(0), clinicaltrials: ok(0) },
    fetched: 0,
    matched: 0,
    excluded: 0,
    alreadyAssessed: 0,
    queued: 0,
    deferred: 0,
    assessed: 0,
    failedAssessments: 0,
    developments: 0,
    highPriority: 0,
    ...overrides,
  };
}

describe("diagnoseTopic", () => {
  it("never calls a topic quiet when every source failed", () => {
    const d = diagnoseTopic(check({ sources: { pubmed: failed, clinicaltrials: failed } }), "complete");
    expect(d.state).toBe("failed");
    expect(d.detail).toContain("not the same as finding nothing");
  });

  it("reports a partly checked topic as incomplete, naming the failed source", () => {
    const d = diagnoseTopic(check({ sources: { pubmed: failed, clinicaltrials: ok(3) }, fetched: 3 }), "complete");
    expect(d.state).toBe("incomplete");
    expect(d.failedSources).toEqual(["PubMed"]);
    expect(d.detail).toContain("PubMed could not be reached");
  });

  it("notes Europe PMC coverage when only the daily preprint feed failed", () => {
    const d = diagnoseTopic(
      check({ sources: { pubmed: ok(2), europepmc: ok(1), biorxiv: { ...failed, shared: true } }, fetched: 3 }),
      "complete",
    );
    expect(d.state).toBe("incomplete");
    expect(d.detail).toContain("still searched through Europe PMC");
  });

  it("explains a genuinely empty window", () => {
    const d = diagnoseTopic(check(), "complete");
    expect(d.state).toBe("quiet");
    expect(d.headline).toBe("No significant new developments");
    expect(d.detail).toContain("no records containing this topic's terms");
  });

  it("explains records found but none matched closely enough", () => {
    const d = diagnoseTopic(check({ sources: { pubmed: ok(40) }, fetched: 40, excluded: 3 }), "complete");
    expect(d.detail).toContain("40 records came back");
    expect(d.detail).toContain("3 were excluded");
  });

  it("explains matches that were all assessed before", () => {
    const d = diagnoseTopic(check({ fetched: 5, matched: 5, alreadyAssessed: 5 }), "complete");
    expect(d.detail).toContain("all already assessed");
  });

  it("explains candidates assessed with none relevant", () => {
    const d = diagnoseTopic(check({ fetched: 9, matched: 7, queued: 7, assessed: 7 }), "complete");
    expect(d.detail).toBe("7 candidates assessed; none was relevant enough to count as a development.");
  });

  it("points at over-general terms when hundreds match and none is relevant", () => {
    const d = diagnoseTopic(check({ fetched: 400, matched: 287, queued: 40, assessed: 37, failedAssessments: 3 }), "complete");
    expect(d.detail).toContain("287 records matched this topic's terms");
  });

  it("does not mistake failed AI assessments for irrelevance", () => {
    const d = diagnoseTopic(check({ fetched: 4, matched: 4, queued: 4, assessed: 0, failedAssessments: 4 }), "complete");
    expect(d.state).toBe("incomplete");
    expect(d.detail).toContain("could not be assessed");
  });

  it("treats a topic with some failed assessments as partly checked, not quiet", () => {
    const d = diagnoseTopic(check({ fetched: 9, matched: 9, queued: 9, assessed: 7, failedAssessments: 2 }), "complete");
    expect(d.state).toBe("incomplete");
    expect(d.detail).toContain("2 candidates could not be assessed");
  });

  it("never reports a topic in a failed run as quiet", () => {
    const d = diagnoseTopic(check({ fetched: 9, matched: 9, queued: 9 }), "failed");
    expect(d.state).toBe("failed");
  });

  it("mentions matches left over the assessment limit", () => {
    const d = diagnoseTopic(check({ fetched: 50, matched: 40, queued: 25, deferred: 15, assessed: 25 }), "complete");
    expect(d.detail).toContain("15 lower-ranked matches were over this check's assessment limit");
  });

  it("reports developments and high-priority counts", () => {
    const d = diagnoseTopic(check({ matched: 3, queued: 3, assessed: 3, developments: 2, highPriority: 1 }), "complete");
    expect(d.state).toBe("developments");
    expect(d.headline).toBe("2 new developments, 1 high priority");
  });

  it("is pending while the run is still assessing", () => {
    expect(diagnoseTopic(check({ queued: 6 }), "evaluating").headline).toBe("Assessing 6 candidates");
  });

  it("is final for a topic with nothing queued, even while the run assesses other topics", () => {
    expect(diagnoseTopic(check(), "evaluating").state).toBe("quiet");
  });
});

describe("topicStatus", () => {
  const run = (id: string, status: RunRecord["status"], topics: TopicCheck[]): RunRecord => ({
    id,
    userId: "u",
    mode: "manual",
    status,
    diagnostics: { topicOrder: topics.map((t) => t.topicId), topics },
    batchId: null,
    error: status === "failed" ? "boom" : null,
    createdAt: "2026-11-10T09:00:00Z",
    completedAt: "2026-11-10T09:02:00Z",
  });

  it("lets a newer failed run override an older quiet one", () => {
    const s = topicStatus("t1", [run("new", "failed", []), run("old", "complete", [check()])]);
    expect(s.diagnosis?.state).toBe("failed");
  });

  it("skips runs that did not include the topic", () => {
    const s = topicStatus("t1", [run("other", "complete", [check({ topicId: "t2" })]), run("old", "complete", [check()])]);
    expect(s.run?.id).toBe("old");
  });

  it("returns no diagnosis for a topic never checked", () => {
    expect(topicStatus("t1", []).diagnosis).toBeNull();
  });
});
