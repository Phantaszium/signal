"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, cx } from "@/components/ui/primitives";
import { useSignal } from "@/lib/store/SignalProvider";

interface Progress {
  status: "running" | "evaluating" | "complete" | "failed";
  error: string | null;
  topics: number;
  fetched: number;
  matched: number;
  queued: number;
  assessed: number;
}

type Phase =
  | { kind: "idle"; note?: string }
  | { kind: "running"; runId: string; progress: Progress | null };

const POLL_MS = 3000;

function steps(p: Progress | null) {
  const gathered = Boolean(p && p.status !== "running");
  return [
    {
      label: gathered
        ? `Searched ${p!.topics} topic${p!.topics === 1 ? "" : "s"}: ${p!.fetched.toLocaleString("en-US")} records retrieved, ${p!.matched} matched`
        : "Searching PubMed, ClinicalTrials.gov and preprint servers…",
      state: gathered ? "done" : "active",
    },
    {
      label: gathered
        ? p!.queued
          ? `Assessing new records… ${p!.assessed} of ${p!.queued}`
          : "Nothing new to assess"
        : "Assessing relevance and significance…",
      state: gathered ? (p!.queued ? "active" : "done") : "pending",
    },
  ] as const;
}

/**
 * "Check now": runs monitoring for every active topic immediately, instead
 * of waiting for the scheduled check, and shows real progress.
 */
export function CheckNow({ compact = false }: { compact?: boolean }) {
  const { running } = useSignal();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>(
    running?.mode === "manual" ? { kind: "running", runId: running.id, progress: null } : { kind: "idle" },
  );
  const busy = useRef(false);

  // Follow new server snapshots: a check started in another tab.
  const [seen, setSeen] = useState(running?.id ?? "");
  if ((running?.id ?? "") !== seen) {
    setSeen(running?.id ?? "");
    if (running?.mode === "manual") setPhase({ kind: "running", runId: running.id, progress: null });
  }

  const runId = phase.kind === "running" ? phase.runId : null;

  useEffect(() => {
    if (!runId) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/runs/${runId}`, { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const progress = (await res.json()) as Progress;
        if (cancelled) return;
        if (progress.status === "running" || progress.status === "evaluating") {
          setPhase({ kind: "running", runId, progress });
          timer = setTimeout(tick, POLL_MS);
          return;
        }
        setPhase({
          kind: "idle",
          note: progress.status === "failed" ? (progress.error ?? "The check failed.") : "Check complete.",
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
  }, [runId, router]);

  const start = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const res = await fetch("/api/runs", { method: "POST" });
      const body = await res.json();
      if (res.status === 202 || body.reason === "running") {
        setPhase({ kind: "running", runId: body.runId, progress: null });
      } else if (body.reason === "cooldown") {
        const at = new Date(body.retryAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
        setPhase({ kind: "idle", note: `You can check again at ${at}.` });
      } else if (body.reason === "no_topics") {
        setPhase({ kind: "idle", note: "Turn on at least one topic to check." });
      } else {
        setPhase({ kind: "idle", note: "Could not start a check." });
      }
    } catch {
      setPhase({ kind: "idle", note: "Could not reach Signal. Check your connection." });
    } finally {
      busy.current = false;
    }
  }, []);

  if (phase.kind === "running") {
    return (
      <div className="rounded-md border border-line bg-canvas px-3 py-2.5">
        <ol className="space-y-1.5">
          {steps(phase.progress).map((s) => (
            <li
              key={s.label.slice(0, 10)}
              className={cx(
                "flex items-center gap-2.5 text-[12px] transition-opacity duration-300",
                s.state === "pending" ? "opacity-40" : "opacity-100",
              )}
            >
              <span
                className={cx(
                  "inline-block h-1.5 w-1.5 shrink-0 rounded-full",
                  s.state === "done" ? "bg-accent" : s.state === "active" ? "animate-pulse bg-high" : "bg-line-strong",
                )}
              />
              <span className={cx("tabular", s.state === "done" ? "text-ink" : "text-ink-muted")}>{s.label}</span>
            </li>
          ))}
        </ol>
        <p className="mt-2 text-[11px] text-ink-faint">
          Usually one to three minutes; a new topic&rsquo;s first check reads the last 30 days and takes
          longer. You can leave this page.
        </p>
      </div>
    );
  }

  return (
    <div className={cx("flex flex-wrap items-center gap-x-3 gap-y-1.5", compact && "justify-end")}>
      <Button size={compact ? "sm" : "md"} onClick={start}>
        Check now
      </Button>
      {phase.note && <span className="text-[11px] text-ink-muted">{phase.note}</span>}
    </div>
  );
}
