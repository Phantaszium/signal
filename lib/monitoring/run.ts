import "server-only";

import { randomUUID } from "node:crypto";
import { collectBatch, submitBatch, type BatchRequest } from "@/lib/ai/batch";
import { evaluateNow, mapWithConcurrency } from "@/lib/ai/evaluate";
import {
  claimDigestPeriod,
  claimOnDemandSlot,
  getAccount,
  listApprovedAccounts,
  releaseDigestPeriod,
  type Account,
} from "@/lib/db/accounts";
import { createDigest, markDigestEmailed, type DigestSummary } from "@/lib/db/digests";
import {
  assessedKeys,
  claimAlerts,
  getItemState,
  insertPendingEvaluations,
  pendingEvaluations,
  publicationsByIds,
  recentItems,
  releaseAlerts,
  runEvaluations,
  saveEvaluation,
  upsertPublications,
} from "@/lib/db/evaluations";
import { createRun, getRun, listOpenRuns, recentRuns, updateRun } from "@/lib/db/runs";
import { listTopics, markTopicsChecked, topicsByUser } from "@/lib/db/topics";
import { isDevelopment, isHighPriority } from "@/lib/developments";
import { digestDue, digestWindow, selectDigestEntries } from "@/lib/digests/plan";
import { emailConfigured, sendAlertEmail, sendDigestEmail } from "@/lib/email/digest";
import { fetchPreprints, type PreprintServer } from "@/lib/ingestion/biorxiv";
import { fetchTrials } from "@/lib/ingestion/clinicaltrials";
import { fetchEuropePmcPreprints } from "@/lib/ingestion/europepmc";
import type { SourceResult } from "@/lib/ingestion/http";
import { fetchPubMed } from "@/lib/ingestion/pubmed";
import { diagnoseTopic } from "@/lib/monitoring/diagnosis";
import { topicStatus } from "@/lib/monitoring/status";
import { allocateCandidates, daysBefore, topicWindow, type Candidate } from "@/lib/monitoring/plan";
import type { RunDiagnostics, RunMode, RunRecord, SourceCheck, TopicCheck } from "@/lib/monitoring/types";
import { prefilterScore } from "@/lib/ranking/scoring";
import type { MonitoringTopic, Publication, SourceKey } from "@/lib/types";

/**
 * Event-driven monitoring.
 *
 *   for each active topic:
 *     search PubMed, ClinicalTrials.gov and Europe PMC preprints with the
 *     topic's terms; read the shared bioRxiv/medRxiv feeds
 *   → deduplicate by id and DOI, skip anything already assessed
 *   → lexical prefilter per topic (sensitivity, exclusions)
 *   → AI assessment of the best candidates, shared fairly across topics
 *   → developments = assessments above the topic's relevance threshold
 *   → alerts for high-priority developments; periodic digests
 *
 * Every step's counts are stored on the run (see monitoring/types.ts), so the
 * app can always say why a topic is quiet, and never calls a topic quiet when
 * one of its sources could not be checked.
 *
 * Scheduled runs submit their assessments as one Message Batch and finish in
 * finalizeRuns(); manual runs ("Check now") assess directly while the user
 * waits.
 */

/** Items assessed per user per scheduled run, beyond first look-backs. The main cost lever. */
const SCHEDULED_CANDIDATES = Number(process.env.SIGNAL_NIGHTLY_CANDIDATES) || 25;
/** Smaller, so a manual check finishes in a minute or two. */
const MANUAL_CANDIDATES = Number(process.env.SIGNAL_ON_DEMAND_CANDIDATES) || 12;
/** Extra assessments for each topic on its first, 30-day look-back. */
const BACKFILL_CANDIDATES = Number(process.env.SIGNAL_BACKFILL_CANDIDATES) || 15;
/** Upper bound on one manual run, so it fits inside the function's time limit. */
const MANUAL_MAX = 30;
/** Upper bound on one scheduled run per user, including first look-backs. */
const SCHEDULED_MAX = 100;
/** Declined batch items retried directly, per run, when finalizing. */
const MAX_DECLINED_RETRIES = 20;
/** Minimum gap between manual runs for one user. */
export const MANUAL_COOLDOWN_MS = 15 * 60_000;
/** A manual run still open after this has died with its function. */
const STALE_MANUAL_MS = 10 * 60_000;
/** A scheduled run with no batch after this was never submitted. */
const STALE_UNSUBMITTED_MS = 15 * 60_000;
/** The scheduled sweep stops starting new accounts with less than this left of its 300s. */
const SWEEP_BUDGET_MS = 240_000;
/** Europe PMC indexes preprints a few days late, so its window starts earlier. */
const EPMC_LAG_DAYS = 7;

