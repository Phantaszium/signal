"use client";

import { forgotPasswordAction } from "@/app/(auth)/actions";
import { ActionForm, Field, SubmitButton } from "@/components/auth/AuthForm";

export function ForgotPasswordForm() {
  return (
    <ActionForm action={forgotPasswordAction}>
      {(state) => (
        <>
          <Field label="Email" name="email" type="email" autoComplete="email" defaultValue={state.email} />
          <SubmitButton>Send reset link</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
