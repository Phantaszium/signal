"use client";

import { resetPasswordAction } from "@/app/(auth)/actions";
import { ActionForm, Field, SubmitButton } from "@/components/auth/AuthForm";

export function ResetPasswordForm() {
  return (
    <ActionForm action={resetPasswordAction}>
      {() => (
        <>
          <Field label="New password" name="password" type="password" autoComplete="new-password" hint="At least 10 characters." />
          <Field label="Confirm new password" name="confirm" type="password" autoComplete="new-password" />
          <SubmitButton>Save password</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
