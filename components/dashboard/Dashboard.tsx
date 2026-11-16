"use client";

import Link from "next/link";
import { DevelopmentCard } from "@/components/developments/DevelopmentCard";
import { MonitoringStatus } from "@/components/monitoring/MonitoringStatus";
import { Chip, RelevanceBadge, SignificanceBadge, cx, timeAgo } from "@/components/ui/primitives";
import { byPriority } from "@/lib/developments";
import { topicStatus } from "@/lib/monitoring/status";
import { useSignal } from "@/lib/store/SignalProvider";

const DAY = 86_400_000;
/** Developments detected within this window are "new" on the dashboard. */
const NEW_DAYS = 7;
/** The Important developments section draws on this window. */
const IMPORTANT_DAYS = 30;
const IMPORTANT_MAX = 5;

const EMPTY = {
  never: {
    title: "No checks have finished yet",
    body: "Your topics are checked every morning. Use Check now to run the first check immediately; a new topic's first check reads the last 30 days.",
  },
  pending: {
    title: "A check is still in progress",
    body: "Nothing qualifying so far in the last 30 days. Results appear here as soon as the current check finishes.",
  },
  problem: {
    title: "Nothing found in what Signal could check",
    body: "Some topics could not be fully checked, so this is not the same as nothing happening. Monitoring status shows which topics and why.",
  },
  quiet: {
    title: "Nothing significant in the last 30 days",
    body: "Signal checked your topics and found nothing that clears their relevance thresholds. It reports quiet periods as quiet rather than filling them with weak matches. Monitoring status shows exactly what each check found.",
  },
} as const;

function Stat({
  value,
  label,
  tone = "neutral",
  href,
}: {
  value: string;
  label: string;
  tone?: "neutral" | "high";
  href?: string;
}) {
  const body = (
    <>
      <div
        className={cx(
          "tabular text-[24px] leading-none font-semibold tracking-tight",
          tone === "high" ? "text-high" : "text-ink",
        )}
      >
        {value}
      </div>
      <div className={cx("mt-1.5 text-[11px] leading-tight", tone === "high" ? "text-high" : "text-ink-faint")}>
        {label}
      </div>
    </>
  );
  const className = cx(
    "block rounded-md border px-4 py-3",
    tone === "high" ? "border-high-line bg-high-soft" : "border-line bg-surface",
    href && "transition-colors hover:border-line-strong",
  );
  return href ? (
    <Link href={href} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

/**
 * The Research Intelligence Dashboard: what changed, why it matters, what to
 * do next — and, when nothing changed, a clear statement that monitoring ran
 * and found nothing that qualified.
 */
export function Dashboard() {
  const { developments, activeTopics, runs, now } = useSignal();

  const recent = developments.filter((d) => now - Date.parse(d.evaluatedAt) < NEW_DAYS * DAY);
  const highRecent = recent.filter((d) => d.highPriority);
  // The least recent topic decides: one healthy topic must not hide another
  // that has not been checked.
  const checkedTimes = activeTopics.map((t) => t.lastCheckedAt);
  const fullyChecked = checkedTimes.filter((t): t is string => Boolean(t));
  const oldestCheck = fullyChecked.length === checkedTimes.length ? fullyChecked.sort()[0] : undefined;

  const states = activeTopics.map((t) => topicStatus(t.id, runs).diagnosis?.state ?? null);
  const emptyState =
    states.length === 0 || states.every((s) => s === null)
      ? "never"
      : states.some((s) => s === "failed" || s === "incomplete")
        ? "problem"
        : states.some((s) => s === "pending" || s === null)
          ? "pending"
          : "quiet";

  const important = developments
    .filter((d) => now - Date.parse(d.evaluatedAt) < IMPORTANT_DAYS * DAY)
    .sort(byPriority)
    .slice(0, IMPORTANT_MAX);
  const activity = developments.slice(0, 6);

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
      <header className="max-w-6xl">
        <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-ink sm:text-[26px]">
          Research intelligence
        </h1>
        <p className="mt-1 text-[13px] text-ink-muted">
          What changed in your field, why it matters to you, and what to do next.
        </p>
      </header>

      {/* A. Research overview */}
      <section aria-label="Research overview" className="mt-6 max-w-6xl">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat value={String(recent.length)} label={`New developments, last ${NEW_DAYS} days`} href="/activity" />
          <Stat
            value={String(highRecent.length)}
            label={`High priority, last ${NEW_DAYS} days`}
            tone={highRecent.length ? "high" : "neutral"}
          />
          <Stat value={String(activeTopics.length)} label="Topics monitored" href="/topics" />
          <Stat
            value={
              oldestCheck
                ? timeAgo(oldestCheck, now)
                : `${fullyChecked.length} of ${checkedTimes.length}`
            }
            label={oldestCheck ? "Every topic fully checked" : "Topics fully checked"}
            href="/monitoring"
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[11px] text-ink-faint">Monitoring:</span>
          {activeTopics.map((t) => (
            <Link key={t.id} href={`/topics/${t.id}`}>
              <Chip tone="accent">{t.profile.program}</Chip>
            </Link>
          ))}
          <Link href="/topics/new" className="ml-1 text-[11px] font-medium text-accent hover:underline">
            + Add topic
          </Link>
        </div>
      </section>

      <div className="mt-8 grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* B. Important developments */}
        <section aria-labelledby="important" className="min-w-0">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-2">
            <h2 id="important" className="eyebrow text-xs font-semibold text-ink-muted">
              Important developments
            </h2>
            <span className="text-[11px] text-ink-faint">
              Last {IMPORTANT_DAYS} days · high priority first
            </span>
          </div>
          <div className="mt-3 space-y-3">
            {important.length ? (
              important.map((d, i) => <DevelopmentCard key={d.publication.id} item={d} defaultOpen={i === 0 && d.highPriority} />)
            ) : (
              <div className="rounded-md border border-dashed border-line px-5 py-8 text-center">
                <p className="text-[14px] font-medium text-ink">{EMPTY[emptyState].title}</p>
                <p className="mx-auto mt-1 max-w-md text-[13px] leading-relaxed text-ink-muted">
                  {EMPTY[emptyState].body}
                </p>
              </div>
            )}
          </div>

          {/* D. Recent activity */}
          <div className="mt-10 flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-2">
            <h2 className="eyebrow text-xs font-semibold text-ink-muted">Recent activity</h2>
            <Link href="/activity" className="text-[11px] font-medium text-accent hover:underline">
              All activity &amp; filters →
            </Link>
          </div>
          {activity.length ? (
            <ul className="divide-y divide-line">
              {activity.map((d) => (
                <li key={d.publication.id} className="py-2.5">
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-ink-faint">
                    <span>Detected {timeAgo(d.evaluatedAt, now)}</span>
                    <span aria-hidden>·</span>
                    <span>{d.topicName ?? "Removed topic"}</span>
                    <RelevanceBadge cls={d.relevance} score={d.scores.researchRelevance} />
                    <SignificanceBadge level={d.significance.level} inferred={d.significance.inferred} />
                  </div>
                  <Link
                    href={`/paper/${encodeURIComponent(d.publication.id)}`}
                    className="mt-1 block text-[13px] font-medium text-ink hover:text-accent"
                  >
                    {d.publication.title}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-3 text-[12px] text-ink-muted">No developments detected yet.</p>
          )}
        </section>

        {/* C. Monitoring status */}
        <aside className="min-w-0 space-y-4 lg:sticky lg:top-6 lg:self-start">
          <MonitoringStatus />
        </aside>
      </div>
    </div>
  );
}
