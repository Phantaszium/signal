import "server-only";

import { evaluateNow, mapWithConcurrency } from "@/lib/ai/evaluate";
import { collectBatch, submitBatch, type BatchRequest } from "@/lib/ai/batch";
import { randomUUID } from "node:crypto";
import { claimOnDemandSlot, getAccount, listBriefingAccounts, type Account } from "@/lib/db/accounts";
import {
  claimEmail,
  createBriefing,
  evaluatedPublicationIds,
  insertPendingEvaluations,
  latestBriefing,
  listEvaluatingBriefings,
  pendingEvaluations,
  releaseEmailClaim,
  saveEvaluation,
  unsentNightlyBriefings,
  updateBriefing,
  upsertPublications,
  type BriefingFunnel,
  type BriefingRecord,
} from "@/lib/db/briefings";
import { fetchPreprints } from "@/lib/ingestion/biorxiv";
import { fetchTrials } from "@/lib/ingestion/clinicaltrials";
import { fetchPubMed } from "@/lib/ingestion/pubmed";
import type { SourceResult } from "@/lib/ingestion/http";
import { sendBriefingEmail } from "@/lib/email/briefing";
import { PREFILTER_FLOOR, prefilterScore } from "@/lib/ranking/scoring";
import type { Publication } from "@/lib/types";

/**
 * The briefing pipeline:
 *
 *   ingest (PubMed, bioRxiv, medRxiv, ClinicalTrials.gov)
 *     → lexical prefilter against the profile     (thousands → a few dozen)
 *     → AI assessment of each remaining candidate (Claude)
 *     → rank with learned preferences at read time
 *
 * Nightly runs submit every user's candidates as one Message Batch and are
 * finalised later; on-demand runs evaluate directly while the user waits.
 */

/** Items sent to the AI per user per night. This is the main cost lever. */
const NIGHTLY_CANDIDATES = Number(process.env.SIGNAL_NIGHTLY_CANDIDATES) || 25;
/** Smaller, so an on-demand briefing finishes in a minute or two. */
const ON_DEMAND_CANDIDATES = Number(process.env.SIGNAL_ON_DEMAND_CANDIDATES) || 12;
/** Minimum gap between on-demand runs for one user. */
export const ON_DEMAND_COOLDOWN_MS = 15 * 60_000;
/** An on-demand run still "evaluating" after this has died with its function. */
const STALE_ON_DEMAND_MS = 10 * 60_000;
/** A nightly briefing with no batch id after this was never submitted. */
const STALE_UNSUBMITTED_NIGHTLY_MS = 15 * 60_000;
/** The sweep stops starting new accounts with less than this left of its 300s. */
const SWEEP_BUDGET_MS = 240_000;

const isoDay = (d: Date) => d.toISOString().slice(0, 10);
function windowOf(days: number, now = new Date()) {
  return { from: isoDay(new Date(now.getTime() - days * 86_400_000)), to: isoDay(now) };
}

interface Window {
  from: string;
  to: string;
}

/** Preprint servers are not queryable by topic, so they are fetched once and shared. */
interface SharedFeeds {
  preprints: Publication[];
  counts: Record<string, number>;
}

async function fetchSharedFeeds(window: Window, deadline: number): Promise<SharedFeeds> {
  const [biorxiv, medrxiv] = await Promise.all([
    fetchPreprints("biorxiv", { ...window, deadline }),
    fetchPreprints("medrxiv", { ...window, deadline }),
  ]);
  return {
    preprints: [...(biorxiv?.publications ?? []), ...(medrxiv?.publications ?? [])],
    counts: { biorxiv: biorxiv?.scanned ?? 0, medrxiv: medrxiv?.scanned ?? 0 },
  };
}

interface Candidate {
  publication: Publication;
  prefilter: number;
}

interface Gathered {
  candidates: Candidate[];
  funnel: BriefingFunnel;
  sourceCounts: Record<string, number>;
}

async function gatherCandidates(
  account: Account,
  window: Window,
  shared: SharedFeeds,
  max: number,
  deadline: number,
): Promise<Gathered> {
  const profile = account.researchProfile!;
  const [pubmed, trials] = await Promise.all([
    fetchPubMed(profile, { ...window, deadline }),
    fetchTrials(profile, { ...window, deadline }),
  ]);

  const sourceCounts: Record<string, number> = {
    ...shared.counts,
    pubmed: pubmed?.scanned ?? 0,
    clinicaltrials: trials?.scanned ?? 0,
  };
  const failed = [
    pubmed ? null : "pubmed",
    trials ? null : "clinicaltrials",
  ].filter(Boolean) as string[];
  if (failed.length) sourceCounts.unavailable = failed.length;

  const pool = new Map<string, Publication>();
  for (const result of [pubmed, trials] as (SourceResult | null)[]) {
    for (const p of result?.publications ?? []) pool.set(p.id, p);
  }
  for (const p of shared.preprints) pool.set(p.id, p);

  // Never pay to assess the same record twice for the same person.
  const seen = await evaluatedPublicationIds(account.id);
  const candidates = [...pool.values()]
    .filter((p) => !seen.has(p.id))
    .map((publication) => ({
      publication,
      prefilter: prefilterScore(publication, profile).score,
    }))
    .filter((c) => c.prefilter >= PREFILTER_FLOOR)
    .sort((a, b) => b.prefilter - a.prefilter)
    .slice(0, max);

  const scanned = Object.entries(sourceCounts)
    .filter(([k]) => k !== "unavailable")
    .reduce((n, [, v]) => n + v, 0);
  return { candidates, funnel: { scanned, candidates: candidates.length }, sourceCounts };
}

