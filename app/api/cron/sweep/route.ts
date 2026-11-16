import { NextResponse } from "next/server";
import { isCronRequest } from "@/lib/auth/cron";
import { runScheduledSweep } from "@/lib/monitoring/run";

export const maxDuration = 300;

/** Scheduled monitoring: check every account's topics and submit one AI batch per account. */
export async function GET(request: Request) {
  if (!isCronRequest(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const report = await runScheduledSweep();
  return NextResponse.json(report);
}
