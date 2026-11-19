import "server-only";

import { db } from "@/lib/supabase/admin";
import type { RunDiagnostics, RunMode, RunRecord, RunStatus } from "@/lib/monitoring/types";

interface RunRow {
  id: string;
  user_id: string;
  mode: RunMode;
  status: RunStatus;
  diagnostics: Partial<RunDiagnostics> | null;
  batch_id: string | null;
  error: string | null;
  created_at: string;
  completed_at: string | null;
}

/** Runs from before per-topic diagnostics existed read as having none. */
const toRun = (r: RunRow): RunRecord => ({
  id: r.id,
  userId: r.user_id,
  mode: r.mode,
  status: r.status,
  diagnostics: {
    topicOrder: r.diagnostics?.topicOrder ?? [],
    topics: r.diagnostics?.topics ?? [],
    durationMs: r.diagnostics?.durationMs,
  },
  batchId: r.batch_id,
  error: r.error,
  createdAt: r.created_at,
  completedAt: r.completed_at,
});

export async function createRun(input: {
  id?: string;
  userId: string;
  mode: RunMode;
  status?: RunStatus;
  batchId?: string;
  diagnostics?: RunDiagnostics;
}): Promise<string> {
  const status = input.status ?? "running";
  const { data, error } = await db()
    .from("monitor_runs")
    .insert({
      ...(input.id ? { id: input.id } : {}),
      user_id: input.userId,
      mode: input.mode,
      status,
      batch_id: input.batchId ?? null,
      diagnostics: input.diagnostics ?? {},
      completed_at: status === "complete" ? new Date().toISOString() : null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function updateRun(
  id: string,
  patch: Partial<{
    status: RunStatus;
    diagnostics: RunDiagnostics;
    batchId: string;
    error: string | null;
    completedAt: string;
  }>,
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.status) row.status = patch.status;
  if (patch.diagnostics) row.diagnostics = patch.diagnostics;
  if (patch.batchId) row.batch_id = patch.batchId;
  if (patch.error !== undefined) row.error = patch.error;
  if (patch.completedAt) row.completed_at = patch.completedAt;
  const { error } = await db().from("monitor_runs").update(row).eq("id", id);
  if (error) throw error;
}

export async function getRun(id: string): Promise<RunRecord | null> {
  const { data, error } = await db().from("monitor_runs").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? toRun(data as RunRow) : null;
}

/** A user's most recent runs, newest first. */
export async function recentRuns(
  userId: string,
  opts: { limit?: number; mode?: RunMode } = {},
): Promise<RunRecord[]> {
  let query = db()
    .from("monitor_runs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 10);
  if (opts.mode) query = query.eq("mode", opts.mode);
  const { data, error } = await query;
  if (error) throw error;
  return (data as RunRow[]).map(toRun);
}

/** Runs still in progress, across all users: for the finalize cron. */
export async function listOpenRuns(): Promise<RunRecord[]> {
  const { data, error } = await db()
    .from("monitor_runs")
    .select("*")
    .in("status", ["running", "evaluating"]);
  if (error) throw error;
  return (data as RunRow[]).map(toRun);
}
