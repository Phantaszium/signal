import "server-only";

import { db } from "@/lib/supabase/admin";
import type { EvaluationOutcome } from "@/lib/ai/evaluate";
import type { AiAssessment, EvaluatedItem, FeedbackAction, Publication } from "@/lib/types";

/**
 * Publications, their per-user AI assessments, and what the user has done
 * with them. An assessment whose relevance clears its topic's threshold is a
 * development (see lib/developments.ts).
 */

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

export async function publicationsByIds(ids: string[]): Promise<Publication[]> {
  if (!ids.length) return [];
  const { data, error } = await db().from("publications").select("*").in("id", ids);
  if (error) throw error;
  return (data as PublicationRow[]).map(fromRow);
}

export async function upsertPublications(pubs: Publication[]): Promise<void> {
  for (let i = 0; i < pubs.length; i += 500) {
    const { error } = await db()
      .from("publications")
      .upsert(pubs.slice(i, i + 500).map(toRow), { onConflict: "id" });
    if (error) throw error;
  }
}

// ------------------------------------------------------------- evaluations

export interface AssessedKey {
  publicationId: string;
  status: "done" | "pending";
  topicId: string | null;
  createdAt: string;
}

/**
 * Publications this user has already had assessed (or queued), by id and by
 * DOI, so a record is never paid for twice even when a second source returns
 * it under a different id. Each entry says which topic it was filed under
 * and when, so a new topic can tell records judged before it existed.
 */
export async function assessedKeys(
  userId: string,
): Promise<{ ids: Map<string, AssessedKey>; dois: Map<string, AssessedKey> }> {
  const ids = new Map<string, AssessedKey>();
  const dois = new Map<string, AssessedKey>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db()
      .from("evaluations")
      .select("publication_id, status, topic_id, created_at, publications!inner(doi)")
      .eq("user_id", userId)
      .in("status", ["done", "pending"])
      .order("publication_id")
      .range(from, from + 999);
    if (error) throw error;
    for (const r of (data ?? []) as unknown as {
      publication_id: string;
      status: AssessedKey["status"];
      topic_id: string | null;
      created_at: string;
      publications: { doi: string | null };
    }[]) {
      const key = { publicationId: r.publication_id, status: r.status, topicId: r.topic_id, createdAt: r.created_at };
      ids.set(r.publication_id, key);
      if (r.publications?.doi) dois.set(r.publications.doi.toLowerCase(), key);
    }
    if (!data || data.length < 1000) return { ids, dois };
  }
}

export interface PendingRow {
  userId: string;
  runId: string;
  topicId: string;
  publicationId: string;
  prefilterScore: number;
  customId?: string;
  /**
   * Re-assess a record already assessed for another topic, replacing that
   * assessment: used when a new topic's first look-back finds records judged
   * before the topic existed.
   */
  reassess?: boolean;
}

export async function insertPendingEvaluations(rows: PendingRow[]): Promise<void> {
  if (!rows.length) return;
  // Callers have already skipped done/pending items; this guards the race
  // where two runs for one user pick the same item at the same moment.
  const { data: taken, error: readError } = await db()
    .from("evaluations")
    .select("publication_id, status")
    .eq("user_id", rows[0].userId)
    .in("status", ["pending", "done"])
    .in("publication_id", rows.map((r) => r.publicationId));
  if (readError) throw readError;
  const status = new Map((taken ?? []).map((t) => [t.publication_id as string, t.status as string]));
  // Pending always blocks (another run owns it); done blocks unless re-assessing.
  rows = rows.filter((r) => {
    const s = status.get(r.publicationId);
    return !s || (s === "done" && r.reassess);
  });
  if (!rows.length) return;
  const { error } = await db()
    .from("evaluations")
    .upsert(
      rows.map((r) => ({
        user_id: r.userId,
        publication_id: r.publicationId,
        run_id: r.runId,
        topic_id: r.topicId,
        prefilter_score: r.prefilterScore,
        custom_id: r.customId ?? null,
        assessment: null,
        relevance: null,
        significance: null,
        evaluated_at: null,
        // alerted_at is left alone, so a re-assessed record is not alerted twice.
        status: "pending",
        error: null,
      })),
      { onConflict: "user_id,publication_id" },
    );
  if (error) throw error;
}

/**
 * Record a result, but only onto the pending row this run owns. The topic is
 * the one the AI chose; the topic the record was retrieved for is kept when
 * the AI's answer did not name one of the user's topics.
 */
