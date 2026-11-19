"use client";

import Link from "next/link";
import { CheckNow } from "@/components/monitoring/CheckNow";
import { cx, timeAgo } from "@/components/ui/primitives";
import type { TopicState } from "@/lib/monitoring/diagnosis";
import { topicStatus } from "@/lib/monitoring/status";
import { useSignal } from "@/lib/store/SignalProvider";

const DOT: Record<TopicState | "never", string> = {
  developments: "bg-high",
  quiet: "bg-positive",
  pending: "animate-pulse bg-accent",
  incomplete: "bg-high-line ring-2 ring-high/30",
  failed: "bg-negative",
  never: "bg-line-strong",
};

/**
 * Per-topic monitoring status. Each line comes from the newest run that
 * checked the topic; a failed or partial check is shown as such, never as
 * "nothing new".
 */
export function MonitoringStatus() {
  const { topics, runs, now } = useSignal();
  const active = topics.filter((t) => t.active);
  const paused = topics.length - active.length;
  const statuses = active.map((topic) => ({ topic, status: topicStatus(topic.id, runs) }));

  const allQuiet =
    statuses.length > 0 && statuses.every(({ status }) => status.diagnosis?.state === "quiet");
  const scheduledPending = runs[0]?.mode === "scheduled" && runs[0].status === "evaluating";

  return (
    <section className="rounded-2xl border border-line bg-surface">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3">
        <h2 className="eyebrow text-[11px] font-semibold text-ink-muted">Update status</h2>
        <Link href="/monitoring" className="text-[11px] font-medium text-accent hover:underline">
          Search history
        </Link>
      </header>

      <div className="px-5 py-4">
        {allQuiet && (
          <p className="mb-3 rounded-xl border border-positive/20 bg-[#eef6f1] px-3 py-2 text-[12px] leading-relaxed text-positive">
            Nothing new cleared the bar for your topics in the latest search. Quiet weeks are normal:
            PaperPuffin won&rsquo;t pad your feed with weak matches.
          </p>
        )}
        {scheduledPending && (
          <p className="mb-3 text-[12px] leading-relaxed text-ink-muted">
            This morning&rsquo;s scheduled search is reading new papers now; results appear here when it
            finishes.
          </p>
        )}

        <ul className="divide-y divide-line">
          {statuses.map(({ topic, status }) => {
            const d = status.diagnosis;
            const state = d?.state ?? "never";
            const checkedAt = status.run?.completedAt ?? status.run?.createdAt;
            return (
              <li key={topic.id} className="py-2.5 first:pt-0 last:pb-0">
                <div className="flex items-start gap-2.5">
                  <span aria-hidden className={cx("mt-[6px] h-2 w-2 shrink-0 rounded-full", DOT[state])} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <Link
                        href={`/topics/${topic.id}`}
                        className="text-[13px] font-medium text-ink hover:text-accent"
                      >
                        {topic.profile.program}
                      </Link>
                      <span className="text-[11px] text-ink-faint">
                        {topic.lastCheckedAt
                          ? `Searched ${timeAgo(topic.lastCheckedAt, now)}`
                          : "Not searched yet"}
                      </span>
                    </div>
                    <p
                      className={cx(
                        "mt-0.5 text-[12px]",
                        state === "failed" || state === "incomplete" ? "text-negative" : "text-ink-muted",
                      )}
                    >
                      {d ? d.headline : "Waiting for its first search"}
                      {checkedAt && d && state !== "pending" ? (
                        <span className="text-ink-faint"> · {timeAgo(checkedAt, now)}</span>
                      ) : null}
                    </p>
                    {d?.detail && state !== "developments" && (
                      <p className="mt-0.5 text-[11px] leading-relaxed text-ink-faint">{d.detail}</p>
                    )}
                    {d && d.partialSources.length > 0 && state !== "pending" && (
                      <p className="mt-0.5 text-[11px] leading-relaxed text-ink-faint">
                        Not every matching record could be read from {d.partialSources.join(", ")}.
                      </p>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        {paused > 0 && (
          <p className="mt-3 text-[11px] text-ink-faint">
            {paused} paused topic{paused === 1 ? "" : "s"} not searched.{" "}
            <Link href="/research" className="text-accent hover:underline">
              Manage topics
            </Link>
          </p>
        )}

        <div className="mt-3 border-t border-line pt-3">
          <CheckNow />
          <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">
            PaperPuffin searches for new papers on every topic each morning. Find new papers runs the same search
            right now.
          </p>
        </div>
      </div>
    </section>
  );
}
