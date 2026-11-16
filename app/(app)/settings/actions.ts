"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/app/(auth)/actions";
import { requireAccount } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { db } from "@/lib/supabase/admin";
import { createAuthClient } from "@/lib/supabase/server";

export async function changeEmailAction(_prev: FormState, form: FormData): Promise<FormState> {
  const account = await requireAccount();
  const parsed = z.string().trim().toLowerCase().email().safeParse(form.get("email"));
  if (!parsed.success) return { error: "Enter a valid email address." };
  if (parsed.data === account.email.toLowerCase()) {
    return { error: "That is already your email address." };
  }
  const supabase = await createAuthClient();
  const { error } = await supabase.auth.updateUser(
    { email: parsed.data },
    { emailRedirectTo: `${env.siteUrl()}/auth/confirm?next=/settings` },
  );
  if (error) return { error: "Could not change the email. It may already be in use." };
  return {
    message: `Confirmation links are on their way. Your account switches to ${parsed.data} once the change is confirmed.`,
  };
}

export async function changePasswordAction(_prev: FormState, form: FormData): Promise<FormState> {
  const account = await requireAccount();
  const parsed = z
    .object({
      current: z.string().min(1, "Enter your current password."),
      password: z.string().min(10, "Use at least 10 characters.").max(128),
      confirm: z.string(),
    })
    .refine((v) => v.password === v.confirm, { message: "The new passwords do not match." })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createAuthClient();
  const check = await supabase.auth.signInWithPassword({
    email: account.email,
    password: parsed.data.current,
  });
  if (check.error) return { error: "Your current password is not correct." };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "same_password") return { error: "Choose a different password." };
    if (error.code === "weak_password") return { error: "That password is too easy to guess." };
    return { error: "Could not change the password. Try again." };
  }
  return { message: "Password changed." };
}

export async function deleteAccountAction(_prev: FormState, form: FormData): Promise<FormState> {
  const account = await requireAccount();
  if (String(form.get("confirm")).trim().toLowerCase() !== "delete") {
    return { error: 'Type "delete" to confirm.' };
  }
  // Cascades to the profile, briefings, assessments and feedback.
  const { error } = await db().auth.admin.deleteUser(account.id);
  if (error) return { error: "Could not delete the account. Try again." };
  const supabase = await createAuthClient();
  await supabase.auth.signOut();
  redirect("/signup");
}
