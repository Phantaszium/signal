"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { env } from "@/lib/env";
import { RECOVERY_COOKIE, safeNextPath } from "@/lib/auth/redirect";
import { createAuthClient } from "@/lib/supabase/server";

export interface FormState {
  error?: string;
  message?: string;
  /** Echoed back so a failed submit does not clear the email field. */
  email?: string;
}

const email = z.string().trim().toLowerCase().email("Enter a valid email address.");
const password = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(128, "Use at most 128 characters.");


export async function signUpAction(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = z
    .object({ email, password, confirm: z.string() })
    .refine((v) => v.password === v.confirm, {
      message: "The passwords do not match.",
      path: ["confirm"],
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message, email: String(form.get("email") ?? "") };
  }

  const supabase = await createAuthClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { emailRedirectTo: `${env.siteUrl()}/auth/confirm?next=/onboarding` },
  });
  if (error) {
    if (error.code === "weak_password") {
      return { error: "That password is too easy to guess. Try a longer one.", email: parsed.data.email };
    }
    return { error: "Could not create the account. Try again in a minute.", email: parsed.data.email };
  }
  // Supabase deliberately gives the same answer for new and existing emails,
  // so the page does too.
  redirect(`/signup/check-email?email=${encodeURIComponent(parsed.data.email)}`);
}

export async function signInAction(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = z.object({ email, password: z.string().min(1) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Enter your email and password.", email: String(form.get("email") ?? "") };

  const supabase = await createAuthClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.code === "email_not_confirmed") {
      return {
        error: "Confirm your email first. We can send the link again.",
        email: parsed.data.email,
      };
    }
    return { error: "That email and password do not match.", email: parsed.data.email };
  }
  redirect(safeNextPath(form.get("next")));
}

export async function resendConfirmationAction(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = email.safeParse(form.get("email"));
  if (!parsed.success) return { error: "Enter a valid email address." };
  const supabase = await createAuthClient();
  await supabase.auth.resend({
    type: "signup",
    email: parsed.data,
    options: { emailRedirectTo: `${env.siteUrl()}/auth/confirm?next=/onboarding` },
  });
  return { message: "If that address has an unconfirmed account, a new link is on its way.", email: parsed.data };
}

export async function forgotPasswordAction(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = email.safeParse(form.get("email"));
  if (!parsed.success) return { error: "Enter a valid email address." };
  const supabase = await createAuthClient();
  await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${env.siteUrl()}/auth/confirm?next=/reset-password`,
  });
  // Same answer whether or not the account exists.
  return { message: "If an account uses that address, a reset link is on its way.", email: parsed.data };
}

export async function resetPasswordAction(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = z
    .object({ password, confirm: z.string() })
    .refine((v) => v.password === v.confirm, { message: "The passwords do not match." })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // Only a session that just arrived through a recovery link may skip the
  // current-password check; anyone else changes it from Settings.
  const cookieStore = await cookies();
  if (!cookieStore.get(RECOVERY_COOKIE)) {
    return { error: "This reset link has expired. Request a new one." };
  }

  const supabase = await createAuthClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "same_password") return { error: "Choose a password you have not used here before." };
    return { error: "This reset link has expired. Request a new one." };
  }
  cookieStore.delete(RECOVERY_COOKIE);
  redirect("/");
}

export async function signOutAction(): Promise<void> {
  const supabase = await createAuthClient();
  await supabase.auth.signOut();
  redirect("/login");
}