const DAY = 86_400_000;
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

function log(event: string, data: Record<string, unknown>): void {
  console.info(`[signal:${event}] ${JSON.stringify(data)}`);
}

// ------------------------------------------------------------- retrieval

type SharedFeeds = Partial<Record<PreprintServer, SourceResult | null>>;

/** bioRxiv and medRxiv cannot be searched by topic: read them once per run and share them. */
async function fetchSharedFeeds(
  topicsList: MonitoringTopic[],
  window: { from: string; to: string },
  deadline: number,
): Promise<SharedFeeds> {
  const servers = (["biorxiv", "medrxiv"] as const).filter((s) =>
    topicsList.some((t) => t.sources.includes(s)),
  );
  const results = await Promise.all(
    servers.map((s) => fetchPreprints(s, { ...window, deadline })),
  );
  return Object.fromEntries(servers.map((s, i) => [s, results[i]]));
}

function sourceCheck(result: SourceResult | null, kept: number, shared = false): SourceCheck {
  if (!result) return { status: "failed", scanned: 0, fetched: 0, matched: 0, ...(shared ? { shared } : {}) };
  return {
    status: result.complete === false ? "partial" : "ok",
    scanned: result.scanned,
    fetched: kept,
    matched: 0,
    ...(shared ? { shared } : {}),
    ...(result.note ? { note: result.note } : {}),
  };
}

interface Gathered {
  candidates: Candidate[];
  checks: TopicCheck[];
}

/**
 * Retrieve and screen records for each of a user's topics, then pick this
 * run's candidates. Topics are searched one after another so a user with
 * several topics stays inside NCBI's request rate.
 */
async function gather(
  account: Account,
  activeTopics: MonitoringTopic[],
  shared: SharedFeeds,
  opts: { cap: number; max: number; deadline: number; now: number },
): Promise<Gathered> {
  const seen = await assessedKeys(account.id);
  const checks: TopicCheck[] = [];
  const perTopic = new Map<string, Candidate[]>();

  for (const topic of activeTopics) {
    const { profile, sensitivity } = topic;
    const window = topicWindow(topic, opts.now);
    const has = (s: SourceKey) => topic.sources.includes(s);
    const fetchOpts = { from: window.from, to: window.to, deadline: opts.deadline };

    const [pubmed, trials, epmc] = await Promise.all([
      has("pubmed") ? fetchPubMed(profile, { ...fetchOpts, limit: window.backfill ? 200 : 120 }) : undefined,
      has("clinicaltrials")
        ? fetchTrials(profile, { ...fetchOpts, limit: window.backfill ? 100 : 50 })
        : undefined,
      has("europepmc") || has("biorxiv") || has("medrxiv")
        ? fetchEuropePmcPreprints(profile, {
            ...fetchOpts,
            from: window.backfill ? window.from : daysBefore(window.from, EPMC_LAG_DAYS),
          })
        : undefined,
    ]);

    // Europe PMC returns preprints from every server; keep the ones this
    // topic monitors (bioRxiv/medRxiv results need those sources enabled).
    const epmcKept = (epmc?.publications ?? []).filter((p) => has(p.origin));

    const sources: TopicCheck["sources"] = {};
    const records: { pub: Publication; source: SourceKey }[] = [];
    const add = (source: SourceKey, result: SourceResult | null | undefined, pubs?: Publication[], isShared = false) => {
      if (result === undefined) return;
      const list = pubs ?? result?.publications ?? [];
      sources[source] = sourceCheck(result, list.length, isShared);
      for (const pub of list) records.push({ pub, source });
    };
    add("pubmed", pubmed);
    add("clinicaltrials", trials);
    if (epmc !== undefined) add("europepmc", epmc, epmcKept);
    for (const server of ["biorxiv", "medrxiv"] as const) {
      if (has(server)) add(server, shared[server] ?? null, undefined, true);
    }

    const check: TopicCheck = {
      topicId: topic.id,
      name: profile.program,
      window: { from: window.from, to: window.to },
      backfill: window.backfill,
      sources,
      fetched: (["pubmed", "clinicaltrials", "europepmc"] as SourceKey[]).reduce(
        (n, s) => n + (sources[s]?.fetched ?? 0),
        0,
      ),
      matched: 0,
      excluded: 0,
      alreadyAssessed: 0,
      queued: 0,
      deferred: 0,
    };

    const fresh: Candidate[] = [];
    const counted = new Set<string>();
    const dois = new Set<string>();
    for (const { pub, source } of records) {
      // The same record can arrive from two sources (a preprint from the
      // bioRxiv feed and Europe PMC): count and consider it once.
      const doi = pub.doi?.toLowerCase();
      if (counted.has(pub.id) || (doi && dois.has(doi))) continue;
      counted.add(pub.id);
      if (doi) dois.add(doi);

      const pf = prefilterScore(pub, profile, sensitivity);
      if (pf.excludedBy) {
        check.excluded += 1;
        continue;
      }
      if (!pf.passes) continue;
      check.matched += 1;
      sources[source]!.matched += 1;
      const prior = seen.ids.get(pub.id) ?? (doi ? seen.dois.get(doi) : undefined);
      // A new topic's first look-back re-assesses records that were judged
      // only against other topics, before this one existed; otherwise it
      // would inherit their verdicts and could look falsely quiet.
      const reassess =
        window.backfill &&
        prior?.publicationId === pub.id &&
        prior.status === "done" &&
        prior.topicId !== topic.id &&
        Date.parse(prior.createdAt) < Date.parse(topic.createdAt);
      if (prior && !reassess) {
        check.alreadyAssessed += 1;
        continue;
      }
      fresh.push({ publication: pub, prefilter: pf.score, topicId: topic.id, ...(reassess ? { reassess } : {}) });
    }
    perTopic.set(topic.id, fresh);
    checks.push(check);
  }

  const backfills = checks.filter((c) => c.backfill).length;
  const { chosen, deferred } = allocateCandidates(
    perTopic,
    Math.min(opts.max, opts.cap + backfills * BACKFILL_CANDIDATES),
  );
  for (const check of checks) {
    const mine = chosen.filter((c) => c.topicId === check.topicId);
    check.queued = mine.length;
    check.queuedIds = mine.map((c) => c.publication.id);
    check.deferred = deferred.get(check.topicId) ?? 0;
  }
  return { candidates: chosen, checks };
}

