import { AdminPanel } from "@/components/admin/AdminPanel";
import { requireAdmin } from "@/lib/auth/session";
import { listAllAccounts, listInvites } from "@/lib/db/accounts";

export const metadata = { title: "Pilot access · Signal" };

export default async function AdminPage() {
  await requireAdmin();
  const [accounts, invites] = await Promise.all([listAllAccounts(), listInvites()]);
  return (
    <div className="px-6 py-7 lg:px-10 lg:py-9">
      <header className="max-w-3xl">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-ink">Pilot access</h1>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
          Invited emails are approved automatically when they sign up. Only approved
          accounts get briefings, so only they cost anything to run.
        </p>
      </header>
      <div className="mt-6 max-w-4xl">
        <AdminPanel
          accounts={accounts.map((a) => ({
            id: a.id,
            email: a.email,
            approved: a.approved,
            isAdmin: a.isAdmin,
            hasProfile: Boolean(a.researchProfile),
            program: a.researchProfile?.program ?? null,
            createdAt: a.createdAt,
          }))}
          invites={invites}
        />
      </div>
    </div>
  );
}
