import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import fixture from "./fixtures/biorxiv-details.json";
import {
  dedupeLatestVersions,
  fetchPreprints,
  mapPreprint,
  type BiorxivRecord,
} from "../biorxiv";

const records = fixture.collection as BiorxivRecord[];

describe("dedupeLatestVersions", () => {
  it("keeps only the highest version per DOI", () => {
    const out = dedupeLatestVersions(records);
    expect(out).toHaveLength(3);
    const dup = out.find((r) => r.doi === "10.64898/2026.10.27.762257");
    expect(dup?.version).toBe("2");
    expect(dup?.title).not.toContain("earlier version");
  });

  it("does not let a later, lower version overwrite a higher one", () => {
    const out = dedupeLatestVersions([...records].reverse());
    expect(out.find((r) => r.doi === "10.64898/2026.10.27.762257")?.version).toBe("2");
  });
});

describe("mapPreprint", () => {
  it("maps a bioRxiv record to a Publication", () => {
    const r = records[1];
    const p = mapPreprint("biorxiv", r);
    expect(p.id).toBe(`biorxiv-${r.doi.replace(/\//g, "_")}`);
    expect(p.origin).toBe("biorxiv");
    expect(p.type).toBe("preprint");
    expect(p.source).toBe("bioRxiv");
    expect(p.doi).toBe(r.doi);
    expect(p.publishedAt).toBe(r.date);
    expect(p.url).toBe(`https://www.biorxiv.org/content/${r.doi}v1`);
    expect(p.authors[0]).toBe("Kosakovsky Pond, S. L.");
    expect(p.authors).toHaveLength(6);
    expect(p.organizations).toEqual([r.author_corresponding_institution]);
    expect(p.tags).toEqual(["scientific communication and education"]);
    expect(p.abstract).not.toMatch(/\s{2,}|\n/);
    expect(p.summary.endsWith("…")).toBe(true);
    expect(p.summary.length).toBeLessThanOrEqual(221);
    expect(p.signals).toBeUndefined();
  });

  it("uses the version in the URL and the medRxiv labels", () => {
    const p = mapPreprint("medrxiv", records[2]);
    expect(p.url).toBe(`https://www.medrxiv.org/content/${records[2].doi}v2`);
    expect(p.source).toBe("medRxiv");
    expect(p.origin).toBe("medrxiv");
  });

  it("drops an NA institution and caps authors at 12", () => {
    const many = Array.from({ length: 20 }, (_, i) => `Author ${i}`).join("; ");
    const p = mapPreprint("biorxiv", { ...records[3], authors: many });
    expect(p.organizations).toEqual([]);
    expect(p.authors).toHaveLength(12);
  });
});

describe("fetchPreprints", () => {
  afterEach(() => vi.unstubAllGlobals());

  const page = (collection: BiorxivRecord[], total: number) =>
    new Response(JSON.stringify({ messages: [{ status: "ok", count: collection.length, total: String(total) }], collection }));

  it("pages by the number of records returned and dedupes", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(page(records.slice(0, 2), 4))
      .mockResolvedValueOnce(page(records.slice(2), 4));
    vi.stubGlobal("fetch", fetchMock);
    const out = await fetchPreprints("biorxiv", { from: "2026-11-04", to: "2026-11-05", deadline: Date.now() + 10000 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe("https://api.biorxiv.org/details/biorxiv/2026-11-04/2026-11-05/2");
    expect(out?.scanned).toBe(4);
    expect(out?.publications).toHaveLength(3);
  });

  it("returns partial results when a later page fails, null when the first fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(page(records.slice(0, 2), 4)).mockRejectedValueOnce(new Error("boom")));
    const partial = await fetchPreprints("biorxiv", { from: "a", to: "b", deadline: Date.now() + 10000 });
    expect(partial?.publications).toHaveLength(2);

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")));
    expect(await fetchPreprints("biorxiv", { from: "a", to: "b", deadline: Date.now() + 10000 })).toBeNull();
  });

  it("returns null without fetching when the deadline has passed", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await fetchPreprints("medrxiv", { from: "a", to: "b", deadline: Date.now() })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
