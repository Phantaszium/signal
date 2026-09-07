import { NextResponse } from "next/server";
import { fetchPubMed } from "@/lib/ingestion/pubmed";
import { DEMO_SCAN_VOLUME } from "@/lib/constants";
import { DEFAULT_PROFILE } from "@/lib/data/profile";
import type { Publication, ResearchProfile } from "@/lib/types";

/**
 * Headroom above the ingestion time budget in lib/ingestion/pubmed.ts, which
 * abandons slow NCBI calls well before this. The function should finish on its
 * own terms rather than be killed by the platform.
 *
 * No `dynamic` or `runtime` export is needed: POST route handlers are never
 * cached, and "nodejs" is already the default runtime.
 */
export const maxDuration = 15;

interface BriefingResponse {
  items: Publication[];
  scanVolume: number;
  sourceMode: "seed" | "pubmed+seed";
  note: string;
}

/**
 * The seeded corpus is always a valid answer. Every failure path returns this
 * rather than an error status, so the client never has to handle a broken
 * response and the demo cannot break in front of an audience.
 */
function seedFallback(note: string): NextResponse<BriefingResponse> {
  return NextResponse.json({
    items: [],
    scanVolume: DEMO_SCAN_VOLUME,
    sourceMode: "seed",
    note,
  });
}

/**
 * Ingestion endpoint for "Generate Today's Briefing".
 *
 * Returns normalized publications only — ranking happens client-side against
 * the live preference model.
 */
export async function POST(request: Request) {
  let profile: ResearchProfile = DEFAULT_PROFILE;
  let live = true;

  try {
    const body = await request.json();
    if (body?.profile) profile = body.profile as ResearchProfile;
    if (typeof body?.live === "boolean") live = body.live;
  } catch {
    // Empty or malformed body — fall through to defaults.
  }

  if (!live) {
    return seedFallback(
      "Demo corpus — fictional but scientifically plausible records.",
    );
  }

  try {
    const result = await fetchPubMed(profile);

    if (!result || !result.publications.length) {
      return seedFallback(
        "Live PubMed lookup unavailable — ranked the demo corpus instead.",
      );
    }

    return NextResponse.json({
      items: result.publications,
      scanVolume: Math.max(result.totalFound, DEMO_SCAN_VOLUME),
      sourceMode: "pubmed+seed",
      note: `${result.publications.length} live PubMed records merged with the demo corpus.`,
    });
  } catch {
    // Anything unexpected (network, parsing, rate limit) degrades to the seed
    // corpus instead of a 500. Never surface upstream detail to the client.
    return seedFallback(
      "Live PubMed lookup unavailable — ranked the demo corpus instead.",
    );
  }
}
