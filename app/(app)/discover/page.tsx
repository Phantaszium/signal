import { Discover } from "@/components/discover/Discover";
import { requireReadyAccount } from "@/lib/auth/session";
import { recentItems } from "@/lib/db/evaluations";

export const metadata = { title: "Discover" };

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000);

export default async function DiscoverPage({ searchParams }: PageProps<"/discover">) {
  const account = await requireReadyAccount();
  const { tab } = await searchParams;
  // Papers read and judged not relevant enough: loaded only here, for the
  // "what PaperPuffin didn't recommend" view.
  const ruledOut = await recentItems(account.id, {
    since: daysAgo(90),
    maxRelevance: 40,
    limit: 150,
  });
  return <Discover initialTab={tab === "search" ? "search" : "for-you"} ruledOut={ruledOut} />;
}
