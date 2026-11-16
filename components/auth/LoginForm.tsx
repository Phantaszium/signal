"use client";

import Link from "next/link";
import { signInAction } from "@/app/(auth)/actions";
import { ActionForm, Field, SubmitButton } from "@/components/auth/AuthForm";

export function LoginForm({ next, linkError }: { next: string; linkError: boolean }) {
  return (
    <ActionForm
      action={signInAction}
      initial={linkError ? { error: "That link is invalid or has expired. Sign in, or request a new one." } : {}}
    >
      {(state) => (
        <>
          <input type="hidden" name="next" value={next} />
          <Field label="Email" name="email" type="email" autoComplete="email" defaultValue={state.email} />
          <Field label="Password" name="password" type="password" autoComplete="current-password" />
          <SubmitButton>Sign in</SubmitButton>
          <div className="flex items-center justify-between text-[12px]">
            <Link href="/forgot-password" className="text-accent hover:underline">
              Forgot your password?
            </Link>
            {state.error?.startsWith("Confirm your email") && state.email && (
              <Link
                href={`/signup/check-email?email=${encodeURIComponent(state.email)}`}
                className="text-accent hover:underline"
              >
                Resend confirmation
              </Link>
            )}
          </div>
        </>
      )}
    </ActionForm>
  );
}
