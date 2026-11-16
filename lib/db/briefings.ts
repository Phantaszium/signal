import "server-only";

import { db } from "@/lib/supabase/admin";
import type { EvaluationOutcome } from "@/lib/ai/evaluate";
import type { AiAssessment, EvaluatedItem, FeedbackAction, Publication } from "@/lib/types";

// ------------------------------------------------------------ publications

interface PublicationRow {
  id: string;
  origin: Publication["origin"];
  type: Publication["type"];
  title: string;
  abstract: string;
  source: string;
  authors: string[];
  organizations: string[];
  published_at: string;
  url: string | null;
  doi: string | null;
}

const toRow = (p: Publication): PublicationRow => ({
  id: p.id,
  origin: p.origin,
  type: p.type,
  title: p.title,
  abstract: p.abstract,
  source: p.source,
  authors: p.authors,
  organizations: p.organizations,
  published_at: p.publishedAt,
  url: p.url ?? null,
  doi: p.doi ?? null,
});

const fromRow = (r: PublicationRow): Publication => ({
  id: r.id,
  origin: r.origin,
  type: r.type,
  title: r.title,
  abstract: r.abstract,
  source: r.source,
  authors: r.authors,
  organizations: r.organizations,
  publishedAt: r.published_at,
  url: r.url ?? undefined,
  doi: r.doi ?? undefined,
  summary: r.abstract ? `${r.abstract.slice(0, 220).trim()}…` : r.title,
  tags: [],
});

export async function upsertPublications(pubs: Publication[]): Promise<void> {
  for (let i = 0; i < pubs.length; i += 500) {
    const { error } = await db()
      .from("publications")
      .upsert(pubs.slice(i, i + 500).map(toRow), { onConflict: "id" });
    if (error) throw error;
  }
}

// --------------------------------------------------------------- briefings

export interface BriefingFunnel {
  /** Records the sources returned for this researcher's window. */
  scanned: number;
  /** Records that passed the lexical prefilter and went to the AI. */
  candidates: number;
}

export interface BriefingRecord {
  id: string;
  userId: string;
  mode: "nightly" | "on_demand";
  status: "evaluating" | "ready" | "failed";
  funnel: BriefingFunnel;
  sourceCounts: Record<string, number>;
  batchId: string | null;
  error: string | null;
  emailedAt: string | null;
  createdAt: string;
  completedAt: string | null;
}

interface BriefingRow {
  id: string;
  user_id: string;
  mode: BriefingRecord["mode"];
  status: BriefingRecord["status"];
  funnel: Partial<BriefingFunnel>;
  source_counts: Record<string, number>;
  batch_id: string | null;
  error: string | null;
  emailed_at: string | null;
  created_at: string;
  completed_at: string | null;
}

const toBriefing = (r: BriefingRow): BriefingRecord => ({
  id: r.id,
  userId: r.user_id,
  mode: r.mode,
  status: r.status,
  funnel: { scanned: 0, candidates: 0, ...r.funnel },
  sourceCounts: r.source_counts ?? {},
  batchId: r.batch_id,
  error: r.error,
  emailedAt: r.emailed_at,
  createdAt: r.created_at,
  completedAt: r.completed_at,
});

