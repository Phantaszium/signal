import type { ScoredPublication } from "@/lib/types";

/** One-line rationale for the detail page's "How this was ranked". */
export function buildRankingRationale(scored: ScoredPublication): string {
  const ordered = [...scored.explanations].sort(
    (a, b) => b.score * b.weight - a.score * a.weight,
  );
  const top = ordered.slice(0, 2);
  const drivers = top.map((e) => `${e.label.toLowerCase()} (${e.score}/100)`).join(" and ");
  const weakest = ordered[ordered.length - 1];
  return `Its ranking score of ${scored.signalScore}, which orders your recommendations, comes mainly from ${drivers}. Its weakest dimension was ${weakest.label.toLowerCase()} at ${weakest.score}/100.`;
}
