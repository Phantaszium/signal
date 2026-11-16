import { NextResponse } from "next/server";
import { isCronRequest } from "@/lib/auth/cron";
import { finalizeRuns } from "@/lib/monitoring/run";

export const maxDuration = 300;

/** Collect finished AI batches, close their runs, send alerts and due digests. */
export async function GET(request: Request) {
  if (!isCronRequest(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const report = await finalizeRuns();
  return NextResponse.json(report);
}
