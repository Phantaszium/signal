/**
 * Builds the "Why this matters to you" line — the most important sentence on
 * every card.
 *
 * The framing (how this connects to *your* program) is generated here from the
 * profile match and the ranking signals. The domain "so what" comes from the
 * publication's `implication` field when present, so the explanation is always
 * anchored to something real rather than paraphrasing the abstract back.
 */

import type { Publication, ResearchProfile, ScoredPublication } from "@/lib/types";

function anchor(scored: ScoredPublication, profile: ResearchProfile): string {
  const { matchedInterests, matchedOrganizations, publication } = scored;
  const lower = matchedInterests.map((m) => m.toLowerCase());
  const hasCore = lower.some((m) => m.includes("kras"));
  const hasResistance =
    lower.some((m) => m.includes("resistance")) ||
    publication.signals?.acquiredResistance;

  if (hasCore && hasResistance) {
    return `Directly relevant to your ${profile.program} resistance program.`;
  }
  if (hasCore) {
    return `Directly relevant to your ${profile.program} program.`;
  }
  if (matchedOrganizations.length) {
    return `Involves ${matchedOrganizations.join(" and ")}, on your watchlist.`;
  }
  if (matchedInterests.length) {
    return `Touches your work on ${matchedInterests.slice(0, 2).join(" and ")}.`;
  }
  return "Adjacent to your program rather than central to it.";
}

/** Fallback clause for items with no authored implication (e.g. live PubMed). */
function generatedClause(pub: Publication, scored: ScoredPublication): string {
  const bits: string[] = [];
  if (pub.signals?.acquiredResistance) bits.push("it addresses acquired resistance");
  if (pub.signals?.mechanistic) bits.push("it proposes a mechanism rather than an association");
  if (pub.signals?.clinical) bits.push("it carries human data");
  if (pub.signals?.inVitroOnly) bits.push("but the evidence is in-vitro only");
  if (!bits.length) {
    const terms = scored.matchedInterests.slice(0, 2).join(" and ");
    return terms
      ? `it overlaps your work on ${terms}`
      : "it sits near the edge of your stated interests";
  }
  return bits.join(", ");
}

export function buildWhyThisMatters(
  scored: ScoredPublication,
  profile: ResearchProfile,
): string {
  const lead = anchor(scored, profile);
  const clause =
    scored.publication.implication ?? generatedClause(scored.publication, scored);
  const body = clause.charAt(0).toUpperCase() + clause.slice(1);
  return `${lead} ${body}.`;
}

/** One-line rationale for the detail page's "Why Signal ranked this highly". */
export function buildRankingRationale(scored: ScoredPublication): string {
  const ordered = [...scored.explanations].sort(
    (a, b) => b.score * b.weight - a.score * a.weight,
  );
  const top = ordered.slice(0, 2);
  const drivers = top.map((e) => `${e.label.toLowerCase()} (${e.score}/100)`).join(" and ");
  const weakest = ordered[ordered.length - 1];
  return `This ranked ${scored.tier === "HIGH" ? "in your top three" : `as ${scored.tier.toLowerCase()}`} mainly on ${drivers}. Its weakest dimension was ${weakest.label.toLowerCase()} at ${weakest.score}/100.`;
}