// ------------------------------------------------------------- on demand

export type StartResult =
  | { ok: true; briefingId: string }
  | { ok: false; reason: "cooldown"; retryAt: string }
  | { ok: false; reason: "running"; briefingId: string };

/** Claim an on-demand slot for this user, enforcing the cooldown. */
export async function startOnDemand(
  account: Account,
  running: BriefingRecord | null,
): Promise<StartResult> {
  if (running && !(await failIfStale(running))) {
    return { ok: false, reason: "running", briefingId: running.id };
  }
  // Admins get a short cooldown rather than none, which still stops a double
  // click from starting (and paying for) two runs.
  const cooldown = account.isAdmin ? 30_000 : ON_DEMAND_COOLDOWN_MS;
  if (!(await claimOnDemandSlot(account.id, cooldown))) {
    const fresh = await getAccount(account.id);
    const retryAt = Date.parse(fresh?.lastOnDemandAt ?? new Date().toISOString()) + cooldown;
    return { ok: false, reason: "cooldown", retryAt: new Date(retryAt).toISOString() };
  }
  const briefingId = await createBriefing({ userId: account.id, mode: "on_demand" });
  return { ok: true, briefingId };
}

/**
 * If an on-demand run has outlived its function, mark it and its pending
 * items failed. Returns true when it did. Called from the progress endpoint
 * so a dead run frees the UI within minutes rather than at the next cron.
 */
export async function failIfStale(briefing: BriefingRecord): Promise<boolean> {
  const age = Date.now() - Date.parse(briefing.createdAt);
  const limit = briefing.mode === "on_demand" ? STALE_ON_DEMAND_MS : STALE_UNSUBMITTED_NIGHTLY_MS;
  const stale =
    briefing.status === "evaluating" &&
    age > limit &&
    (briefing.mode === "on_demand" || !briefing.batchId);
  if (!stale) return false;
  for (const p of await pendingEvaluations(briefing.id)) {
    await saveEvaluation(p.userId, p.publicationId, briefing.id, { ok: false, reason: "timed out" });
  }
  await updateBriefing(briefing.id, {
    status: "failed",
    error: "The briefing took too long. Try again.",
    completedAt: new Date().toISOString(),
  });
  return true;
}

/**
 * Run an on-demand briefing to completion. Looks back further than the
 * nightly run so a brand-new account has something to read on day one.
 */
