"use client";

import { resendConfirmationAction } from "@/app/(auth)/actions";
import { ActionForm, Field, SubmitButton } from "@/components/auth/AuthForm";

export function ResendForm({ email }: { email: string }) {
  return (
    <ActionForm action={resendConfirmationAction} initial={{ email }}>
      {(state) => (
        <>
          <Field label="Email" name="email" type="email" autoComplete="email" defaultValue={state.email} />
          <SubmitButton>Resend confirmation link</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
