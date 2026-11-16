import { ActivityFeed } from "@/components/activity/ActivityFeed";
import { requireReadyAccount } from "@/lib/auth/session";
import { recentItems } from "@/lib/db/evaluations";

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000);

export const metadata = { title: "Activity · Signal" };

export default async function ActivityPage() {
  const account = await requireReadyAccount();
  // Assessed but below every topic's threshold: loaded only for this page's
  // "ruled out" view, since the app shell does not carry them.
  const ruledOut = await recentItems(account.id, {
    since: daysAgo(90),
    maxRelevance: 40,
    limit: 150,
  });
  return (
    <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
      <header className="max-w-4xl">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-ink">Activity</h1>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
          Every development Signal has detected, newest first, grouped by the day it was found.
        </p>
      </header>
      <div className="mt-6 max-w-4xl">
        <ActivityFeed ruledOut={ruledOut} />
      </div>
    </div>
  );
}
