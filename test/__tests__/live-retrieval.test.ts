import { it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { fetchPubMed } from "@/lib/ingestion/pubmed";
import { fetchTrials } from "@/lib/ingestion/clinicaltrials";
import { fetchEuropePmcPreprints } from "@/lib/ingestion/europepmc";
import { fetchPreprints } from "@/lib/ingestion/biorxiv";
import { prefilterScore } from "@/lib/ranking/scoring";
import { topicWindow } from "@/lib/monitoring/plan";
import { EXAMPLE_PROFILE } from "@/lib/data/profile";
import type { Sensitivity, TopicProfile } from "@/lib/types";

const niche: TopicProfile = {
  program: "Spectinomycin Resistance in V. natriegens",
  description: "Adaptation and resistance mutations to spectinomycin in Vibrio natriegens.",
  keywords: ["Spectinomycin", "antibiotic resistance evolution", "aminoglycoside resistance", "ribosomal mutations", "fitness cost"],
  synonyms: [],
  genes: ["rpsE", "ribosomal protein S5"],
  organisms: ["Vibrio natriegens"],
  diseases: [],
  techniques: ["Morbidostat", "Chemostat", "experimental evolution", "adaptive laboratory evolution"],
  organizations: [],
  exclusions: [],
};

/**
 * Live check against the real sources: no database, no AI, no cost. Prints
 * what each source returned and how many records pass the filter for a broad
 * and a niche topic. Run with `npm run test:live`.
 */
it.skipIf(!process.env.SIGNAL_LIVE_TESTS)("retrieves real records for a broad and a niche topic", { timeout: 180_000 }, async () => {
  const now = Date.now();
  const deadline = now + 60_000;
  const feed = await fetchPreprints("biorxiv", { from: new Date(now - 2 * 864e5).toISOString().slice(0, 10), to: new Date(now).toISOString().slice(0, 10), deadline });
  for (const [name, p, sens] of [["broad: KRAS G12D", EXAMPLE_PROFILE, "balanced"], ["niche: spectinomycin", niche, "balanced"]] as [string, TopicProfile, Sensitivity][]) {
    const w = topicWindow({ backfilledAt: null, lastCheckedAt: null }, now);
    const [pm, ct, ep] = await Promise.all([
      fetchPubMed(p, { ...w, deadline, limit: 200 }),
      fetchTrials(p, { ...w, deadline, limit: 100 }),
      fetchEuropePmcPreprints(p, { ...w, deadline }),
    ]);
    const all = [...(pm?.publications ?? []), ...(ct?.publications ?? []), ...(ep?.publications ?? []), ...(feed?.publications ?? [])];
    const seen = new Set<string>(); const dois = new Set<string>(); let dupes = 0;
    const uniq = all.filter((x) => { const d = x.doi?.toLowerCase(); if (seen.has(x.id) || (d && dois.has(d))) { dupes++; return false; } seen.add(x.id); if (d) dois.add(d); return true; });
    const scored = uniq.map((x) => ({ x, pf: prefilterScore(x, p, sens) }));
    const passed = scored.filter((s) => s.pf.passes).sort((a, b) => b.pf.score - a.pf.score);
    const broadPass = scored.filter((s) => prefilterScore(s.x, p, "broad").passes).length;
    console.log(`\n=== ${name} | window ${w.from}..${w.to}`);
    console.log(`pubmed ${pm ? `${pm.publications.length}/${pm.scanned}${pm.complete === false ? " partial" : ""}` : "FAILED"} | trials ${ct ? `${ct.publications.length}/${ct.scanned}` : "FAILED"} | epmc ${ep ? `${ep.publications.length}/${ep.scanned}` : "FAILED"} | biorxiv feed ${feed ? `${feed.publications.length}/${feed.scanned}${feed.complete === false ? " partial" : ""}` : "FAILED"}`);
    console.log(`unique ${uniq.length} (dupes removed ${dupes}) | pass balanced ${passed.length} | would pass broad ${broadPass}`);
    for (const s of passed.slice(0, 6)) console.log(`  [${s.pf.score}] ${s.x.origin} ${s.x.publishedAt} ${s.x.title.slice(0, 95)}`);
  }
});
