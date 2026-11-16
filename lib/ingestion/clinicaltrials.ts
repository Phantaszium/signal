import "server-only";

/**
 * ClinicalTrials.gov ingestion via the v2 REST API.
 *
 * https://clinicaltrials.gov/api/v2/studies
 *
 * No key required. We pull studies whose record was updated in the window and
 * match the profile's terms. Note that `query.term` is a broad full-text search
 * with synonym expansion, so results are noisy; the abstract we build is
 * deliberately rich so the downstream AI assessment can judge relevance.
 *
 * Failures never throw; they return null.
 */

import type { Publication, ResearchProfile } from "@/lib/types";
import { collapseWhitespace, fetchWithDeadline, teaser, type SourceResult } from "./http";

const API = "https://clinicaltrials.gov/api/v2/studies";
const DEFAULT_LIMIT = 50;
const MAX_TAGS = 6;
const MAX_INTERVENTIONS = 8;
const MAX_OUTCOMES = 4;

/** The subset of the v2 study shape we read. Everything is optional upstream. */
export interface CtStudy {
  protocolSection?: {
    identificationModule?: { nctId?: string; briefTitle?: string; officialTitle?: string };
    statusModule?: {
      overallStatus?: string;
      studyFirstPostDateStruct?: { date?: string };
      lastUpdatePostDateStruct?: { date?: string };
    };
    sponsorCollaboratorsModule?: {
      leadSponsor?: { name?: string };
      collaborators?: { name?: string }[];
    };
    descriptionModule?: { briefSummary?: string };
    conditionsModule?: { conditions?: string[]; keywords?: string[] };
    designModule?: {
      studyType?: string;
      phases?: string[];
      enrollmentInfo?: { count?: number; type?: string };
    };
    armsInterventionsModule?: { interventions?: { type?: string; name?: string }[] };
    outcomesModule?: { primaryOutcomes?: { measure?: string; timeFrame?: string }[] };
  };
  hasResults?: boolean;
}

export interface CtResponse {
  totalCount?: number;
  studies?: CtStudy[];
  nextPageToken?: string;
}

/** Quote a term if it contains whitespace, so the API treats it as a phrase. */
function quoteTerm(term: string): string {
  const t = term.trim().replace(/"/g, "");
  return /\s/.test(t) ? `"${t}"` : t;
}

/** Turn a research profile into a ClinicalTrials.gov `query.term` expression. */
export function buildTrialQuery(profile: ResearchProfile): string {
  const terms = [...profile.keywords, ...profile.genes.slice(0, 5), ...profile.diseases]
    .map((t) => t?.trim())
    .filter((t): t is string => Boolean(t));
  const seen = new Set<string>();
  const unique = terms.filter((t) => {
    const key = t.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return unique.map(quoteTerm).join(" OR ");
}

/** "ACTIVE_NOT_RECRUITING" -> "Active, not recruiting"-ish; "PHASE2" -> "Phase 2". */
function humanize(value: string): string {
  const phase = value.match(/^(EARLY_)?PHASE(\d)$/);
  if (phase) return `${phase[1] ? "Early " : ""}Phase ${phase[2]}`;
  if (value === "NA") return "Not applicable";
  const words = value.toLowerCase().replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Map one v2 study to a Publication. Returns null if it has no NCT ID. */
export function mapTrial(study: CtStudy): Publication | null {
  const p = study.protocolSection;
  const nctId = p?.identificationModule?.nctId;
  if (!p || !nctId) return null;

  const title =
    collapseWhitespace(p.identificationModule?.briefTitle) ||
    collapseWhitespace(p.identificationModule?.officialTitle) ||
    nctId;
  const briefSummary = collapseWhitespace(p.descriptionModule?.briefSummary);
  const conditions = (p.conditionsModule?.conditions ?? []).map(collapseWhitespace).filter(Boolean);
  const phases = (p.designModule?.phases ?? []).map(humanize);
  const enrollment = p.designModule?.enrollmentInfo;
  const interventions = (p.armsInterventionsModule?.interventions ?? [])
    .filter((i) => i.name)
    .slice(0, MAX_INTERVENTIONS)
    .map((i) => (i.type ? `${humanize(i.type)}: ${collapseWhitespace(i.name)}` : collapseWhitespace(i.name)));
  const outcomes = (p.outcomesModule?.primaryOutcomes ?? [])
    .filter((o) => o.measure)
    .slice(0, MAX_OUTCOMES)
    .map((o) =>
      o.timeFrame
        ? `${collapseWhitespace(o.measure)} (${collapseWhitespace(o.timeFrame)})`
        : collapseWhitespace(o.measure),
    );

  const sponsors = p.sponsorCollaboratorsModule;
  const organizations = [
    sponsors?.leadSponsor?.name,
    ...(sponsors?.collaborators ?? []).map((c) => c.name),
  ]
    .map((n) => collapseWhitespace(n))
    .filter((n, i, all) => n && all.indexOf(n) === i);

  const lines = [
    `Overall status: ${p.statusModule?.overallStatus ? humanize(p.statusModule.overallStatus) : "Unknown"}`,
    `Study type: ${p.designModule?.studyType ? humanize(p.designModule.studyType) : "Unknown"}`,
    `Phase: ${phases.length ? phases.join(" / ") : "Not specified"}`,
    `Enrollment: ${
      enrollment?.count != null
        ? `${enrollment.count}${enrollment.type ? ` (${enrollment.type.toLowerCase()})` : ""}`
        : "Not specified"
    }`,
    `Conditions: ${conditions.length ? conditions.join("; ") : "Not specified"}`,
    `Interventions: ${interventions.length ? interventions.join("; ") : "Not specified"}`,
    `Primary outcomes: ${outcomes.length ? outcomes.join("; ") : "Not specified"}`,
    organizations.length ? `Sponsors: ${organizations.join("; ")}` : "",
    study.hasResults ? "Results posted: yes" : "",
    `Summary: ${briefSummary || "No summary provided."}`,
  ].filter(Boolean);

  return {
    id: `nct-${nctId}`,
    title,
    source: "ClinicalTrials.gov",
    publishedAt:
      p.statusModule?.lastUpdatePostDateStruct?.date ??
      p.statusModule?.studyFirstPostDateStruct?.date ??
      new Date().toISOString().slice(0, 10),
    type: "trial",
    authors: [],
    summary: teaser(briefSummary, title),
    abstract: lines.join("\n"),
    tags: conditions.slice(0, MAX_TAGS),
    organizations,
    origin: "clinicaltrials",
    url: `https://clinicaltrials.gov/study/${nctId}`,
  };
}

/** Fetch trials matching the profile whose record was updated between `from` and `to`. */
export async function fetchTrials(
  profile: ResearchProfile,
  opts: { from: string; to: string; deadline: number; limit?: number },
): Promise<SourceResult | null> {
  try {
    const term = buildTrialQuery(profile);
    if (!term) return null;
    const params = new URLSearchParams({
      "query.term": term,
      "filter.advanced": `AREA[LastUpdatePostDate]RANGE[${opts.from},${opts.to}]`,
      pageSize: String(opts.limit ?? DEFAULT_LIMIT),
      countTotal: "true",
      format: "json",
    });
    const res = await fetchWithDeadline(`${API}?${params}`, opts.deadline);
    if (!res.ok) return null;
    const json = (await res.json()) as CtResponse;
    const studies = json.studies ?? [];
    const publications = studies
      .map(mapTrial)
      .filter((p): p is Publication => p !== null);
    return { publications, scanned: json.totalCount ?? studies.length };
  } catch {
    return null;
  }
}
