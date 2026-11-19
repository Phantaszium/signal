import { AdminPanel } from "@/components/admin/AdminPanel";
import { requireAdmin } from "@/lib/auth/session";
import { listAllAccounts, listInvites } from "@/lib/db/accounts";
import { topicsByUser } from "@/lib/db/topics";

export const metadata = { title: "Beta access" };

export default async function AdminPage() {
  await requireAdmin();
  const [accounts, invites, topics] = await Promise.all([listAllAccounts(), listInvites(), topicsByUser()]);
  return (
    <div className="px-6 py-7 lg:px-10 lg:py-9">
      <header className="max-w-3xl">
        <h1 className="font-display text-[28px] font-semibold text-ink">Beta access</h1>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
          Invited emails are approved automatically when they sign up. Only approved
          accounts are monitored, so only they cost anything to run.
        </p>
      </header>
      <div className="mt-6 max-w-4xl">
        <AdminPanel
          accounts={accounts.map((a) => ({
            id: a.id,
            email: a.email,
            approved: a.approved,
            isAdmin: a.isAdmin,
            topics: (topics.get(a.id) ?? []).map((t) => t.profile.program),
            createdAt: a.createdAt,
          }))}
          invites={invites}
        />
      </div>
    </div>
  );
}
