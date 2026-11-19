import "server-only";

import { db } from "@/lib/supabase/admin";
import type { TopicState } from "@/lib/monitoring/diagnosis";
import type { DigestFrequency } from "@/lib/types";

export interface DigestSummary {
  developments: number;
  highPriority: number;
  /** Each topic's monitoring state when the digest was built. */
  topics: { topicId: string; name: string; state: TopicState | "not_checked"; headline: string }[];
}

export interface DigestRecord {
  id: string;
  userId: string;
  frequency: DigestFrequency;
  periodStart: string;
  periodEnd: string;
  publicationIds: string[];
  summary: DigestSummary;
  emailedAt: string | null;
  createdAt: string;
}

interface DigestRow {
  id: string;
  user_id: string;
  frequency: DigestFrequency;
  period_start: string;
  period_end: string;
  publication_ids: string[];
  summary: Partial<DigestSummary>;
  emailed_at: string | null;
  created_at: string;
}

const toDigest = (r: DigestRow): DigestRecord => ({
  id: r.id,
  userId: r.user_id,
  frequency: r.frequency,
  periodStart: r.period_start,
  periodEnd: r.period_end,
  publicationIds: r.publication_ids ?? [],
  summary: { developments: 0, highPriority: 0, topics: [], ...r.summary },
  emailedAt: r.emailed_at,
  createdAt: r.created_at,
});

export async function createDigest(input: {
  userId: string;
  frequency: DigestFrequency;
  periodStart: string;
  periodEnd: string;
  publicationIds: string[];
  summary: DigestSummary;
}): Promise<DigestRecord> {
  const { data, error } = await db()
    .from("digests")
    .insert({
      user_id: input.userId,
      frequency: input.frequency,
      period_start: input.periodStart,
      period_end: input.periodEnd,
      publication_ids: input.publicationIds,
      summary: input.summary,
    })
    .select("*")
    .single();
  if (error) throw error;
  return toDigest(data as DigestRow);
}

export async function listDigests(userId: string, limit = 20): Promise<DigestRecord[]> {
  const { data, error } = await db()
    .from("digests")
    .select("*")
    .eq("user_id", userId)
    .order("period_end", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as DigestRow[]).map(toDigest);
}

export async function markDigestEmailed(id: string): Promise<void> {
  const { error } = await db()
    .from("digests")
    .update({ emailed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