export async function runOnDemand(account: Account, briefingId: string): Promise<void> {
  try {
    const deadline = Date.now() + 45_000;
    const window = windowOf(7);
    // bioRxiv pages at ~30 records per 2s, so a week of preprints would take
    // minutes; on demand, read the last two days and leave the rest to nightly.
    const shared = await fetchSharedFeeds(windowOf(2), deadline);
    const { candidates, funnel, sourceCounts } = await gatherCandidates(
      account,
      window,
      shared,
      ON_DEMAND_CANDIDATES,
      deadline,
    );
    await updateBriefing(briefingId, { funnel, sourceCounts });

    await upsertPublications(candidates.map((c) => c.publication));
    await insertPendingEvaluations(
      candidates.map((c) => ({
        userId: account.id,
        briefingId,
        publicationId: c.publication.id,
        prefilterScore: c.prefilter,
      })),
    );

    const profile = account.researchProfile!;
    const outcomes = await mapWithConcurrency(candidates, 6, async (c) => {
      const outcome = await evaluateNow(profile, c.publication);
      await saveEvaluation(account.id, c.publication.id, briefingId, outcome);
      return outcome;
    });

    const anyOk = outcomes.some((o) => o.ok) || candidates.length === 0;
    await updateBriefing(briefingId, {
      status: anyOk ? "ready" : "failed",
      error: anyOk ? null : "No items could be assessed. Try again later.",
      completedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("on-demand briefing failed", error);
    await updateBriefing(briefingId, {
      status: "failed",
      error: "Something went wrong while building the briefing.",
      completedAt: new Date().toISOString(),
    });
  }
}

// ---------------------------------------------------------------- nightly

export interface SweepReport {
  accounts: number;
  briefings: number;
  requests: number;
  batchIds: string[];
  /** Accounts not reached before the time budget ran out; re-run the sweep. */
  skipped: number;
}

/**
 * Nightly step 1: ingest, prefilter and submit each user's candidates as a
 * Message Batch. A briefing row is created only once its batch has been
 * accepted, so a failure part-way never leaves a briefing that nothing will
 * finish; accounts not reached in time are picked up by a re-run.
 */
export async function runNightlySweep(): Promise<SweepReport> {
  const started = Date.now();
  const accounts = await listBriefingAccounts();
  const window = windowOf(2);
  // bioRxiv alone takes ~45s for a two-day window; give the shared feeds most
  // of the cron's budget up front, since every user reuses them.
  const shared = await fetchSharedFeeds(window, Date.now() + 120_000);

  const report: SweepReport = { accounts: accounts.length, briefings: 0, requests: 0, batchIds: [], skipped: 0 };

  for (const account of accounts) {
    if (Date.now() - started > SWEEP_BUDGET_MS) {
      report.skipped += 1;
      continue;
    }
    try {
      // Cron can retry or be triggered by hand: one nightly briefing per user
      // per morning, or a second, empty one would hide the first.
      const previous = await latestBriefing(account.id, { mode: "nightly" });
      if (previous && Date.now() - Date.parse(previous.createdAt) < 12 * 3_600_000) continue;

      const deadline = Date.now() + 25_000;
      const gathered = await gatherCandidates(account, window, shared, NIGHTLY_CANDIDATES, deadline);
      const briefingId = randomUUID();

      if (!gathered.candidates.length) {
        await createBriefing({
          id: briefingId,
          userId: account.id,
          mode: "nightly",
          status: "ready",
          funnel: gathered.funnel,
          sourceCounts: gathered.sourceCounts,
        });
        report.briefings += 1;
        continue;
      }

      // Batch custom ids allow only [A-Za-z0-9_-], up to 64 characters.
      const compact = briefingId.replace(/-/g, "");
      const requests: BatchRequest[] = gathered.candidates.map((c, i) => ({
        customId: `${compact}_${i}`,
        profile: account.researchProfile!,
        publication: c.publication,
      }));
      const batchId = await submitBatch(requests);

      await upsertPublications(gathered.candidates.map((c) => c.publication));
      await createBriefing({
        id: briefingId,
        userId: account.id,
        mode: "nightly",
        batchId,
        funnel: gathered.funnel,
        sourceCounts: gathered.sourceCounts,
      });
      await insertPendingEvaluations(
        gathered.candidates.map((c, i) => ({
          userId: account.id,
          briefingId,
          publicationId: c.publication.id,
          prefilterScore: c.prefilter,
          customId: requests[i].customId,
        })),
      );
      report.briefings += 1;
      report.requests += requests.length;
      report.batchIds.push(batchId);
    } catch (error) {
      console.error(`nightly sweep failed for account ${account.id}`, error);
    }
  }
  return report;
}

export interface FinalizeReport {
  batchesChecked: number;
  briefingsCompleted: number;
  emailsSent: number;
  staleFailed: number;
}

/**
 * Nightly step 2 (and safe to call any time): collect finished batches,
 * store the assessments, mark briefings ready and email them. Also fails runs
 * that died part-way.
 */
export async function finalizeBriefings(): Promise<FinalizeReport> {
  const evaluating = await listEvaluatingBriefings();
  const report: FinalizeReport = {
    batchesChecked: 0,
    briefingsCompleted: 0,
    emailsSent: 0,
    staleFailed: 0,
  };

  for (const b of evaluating) {
    if (await failIfStale(b)) report.staleFailed += 1;
  }

  for (const b of evaluating) {
    if (b.mode !== "nightly" || !b.batchId) continue;
    report.batchesChecked += 1;
    try {
      const status = await collectBatch(b.batchId);
      if (!status.done) continue;
      for (const p of await pendingEvaluations(b.id)) {
        const outcome = (p.customId && status.results.get(p.customId)) || {
          ok: false as const,
          reason: "missing from batch results",
        };
        await saveEvaluation(p.userId, p.publicationId, b.id, outcome);
      }
      await updateBriefing(b.id, { status: "ready", completedAt: new Date().toISOString() });
      report.briefingsCompleted += 1;
    } catch (error) {
      console.error(`finalizing briefing ${b.id} failed`, error);
    }
  }

  report.emailsSent = await sendPendingEmails();
  return report;
}

/** Email every ready nightly briefing from the last day that has not been sent. */
async function sendPendingEmails(): Promise<number> {
  // Older than this is yesterday's news; skip it rather than send it late.
  const briefings = await unsentNightlyBriefings(new Date(Date.now() - 20 * 3_600_000));
  let sent = 0;
  for (const briefing of briefings) {
    const account = await getAccount(briefing.userId);
    if (!account?.approved || !account.emailDigest) continue;
    if (!(await claimEmail(briefing.id))) continue;
    try {
      if (await sendBriefingEmail(account, briefing)) sent += 1;
      else await releaseEmailClaim(briefing.id); // email not configured yet
    } catch (error) {
      await releaseEmailClaim(briefing.id);
      console.error(`briefing email failed for account ${account.id}`, error);
    }
  }
  return sent;
}
