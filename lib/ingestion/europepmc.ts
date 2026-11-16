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
