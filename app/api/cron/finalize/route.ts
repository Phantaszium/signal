import { NextResponse } from "next/server";
import { isCronRequest } from "@/lib/auth/cron";
import { finalizeBriefings } from "@/lib/briefing/run";

export const maxDuration = 300;

/** Collect finished AI batches, publish briefings and send the emails. */
export async function GET(request: Request) {
  if (!isCronRequest(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const report = await finalizeBriefings();
  return NextResponse.json(report);
}
