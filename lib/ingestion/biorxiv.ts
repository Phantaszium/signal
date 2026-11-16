import "server-only";

/**
 * bioRxiv / medRxiv ingestion via the public details API.
 *
 * https://api.biorxiv.org/details/{server}/{from}/{to}/{cursor}
 *
 * No key required. The API pages by record offset; the documented page size is
 * 100 but the live API currently returns 30, so the cursor advances by however
 * many records each page actually returned. A record appears once per version
 * posted in the window, so we keep only the latest version of each DOI.
 *
 * Failures never throw: a first-page failure returns null, a later-page
 * failure returns whatever was collected so far.
 */

import type { Publication } from "@/lib/types";
import { collapseWhitespace, fetchWithDeadline, logSourceFailure, teaser, type SourceResult } from "./http";

const API = "https://api.biorxiv.org/details";
const DEFAULT_MAX_RECORDS = 2000;
const MAX_AUTHORS = 12;
/** Stop paging when less than this remains; leave room for downstream work. */
const PAGE_MIN_REMAINING_MS = 1500;
/**
 * The details API is often slow: single pages have taken over 30s. Allow a
 * page that long, within the caller's overall deadline.
 */
const PAGE_TIMEOUT_MS = 40_000;

export type PreprintServer = "biorxiv" | "medrxiv";

/** One record from the details endpoint. Numeric fields arrive as strings. */
export interface BiorxivRecord {
  doi: string;
  title?: string;
  authors?: string;
  author_corresponding?: string;
  author_corresponding_institution?: string;
  date?: string;
  version?: string | number;
  type?: string;
  license?: string;
  category?: string;
  abstract?: string;
  published?: string;
  server?: string;
}

interface BiorxivMessage {
  status?: string;
  count?: number | string;
  total?: number | string;
  cursor?: number | string;
}

export interface BiorxivPage {
  messages?: BiorxivMessage[];
  collection?: BiorxivRecord[];
}

const SOURCE_LABEL: Record<PreprintServer, string> = {
  biorxiv: "bioRxiv",
  medrxiv: "medRxiv",
};

const versionOf = (r: BiorxivRecord) => Number(r.version) || 1;

/** Keep the highest version of each DOI, preserving first-seen order. */
export function dedupeLatestVersions(records: BiorxivRecord[]): BiorxivRecord[] {
  const byDoi = new Map<string, BiorxivRecord>();
  for (const r of records) {
    if (!r?.doi) continue;
    const prev = byDoi.get(r.doi);
    if (!prev || versionOf(r) > versionOf(prev)) byDoi.set(r.doi, r);
  }
  return [...byDoi.values()];
}

/** Map one details record to a Publication. */
export function mapPreprint(server: PreprintServer, r: BiorxivRecord): Publication {
  const title = collapseWhitespace(r.title) || "Untitled preprint";
  const abstract = collapseWhitespace(r.abstract);
  const version = versionOf(r);
  const institution = collapseWhitespace(r.author_corresponding_institution);
  const category = collapseWhitespace(r.category);
  return {
    // DOIs contain "/", which would split the /paper/[id] route segment.
    id: `${server}-${r.doi.replace(/\//g, "_")}`,
    title,
    source: SOURCE_LABEL[server],
    publishedAt: r.date ?? new Date().toISOString().slice(0, 10),
    type: "preprint",
    authors: (r.authors ?? "")
      .split(";")
      .map((a) => a.trim())
      .filter(Boolean)
      .slice(0, MAX_AUTHORS),
    summary: teaser(abstract, title),
    abstract: abstract || "Abstract not available for this preprint.",
    tags: category ? [category] : [],
    organizations: institution && institution.toUpperCase() !== "NA" ? [institution] : [],
    origin: server,
    url: `https://www.${server}.org/content/${r.doi}v${version}`,
    doi: r.doi,
  };
}

/** Fetch all preprints posted on `server` between `from` and `to` (YYYY-MM-DD). */
export async function fetchPreprints(
  server: PreprintServer,
  opts: { from: string; to: string; deadline: number; maxRecords?: number },
): Promise<SourceResult | null> {
  const maxRecords = opts.maxRecords ?? DEFAULT_MAX_RECORDS;
  const records: BiorxivRecord[] = [];
  let total = 0;
  let cursor = 0;

  while (true) {
    let page: BiorxivPage;
    try {
      const res = await fetchWithDeadline(
        `${API}/${server}/${opts.from}/${opts.to}/${cursor}`,
        opts.deadline,
        PAGE_TIMEOUT_MS,
      );
      if (!res.ok) throw new Error(`${server}: HTTP ${res.status}`);
      page = (await res.json()) as BiorxivPage;
    } catch (error) {
      logSourceFailure(server, error);
      if (cursor === 0) return null;
      break; // keep what we already have
    }

    const batch = page.collection ?? [];
    if (cursor === 0) total = Number(page.messages?.[0]?.total ?? batch.length) || 0;
    records.push(...batch);
    cursor += batch.length;

    if (!batch.length) break;
    if (cursor >= total || cursor >= maxRecords) break;
    if (opts.deadline - Date.now() < PAGE_MIN_REMAINING_MS) break;
  }

  const publications = dedupeLatestVersions(records.slice(0, maxRecords)).map((r) =>
    mapPreprint(server, r),
  );
  const complete = records.length >= total;
  return {
    publications,
    scanned: Math.max(total, records.length),
    complete,
    note: complete
      ? undefined
      : `Read ${records.length} of ${total} preprints posted in the window before reaching the time or size limit.`,
  };
}
