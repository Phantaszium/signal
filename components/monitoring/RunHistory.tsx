"use client";

import { LocalTime } from "@/components/ui/LocalTime";
import { cx } from "@/components/ui/primitives";
import { SOURCE_LABEL, diagnoseTopic } from "@/lib/monitoring/diagnosis";
import type { RunRecord, SourceCheck, TopicCheck } from "@/lib/monitoring/types";
import type { SourceKey } from "@/lib/types";

const STATUS_TONE: Record<SourceCheck["status"], string> = {
  ok: "text-positive",
  partial: "text-high",
  failed: "text-negative",
};

function Funnel({ check }: { check: TopicCheck }) {
  const steps: [string, number | undefined][] = [
    ["retrieved by search", check.fetched],
    ["matched the topic", check.matched],
    ["excluded", check.excluded],
    ["already assessed", check.alreadyAssessed],
    ["sent to AI", check.queued],
    ["over assessment limit", check.deferred],
    ["assessed", check.assessed],
    ["developments", check.developments],
  ];
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] sm:grid-cols-4">
      {steps
        .filter(([, n]) => n !== undefined)
        .map(([label, n]) => (
          <div key={label} className="flex items-baseline justify-between gap-2 border-b border-line/60 py-0.5">
            <dt className="text-ink-faint">{label}</dt>
            <dd className="tabular font-medium text-ink">{n}</dd>
          </div>
        ))}
    </dl>
  );
}

function TopicRow({ check, run }: { check: TopicCheck; run: RunRecord }) {
  const d = diagnoseTopic(check, run.status);
  return (
    <div className="border-t border-line py-3 first:border-t-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[13px] font-medium text-ink">{check.name}</span>
        <span className="text-[11px] text-ink-faint">
          {check.window.from} → {check.window.to}
          {check.backfill ? " · first 30-day look-back" : ""}
        </span>
      </div>
      <p className="mt-0.5 text-[12px] text-ink">{d.headline}</p>
      {d.detail && <p className="mt-0.5 text-[11px] leading-relaxed text-ink-muted">{d.detail}</p>}

      <table className="mt-2 w-full text-left text-[11px]">
        <thead className="text-ink-faint">
          <tr>
            <th className="py-1 font-medium">Source</th>
            <th className="py-1 font-medium">Status</th>
            <th className="tabular py-1 text-right font-medium">Reported</th>
            <th className="tabular py-1 text-right font-medium">Read</th>
            <th className="tabular py-1 text-right font-medium">Matched</th>
          </tr>
        </thead>
        <tbody>
          {(Object.entries(check.sources) as [SourceKey, SourceCheck][]).map(([key, s]) => (
            <tr key={key} className="border-t border-line/60 align-top">
              <td className="py-1 pr-2 text-ink">
                {SOURCE_LABEL[key]}
                {s.shared && <span className="text-ink-faint"> (daily feed)</span>}
                {s.note && <span className="block text-[10px] text-ink-faint">{s.note}</span>}
              </td>
              <td className={cx("py-1 pr-2 font-medium", STATUS_TONE[s.status])}>{s.status}</td>
              <td className="tabular py-1 text-right text-ink-muted">{s.scanned.toLocaleString("en-US")}</td>
              <td className="tabular py-1 text-right text-ink-muted">{s.fetched.toLocaleString("en-US")}</td>
              <td className="tabular py-1 text-right text-ink">{s.matched}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2">
        <Funnel check={check} />
      </div>
    </div>
  );
}

/**
 * Every recent run with what each source returned and where records stopped:
 * the evidence behind each line of Monitoring status.
 */
export function RunHistory({ runs }: { runs: RunRecord[] }) {
  return (
    <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
      <header className="max-w-4xl">
        <h1 className="font-display text-[28px] font-semibold text-ink">Search history</h1>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
          What each check searched, what every source returned, and where records were filtered out. Use it
          to tell a quiet field apart from a source that could not be reached or a topic whose terms are too
          narrow or too broad.
        </p>
      </header>

      <ul className="mt-6 max-w-4xl space-y-4">
        {runs.length === 0 && <li className="text-[13px] text-ink-muted">No checks have run yet.</li>}
        {runs.map((run) => (
          <li key={run.id} className="rounded-2xl border border-line bg-surface">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-2.5">
              <span className="text-[13px] font-medium text-ink">
                {run.mode === "scheduled" ? "Scheduled check" : "Manual check"} · <LocalTime iso={run.createdAt} />
              </span>
              <span
                className={cx(
                  "text-[11px] font-medium",
                  run.status === "failed" ? "text-negative" : run.status === "complete" ? "text-positive" : "text-accent",
                )}
              >
                {run.status === "evaluating" ? "assessing" : run.status}
                {run.diagnostics.durationMs ? ` · ${Math.round(run.diagnostics.durationMs / 1000)}s` : ""}
              </span>
            </div>
            <div className="px-4 py-1">
              {run.error && <p className="py-2 text-[12px] text-negative">{run.error}</p>}
              {run.diagnostics.topics.length ? (
                run.diagnostics.topics.map((c) => <TopicRow key={c.topicId} check={c} run={run} />)
              ) : (
                <p className="py-2.5 text-[12px] text-ink-faint">
                  {run.status === "running"
                    ? "Searching sources…"
                    : run.status === "failed"
                      ? "The check stopped before any topic was searched."
                      : "Run from before per-topic diagnostics were recorded."}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