export async function saveEvaluation(
  userId: string,
  publicationId: string,
  runId: string,
  outcome: EvaluationOutcome,
): Promise<void> {
  const patch = outcome.ok
    ? {
        status: "done",
        assessment: outcome.assessment,
        relevance: outcome.assessment.relevance.score,
        significance: outcome.assessment.significance?.level ?? null,
        evaluated_at: outcome.assessment.evaluatedAt,
        error: null,
        ...(outcome.assessment.topicId ? { topic_id: outcome.assessment.topicId } : {}),
      }
    : { status: "failed", error: outcome.reason };
  const { error } = await db()
    .from("evaluations")
    .update(patch)
    .eq("user_id", userId)
    .eq("publication_id", publicationId)
    .eq("run_id", runId)
    .eq("status", "pending");
  if (error) throw error;
}

/** Pending evaluations in a run, with the batch request id each was sent under. */
export async function pendingEvaluations(
  runId: string,
): Promise<{ userId: string; publicationId: string; customId: string | null }[]> {
  const { data, error } = await db()
    .from("evaluations")
    .select("user_id, publication_id, custom_id")
    .eq("run_id", runId)
    .eq("status", "pending");
  if (error) throw error;
  return (data ?? []).map((r) => ({
    userId: r.user_id as string,
    publicationId: r.publication_id as string,
    customId: r.custom_id as string | null,
  }));
}

/** Every evaluation a run produced, for its completion counts. */
export async function runEvaluations(
  runId: string,
): Promise<
  { publicationId: string; topicId: string | null; status: string; assessment: AiAssessment | null }[]
> {
  const { data, error } = await db()
    .from("evaluations")
    .select("publication_id, topic_id, status, assessment")
    .eq("run_id", runId);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    publicationId: r.publication_id as string,
    topicId: r.topic_id as string | null,
    status: r.status as string,
    assessment: r.assessment as AiAssessment | null,
  }));
}

interface EvaluationJoinRow {
  run_id: string | null;
  topic_id: string | null;
  evaluated_at: string | null;
  created_at: string;
  assessment: AiAssessment;
  publications: PublicationRow;
}

const ITEM_COLUMNS = "run_id, topic_id, evaluated_at, created_at, assessment, publications!inner(*)";

function toItems(rows: unknown[] | null): EvaluatedItem[] {
  return ((rows ?? []) as EvaluationJoinRow[]).map((r) => ({
    publication: fromRow(r.publications),
    assessment: r.assessment,
    runId: r.run_id,
    topicId: r.topic_id,
    evaluatedAt: r.evaluated_at ?? r.created_at,
  }));
}

/**
 * Completed assessments for a user, newest first. `minRelevance` filters on
 * the indexed relevance column; `maxRelevance` selects what was ruled out.
 */
export async function recentItems(
  userId: string,
  opts: { since?: Date; minRelevance?: number; maxRelevance?: number; limit?: number } = {},
): Promise<EvaluatedItem[]> {
  let query = db()
    .from("evaluations")
    .select(ITEM_COLUMNS)
    .eq("user_id", userId)
    .eq("status", "done")
    .order("evaluated_at", { ascending: false })
    .limit(opts.limit ?? 300);
  if (opts.since) query = query.gte("evaluated_at", opts.since.toISOString());
  if (opts.minRelevance !== undefined) query = query.gte("relevance", opts.minRelevance);
  if (opts.maxRelevance !== undefined) query = query.lt("relevance", opts.maxRelevance);
  const { data, error } = await query;
  if (error) throw error;
  return toItems(data);
}

/** Completed assessments for specific publications. */
export async function itemsByIds(
  userId: string,
  publicationIds: string[],
): Promise<EvaluatedItem[]> {
  if (!publicationIds.length) return [];
  const { data, error } = await db()
    .from("evaluations")
    .select(ITEM_COLUMNS)
    .eq("user_id", userId)
    .eq("status", "done")
    .in("publication_id", publicationIds);
  if (error) throw error;
  return toItems(data);
}

export async function countDoneEvaluations(runId: string): Promise<number> {
  const { count, error } = await db()
    .from("evaluations")
    .select("*", { count: "exact", head: true })
    .eq("run_id", runId)
    .in("status", ["done", "failed"]);
  if (error) throw error;
  return count ?? 0;
}

/**
 * Atomically mark developments as alerted. Returns the ids this call claimed,
 * so overlapping runs cannot send the same alert twice.
 */
export async function claimAlerts(userId: string, publicationIds: string[]): Promise<string[]> {
  if (!publicationIds.length) return [];
  const { data, error } = await db()
    .from("evaluations")
    .update({ alerted_at: new Date().toISOString() })
    .eq("user_id", userId)
    .in("publication_id", publicationIds)
    .is("alerted_at", null)
    .select("publication_id");
  if (error) throw error;
  return (data ?? []).map((r) => r.publication_id as string);
}

export async function releaseAlerts(userId: string, publicationIds: string[]): Promise<void> {
  if (!publicationIds.length) return;
  const { error } = await db()
    .from("evaluations")
    .update({ alerted_at: null })
    .eq("user_id", userId)
    .in("publication_id", publicationIds);
  if (error) throw error;
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
