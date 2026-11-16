import { describe, expect, it } from "vitest";
import { NEUTRAL_PREFERENCE_WEIGHTS } from "@/lib/data/profile";
import { digestDue, digestWindow, selectDigestEntries } from "@/lib/digests/plan";
import { item, topic } from "@/test/fixtures";

const NOW = Date.parse("2026-11-15T10:30:00Z");
const DAY = 86_400_000;

describe("digestDue", () => {
  it("is never due for alerts-only or off", () => {
    expect(digestDue("important_only", null, NOW)).toBe(false);
    expect(digestDue("off", null, NOW)).toBe(false);
  });

  it("allows a little slack for cron timing", () => {
    expect(digestDue("daily", new Date(NOW - 23 * 3_600_000).toISOString(), NOW)).toBe(true);
    expect(digestDue("daily", new Date(NOW - 20 * 3_600_000).toISOString(), NOW)).toBe(false);
    expect(digestDue("weekly", new Date(NOW - 3 * DAY).toISOString(), NOW)).toBe(false);
  });
});

describe("digestWindow", () => {
  it("covers the time since the last digest, at most two periods", () => {
    expect(digestWindow("weekly", new Date(NOW - 7 * DAY).toISOString(), NOW).start).toBe(NOW - 7 * DAY);
    expect(digestWindow("weekly", new Date(NOW - 60 * DAY).toISOString(), NOW).start).toBe(NOW - 14 * DAY);
    expect(digestWindow("daily", null, NOW).start).toBe(NOW - DAY);
  });
});

describe("selectDigestEntries", () => {
  const window = { start: NOW - 7 * DAY, end: NOW };
  const at = (daysAgo: number) => new Date(NOW - daysAgo * DAY).toISOString();

  it("includes only developments from the window that were not dismissed", () => {
    const entries = selectDigestEntries(
      [
        item("in", 80, { evaluatedAt: at(1) }),
        item("old", 90, { evaluatedAt: at(10) }),
        item("weak", 30, { evaluatedAt: at(1) }),
        item("dismissed", 90, { evaluatedAt: at(1) }),
        item("orphan", 90, { evaluatedAt: at(1), topicId: null }),
      ],
      [topic()],
      NEUTRAL_PREFERENCE_WEIGHTS,
      new Set(["dismissed"]),
      window,
    );
    expect(entries.map((e) => e.item.publication.id)).toEqual(["in"]);
  });

  it("returns nothing rather than padding a quiet period", () => {
    const entries = selectDigestEntries(
      [item("a", 35, { evaluatedAt: at(1) }), item("b", 20, { evaluatedAt: at(2) })],
      [topic()],
      NEUTRAL_PREFERENCE_WEIGHTS,
      new Set(),
      window,
    );
    expect(entries).toEqual([]);
  });

  it("puts high-priority developments first", () => {
    const entries = selectDigestEntries(
      [
        item("solid", 95, { evaluatedAt: at(1), scores: { novelty: 99, evidence: 99, strategic: 99 }, assessment: { significance: { level: "moderate", reason: "" } } }),
        item("major", 70, { evaluatedAt: at(1), assessment: { significance: { level: "major", reason: "" } } }),
      ],
      [topic()],
      NEUTRAL_PREFERENCE_WEIGHTS,
      new Set(),
      window,
    );
    expect(entries.map((e) => [e.item.publication.id, e.highPriority])).toEqual([
      ["solid", true],
      ["major", true],
    ]);
  });
});