// ------------------------------------------------------------ completion

/**
 * Close a run: count what its assessments found per topic, mark fully
 * checked topics, and log the outcome. A topic with a failed source is not
 * marked checked, so its next window still covers what was missed.
 */
async function completeRun(run: RunRecord, topicsList: MonitoringTopic[]): Promise<RunDiagnostics> {
  const evaluations = await runEvaluations(run.id);
  const sensitivity = new Map(topicsList.map((t) => [t.id, t.sensitivity]));
  const diagnostics: RunDiagnostics = {
    ...run.diagnostics,
    topics: run.diagnostics.topics.map((check) => {
      // What this topic searched for is counted against it; what the AI
      // filed under it decides its developments.
      const queued = check.queuedIds ? new Set(check.queuedIds) : null;
      const searched = evaluations.filter((e) =>
        queued ? queued.has(e.publicationId) : e.topicId === check.topicId,
      );
      const filed = evaluations.filter((e) => e.topicId === check.topicId && e.status === "done" && e.assessment);
      const level = sensitivity.get(check.topicId) ?? "balanced";
      return {
        ...check,
        assessed: searched.filter((e) => e.status === "done").length,
        failedAssessments: searched.filter((e) => e.status === "failed").length,
        developments: filed.filter((e) => isDevelopment(e.assessment!, level)).length,
        highPriority: filed.filter((e) => isHighPriority(e.assessment!, level)).length,
      };
    }),
    durationMs: Date.now() - Date.parse(run.createdAt),
  };

  const queued = diagnostics.topics.reduce((n, t) => n + t.queued, 0);
  const assessed = diagnostics.topics.reduce((n, t) => n + (t.assessed ?? 0), 0);
  const allFailed = queued > 0 && evaluations.length > 0 && evaluations.every((e) => e.status === "failed");
  const completedAt = new Date().toISOString();

  await updateRun(run.id, {
    status: allFailed ? "failed" : "complete",
    diagnostics,
    error: allFailed ? "No candidates could be assessed. They will be retried in the next check." : null,
    completedAt,
  });

  if (!allFailed) {
    // Fully checked: every source answered and every candidate was assessed.
    const clean = diagnostics.topics.filter(
      (t) =>
        Object.values(t.sources).every((s) => s && s.status !== "failed") && !t.failedAssessments,
    );
    await markTopicsChecked(
      clean.map((t) => t.topicId),
      completedAt,
      clean.filter((t) => t.backfill).map((t) => t.topicId),
    );
  }

  log("run", {
    run: run.id,
    user: run.userId,
    mode: run.mode,
    status: allFailed ? "failed" : "complete",
    assessed,
    durationMs: diagnostics.durationMs,
    topics: diagnostics.topics.map((t) => ({
      topic: t.topicId,
      diagnosis: diagnoseTopic(t, "complete").state,
      window: t.window,
      backfill: t.backfill,
      sources: Object.fromEntries(
        Object.entries(t.sources).map(([k, s]) => [k, `${s!.status}:${s!.fetched}/${s!.scanned}:${s!.matched}`]),
      ),
      matched: t.matched,
      excluded: t.excluded,
      alreadyAssessed: t.alreadyAssessed,
      queued: t.queued,
      deferred: t.deferred,
      developments: t.developments,
    })),
  });
  return diagnostics;
}

