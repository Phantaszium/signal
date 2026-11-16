import "server-only";

import { db } from "@/lib/supabase/admin";
import type { MonitoringTopic, Sensitivity, SourceKey, TopicProfile } from "@/lib/types";

export const ALL_SOURCES: SourceKey[] = ["pubmed", "clinicaltrials", "biorxiv", "medrxiv", "europepmc"];

interface TopicRow {
  id: string;
  user_id: string;
  definition: Partial<TopicProfile>;
  sensitivity: Sensitivity;
  sources: string[];
  active: boolean;
  backfilled_at: string | null;
  last_checked_at: string | null;
  created_at: string;
}

const list = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x) => typeof x === "string") : []);

/** Rows written before a field existed read as empty, never undefined. */
function toProfile(d: Partial<TopicProfile>): TopicProfile {
  return {
    program: d.program ?? "Untitled topic",
    description: d.description ?? "",
    keywords: list(d.keywords),
    synonyms: list(d.synonyms),
    genes: list(d.genes),
    organisms: list(d.organisms),
    diseases: list(d.diseases),
    techniques: list(d.techniques),
    organizations: list(d.organizations),
    exclusions: list(d.exclusions),
  };
}

function toTopic(r: TopicRow): MonitoringTopic & { userId: string } {
  return {
    id: r.id,
    userId: r.user_id,
    profile: toProfile(r.definition),
    sensitivity: r.sensitivity,
    sources: r.sources.filter((s): s is SourceKey => (ALL_SOURCES as string[]).includes(s)),
    active: r.active,
    backfilledAt: r.backfilled_at,
    lastCheckedAt: r.last_checked_at,
    createdAt: r.created_at,
  };
}

export async function listTopics(userId: string): Promise<MonitoringTopic[]> {
  const { data, error } = await db()
    .from("topics")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as TopicRow[]).map(toTopic);
}

/** Every user's topics, grouped by user id. For the scheduler and admin. */
export async function topicsByUser(): Promise<Map<string, MonitoringTopic[]>> {
  const { data, error } = await db().from("topics").select("*").order("created_at", { ascending: true });
  if (error) throw error;
  const out = new Map<string, MonitoringTopic[]>();
  for (const row of data as TopicRow[]) {
    const topic = toTopic(row);
    out.set(topic.userId, [...(out.get(topic.userId) ?? []), topic]);
  }
  return out;
}

export async function getTopic(userId: string, id: string): Promise<MonitoringTopic | null> {
  const { data, error } = await db()
    .from("topics")
    .select("*")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? toTopic(data as TopicRow) : null;
}

export interface TopicInput {
  profile: TopicProfile;
  sensitivity: Sensitivity;
  sources: SourceKey[];
  active: boolean;
}

export async function createTopic(userId: string, input: TopicInput): Promise<string> {
  const { data, error } = await db()
    .from("topics")
    .insert({
      user_id: userId,
      definition: input.profile,
      sensitivity: input.sensitivity,
      sources: input.sources,
      active: input.active,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function updateTopic(userId: string, id: string, input: TopicInput): Promise<void> {
  const { error } = await db()
    .from("topics")
    .update({
      definition: input.profile,
      sensitivity: input.sensitivity,
      sources: input.sources,
      active: input.active,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("id", id);
  if (error) throw error;
}

/**
 * Deleting a topic keeps the assessments made for it, with no topic (see
 * migration 0003), so saved items survive and records are not re-assessed.
 */
export async function deleteTopic(userId: string, id: string): Promise<void> {
  const { error } = await db().from("topics").delete().eq("user_id", userId).eq("id", id);
  if (error) throw error;
}

/**
 * Record that these topics were checked. `backfilled` marks the topics whose
 * first look-back has now run, so later runs only read new records.
 */
export async function markTopicsChecked(
  ids: string[],
  at: string,
  backfilled: string[],
): Promise<void> {
  if (ids.length) {
    const { error } = await db().from("topics").update({ last_checked_at: at }).in("id", ids);
    if (error) throw error;
  }
  if (backfilled.length) {
    const { error } = await db()
      .from("topics")
      .update({ backfilled_at: at })
      .in("id", backfilled)
      .is("backfilled_at", null);
    if (error) throw error;
  }
}
