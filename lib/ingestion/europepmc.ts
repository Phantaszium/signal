import "server-only";

/**
 * Preprint search via Europe PMC's REST API.
 *
 * https://www.ebi.ac.uk/europepmc/webservices/rest/search
 *
 * bioRxiv and medRxiv can only be read date by date (see biorxiv.ts), which
 * is too slow to look back more than a few days. Europe PMC indexes preprints
 * from those servers and others (Research Square, SSRN, Preprints.org...) and
 * can be searched by topic over any window, so it is what makes a longer
 * first look-back for a new topic possible. It indexes with a lag of a few
 * days, so the bioRxiv/medRxiv feeds stay the source for the latest records.
 *
 * Free; no key. Failures never throw; they return null.
 */

import type { Publication, PublicationOrigin } from "@/lib/types";
import {
  collapseWhitespace,
  fetchWithDeadline,
  logSourceFailure,
  teaser,
  type QueryTerms,
  type SourceResult,
} from "./http";

const API = "https://www.ebi.ac.uk/europepmc/webservices/rest/search";
const DEFAULT_LIMIT = 100;
const MAX_AUTHORS = 12;

export interface EpmcRecord {
  id: string;
  source?: string;
  doi?: string;
  title?: string;
  abstractText?: string;
  authorString?: string;
  authorList?: { author?: { fullName?: string }[] };
  firstPublicationDate?: string;
  bookOrReportDetails?: { publisher?: string };
}

interface EpmcResponse {
  hitCount?: number;
  resultList?: { result?: EpmcRecord[] };
}

