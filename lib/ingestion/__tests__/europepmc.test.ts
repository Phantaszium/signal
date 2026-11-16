import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { buildPreprintQuery, fetchEuropePmcPreprints, mapEpmcPreprint } from "../europepmc";

describe("buildPreprintQuery", () => {
  it("ORs topic terms over title and abstract, limited to preprints in the window", () => {
    expect(
      buildPreprintQuery(
        { keywords: ["spectinomycin"], synonyms: ["Trobicin"], genes: ["rpsE"], organisms: ["Vibrio natriegens"], diseases: [] },
        "2026-10-16",
        "2026-11-15",
      ),
    ).toBe(
      '(TITLE_ABS:"spectinomycin" OR TITLE_ABS:"Trobicin" OR TITLE_ABS:"rpsE" OR TITLE_ABS:"Vibrio natriegens") AND SRC:PPR AND FIRST_PDATE:[2026-10-16 TO 2026-11-15]',
    );
  });

  it("is empty with no terms", () => {
    expect(buildPreprintQuery({ keywords: [], genes: [], diseases: [] }, "a", "b")).toBe("");
  });
});

describe("mapEpmcPreprint", () => {
  it("gives bioRxiv records the same id as the bioRxiv feed, so they deduplicate", () => {
    const p = mapEpmcPreprint({
      id: "PPR1321803",
      doi: "10.64898/2026.09.14.751516",
      title: "Three catalase-peroxidases in <i>Vibrio natriegens</i>.",
      abstractText: "<h4>Abstract</h4>We show...",
      authorList: { author: [{ fullName: "Glasgo LD" }] },
      firstPublicationDate: "2026-09-16",
      bookOrReportDetails: { publisher: "bioRxiv" },
    })!;
    expect(p.id).toBe("biorxiv-10.64898_2026.09.14.751516");
    expect(p.origin).toBe("biorxiv");
    expect(p.title).toBe("Three catalase-peroxidases in Vibrio natriegens");
    expect(p.abstract).toBe("Abstract We show...");
    expect(p.url).toBe("https://doi.org/10.64898/2026.09.14.751516");
  });

  it("keeps other servers under their own id", () => {
    const p = mapEpmcPreprint({ id: "PPR1", title: "T", bookOrReportDetails: { publisher: "Research Square" } })!;
    expect(p.id).toBe("ppr-PPR1");
    expect(p.origin).toBe("europepmc");
    expect(p.source).toBe("Research Square");
    expect(p.url).toBe("https://europepmc.org/article/PPR/PPR1");
  });
});

describe("fetchEuropePmcPreprints", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reports an incomplete read when more records matched than were returned", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ hitCount: 250, resultList: { result: [{ id: "PPR1", title: "T" }] } }),
      ),
    );
    const r = await fetchEuropePmcPreprints({ keywords: ["x"], genes: [], diseases: [] }, {
      from: "a",
      to: "b",
      deadline: Date.now() + 10_000,
    });
    expect(r?.scanned).toBe(250);
    expect(r?.complete).toBe(false);
    expect(r?.note).toContain("1 of 250");
  });

  it("returns null when the API fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 503 })));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(
      await fetchEuropePmcPreprints({ keywords: ["x"], genes: [], diseases: [] }, { from: "a", to: "b", deadline: Date.now() + 10_000 }),
    ).toBeNull();
  });
});