// ---------------------------------------------------------------- manual

export type StartResult =
  | { ok: true; runId: string }
  | { ok: false; reason: "cooldown"; retryAt: string }
  | { ok: false; reason: "running"; runId: string }
  | { ok: false; reason: "no_topics" };

/** Claim a manual run for this user, enforcing the cooldown. */
export async function startManual(account: Account): Promise<StartResult> {
  const [latest] = await recentRuns(account.id, { limit: 1, mode: "manual" });
  if (latest && (latest.status === "running" || latest.status === "evaluating") && !(await failIfStale(latest))) {
    return { ok: false, reason: "running", runId: latest.id };
  }
  const active = (await listTopics(account.id)).filter((t) => t.active);
  if (!active.length) return { ok: false, reason: "no_topics" };

  // Admins get a short cooldown rather than none, which still stops a double
  // click from starting (and paying for) two runs.
  const cooldown = account.isAdmin ? 30_000 : MANUAL_COOLDOWN_MS;
  if (!(await claimOnDemandSlot(account.id, cooldown))) {
    const fresh = await getAccount(account.id);
    const retryAt = Date.parse(fresh?.lastOnDemandAt ?? new Date().toISOString()) + cooldown;
    return { ok: false, reason: "cooldown", retryAt: new Date(retryAt).toISOString() };
  }
  const runId = await createRun({ userId: account.id, mode: "manual" });
  return { ok: true, runId };
}

/**
 * If a run has outlived its function, mark it and its pending items failed.
 * Returns true when it did. Called from the progress endpoint so a dead run
 * frees the UI within minutes rather than at the next cron.
 */
export async function failIfStale(run: RunRecord): Promise<boolean> {
  const age = Date.now() - Date.parse(run.createdAt);
  const open = run.status === "running" || run.status === "evaluating";
  const stale =
    open &&
    ((run.mode === "manual" && age > STALE_MANUAL_MS) ||
      (run.mode === "scheduled" && !run.batchId && age > STALE_UNSUBMITTED_MS));
  if (!stale) return false;
  await abandonRun(run.id, "timed out", "The check took too long and was stopped. Nothing was marked as checked; try again.");
  log("run-stale", { run: run.id, user: run.userId, mode: run.mode });
  return true;
}

/** Fail a run and its pending assessments. Its topics are not marked checked. */
async function abandonRun(runId: string, itemReason: string, message: string): Promise<void> {
  for (const p of await pendingEvaluations(runId)) {
    await saveEvaluation(p.userId, p.publicationId, runId, { ok: false, reason: itemReason });
  }
  await updateRun(runId, { status: "failed", error: message, completedAt: new Date().toISOString() });
}

