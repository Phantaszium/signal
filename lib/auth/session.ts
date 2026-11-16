import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { createAuthClient } from "@/lib/supabase/server";
import { ensureAccount, type Account } from "@/lib/db/accounts";
import { listTopics } from "@/lib/db/topics";
import type { MonitoringTopic } from "@/lib/types";

export interface SessionUser {
  id: string;
  email: string;
}

/** The verified signed-in user, or null. Cached for the duration of a request. */
export const currentUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createAuthClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.email) return null;
  return { id: data.user.id, email: data.user.email };
});

export function isAdminEmail(email: string): boolean {
  return env.adminEmails().includes(email.toLowerCase());
}

/** Signed-in user plus their account row; redirects to /login otherwise. */
export const requireAccount = cache(async (): Promise<Account> => {
  const user = await currentUser();
  if (!user) redirect("/login");
  return ensureAccount(user.id, user.email);
});

/** The signed-in user's monitoring topics. Cached for the duration of a request. */
export const currentTopics = cache(async (userId: string): Promise<MonitoringTopic[]> =>
  listTopics(userId),
);

/**
 * An approved account with at least one monitoring topic — the precondition
 * for every page that shows or spends money on monitoring.
 */
export const requireReadyAccount = cache(async (): Promise<Account> => {
  const account = await requireAccount();
  if (!(await currentTopics(account.id)).length) redirect("/onboarding");
  if (!account.approved) redirect("/pending");
  return account;
});

export const requireAdmin = cache(async (): Promise<Account> => {
  const account = await requireAccount();
  if (!account.isAdmin) redirect("/");
  return account;
});
