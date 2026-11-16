import { NextResponse } from "next/server";
import { isCronRequest } from "@/lib/auth/cron";
import { runNightlySweep } from "@/lib/briefing/run";

export const maxDuration = 300;

/** Nightly: ingest every source, prefilter per user, submit one AI batch. */
export async function GET(request: Request) {
  if (!isCronRequest(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const report = await runNightlySweep();
  return NextResponse.json(report);
}