/** Run a manual check to completion. */
export async function runManual(account: Account, runId: string): Promise<void> {
  try {
    const now = Date.now();
    const active = (await listTopics(account.id)).filter((t) => t.active);
    const deadline = now + 55_000;
    // bioRxiv pages at ~30 records per 2s: a manual check reads two days of
    // the feeds; Europe PMC covers anything older.
    const shared = await fetchSharedFeeds(active, { from: isoDay(now - 2 * DAY), to: isoDay(now) }, deadline);
    const { candidates, checks } = await gather(account, active, shared, {
      cap: MANUAL_CANDIDATES,
      max: MANUAL_MAX,
      deadline,
      now,
    });
    const diagnostics: RunDiagnostics = { topicOrder: active.map((t) => t.id), topics: checks };
    await updateRun(runId, { status: candidates.length ? "evaluating" : "running", diagnostics });

    await upsertPublications(candidates.map((c) => c.publication));
    await insertPendingEvaluations(
      candidates.map((c) => ({
        userId: account.id,
        runId,
        topicId: c.topicId,
        publicationId: c.publication.id,
        prefilterScore: c.prefilter,
        reassess: c.reassess,
      })),
    );

    await mapWithConcurrency(candidates, 8, async (c) => {
      const outcome = await evaluateNow(active, c.publication);
      await saveEvaluation(account.id, c.publication.id, runId, outcome);
    });

    const run = (await getRun(runId))!;
    await completeRun(run, active);
    await sendAlerts(account, active, runId);
  } catch (error) {
    console.error(`[signal:run] manual run ${runId} failed`, error);
    await abandonRun(runId, "run failed", "Something went wrong during the check. Nothing was marked as checked; try again.");
  }
}

// ------------------------------------------------------------- scheduled

export interface SweepReport {
  accounts: number;
  runs: number;
  requests: number;
  batchIds: string[];
  /** Accounts not reached before the time budget ran out; re-run the sweep. */
  skipped: number;
}

/**
 * Scheduled step 1: retrieve and screen for every approved account, and
 * submit each account's candidates as a Message Batch. A run row is created
 * only once its batch has been accepted, so a failure part-way never leaves
 * a run that nothing will finish; accounts not reached are picked up by a
 * re-run.
 */
export async function runScheduledSweep(): Promise<SweepReport> {
  const started = Date.now();
  const [accounts, allTopics] = await Promise.all([listApprovedAccounts(), topicsByUser()]);
  const due = accounts
    .map((account) => ({ account, active: (allTopics.get(account.id) ?? []).filter((t) => t.active) }))
    .filter((a) => a.active.length > 0);

  // bioRxiv alone takes ~45s for two days; give the shared feeds most of the
  // budget up front, since every user reuses them.
  const shared = await fetchSharedFeeds(
    due.flatMap((d) => d.active),
    { from: isoDay(started - 2 * DAY), to: isoDay(started) },
    started + 120_000,
  );

  const report: SweepReport = { accounts: due.length, runs: 0, requests: 0, batchIds: [], skipped: 0 };
  for (const { account, active } of due) {
    if (Date.now() - started > SWEEP_BUDGET_MS) {
      report.skipped += 1;
      continue;
    }
    let openRun: string | null = null;
    try {
      // Cron can retry or be triggered by hand: one scheduled run per user
      // per 12 hours.
      const [previous] = await recentRuns(account.id, { limit: 1, mode: "scheduled" });
      if (previous && Date.now() - Date.parse(previous.createdAt) < 12 * 3_600_000) continue;

      const now = Date.now();
      const { candidates, checks } = await gather(account, active, shared, {
        cap: SCHEDULED_CANDIDATES,
        max: SCHEDULED_MAX,
        deadline: now + 25_000,
        now,
      });
      const runId = randomUUID();
      const diagnostics: RunDiagnostics = { topicOrder: active.map((t) => t.id), topics: checks };

      if (!candidates.length) {
        await createRun({ id: runId, userId: account.id, mode: "scheduled", status: "running", diagnostics });
        await completeRun((await getRun(runId))!, active);
        report.runs += 1;
        continue;
      }

      // Batch custom ids allow only [A-Za-z0-9_-], up to 64 characters.
      const compact = runId.replace(/-/g, "");
      const requests: BatchRequest[] = candidates.map((c, i) => ({
        customId: `${compact}_${i}`,
        topics: active,
        publication: c.publication,
      }));
      // The run row exists before the batch is paid for, so a failure after
      // submitting can never orphan a batch. A run left without a batch is
      // failed by failIfStale and its topics re-checked next time.
      await createRun({ id: runId, userId: account.id, mode: "scheduled", status: "running", diagnostics });
      openRun = runId;
      await upsertPublications(candidates.map((c) => c.publication));
      await insertPendingEvaluations(
        candidates.map((c, i) => ({
          userId: account.id,
          runId,
          topicId: c.topicId,
          publicationId: c.publication.id,
          prefilterScore: c.prefilter,
          customId: requests[i].customId,
          reassess: c.reassess,
        })),
      );
      const batchId = await submitBatch(requests);
      await updateRun(runId, { status: "evaluating", batchId });
      report.runs += 1;
      report.requests += requests.length;
      report.batchIds.push(batchId);
    } catch (error) {
      console.error(`[signal:run] scheduled sweep failed for account ${account.id}`, error);
      if (openRun) {
        await abandonRun(openRun, "not submitted", "The scheduled check could not be submitted. It will run again tomorrow.").catch(
          () => {},
        );
      }
    }
  }
  log("sweep", { ...report, durationMs: Date.now() - started });
  return report;
}

