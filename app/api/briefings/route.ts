import { after, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { getAccount } from "@/lib/db/accounts";
import { latestBriefing } from "@/lib/db/briefings";
import { runOnDemand, startOnDemand } from "@/lib/briefing/run";

/** The run continues after the response; this bounds it on Vercel. */
export const maxDuration = 300;

/** Start an on-demand briefing. The client polls GET /api/briefings/:id. */
export async function POST() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const account = await getAccount(user.id);
  if (!account?.approved || !account.researchProfile) {
    return NextResponse.json({ error: "account not ready" }, { status: 403 });
  }

  const latest = await latestBriefing(account.id);
  const running =
    latest && latest.status === "evaluating" && latest.mode === "on_demand" ? latest : null;
  const result = await startOnDemand(account, running);
  if (!result.ok) return NextResponse.json(result, { status: 429 });

  after(() => runOnDemand(account, result.briefingId));
  return NextResponse.json(result, { status: 202 });
}
