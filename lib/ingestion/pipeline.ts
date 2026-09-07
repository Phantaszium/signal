/**
 * The briefing pipeline:
 *
 *   ingest (PubMed | seed) → normalize → relevance filter → rank → briefing
 *
 * The whole point of Signal lives in the filter and the rank steps: the
 * pipeline is explicitly built to throw most things away.
 */

import { DEMO_SCAN_VOLUME } from "@/lib/constants";
import { SEED_PUBLICATIONS } from "@/lib/data/seed-papers";
import { fetchPubMed } from "@/lib/ingestion/pubmed";
import { buildWhyThisMatters } from "@/lib/ranking/explain";
import {
  MAX_HIGH_ITEMS,
  RELEVANCE_FLOOR,
  scorePublication,
} from "@/lib/ranking/scoring";
import type {
  Briefing,
  PreferenceWeights,
  Publication,
  ResearchProfile,
  ScoredPublication,
} from "@/lib/types";

export { DEMO_SCAN_VOLUME };

export interface BuildBriefingOptions {
  profile: ResearchProfile;
  weights: PreferenceWeights;
  /** Attempt a live PubMed pull. Falls back to seed automatically on failure. */
  live?: boolean;
  now?: Date;
  /** Publication ids the user has marked "not relevant" — excluded outright. */
  dismissedIds?: string[];
}

/** De-duplicate by DOI, then by normalized title. */
function dedupe(pubs: Publication[]): Publication[] {
  const seen = new Set<string>();
  return pubs.filter((p) => {
    const key = (p.doi ?? p.title).toLowerCase().replace(/[^a-z0-9]/g, "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function buildBriefing({
  profile,
  weights,
  live = false,
  now = new Date(),
  dismissedIds = [],
}: BuildBriefingOptions): Promise<Briefing> {
  // ---- 1. Ingest -----------------------------------------------------------
  let ingested: Publication[] = SEED_PUBLICATIONS;
  let sourceMode: Briefing["sourceMode"] = "seed";
  let sourceNote =
    "Demo corpus — fictional but scientifically plausible records. No live source configured.";
  let scanVolume = DEMO_SCAN_VOLUME;

  if (live) {
    const result = await fetchPubMed(profile);
    if (result && result.publications.length) {
      ingested = dedupe([...result.publications, ...SEED_PUBLICATIONS]);
      sourceMode = "pubmed+seed";
      sourceNote = `${result.publications.length} live PubMed records merged with the demo corpus. Live items are labelled PubMed.`;
      scanVolume = Math.max(result.totalFound, DEMO_SCAN_VOLUME);
    } else {
      sourceNote =
        "PubMed was unavailable or returned nothing; fell back to the demo corpus.";
    }
  }

  const dismissed = new Set(dismissedIds);
  const candidates = ingested.filter((p) => !dismissed.has(p.id));

  // ---- 2. Rank -------------------------------------------------------------
  const scored: ScoredPublication[] = candidates.map((pub) => {
    const s = scorePublication(pub, { profile, weights, now });
    return { ...s, whyThisMatters: buildWhyThisMatters(s, profile) };
  });

  // ---- 3. Filter: only items that clear the relevance floor survive ---------
  const relevant = scored
    .filter((s) => s.scores.researchRelevance >= RELEVANCE_FLOOR)
    .sort((a, b) => b.signalScore - a.signalScore);

  // ---- 4. Tier, with a hard cap on HIGH so the briefing stays readable ------
  const high = relevant.slice(0, MAX_HIGH_ITEMS).filter((s) => s.tier === "HIGH");
  const highIds = new Set(high.map((s) => s.publication.id));
  const rest = relevant.filter((s) => !highIds.has(s.publication.id));
  const notable = rest.filter((s) => s.tier !== "CONTEXT");
  const context = rest.filter((s) => s.tier === "CONTEXT");

  return {
    generatedAt: now.toISOString(),
    funnel: {
      ingested: scanVolume,
      likelyRelevant: relevant.length,
      important: high.length,
    },
    high,
    notable,
    context,
    sourceMode,
    sourceNote,
  };
}

/** Score a single publication in isolation (used by the detail page). */
export function findSeedPublication(id: string): Publication | undefined {
  return SEED_PUBLICATIONS.find((p) => p.id === id);
}
