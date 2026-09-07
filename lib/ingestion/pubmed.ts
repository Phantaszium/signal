import "server-only";

/**
 * PubMed / NCBI E-utilities ingestion.
 *
 * No API key is required; a key (NCBI_API_KEY) only raises the rate limit.
 * Every failure path returns an empty array so the pipeline can fall back to
 * the seed corpus without the demo ever breaking.
 */

import type { Publication, PublicationSignals, ResearchProfile } from "@/lib/types";

const EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";

/**
 * Timeouts are budgeted for a serverless host, not a laptop.
 *
 * One ingestion makes three sequential NCBI calls (esearch → esummary →
 * efetch). A per-call timeout alone is not enough: three slow calls would
 * exceed the platform's function duration limit and return a gateway error
 * instead of falling back to the seed corpus. So the whole operation shares a
 * single deadline, and any call that would run past it is abandoned in favour
 * of the seeded demo data.
 */
const TOTAL_BUDGET_MS = 7000;
const PER_CALL_TIMEOUT_MS = 4000;
/** Below this, there is not enough time left for a request to be useful. */
const MIN_USEFUL_MS = 300;

/** Turn a research profile into a PubMed boolean query. */
export function buildQuery(profile: ResearchProfile): string {
  const terms = [...profile.keywords, ...profile.genes.slice(0, 3)]
    .map((t) => `"${t}"[Title/Abstract]`)
    .join(" OR ");
  return `(${terms}) AND ("last 30 days"[dp])`;
}

