"use client";

import { useState, useTransition } from "react";
import { setEmailDigestAction } from "@/app/(app)/actions";
import { signOutAction } from "@/app/(auth)/actions";
import {
  changeEmailAction,
  changePasswordAction,
  deleteAccountAction,
} from "@/app/(app)/settings/actions";
import { ActionForm, Field } from "@/components/auth/AuthForm";
import { Button, Panel } from "@/components/ui/primitives";
import { useFormStatus } from "react-dom";

function Submit({ children, danger = false }: { children: React.ReactNode; danger?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={danger ? "danger" : "primary"} disabled={pending}>
      {pending ? "Working…" : children}
    </Button>
  );
}

export function SettingsForms({ email, emailDigest }: { email: string; emailDigest: boolean }) {
  const [digest, setDigest] = useState(emailDigest);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-5">
      <Panel title="Daily briefing email">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={digest}
            disabled={pending}
            onChange={(e) => {
              const next = e.target.checked;
              setDigest(next);
              startTransition(() => setEmailDigestAction(next));
            }}
            className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
          />
          <span>
            <span className="block text-[13px] font-medium text-ink">
              Email me each morning&rsquo;s briefing
            </span>
            <span className="block text-[12px] text-ink-muted">Sent to {email}.</span>
          </span>
        </label>
      </Panel>

      <Panel title="Email address">
        <ActionForm action={changeEmailAction}>
          {() => (
            <>
              <Field label="New email address" name="email" type="email" autoComplete="email" hint="We'll email a confirmation link. Your current address stays active until the change is confirmed." />
              <Submit>Change email</Submit>
            </>
          )}
        </ActionForm>
      </Panel>

      <Panel title="Password">
        <ActionForm action={changePasswordAction}>
          {() => (
            <>
              <Field label="Current password" name="current" type="password" autoComplete="current-password" />
              <Field label="New password" name="password" type="password" autoComplete="new-password" hint="At least 10 characters." />
              <Field label="Confirm new password" name="confirm" type="password" autoComplete="new-password" />
              <Submit>Change password</Submit>
            </>
          )}
        </ActionForm>
      </Panel>

      <Panel title="Sign out">
        <form action={signOutAction}>
          <Button type="submit">Sign out</Button>
        </form>
      </Panel>

      <Panel title="Delete account">
        <p className="mb-3 text-[12px] leading-relaxed text-ink-muted">
          Permanently deletes your account, research profile, briefings, saved items and
          feedback. This cannot be undone.
        </p>
        <ActionForm action={deleteAccountAction}>
          {() => (
            <>
              <Field label='Type "delete" to confirm' name="confirm" autoComplete="off" />
              <Submit danger>Delete my account</Submit>
            </>
          )}
        </ActionForm>
      </Panel>
    </div>
  );
}