export interface FinalizeReport {
  batchesChecked: number;
  runsCompleted: number;
  staleFailed: number;
  alertsSent: number;
  digestsBuilt: number;
  digestsEmailed: number;
}

/**
 * Scheduled step 2 (safe to call any time): collect finished batches, close
 * their runs, send alerts, then build any digests that are due.
 */
export async function finalizeRuns(): Promise<FinalizeReport> {
  const open = await listOpenRuns();
  const report: FinalizeReport = {
    batchesChecked: 0,
    runsCompleted: 0,
    staleFailed: 0,
    alertsSent: 0,
    digestsBuilt: 0,
    digestsEmailed: 0,
  };

  for (const run of open) {
    if (await failIfStale(run)) report.staleFailed += 1;
  }

  for (const run of open) {
    if (run.mode !== "scheduled" || !run.batchId || run.status !== "evaluating") continue;
    report.batchesChecked += 1;
    try {
      const status = await collectBatch(run.batchId, run.diagnostics.topicOrder);
      if (!status.done) continue;
      const [account, active] = await Promise.all([getAccount(run.userId), listTopics(run.userId)]);
      const pending = await pendingEvaluations(run.id);
      const declined: string[] = [];
      for (const p of pending) {
        const outcome = (p.customId && status.results.get(p.customId)) || {
          ok: false as const,
          reason: "missing from batch results",
        };
        if (!outcome.ok && outcome.reason === "declined by model") declined.push(p.publicationId);
        else await saveEvaluation(p.userId, p.publicationId, run.id, outcome);
      }
      // Batches have no server-side fallback, and legitimate microbiology or
      // pathogen research is sometimes declined there. Retry those directly,
      // where a declined request falls back to another model.
      const ordered = run.diagnostics.topicOrder
        .map((id) => active.find((t) => t.id === id))
        .filter((t): t is MonitoringTopic => Boolean(t));
      const retry = (await publicationsByIds(declined)).slice(0, MAX_DECLINED_RETRIES);
      await mapWithConcurrency(retry, 6, async (pub) => {
        await saveEvaluation(run.userId, pub.id, run.id, await evaluateNow(ordered, pub));
      });
      for (const id of declined) {
        if (!retry.some((p) => p.id === id)) {
          await saveEvaluation(run.userId, id, run.id, { ok: false, reason: "declined by model" });
        }
      }
      if (declined.length) log("declined-retry", { run: run.id, declined: declined.length, retried: retry.length });
      await completeRun(run, active);
      report.runsCompleted += 1;
      if (account) report.alertsSent += await sendAlerts(account, active, run.id);
    } catch (error) {
      console.error(`[signal:run] finalizing run ${run.id} failed`, error);
    }
  }

  const digests = await buildDueDigests();
  report.digestsBuilt = digests.built;
  report.digestsEmailed = digests.emailed;
  log("finalize", { ...report });
  return report;
}

// ------------------------------------------------------- alerts & digests

/** Whether this account wants an immediate email for high-priority developments. */
function wantsAlerts(account: Account): boolean {
  if (account.digestFrequency === "important_only") return true;
  // A daily digest already leads with them; "off" means no email at all.
  return account.alertsEnabled && (account.digestFrequency === "weekly" || account.digestFrequency === "monthly");
}