export async function createBriefing(input: {
  id?: string;
  userId: string;
  mode: BriefingRecord["mode"];
  status?: BriefingRecord["status"];
  batchId?: string;
  funnel?: BriefingFunnel;
  sourceCounts?: Record<string, number>;
}): Promise<string> {
  const { data, error } = await db()
    .from("briefings")
    .insert({
      ...(input.id ? { id: input.id } : {}),
      user_id: input.userId,
      mode: input.mode,
      status: input.status ?? "evaluating",
      batch_id: input.batchId ?? null,
      funnel: input.funnel ?? {},
      source_counts: input.sourceCounts ?? {},
      completed_at: input.status === "ready" ? new Date().toISOString() : null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function updateBriefing(
  id: string,
  patch: Partial<{
    status: BriefingRecord["status"];
    funnel: BriefingFunnel;
    sourceCounts: Record<string, number>;
    batchId: string;
    error: string | null;
    emailedAt: string;
    completedAt: string;
  }>,
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.status) row.status = patch.status;
  if (patch.funnel) row.funnel = patch.funnel;
  if (patch.sourceCounts) row.source_counts = patch.sourceCounts;
  if (patch.batchId) row.batch_id = patch.batchId;
  if (patch.error !== undefined) row.error = patch.error;
  if (patch.emailedAt) row.emailed_at = patch.emailedAt;
  if (patch.completedAt) row.completed_at = patch.completedAt;
  const { error } = await db().from("briefings").update(row).eq("id", id);
  if (error) throw error;
}

export async function getBriefing(id: string): Promise<BriefingRecord | null> {
  const { data, error } = await db().from("briefings").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? toBriefing(data as BriefingRow) : null;
}

/** Most recent briefing for a user, optionally filtered by status or mode. */
export async function latestBriefing(
  userId: string,
  opts: { readyOnly?: boolean; mode?: BriefingRecord["mode"] } = {},
): Promise<BriefingRecord | null> {
  let query = db()
    .from("briefings")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (opts.readyOnly) query = query.eq("status", "ready");
  if (opts.mode) query = query.eq("mode", opts.mode);
  const { data, error } = await query;
  if (error) throw error;
  return data?.[0] ? toBriefing(data[0] as BriefingRow) : null;
}

/** Nightly briefings that are ready but have not been emailed. */
export async function unsentNightlyBriefings(since: Date): Promise<BriefingRecord[]> {
  const { data, error } = await db()
    .from("briefings")
    .select("*")
    .eq("mode", "nightly")
    .eq("status", "ready")
    .is("emailed_at", null)
    .gte("created_at", since.toISOString());
  if (error) throw error;
  return (data as BriefingRow[]).map(toBriefing);
}

/**
 * Atomically mark a briefing as emailed. Returns false if another run got
 * there first, so overlapping finalize calls cannot send twice.
 */
export async function claimEmail(briefingId: string): Promise<boolean> {
  const { data, error } = await db()
    .from("briefings")
    .update({ emailed_at: new Date().toISOString() })
    .eq("id", briefingId)
    .is("emailed_at", null)
    .select("id");
  if (error) throw error;
  return Boolean(data?.length);
}

export async function releaseEmailClaim(briefingId: string): Promise<void> {
  const { error } = await db().from("briefings").update({ emailed_at: null }).eq("id", briefingId);
  if (error) throw error;
}

export async function listEvaluatingBriefings(): Promise<BriefingRecord[]> {
  const { data, error } = await db().from("briefings").select("*").eq("status", "evaluating");
  if (error) throw error;
  return (data as BriefingRow[]).map(toBriefing);
}

// ------------------------------------------------------------- evaluations

/** Publications this user has already had assessed, so they are never paid for twice. */
export async function evaluatedPublicationIds(userId: string): Promise<Set<string>> {
  const ids = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db()
      .from("evaluations")
      .select("publication_id")
      .eq("user_id", userId)
      .in("status", ["done", "pending"])
      .range(from, from + 999);
    if (error) throw error;
    for (const r of data ?? []) ids.add(r.publication_id as string);
    if (!data || data.length < 1000) return ids;
  }
}

export async function insertPendingEvaluations(
  rows: {
    userId: string;
    briefingId: string;
    publicationId: string;
    prefilterScore: number;
    customId?: string;
  }[],
): Promise<void> {
  if (!rows.length) return;
  // Callers have already skipped done/pending items; this guards the race
  // where two runs for one user pick the same item at the same moment.
  const { data: taken, error: readError } = await db()
    .from("evaluations")
    .select("publication_id")
    .eq("user_id", rows[0].userId)
    .in("status", ["pending", "done"])
    .in("publication_id", rows.map((r) => r.publicationId));
  if (readError) throw readError;
  const takenIds = new Set((taken ?? []).map((t) => t.publication_id as string));
  rows = rows.filter((r) => !takenIds.has(r.publicationId));
  if (!rows.length) return;
  const { error } = await db()
    .from("evaluations")
    .upsert(
      rows.map((r) => ({
        user_id: r.userId,
        publication_id: r.publicationId,
        briefing_id: r.briefingId,
        prefilter_score: r.prefilterScore,
        custom_id: r.customId ?? null,
        assessment: null,
        status: "pending",
        error: null,
      })),
      { onConflict: "user_id,publication_id" },
    );
  if (error) throw error;
}

/** Record a result, but only onto the pending row this briefing owns. */
export async function saveEvaluation(
  userId: string,
  publicationId: string,
  briefingId: string,
  outcome: EvaluationOutcome,
): Promise<void> {
  const { error } = await db()
    .from("evaluations")
    .update(
      outcome.ok
        ? { status: "done", assessment: outcome.assessment, error: null }
        : { status: "failed", error: outcome.reason },
    )
    .eq("user_id", userId)
    .eq("publication_id", publicationId)
    .eq("briefing_id", briefingId)
    .eq("status", "pending");
  if (error) throw error;
}

/** Pending evaluations in a briefing, with the batch request id each was sent under. */
export async function pendingEvaluations(
  briefingId: string,
): Promise<{ userId: string; publicationId: string; customId: string | null }[]> {
  const { data, error } = await db()
    .from("evaluations")
    .select("user_id, publication_id, custom_id")
    .eq("briefing_id", briefingId)
    .eq("status", "pending");
  if (error) throw error;
  return (data ?? []).map((r) => ({
    userId: r.user_id as string,
    publicationId: r.publication_id as string,
    customId: r.custom_id as string | null,
  }));
}

interface EvaluationJoinRow {
  briefing_id: string | null;
  assessment: AiAssessment;
  publications: PublicationRow;
}

function evaluationsQuery() {
  return db().from("evaluations").select("briefing_id, assessment, publications!inner(*)");
}

function toItems(rows: unknown[] | null): EvaluatedItem[] {
  return ((rows ?? []) as EvaluationJoinRow[]).map((r) => ({
    publication: fromRow(r.publications),
    assessment: r.assessment,
    briefingId: r.briefing_id,
  }));
}

/** Completed assessments from one briefing. */
export async function itemsForBriefing(
  userId: string,
  briefingId: string,
): Promise<EvaluatedItem[]> {
  const { data, error } = await evaluationsQuery()
    .eq("user_id", userId)
    .eq("briefing_id", briefingId)
    .eq("status", "done");
  if (error) throw error;
  return toItems(data);
}

/** Completed assessments for specific publications. */
export async function itemsByIds(
  userId: string,
  publicationIds: string[],
): Promise<EvaluatedItem[]> {
  if (!publicationIds.length) return [];
  const { data, error } = await evaluationsQuery()
    .eq("user_id", userId)
    .eq("status", "done")
    .in("publication_id", publicationIds);
  if (error) throw error;
  return toItems(data);
}

export async function countDoneEvaluations(briefingId: string): Promise<number> {
  const { count, error } = await db()
    .from("evaluations")
    .select("*", { count: "exact", head: true })
    .eq("briefing_id", briefingId)
    .eq("status", "done");
  if (error) throw error;
  return count ?? 0;
}

// --------------------------------------------------------- item state

export interface ItemState {
  savedIds: string[];
  dismissedIds: string[];
}

export async function getItemState(userId: string): Promise<ItemState> {
  const { data, error } = await db()
    .from("item_state")
    .select("publication_id, saved, dismissed")
    .eq("user_id", userId);
  if (error) throw error;
  const rows = data ?? [];
  return {
    savedIds: rows.filter((r) => r.saved).map((r) => r.publication_id as string),
    dismissedIds: rows.filter((r) => r.dismissed).map((r) => r.publication_id as string),
  };
}

export async function setItemState(
  userId: string,
  publicationId: string,
  patch: { saved?: boolean; dismissed?: boolean },
): Promise<void> {
  const { data: existing, error: readError } = await db()
    .from("item_state")
    .select("saved, dismissed")
    .eq("user_id", userId)
    .eq("publication_id", publicationId)
    .maybeSingle();
  if (readError) throw readError;
  const { error } = await db()
    .from("item_state")
    .upsert(
      {
        user_id: userId,
        publication_id: publicationId,
        saved: patch.saved ?? existing?.saved ?? false,
        dismissed: patch.dismissed ?? existing?.dismissed ?? false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,publication_id" },
    );
  if (error) throw error;
}

export async function recordFeedbackEvent(
  userId: string,
  publicationId: string,
  action: FeedbackAction,
): Promise<void> {
  const { error } = await db()
    .from("feedback")
    .insert({ user_id: userId, publication_id: publicationId, action });
  if (error) throw error;
}

export async function feedbackCount(userId: string): Promise<number> {
  const { count, error } = await db()
    .from("feedback")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error) throw error;
  return count ?? 0;
}
