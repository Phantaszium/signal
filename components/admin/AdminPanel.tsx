"use client";

import { useTransition } from "react";
import { inviteAction, removeInviteAction, setApprovedAction } from "@/app/(app)/admin/actions";
import { ActionForm, Field } from "@/components/auth/AuthForm";
import { Button, Chip, Panel, formatDate } from "@/components/ui/primitives";

interface Row {
  id: string;
  email: string;
  approved: boolean;
  isAdmin: boolean;
  topics: string[];
  createdAt: string;
}

export function AdminPanel({
  accounts,
  invites,
}: {
  accounts: Row[];
  invites: { email: string; createdAt: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const signedUp = new Set(accounts.map((a) => a.email.toLowerCase()));
  const outstanding = invites.filter((i) => !signedUp.has(i.email));

  return (
    <div className="space-y-5">
      <Panel title="Invite a researcher">
        <ActionForm action={inviteAction} className="max-w-md">
          {() => (
            <>
              <Field label="Email" name="email" type="email" autoComplete="off" />
              <Button type="submit" variant="primary">
                Invite
              </Button>
            </>
          )}
        </ActionForm>
        <p className="mt-3 text-[11px] text-ink-faint">
          This does not send an email. Share the sign-up link with them yourself.
        </p>
      </Panel>

      <Panel title={`Accounts (${accounts.length})`}>
        <ul className="divide-y divide-line">
          {accounts.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-ink">
                  {a.email} {a.isAdmin && <Chip tone="accent">admin</Chip>}
                </p>
                <p className="text-[11px] text-ink-faint">
                  Joined {formatDate(a.createdAt)} ·{" "}
                  {a.topics.length ? a.topics.join(" · ") : "no topics yet"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {a.approved ? <Chip tone="accent">approved</Chip> : <Chip tone="warn">waitlist</Chip>}
                {!a.isAdmin && (
                  <Button
                    size="sm"
                    variant={a.approved ? "danger" : "primary"}
                    disabled={pending}
                    onClick={() => startTransition(() => setApprovedAction(a.id, !a.approved))}
                  >
                    {a.approved ? "Revoke" : "Approve"}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Panel>

      {outstanding.length > 0 && (
        <Panel title="Invited, not signed up yet">
          <ul className="divide-y divide-line">
            {outstanding.map((i) => (
              <li key={i.email} className="flex items-center justify-between gap-3 py-2">
                <span className="text-[13px] text-ink">{i.email}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => startTransition(() => removeInviteAction(i.email))}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
