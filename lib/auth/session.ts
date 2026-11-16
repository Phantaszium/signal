import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { createAuthClient } from "@/lib/supabase/server";
import { ensureAccount, type Account } from "@/lib/db/accounts";

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

/**
 * An approved account with a research profile — the precondition for every
 * page that shows or spends money on briefings.
 */
export const requireReadyAccount = cache(async (): Promise<Account> => {
  const account = await requireAccount();
  if (!account.researchProfile) redirect("/onboarding");
  if (!account.approved) redirect("/pending");
  return account;
});

export const requireAdmin = cache(async (): Promise<Account> => {
  const account = await requireAccount();
  if (!account.isAdmin) redirect("/");
  return account;
});
