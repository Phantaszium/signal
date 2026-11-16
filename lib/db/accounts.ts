import "server-only";

import { env } from "@/lib/env";
import { db } from "@/lib/supabase/admin";
import { NEUTRAL_PREFERENCE_WEIGHTS } from "@/lib/preferences/model";
import type { PreferenceWeights, ResearchProfile } from "@/lib/types";

export interface Account {
  id: string;
  email: string;
  displayName: string | null;
  approved: boolean;
  isAdmin: boolean;
  researchProfile: ResearchProfile | null;
  weights: PreferenceWeights;
  emailDigest: boolean;
  lastOnDemandAt: string | null;
  createdAt: string;
}

interface ProfileRow {
  id: string;
  email: string;
  display_name: string | null;
  approved: boolean;
  research_profile: ResearchProfile | null;
  preference_weights: PreferenceWeights | null;
  email_digest: boolean;
  last_on_demand_at: string | null;
  created_at: string;
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
    researchProfile: row.research_profile,
    weights: { ...NEUTRAL_PREFERENCE_WEIGHTS, ...(row.preference_weights ?? {}) },
    emailDigest: row.email_digest,
    lastOnDemandAt: row.last_on_demand_at,
    createdAt: row.created_at,
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

/** Accounts that should receive a nightly briefing. */
export async function listBriefingAccounts(): Promise<Account[]> {
  const { data, error } = await db()
    .from("profiles")
    .select("*")
    .not("research_profile", "is", null);
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
    researchProfile: ResearchProfile;
    weights: PreferenceWeights;
    emailDigest: boolean;
    lastOnDemandAt: string;
  }>,
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.displayName !== undefined) row.display_name = patch.displayName;
  if (patch.approved !== undefined) row.approved = patch.approved;
  if (patch.researchProfile !== undefined) row.research_profile = patch.researchProfile;
  if (patch.weights !== undefined) row.preference_weights = patch.weights;
  if (patch.emailDigest !== undefined) row.email_digest = patch.emailDigest;
  if (patch.lastOnDemandAt !== undefined) row.last_on_demand_at = patch.lastOnDemandAt;
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
