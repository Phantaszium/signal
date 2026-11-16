import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth/session";
import { failIfStale } from "@/lib/briefing/run";
import { countDoneEvaluations, getBriefing } from "@/lib/db/briefings";

/** Progress of one briefing, for the "Refresh now" progress view. */
export async function GET(_request: Request, ctx: RouteContext<"/api/briefings/[id]">) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = z.string().uuid().safeParse((await ctx.params).id);
  if (!id.success) return NextResponse.json({ error: "not found" }, { status: 404 });

  let briefing = await getBriefing(id.data);
  if (!briefing || briefing.userId !== user.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  // A run whose function died would otherwise read "evaluating" until cron.
  if (await failIfStale(briefing)) briefing = (await getBriefing(id.data))!;

  return NextResponse.json({
    status: briefing.status,
    error: briefing.error,
    funnel: briefing.funnel,
    evaluated: await countDoneEvaluations(briefing.id),
  });
}
