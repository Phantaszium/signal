import { describe, expect, it } from "vitest";
import { allocateCandidates, daysBefore, topicWindow, type Candidate } from "@/lib/monitoring/plan";
import { pub } from "@/test/fixtures";

const NOW = Date.parse("2026-11-15T09:00:00Z");

describe("topicWindow", () => {
  it("looks back 30 days on a topic's first check", () => {
    expect(topicWindow({ backfilledAt: null, lastCheckedAt: null }, NOW)).toEqual({
      from: "2026-10-16",
      to: "2026-11-15",
      backfill: true,
    });
  });

  it("re-reads from a day before the last check, at least two days", () => {
    const w = topicWindow({ backfilledAt: "x", lastCheckedAt: "2026-11-14T09:00:00Z" }, NOW);
    expect(w).toEqual({ from: "2026-11-13", to: "2026-11-15", backfill: false });
    const longer = topicWindow({ backfilledAt: "x", lastCheckedAt: "2026-11-10T09:00:00Z" }, NOW);
    expect(longer.from).toBe("2026-11-09");
  });

  it("caps the window after a long gap", () => {
    const w = topicWindow({ backfilledAt: "x", lastCheckedAt: "2026-09-01T00:00:00Z" }, NOW);
    expect(w.from).toBe("2026-11-01");
  });
});

describe("daysBefore", () => {
  it("shifts an ISO day", () => {
    expect(daysBefore("2026-11-03", 7)).toBe("2026-10-27");
  });
});

describe("allocateCandidates", () => {
  const c = (id: string, topicId: string, prefilter: number): Candidate => ({
    publication: pub(id, id),
    topicId,
    prefilter,
  });

  it("shares the budget across topics so a broad topic cannot starve a narrow one", () => {
    const broad = Array.from({ length: 20 }, (_, i) => c(`b${i}`, "broad", 90 - i));
    const narrow = [c("n1", "narrow", 20), c("n2", "narrow", 18)];
    const { chosen, deferred } = allocateCandidates(
      new Map([
        ["broad", broad],
        ["narrow", narrow],
      ]),
      6,
    );
    expect(chosen.map((x) => x.publication.id).sort()).toEqual(["b0", "b1", "b2", "b3", "n1", "n2"]);
    expect(deferred.get("broad")).toBe(16);
    expect(deferred.get("narrow")).toBe(0);
  });

  it("takes each topic's best candidates first and assesses a shared record once", () => {
    const { chosen } = allocateCandidates(
      new Map([
        ["a", [c("x", "a", 10), c("shared", "a", 50)]],
        ["b", [c("shared", "b", 60), c("y", "b", 5)]],
      ]),
      10,
    );
    // Round one: topic a takes "shared"; topic b skips it and takes "y".
    expect(chosen.map((x) => x.publication.id)).toEqual(["shared", "y", "x"]);
  });
});
