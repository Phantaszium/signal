import { RunHistory } from "@/components/monitoring/RunHistory";
import { requireReadyAccount } from "@/lib/auth/session";
import { recentRuns } from "@/lib/db/runs";

export const metadata = { title: "Run history · Signal" };

export default async function MonitoringPage() {
  const account = await requireReadyAccount();
  return <RunHistory runs={await recentRuns(account.id, { limit: 20 })} />;
}
