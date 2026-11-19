import "server-only";

import { env } from "@/lib/env";
import { db } from "@/lib/supabase/admin";
import { NEUTRAL_PREFERENCE_WEIGHTS } from "@/lib/preferences/model";
import { parseStudentProfile, serializeStudentProfile } from "@/lib/profile/student";
import type { DigestFrequency, PreferenceWeights, StudentProfile } from "@/lib/types";

export type { DigestFrequency };
export const DIGEST_FREQUENCIES: DigestFrequency[] = ["daily", "weekly", "monthly", "important_only", "off"];

export interface Account {
  id: string;
  email: string;
  displayName: string | null;
  approved: boolean;
  isAdmin: boolean;
  weights: PreferenceWeights;
  digestFrequency: DigestFrequency;
  alertsEnabled: boolean;
  lastDigestAt: string | null;
  lastOnDemandAt: string | null;
  createdAt: string;
  /** The student's research profile; empty until they fill it in. */
  student: StudentProfile;
}

interface ProfileRow {
  id: string;
  email: string;
  display_name: string | null;
  approved: boolean;
  preference_weights: PreferenceWeights | null;
  digest_frequency: DigestFrequency;
  alerts_enabled: boolean;
  last_digest_at: string | null;
  last_on_demand_at: string | null;
  created_at: string;
  research_profile: unknown;
}

function toAccount(row: ProfileRow): Account {
  const isAdmin = env.adminEmails().includes(row.email.toLowerCase());
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    // Admins never wait on their own approval queue.
    approved: row.approved || isAdmin,
    isAdmin,
    weights: { ...NEUTRAL_PREFERENCE_WEIGHTS, ...(row.preference_weights ?? {}) },
    digestFrequency: row.digest_frequency,
    alertsEnabled: row.alerts_enabled,
    lastDigestAt: row.last_digest_at,
    lastOnDemandAt: row.last_on_demand_at,
    createdAt: row.created_at,
    student: parseStudentProfile(row.research_profile),
  };
}

export async function getAccount(id: string): Promise<Account | null> {
  const { data, error } = await db().from("profiles").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? toAccount(data as ProfileRow) : null;
}

/**
 * The account for a verified auth user. The signup trigger normally creates
 * the row; this covers users who predate the trigger or hit a failure there,
 * which would otherwise bounce between /login and / forever.
 */
export async function ensureAccount(id: string, email: string): Promise<Account> {
  const existing = await getAccount(id);
  if (existing) return existing;
  const { data: invited } = await db()
    .from("approved_emails")
    .select("email")
    .eq("email", email.toLowerCase())
    .maybeSingle();
  const { error } = await db()
    .from("profiles")
    .upsert({ id, email, approved: Boolean(invited) }, { onConflict: "id", ignoreDuplicates: true });
  if (error) throw error;
  const created = await getAccount(id);
  if (!created) throw new Error(`Could not create account row for ${id}`);
  return created;
}

/** Approved accounts: the only ones monitoring runs and digests are spent on. */
export async function listApprovedAccounts(): Promise<Account[]> {
  const { data, error } = await db().from("profiles").select("*");
  if (error) throw error;
  return (data as ProfileRow[]).map(toAccount).filter((a) => a.approved);
}

export async function listAllAccounts(): Promise<Account[]> {
  const { data, error } = await db()
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as ProfileRow[]).map(toAccount);
}

export async function updateAccount(
  id: string,
  patch: Partial<{
    displayName: string | null;
    approved: boolean;
    weights: PreferenceWeights;
    digestFrequency: DigestFrequency;
    alertsEnabled: boolean;
    lastOnDemandAt: string;
    student: StudentProfile;
  }>,
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.displayName !== undefined) row.display_name = patch.displayName;
  if (patch.approved !== undefined) row.approved = patch.approved;
  if (patch.weights !== undefined) row.preference_weights = patch.weights;
  if (patch.digestFrequency !== undefined) row.digest_frequency = patch.digestFrequency;
  if (patch.alertsEnabled !== undefined) row.alerts_enabled = patch.alertsEnabled;
  if (patch.lastOnDemandAt !== undefined) row.last_on_demand_at = patch.lastOnDemandAt;
  if (patch.student !== undefined) row.research_profile = serializeStudentProfile(patch.student);
  const { error } = await db().from("profiles").update(row).eq("id", id);
  if (error) throw error;
}

/**
 * Atomically claim an on-demand run: succeeds only if the last one started
 * before `cooldownMs` ago, so two simultaneous requests cannot both start.
 */
export async function claimOnDemandSlot(id: string, cooldownMs: number): Promise<boolean> {
  const now = new Date();
  const cutoff = new Date(now.getTime() - cooldownMs).toISOString();
  const { data, error } = await db()
    .from("profiles")
    .update({ last_on_demand_at: now.toISOString() })
    .eq("id", id)
    .or(`last_on_demand_at.is.null,last_on_demand_at.lt.${cutoff}`)
    .select("id");
  if (error) throw error;
  return Boolean(data?.length);
}

/**
 * Atomically claim the next digest period: succeeds only if no other run has
 * moved last_digest_at since `previous` was read, so overlapping cron calls
 * cannot build the same digest twice.
 */
export async function claimDigestPeriod(
  id: string,
  previous: string | null,
  now: string,
): Promise<boolean> {
  let query = db().from("profiles").update({ last_digest_at: now }).eq("id", id);
  query = previous ? query.eq("last_digest_at", previous) : query.is("last_digest_at", null);
  const { data, error } = await query.select("id");
  if (error) throw error;
  return Boolean(data?.length);
}

/** Undo a claim whose digest could not be built, so the next finalize retries it. */
export async function releaseDigestPeriod(id: string, claimed: string, previous: string | null): Promise<void> {
  const { error } = await db()
    .from("profiles")
    .update({ last_digest_at: previous })
    .eq("id", id)
    .eq("last_digest_at", claimed);
  if (error) throw error;
}

export async function listInvites(): Promise<{ email: string; createdAt: string }[]> {
  const { data, error } = await db()
    .from("approved_emails")
    .select("email, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({ email: r.email, createdAt: r.created_at }));
}

/** Invite an email: future signups are auto-approved, an existing account is approved now. */
export async function inviteEmail(email: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  const { error } = await db()
    .from("approved_emails")
    .upsert({ email: normalized }, { onConflict: "email" });
  if (error) throw error;
  const { error: approveError } = await db()
    .from("profiles")
    .update({ approved: true })
    .eq("email", normalized);
  if (approveError) throw approveError;
}

export async function removeInvite(email: string): Promise<void> {
  const { error } = await db().from("approved_emails").delete().eq("email", email);
  if (error) throw error;
}
