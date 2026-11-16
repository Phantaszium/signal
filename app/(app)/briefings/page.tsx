import { Briefings } from "@/components/briefings/Briefings";
import { requireReadyAccount } from "@/lib/auth/session";
import { listDigests } from "@/lib/db/digests";
import { itemsByIds } from "@/lib/db/evaluations";

export const metadata = { title: "Briefings · Signal" };

export default async function BriefingsPage() {
  const account = await requireReadyAccount();
  const digests = await listDigests(account.id, 20);
  const items = await itemsByIds(account.id, [...new Set(digests.flatMap((d) => d.publicationIds))]);
  return (
    <Briefings
      items={items}
      digests={digests.map((d) => ({
        id: d.id,
        frequency: d.frequency,
        periodStart: d.periodStart,
        periodEnd: d.periodEnd,
        publicationIds: d.publicationIds,
        developments: d.summary.developments,
        highPriority: d.summary.highPriority,
        topics: d.summary.topics,
        emailedAt: d.emailedAt,
      }))}
    />
  );
}
