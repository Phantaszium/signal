"use client";

import { signUpAction } from "@/app/(auth)/actions";
import { ActionForm, Field, SubmitButton } from "@/components/auth/AuthForm";

export function SignUpForm() {
  return (
    <ActionForm action={signUpAction}>
      {(state) => (
        <>
          <Field label="Email" name="email" type="email" autoComplete="email" defaultValue={state.email} hint="Alerts and briefings are sent here. We'll send a link to confirm it." />
          <Field label="Password" name="password" type="password" autoComplete="new-password" hint="At least 10 characters." />
          <Field label="Confirm password" name="confirm" type="password" autoComplete="new-password" />
          <SubmitButton>Create account</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