/** Topic terms as a Europe PMC title/abstract query over preprints posted in the window. */
export function buildPreprintQuery(profile: QueryTerms, from: string, to: string): string {
  const terms = [
    ...profile.keywords,
    ...(profile.synonyms ?? []),
    ...profile.genes.slice(0, 5),
    ...(profile.organisms ?? []),
    ...profile.diseases.slice(0, 3),
  ]
    .map((t) => t.trim().replace(/"/g, ""))
    .filter(Boolean)
    .map((t) => `TITLE_ABS:"${t}"`);
  if (!terms.length) return "";
  return `(${terms.join(" OR ")}) AND SRC:PPR AND FIRST_PDATE:[${from} TO ${to}]`;
}

/** Drop inline markup (<i>, <sup>, <h4>...) without gluing words or stranding punctuation. */
const stripTags = (s: string | undefined) =>
  collapseWhitespace((s ?? "").replace(/<[^>]+>/g, " ")).replace(/\s+([.,;:)])/g, "$1");

/**
 * Map one record. bioRxiv and medRxiv preprints get the same id the
 * bioRxiv feed gives them (server + DOI), so a preprint found both ways is
 * stored, assessed and shown once.
 */
export function mapEpmcPreprint(r: EpmcRecord): Publication | null {
  if (!r.id) return null;
  const publisher = collapseWhitespace(r.bookOrReportDetails?.publisher);
  const server: PublicationOrigin | null =
    /^biorxiv$/i.test(publisher) ? "biorxiv" : /^medrxiv$/i.test(publisher) ? "medrxiv" : null;
  const doi = r.doi?.trim() || undefined;

  const title = stripTags(r.title).replace(/\.$/, "") || "Untitled preprint";
  const abstract = stripTags(r.abstractText);
  const authors = (r.authorList?.author ?? [])
    .map((a) => collapseWhitespace(a.fullName))
    .filter(Boolean);

  return {
    id: server && doi ? `${server}-${doi.replace(/\//g, "_")}` : `ppr-${r.id}`,
    title,
    source: publisher || "Preprint",
    publishedAt: r.firstPublicationDate ?? new Date().toISOString().slice(0, 10),
    type: "preprint",
    authors: (authors.length ? authors : (r.authorString ?? "").split(",").map((a) => a.trim()))
      .filter(Boolean)
      .slice(0, MAX_AUTHORS),
    summary: teaser(abstract, title),
    abstract: abstract || "Abstract not available for this preprint.",
    tags: [],
    organizations: [],
    origin: server ?? "europepmc",
    url: doi ? `https://doi.org/${doi}` : `https://europepmc.org/article/PPR/${r.id}`,
    doi,
  };
}

/** Search preprints matching a topic, posted between `from` and `to` (YYYY-MM-DD). */
export async function fetchEuropePmcPreprints(
  profile: QueryTerms,
  opts: { from: string; to: string; deadline: number; limit?: number },
): Promise<SourceResult | null> {
  const query = buildPreprintQuery(profile, opts.from, opts.to);
  if (!query) return null;
  const limit = opts.limit ?? DEFAULT_LIMIT;
  try {
    const params = new URLSearchParams({
      query,
      format: "json",
      resultType: "core",
      pageSize: String(limit),
      sort: "P_PDATE_D desc",
    });
    const res = await fetchWithDeadline(`${API}?${params}`, opts.deadline, 15_000);
    if (!res.ok) {
      logSourceFailure("europepmc", `HTTP ${res.status}`);
      return null;
    }
    const json = (await res.json()) as EpmcResponse;
    const records = json.resultList?.result ?? [];
    const publications = records
      .map(mapEpmcPreprint)
      .filter((p): p is Publication => p !== null);
    const scanned = json.hitCount ?? records.length;
    const complete = scanned <= records.length;
    return {
      publications,
      scanned,
      complete,
      note: complete ? undefined : `Read the newest ${records.length} of ${scanned} matching preprints.`,
    };
  } catch (error) {
    logSourceFailure("europepmc", error);
    return null;
  }
}

// ------------------------------------------------------------ live search

/** Extra fields Europe PMC returns for journal articles. */
export interface EpmcArticle extends EpmcRecord {
  pmid?: string;
  pmcid?: string;
  isOpenAccess?: string;
  journalInfo?: { journal?: { title?: string }; yearOfPublication?: number };
  pubTypeList?: { pubType?: string[] };
}

export interface SearchFilters {
  /** Only records first published on or after this date (YYYY-MM-DD). */
  from?: string;
  type?: "all" | "journal" | "preprint";
  openAccessOnly?: boolean;
  /** Restrict to one journal title. */
  journal?: string;
  sort?: "relevance" | "date";
}

/** A search hit with the provenance the results list shows. */
export interface SearchHit {
  publication: Publication;
  openAccess: boolean;
  pmcid?: string;
}

const clean = (s: string) => s.replace(/["\\]/g, " ").replace(/\s+/g, " ").trim();

/**
 * A Europe PMC query for a student's free-text search. Europe PMC covers
 * PubMed/MEDLINE, PubMed Central and preprint servers in one index, so a
 * single query searches all of them. Free text is passed through as Europe
 * PMC's own search syntax (it supports AND/OR and quoted phrases).
 */
export function buildSearchQuery(text: string, f: SearchFilters = {}): string {
  const q = text.trim();
  if (!q) return "";
  const parts = [`(${q})`];
  if (f.type === "journal") parts.push("NOT SRC:PPR");
  if (f.type === "preprint") parts.push("SRC:PPR");
  if (f.openAccessOnly) parts.push("OPEN_ACCESS:y");
  if (f.journal?.trim()) parts.push(`JOURNAL:"${clean(f.journal)}"`);
  if (f.from && /^\d{4}-\d{2}-\d{2}$/.test(f.from)) {
    parts.push(`FIRST_PDATE:[${f.from} TO ${new Date().toISOString().slice(0, 10)}]`);
  }
  return parts.join(" AND ");
}

/**
 * Map any Europe PMC record. PubMed records get the same id the PubMed
 * adapter gives them, and bioRxiv/medRxiv preprints the same id the preprint
 * feed gives them, so a paper found by search and by monitoring is one paper.
 */
export function mapEpmcArticle(r: EpmcArticle): SearchHit | null {
  if (!r.id) return null;
  const openAccess = r.isOpenAccess === "Y";
  if (r.source === "PPR") {
    const pub = mapEpmcPreprint(r);
    return pub ? { publication: pub, openAccess, pmcid: r.pmcid } : null;
  }
  const title = stripTags(r.title).replace(/\.$/, "");
  if (!title) return null;
  const abstract = stripTags(r.abstractText);
  const doi = r.doi?.trim() || undefined;
  const authors = (r.authorList?.author ?? [])
    .map((a) => collapseWhitespace(a.fullName))
    .filter(Boolean);
  const types = (r.pubTypeList?.pubType ?? []).join(" ").toLowerCase();
  const pmid = r.pmid ?? (r.source === "MED" ? r.id : undefined);
  const publication: Publication = {
    id: pmid ? `pmid-${pmid}` : `epmc-${r.source ?? "x"}-${r.id}`,
    title,
    source: collapseWhitespace(r.journalInfo?.journal?.title) || "Journal article",
    publishedAt:
      r.firstPublicationDate ??
      (r.journalInfo?.yearOfPublication ? `${r.journalInfo.yearOfPublication}-01-01` : new Date().toISOString().slice(0, 10)),
    type: types.includes("clinical trial") || types.includes("randomized") ? "trial" : "journal",
    authors: (authors.length ? authors : (r.authorString ?? "").split(",").map((a) => a.trim()))
      .filter(Boolean)
      .slice(0, MAX_AUTHORS),
    summary: teaser(abstract, title),
    abstract,
    tags: [],
    organizations: [],
    origin: pmid ? "pubmed" : "europepmc",
    url: pmid
      ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`
      : doi
        ? `https://doi.org/${doi}`
        : `https://europepmc.org/article/${r.source}/${r.id}`,
    doi,
  };
  return { publication, openAccess, pmcid: r.pmcid };
}

export type SearchOutcome =
  | { ok: true; hits: SearchHit[]; total: number; nextCursor: string | null }
  | { ok: false; reason: string };

/** Live literature search for the Discover page. */
export async function searchLiterature(
  text: string,
  filters: SearchFilters = {},
  opts: { cursor?: string; pageSize?: number } = {},
): Promise<SearchOutcome> {
  const query = buildSearchQuery(text, filters);
  if (!query) return { ok: true, hits: [], total: 0, nextCursor: null };
  const params = new URLSearchParams({
    query,
    format: "json",
    resultType: "core",
    pageSize: String(opts.pageSize ?? 20),
    cursorMark: opts.cursor ?? "*",
  });
  if (filters.sort === "date") params.set("sort", "P_PDATE_D desc");
  try {
    const res = await fetchWithDeadline(`${API}?${params}`, Date.now() + 20_000, 15_000);
    if (!res.ok) {
      logSourceFailure("europepmc-search", `HTTP ${res.status}`);
      return { ok: false, reason: `Europe PMC returned an error (HTTP ${res.status}).` };
    }
    const json = (await res.json()) as EpmcResponse & { nextCursorMark?: string; resultList?: { result?: EpmcArticle[] } };
    const records = (json.resultList?.result ?? []) as EpmcArticle[];
    const hits = records.map(mapEpmcArticle).filter((h): h is SearchHit => h !== null);
    const total = json.hitCount ?? hits.length;
    const next = json.nextCursorMark && json.nextCursorMark !== opts.cursor && records.length ? json.nextCursorMark : null;
    return { ok: true, hits, total, nextCursor: next };
  } catch (error) {
    logSourceFailure("europepmc-search", error);
    return { ok: false, reason: "Europe PMC could not be reached. Try again in a moment." };
  }
}

/** Look up one paper by DOI or PMID. Null when it is not indexed or the source is unreachable. */
export async function lookupPaper(
  id: { doi: string } | { pmid: string } | { source: string; extId: string },
): Promise<SearchHit | null> {
  const query =
    "doi" in id
      ? `DOI:"${clean(id.doi)}"`
      : "pmid" in id
        ? `EXT_ID:${id.pmid.replace(/\D/g, "")} AND SRC:MED`
        : `EXT_ID:"${clean(id.extId)}" AND SRC:${id.source.replace(/[^A-Z]/g, "")}`;
  const params = new URLSearchParams({ query, format: "json", resultType: "core", pageSize: "1" });
  try {
    const res = await fetchWithDeadline(`${API}?${params}`, Date.now() + 12_000, 10_000);
    if (!res.ok) return null;
    const json = (await res.json()) as { resultList?: { result?: EpmcArticle[] } };
    const first = json.resultList?.result?.[0];
    return first ? mapEpmcArticle(first) : null;
  } catch (error) {
    logSourceFailure("europepmc-lookup", error);
    return null;
  }
}
