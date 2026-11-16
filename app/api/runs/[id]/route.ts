import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth/session";
import { countDoneEvaluations } from "@/lib/db/evaluations";
import { getRun } from "@/lib/db/runs";
import { failIfStale } from "@/lib/monitoring/run";

/** Progress of one run, for the "Check now" progress view. */
export async function GET(_request: Request, ctx: RouteContext<"/api/runs/[id]">) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = z.string().uuid().safeParse((await ctx.params).id);
  if (!id.success) return NextResponse.json({ error: "not found" }, { status: 404 });

  let run = await getRun(id.data);
  if (!run || run.userId !== user.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  // A run whose function died would otherwise read "running" until cron.
  if (await failIfStale(run)) run = (await getRun(id.data))!;

  const topics = run.diagnostics.topics;
  return NextResponse.json({
    status: run.status,
    error: run.error,
    topics: topics.length,
    fetched: topics.reduce((n, t) => n + t.fetched, 0),
    matched: topics.reduce((n, t) => n + t.matched, 0),
    queued: topics.reduce((n, t) => n + t.queued, 0),
    assessed: await countDoneEvaluations(run.id),
  });
}
