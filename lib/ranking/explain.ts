import type { ScoredPublication } from "@/lib/types";

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
