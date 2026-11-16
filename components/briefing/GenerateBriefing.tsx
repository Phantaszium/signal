"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, cx } from "@/components/ui/primitives";
import { useSignal } from "@/lib/store/SignalProvider";

interface Progress {
  status: "evaluating" | "ready" | "failed";
  error: string | null;
  funnel: { scanned?: number; candidates?: number };
  evaluated: number;
}

type Phase =
  | { kind: "idle"; note?: string }
  | { kind: "running"; briefingId: string; progress: Progress | null };

const POLL_MS = 3000;

function steps(progress: Progress | null) {
  const scanned = progress?.funnel.scanned ?? 0;
  const candidates = progress?.funnel.candidates ?? 0;
  const gathered = scanned > 0;
  return [
    {
      label: gathered
        ? `${scanned.toLocaleString()} records read from PubMed, bioRxiv, medRxiv and ClinicalTrials.gov`
        : "Reading PubMed, bioRxiv, medRxiv and ClinicalTrials.gov…",
      state: gathered ? "done" : "active",
    },
    {
      label: gathered
        ? `${candidates} matched your profile closely enough to assess`
        : "Filtering against your research profile…",
      state: gathered ? "done" : "pending",
    },
    {
      label:
        gathered && candidates > 0
          ? `Assessing each one for you… ${progress?.evaluated ?? 0} of ${candidates}`
          : "Assessing relevance, evidence and novelty…",
      state: gathered ? "active" : "pending",
    },
  ] as const;
}

export function GenerateBriefing() {
  const { running, briefingMeta, lastFailure } = useSignal();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>(
    running?.mode === "on_demand"
      ? { kind: "running", briefingId: running.id, progress: null }
      : { kind: "idle", note: lastFailure ?? undefined },
  );
  const busy = useRef(false);

  // Follow new server snapshots: a run started in another tab, or a failure
  // recorded after a refresh.
  const snapshotKey = `${running?.id ?? ""}|${lastFailure ?? ""}`;
  const [seenKey, setSeenKey] = useState(snapshotKey);
  if (seenKey !== snapshotKey) {
    setSeenKey(snapshotKey);
    if (running?.mode === "on_demand") {
      setPhase({ kind: "running", briefingId: running.id, progress: null });
    } else if (phase.kind === "idle" && lastFailure) {
      setPhase({ kind: "idle", note: lastFailure });
    }
  }

  const runningId = phase.kind === "running" ? phase.briefingId : null;

  // Poll the run until it finishes, then reload the server snapshot.
  useEffect(() => {
    if (!runningId) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/briefings/${runningId}`, { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const progress = (await res.json()) as Progress;
        if (cancelled) return;
        if (progress.status === "evaluating") {
          setPhase({ kind: "running", briefingId: runningId, progress });
          timer = setTimeout(tick, POLL_MS);
          return;
        }
        setPhase({
          kind: "idle",
          note: progress.status === "failed" ? (progress.error ?? "The briefing failed.") : undefined,
        });
        router.refresh();
      } catch {
        if (!cancelled) timer = setTimeout(tick, POLL_MS * 2);
      }
    };
    let timer = setTimeout(tick, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [runningId, router]);

  const start = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const res = await fetch("/api/briefings", { method: "POST" });
      const body = await res.json();
      if (res.status === 202) {
        setPhase({ kind: "running", briefingId: body.briefingId, progress: null });
      } else if (body.reason === "running") {
        setPhase({ kind: "running", briefingId: body.briefingId, progress: null });
      } else if (body.reason === "cooldown") {
        const at = new Date(body.retryAt).toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        });
        setPhase({ kind: "idle", note: `You can refresh again at ${at}.` });
      } else {
        setPhase({ kind: "idle", note: "Could not start a briefing." });
      }
    } catch {
      setPhase({ kind: "idle", note: "Could not reach Signal. Check your connection." });
    } finally {
      busy.current = false;
    }
  }, []);

  if (phase.kind === "running") {
    return (
      <div className="rounded-md border border-line bg-surface px-4 py-3">
        <ol className="space-y-2">
          {steps(phase.progress).map((s) => (
            <li
              key={s.label.slice(0, 12)}
              className={cx(
                "flex items-center gap-2.5 text-[13px] transition-opacity duration-300",
                s.state === "pending" ? "opacity-30" : "opacity-100",
              )}
            >
              <span
                className={cx(
                  "inline-block h-1.5 w-1.5 shrink-0 rounded-full",
                  s.state === "done"
                    ? "bg-accent"
                    : s.state === "active"
                      ? "animate-pulse bg-high"
                      : "bg-line-strong",
                )}
              />
              <span className={cx("tabular", s.state === "done" ? "font-medium text-ink" : "text-ink-muted")}>
                {s.label}
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-2.5 text-[11px] text-ink-faint">
          This usually takes one to three minutes. You can leave this page; the briefing keeps building.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <Button variant={briefingMeta ? "secondary" : "primary"} onClick={start}>
        {briefingMeta ? "Refresh now" : "Build my first briefing"}
      </Button>
      <span className="text-[11px] text-ink-faint">
        {phase.note ?? "A new briefing is prepared every morning and emailed to you."}
      </span>
    </div>
  );
}