/** Email high-priority developments from one run. Returns 1 if an alert was sent. */
async function sendAlerts(account: Account, topicsList: MonitoringTopic[], runId: string): Promise<number> {
  if (!wantsAlerts(account) || !emailConfigured()) return 0;
  const [items, state] = await Promise.all([
    recentItems(account.id, { since: new Date(Date.now() - 2 * DAY), minRelevance: 40, limit: 200 }),
    getItemState(account.id),
  ]);
  const entries = selectDigestEntries(
    items.filter((i) => i.runId === runId),
    topicsList,
    account.weights,
    new Set(state.dismissedIds),
    { start: 0, end: Date.now() + 1 },
  ).filter((e) => e.highPriority);
  if (!entries.length) return 0;

  const claimed = new Set(await claimAlerts(account.id, entries.map((e) => e.item.publication.id)));
  const toSend = entries.filter((e) => claimed.has(e.item.publication.id));
  if (!toSend.length) return 0;
  try {
    const names = new Map(topicsList.map((t) => [t.id, t.profile.program]));
    await sendAlertEmail(account, toSend, names);
    log("alert", { user: account.id, run: runId, items: toSend.length });
    return 1;
  } catch (error) {
    await releaseAlerts(account.id, [...claimed]);
    console.error(`[signal:alert] alert email failed for account ${account.id}`, error);
    return 0;
  }
}

/** Each topic's latest monitoring state, for a digest's status section. */
async function topicStatuses(userId: string, topicsList: MonitoringTopic[]): Promise<DigestSummary["topics"]> {
  const runs = await recentRuns(userId, { limit: 10 });
  return topicsList
    .filter((t) => t.active)
    .map((topic) => {
      const { diagnosis } = topicStatus(topic.id, runs);
      return diagnosis
        ? { topicId: topic.id, name: topic.profile.program, state: diagnosis.state, headline: diagnosis.headline }
        : { topicId: topic.id, name: topic.profile.program, state: "not_checked" as const, headline: "Not checked yet" };
    });
}

/** Build (and email, when configured) every digest whose period has elapsed. */
async function buildDueDigests(): Promise<{ built: number; emailed: number }> {
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const [accounts, allTopics, open] = await Promise.all([listApprovedAccounts(), topicsByUser(), listOpenRuns()]);
  // A run still assessing (this morning's batch, usually) would be missing
  // from the digest; wait for it, unless it has been open for half a day.
  const waiting = new Set(
    open.filter((r) => now - Date.parse(r.createdAt) < 12 * 3_600_000).map((r) => r.userId),
  );
  let built = 0;
  let emailed = 0;

  for (const account of accounts) {
    const topicsList = allTopics.get(account.id) ?? [];
    if (!topicsList.length || !digestDue(account.digestFrequency, account.lastDigestAt, now)) continue;
    if (waiting.has(account.id)) continue;
    // Claim the period first, so overlapping finalize calls build it once.
    if (!(await claimDigestPeriod(account.id, account.lastDigestAt, nowIso))) continue;
    let stored = false;
    try {
      const window = digestWindow(account.digestFrequency, account.lastDigestAt, now);
      const [items, state] = await Promise.all([
        recentItems(account.id, { since: new Date(window.start), minRelevance: 40, limit: 300 }),
        getItemState(account.id),
      ]);
      const entries = selectDigestEntries(items, topicsList, account.weights, new Set(state.dismissedIds), window);
      // A quiet day needs no daily email; weekly and monthly digests still
      // report a quiet period, with each topic's monitoring status.
      if (!entries.length && account.digestFrequency === "daily") continue;

      const digest = await createDigest({
        userId: account.id,
        frequency: account.digestFrequency,
        periodStart: new Date(window.start).toISOString(),
        periodEnd: nowIso,
        publicationIds: entries.map((e) => e.item.publication.id),
        summary: {
          developments: entries.length,
          highPriority: entries.filter((e) => e.highPriority).length,
          topics: await topicStatuses(account.id, topicsList),
        },
      });
      stored = true;
      built += 1;
      const names = new Map(topicsList.map((t) => [t.id, t.profile.program]));
      if (await sendDigestEmail(account, digest, entries, names)) {
        await markDigestEmailed(digest.id);
        emailed += 1;
      }
    } catch (error) {
      console.error(`[signal:digest] digest failed for account ${account.id}`, error);
      // Not built: give the period back so the next finalize builds it. A
      // stored digest whose email failed stays in the app, marked not emailed.
      if (!stored) await releaseDigestPeriod(account.id, nowIso, account.lastDigestAt).catch(() => {});
    }
  }
  return { built, emailed };
}

export type { RunMode };