async function fetchWithTimeout(url: string, deadline: number): Promise<Response> {
  const remaining = deadline - Date.now();
  if (remaining < MIN_USEFUL_MS) {
    throw new Error("pubmed: time budget exhausted");
  }
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    Math.min(PER_CALL_TIMEOUT_MS, remaining),
  );
  try {
    return await fetch(url, { signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Append NCBI credentials and identification.
 *
 * Both are read server-side only (this module is `server-only`), so the key is
 * never exposed to the browser. NCBI asks API consumers to identify themselves
 * with tool/email; on shared serverless IPs that identification measurably
 * reduces the chance of being rate-limited.
 */
function withKey(url: string): string {
  const key = process.env.NCBI_API_KEY;
  const email = process.env.NCBI_TOOL_EMAIL;
  let out = `${url}&tool=signal`;
  if (key) out += `&api_key=${encodeURIComponent(key)}`;
  if (email) out += `&email=${encodeURIComponent(email)}`;
  return out;
}

interface ESummaryRecord {
  uid: string;
  title?: string;
  source?: string;
  pubdate?: string;
  sortpubdate?: string;
  authors?: { name: string }[];
  articleids?: { idtype: string; value: string }[];
  pubtype?: string[];
}

/**
 * Derive ranking signals from PubMed metadata. Deliberately conservative:
 * without the full text we can only infer weakly, so live items get modest
 * priors rather than confident ones.
 */
function inferSignals(title: string, abstractText: string): PublicationSignals {
  const text = `${title} ${abstractText}`.toLowerCase();
  const has = (...words: string[]) => words.some((w) => text.includes(w));
  return {
    mechanistic: has("mechanism", "mechanistic", "drives", "mediates", "confers"),
    inVitroOnly:
      has("in vitro", "cell line") && !has("patient", "xenograft", "in vivo", "clinical"),
    clinical: has("patients", "clinical trial", "phase 1", "phase 2", "phase 3", "cohort"),
    acquiredResistance: has("acquired resistance", "resistance", "refractory", "relapse"),
    negativeResult: has("did not improve", "no significant difference", "failed to"),
    noveltyPrior: 55,
    strategicPrior: 40,
    replication: "none",
  };
}

function classifyType(pubtypes: string[] = []): Publication["type"] {
  const joined = pubtypes.join(" ").toLowerCase();
  if (joined.includes("preprint")) return "preprint";
  if (joined.includes("clinical trial") || joined.includes("randomized")) return "trial";
  return "journal";
}

const escapeRegExp = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Some records repeat the title as the first abstract paragraph. */
function stripLeadingTitle(abstract: string, title: string): string {
  if (!abstract || title.length < 20) return abstract;
  return abstract
    .replace(new RegExp(`^${escapeRegExp(title)}\\.?\\s*`, "i"), "")
    .trim();
}

function toIsoDate(pubdate?: string): string {
  if (!pubdate) return new Date().toISOString().slice(0, 10);
  const parsed = new Date(pubdate);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString().slice(0, 10);
  return parsed.toISOString().slice(0, 10);
}

/**
 * Sections that mark the end of the abstract body in efetch text output.
 * Everything from here on (copyright, DOI, conflict-of-interest statements) is
 * metadata. This matters: COI statements name dozens of pharma companies, and
 * letting them into the abstract produces false watchlist matches.
 */
const ABSTRACT_TERMINATOR =
  /^(©|Copyright|DOI:|PMID:|PMCID:|Conflict of interest|Competing interest|Comment in|Comment on|Erratum|Update of|Publisher:|Funding:)/i;

/** Author lists and affiliation blocks, which sit above the abstract body. */
function isFrontMatter(paragraph: string): boolean {
  if (/^Author information/i.test(paragraph)) return true;
  if (/^\(\d+\)/.test(paragraph)) return true; // affiliation block
  const commas = paragraph.match(/,/g)?.length ?? 0;
  return /\(\d+\)/.test(paragraph) && commas > 3; // "Smith J(1), Doe A(2), ..."
}

/** Extract just the abstract body from one efetch text record. */
function extractAbstract(record: string): string {
  const paragraphs = record.split(/\n\s*\n/).map((p) => p.replace(/\s+/g, " ").trim());
  const body: string[] = [];
  // Skip the leading citation line; stop at the first metadata section.
  for (const paragraph of paragraphs.slice(1)) {
    if (ABSTRACT_TERMINATOR.test(paragraph)) break;
    if (isFrontMatter(paragraph)) continue;
    if (paragraph.length < 200) continue; // title and short notes
    body.push(paragraph);
  }
  return body.join(" ").trim();
}

/** Fetch abstracts in one efetch call, keyed by PMID. */
async function fetchAbstracts(
  ids: string[],
  deadline: number,
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  try {
    const url = withKey(
      `${EUTILS}/efetch.fcgi?db=pubmed&id=${ids.join(",")}&rettype=abstract&retmode=text`,
    );
    const res = await fetchWithTimeout(url, deadline);
    if (!res.ok) return out;
    const text = await res.text();
    // efetch text mode numbers each record: "1. Journal. 2026 ..."
    for (const record of text.split(/\n(?=\d+\.\s)/)) {
      const pmid = record.match(/PMID:\s*(\d+)/)?.[1];
      if (!pmid) continue;
      const body = extractAbstract(record);
      if (body) out[pmid] = body;
    }
  } catch {
    // Abstracts are optional; ranking degrades gracefully without them.
  }
  return out;
}

export interface PubMedResult {
  publications: Publication[];
  /** Total hits PubMed reports for the query, used for the funnel's top number. */
  totalFound: number;
}

export async function fetchPubMed(
  profile: ResearchProfile,
  limit = 40,
): Promise<PubMedResult | null> {
  const deadline = Date.now() + TOTAL_BUDGET_MS;
  try {
    const query = encodeURIComponent(buildQuery(profile));
    const searchUrl = withKey(
      `${EUTILS}/esearch.fcgi?db=pubmed&term=${query}&retmax=${limit}&sort=date&retmode=json`,
    );
    const searchRes = await fetchWithTimeout(searchUrl, deadline);
    if (!searchRes.ok) return null;
    const searchJson = await searchRes.json();
    const ids: string[] = searchJson?.esearchresult?.idlist ?? [];
    const totalFound = Number(searchJson?.esearchresult?.count ?? ids.length);
    if (!ids.length) return null;

    const sumUrl = withKey(
      `${EUTILS}/esummary.fcgi?db=pubmed&id=${ids.join(",")}&retmode=json`,
    );
    const sumRes = await fetchWithTimeout(sumUrl, deadline);
    if (!sumRes.ok) return null;
    const sumJson = await sumRes.json();
    const abstracts = await fetchAbstracts(ids, deadline);

    const publications: Publication[] = ids
      .map((id) => sumJson?.result?.[id] as ESummaryRecord | undefined)
      .filter((r): r is ESummaryRecord => Boolean(r?.title))
      .map((r) => {
        const title = r.title!.replace(/\.$/, "");
        const abstract = stripLeadingTitle(abstracts[r.uid] ?? "", title);
        const doi = r.articleids?.find((a) => a.idtype === "doi")?.value;
        return {
          id: `pmid-${r.uid}`,
          title,
          source: r.source ?? "PubMed",
          publishedAt: toIsoDate(r.sortpubdate ?? r.pubdate),
          type: classifyType(r.pubtype),
          authors: (r.authors ?? []).map((a) => a.name).slice(0, 8),
          summary: abstract ? `${abstract.slice(0, 220).trim()}…` : title,
          abstract: abstract || "Abstract not available from PubMed for this record.",
          tags: [],
          organizations: [],
          origin: "pubmed" as const,
          url: `https://pubmed.ncbi.nlm.nih.gov/${r.uid}/`,
          doi,
          signals: inferSignals(title, abstract),
        };
      });

    return { publications, totalFound };
  } catch {
    return null;
  }
}
