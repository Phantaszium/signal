"use client";

import { useState, useTransition } from "react";
import { setDigestSettingsAction } from "@/app/(app)/actions";
import { signOutAction } from "@/app/(auth)/actions";
import {
  changeEmailAction,
  changePasswordAction,
  deleteAccountAction,
} from "@/app/(app)/settings/actions";
import { ActionForm, Field } from "@/components/auth/AuthForm";
import { Button, Panel, cx } from "@/components/ui/primitives";
import { FREQUENCY_LABEL } from "@/lib/digests/plan";
import type { DigestFrequency } from "@/lib/types";
import { useFormStatus } from "react-dom";

function Submit({ children, danger = false }: { children: React.ReactNode; danger?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={danger ? "danger" : "primary"} disabled={pending}>
      {pending ? "Working…" : children}
    </Button>
  );
}

export function SettingsForms({
  email,
  digestFrequency,
  alertsEnabled,
  emailConfigured,
}: {
  email: string;
  digestFrequency: DigestFrequency;
  alertsEnabled: boolean;
  emailConfigured: boolean;
}) {
  const [frequency, setFrequency] = useState(digestFrequency);
  const [alerts, setAlerts] = useState(alertsEnabled);
  const [pending, startTransition] = useTransition();
  const save = (next: { digestFrequency: DigestFrequency; alertsEnabled: boolean }) =>
    startTransition(async () => {
      await setDigestSettingsAction(next);
    });
  const alertsApply = frequency === "weekly" || frequency === "monthly";

  return (
    <div className="space-y-5">
      <Panel title="Briefing emails">
        {!emailConfigured && (
          <p className="mb-3 rounded-xl border border-high-line bg-high-soft px-3 py-2 text-[12px] leading-relaxed text-high">
            Email is not set up on this PaperPuffin server yet, so briefings are built in the app but not sent.
          </p>
        )}
        <fieldset className="space-y-1.5" disabled={pending}>
          <legend className="mb-2 text-[12px] text-ink-muted">
            How often should PaperPuffin email you? Sent to {email}.
          </legend>
          {(Object.keys(FREQUENCY_LABEL) as DigestFrequency[]).map((f) => (
            <label
              key={f}
              className={cx(
                "flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2 transition-colors",
                frequency === f ? "border-accent/50 bg-accent-soft/50" : "border-line hover:border-line-strong",
              )}
            >
              <input
                type="radio"
                name="frequency"
                checked={frequency === f}
                onChange={() => {
                  setFrequency(f);
                  save({ digestFrequency: f, alertsEnabled: alerts });
                }}
                className="mt-0.5 accent-[var(--accent)]"
              />
              <span>
                <span className="block text-[13px] font-medium text-ink">{FREQUENCY_LABEL[f].label}</span>
                <span className="block text-[12px] text-ink-muted">{FREQUENCY_LABEL[f].detail}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <label className={cx("mt-4 flex items-start gap-3", alertsApply ? "cursor-pointer" : "opacity-50")}>
          <input
            type="checkbox"
            checked={alerts}
            disabled={pending || !alertsApply}
            onChange={(e) => {
              setAlerts(e.target.checked);
              save({ digestFrequency: frequency, alertsEnabled: e.target.checked });
            }}
            className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
          />
          <span>
            <span className="block text-[13px] font-medium text-ink">
              Also email me right away about papers worth reading first
            </span>
            <span className="block text-[12px] text-ink-muted">
              For weekly and monthly briefings. These are papers directly relevant to a topic and judged
              significant for the field. Daily briefings already lead with them.
            </span>
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
          Permanently deletes your account, topics, developments, briefings, saved items and
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
