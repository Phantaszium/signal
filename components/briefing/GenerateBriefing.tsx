"use client";

import { useCallback, useRef, useState } from "react";
import { Button, cx } from "@/components/ui/primitives";
import { useSignal } from "@/lib/store/SignalProvider";
import type { Publication } from "@/lib/types";

type Phase = "idle" | "running" | "done";

interface Counts {
  ingested: number;
  relevant: number;
  important: number;
}

const STEPS: { running: string; result: (c: Counts) => string }[] = [
  {
    running: "Searching literature…",
    result: (c) => `${c.ingested.toLocaleString()} items found`,
  },
  { running: "Evaluating relevance…", result: (c) => `${c.relevant} likely relevant` },
  {
    running: "Ranking significance…",
    result: (c) => `${c.important} important findings identified`,
  },
];

const STEP_MS = 700;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function GenerateBriefing() {
  const { profile, briefing, ingestLive, lastGeneratedAt } = useSignal();
  const [phase, setPhase] = useState<Phase>("idle");
  const [step, setStep] = useState(0);
  const [live, setLive] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const busy = useRef(false);

  const run = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setPhase("running");
    setStep(0);
    setNote(null);

    // Ingest first, then animate — so every number the sequence reveals is the
    // number the briefing actually ends up showing.
    let result: { items: Publication[]; scanVolume: number; note: string } | null = null;
    try {
      const res = await fetch("/api/briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, live }),
      });
      if (res.ok) result = await res.json();
    } catch {
      // Falls through to the seeded corpus below.
    }

    if (result) {
      ingestLive(result.items, result.note, result.scanVolume);
      setNote(result.note);
    } else {
      setNote("Live lookup unavailable — ranked the demo corpus instead.");
    }

    for (let i = 1; i <= STEPS.length; i += 1) {
      await wait(STEP_MS);
      setStep(i);
    }
    await wait(300);
    setPhase("done");
    busy.current = false;
  }, [profile, live, ingestLive]);

  const counts: Counts = {
    ingested: briefing.funnel.ingested,
    relevant: briefing.funnel.likelyRelevant,
    important: briefing.funnel.important,
  };

  if (phase === "running") {
    return (
      <div className="rounded-md border border-line bg-surface px-4 py-3">
        <ol className="space-y-2">
          {STEPS.map((s, i) => {
            const state = i < step ? "done" : i === step ? "active" : "pending";
            return (
              <li
                key={s.running}
                className={cx(
                  "flex items-center gap-2.5 text-[13px] transition-opacity duration-300",
                  state === "pending" ? "opacity-30" : "opacity-100",
                )}
              >
                <span
                  className={cx(
                    "inline-block h-1.5 w-1.5 rounded-full",
                    state === "done"
                      ? "bg-accent"
                      : state === "active"
                        ? "animate-pulse bg-high"
                        : "bg-line-strong",
                  )}
                />
                {state === "done" ? (
                  <span className="tabular font-medium text-ink">{s.result(counts)}</span>
                ) : (
                  <span className="text-ink-muted">{s.running}</span>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <Button variant="primary" onClick={run}>
        {phase === "done" ? "Regenerate briefing" : "Generate Today's Briefing"}
      </Button>

      <label className="flex cursor-pointer items-center gap-1.5 text-[12px] text-ink-muted select-none">
        <input
          type="checkbox"
          checked={live}
          onChange={(e) => setLive(e.target.checked)}
          className="h-3.5 w-3.5 accent-[var(--accent)]"
        />
        Include live PubMed results
      </label>

      {note ? (
        <span className="text-[11px] text-ink-faint">{note}</span>
      ) : lastGeneratedAt ? (
        <span className="text-[11px] text-ink-faint">
          Last generated{" "}
          {new Date(lastGeneratedAt).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
          })}
        </span>
      ) : null}
    </div>
  );
}
