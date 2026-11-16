import { after, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { getAccount } from "@/lib/db/accounts";
import { runManual, startManual } from "@/lib/monitoring/run";

/** The run continues after the response; this bounds it on Vercel. */
export const maxDuration = 300;

/** Start a manual check ("Check now"). The client polls GET /api/runs/:id. */
export async function POST() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const account = await getAccount(user.id);
  if (!account?.approved) return NextResponse.json({ error: "account not ready" }, { status: 403 });

  const result = await startManual(account);
  if (!result.ok) return NextResponse.json(result, { status: result.reason === "no_topics" ? 400 : 429 });

  after(() => runManual(account, result.runId));
  return NextResponse.json(result, { status: 202 });
}
