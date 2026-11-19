import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import fixture from "./fixtures/clinicaltrials-studies.json";
import { buildTrialQuery, fetchTrials, mapTrial, type CtStudy } from "../clinicaltrials";
import type { ResearchProfile } from "@/lib/types";

const studies = fixture.studies as CtStudy[];

const profile: ResearchProfile = {
  program: "KRAS NSCLC",
  description: "",
  keywords: ["KRAS G12C", "acquired resistance"],
  genes: ["KRAS", "STK11", "KEAP1", "EGFR", "TP53", "SHP2"],
  diseases: ["non-small cell lung cancer", "kras"],
  techniques: ["CRISPR"],
  organizations: ["Amgen"],
};

describe("buildTrialQuery", () => {
  it("ORs keywords, the first five genes and diseases, quoting phrases", () => {
    expect(buildTrialQuery(profile)).toBe(
      '"KRAS G12C" OR "acquired resistance" OR KRAS OR STK11 OR KEAP1 OR EGFR OR TP53 OR "non-small cell lung cancer"',
    );
  });

  it("returns an empty string for an empty profile", () => {
    expect(buildTrialQuery({ ...profile, keywords: [], genes: [], diseases: [] })).toBe("");
  });
});

describe("mapTrial", () => {
  it("maps a study with collaborators, phases and interventions", () => {
    const p = mapTrial(studies[0])!;
    expect(p.id).toBe("nct-NCT07397338");
    expect(p.origin).toBe("clinicaltrials");
    expect(p.type).toBe("trial");
    expect(p.source).toBe("ClinicalTrials.gov");
    expect(p.title).toBe("Study of RAS(ON) Inhibitors in Combination With Ivonescimab in Patients With Solid Tumors");
    expect(p.publishedAt).toBe("2026-11-04");
    expect(p.url).toBe("https://clinicaltrials.gov/study/NCT07397338");
    expect(p.organizations).toEqual(["Revolution Medicines, Inc.", "Summit Therapeutics"]);
    expect(p.authors).toEqual([]);
    expect(p.tags).toHaveLength(6);
    expect(p.tags).toContain("NSCLC");
    expect(p.abstract).toContain("Overall status: Recruiting");
    expect(p.abstract).toContain("Phase: Phase 1 / Phase 2");
    expect(p.abstract).toContain("Enrollment: 370 (estimated)");
    expect(p.abstract).toContain("Drug: Daraxonrasib");
    expect(p.abstract).toContain("Primary outcomes:");
    expect(p.abstract).toContain("Summary: The purpose of this study");
    expect(p.summary.endsWith("…")).toBe(true);
    expect(p.summary.length).toBeLessThanOrEqual(221);
  });

  it("handles a study without phases or collaborators", () => {
    const p = mapTrial(studies[2])!;
    expect(p.id).toBe("nct-NCT02682667");
    expect(p.organizations).toEqual(["National Cancer Institute (NCI)"]);
    expect(p.abstract).toContain("Phase: Not specified");
  });

  it("falls back to the first-post date and skips studies without an NCT ID", () => {
    const s = structuredClone(studies[1]);
    delete s.protocolSection!.statusModule!.lastUpdatePostDateStruct;
    expect(mapTrial(s)!.publishedAt).toBe(s.protocolSection!.statusModule!.studyFirstPostDateStruct!.date);
    expect(mapTrial({ protocolSection: {} })).toBeNull();
  });
});

describe("fetchTrials", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("builds the request and reports totalCount as scanned", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(fixture)));
    vi.stubGlobal("fetch", fetchMock);
    const out = await fetchTrials(profile, { from: "2026-11-04", to: "2026-11-05", deadline: Date.now() + 10000, limit: 3 });
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.origin + url.pathname).toBe("https://clinicaltrials.gov/api/v2/studies");
    expect(url.searchParams.get("filter.advanced")).toBe("AREA[LastUpdatePostDate]RANGE[2026-11-04,2026-11-05]");
    expect(url.searchParams.get("pageSize")).toBe("3");
    expect(url.searchParams.get("countTotal")).toBe("true");
    expect(url.searchParams.get("query.term")).toBe(buildTrialQuery(profile));
    expect(out?.scanned).toBe(fixture.totalCount);
    expect(out?.publications).toHaveLength(3);
  });

  it("returns null on HTTP or network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("nope", { status: 500 })));
    expect(await fetchTrials(profile, { from: "a", to: "b", deadline: Date.now() + 10000 })).toBeNull();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    expect(await fetchTrials(profile, { from: "a", to: "b", deadline: Date.now() + 10000 })).toBeNull();
  });
});
