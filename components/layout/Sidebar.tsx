"use client";

import Link from "next/link";
import { useSignal } from "@/lib/store/SignalProvider";
import { topicStatus } from "@/lib/monitoring/status";
import type { TopicState } from "@/lib/monitoring/diagnosis";
import { cx } from "@/components/ui/primitives";

interface NavItem {
  href: string;
  label: string;
}

const DOT: Record<TopicState | "never", string> = {
  developments: "bg-high",
  quiet: "bg-positive",
  pending: "animate-pulse bg-accent",
  incomplete: "bg-high-line",
  failed: "bg-negative",
  never: "bg-line-strong",
};

const WEEK = 7 * 86_400_000;

export function Sidebar({ nav, pathname }: { nav: NavItem[]; pathname: string }) {
  const { account, savedIds, developments, topics, runs, now } = useSignal();
  const newThisWeek = developments.filter((d) => now - Date.parse(d.evaluatedAt) < WEEK);
  const highThisWeek = newThisWeek.filter((d) => d.highPriority).length;

  const count = (href: string): { n: number; high?: boolean } | null => {
    if (href === "/" && highThisWeek) return { n: highThisWeek, high: true };
    if (href === "/activity" && newThisWeek.length) return { n: newThisWeek.length };
    if (href === "/saved" && savedIds.length) return { n: savedIds.length };
    return null;
  };

  return (
    <div className="flex min-h-full flex-col">
      <div className="border-b border-line px-5 py-5">
        <div className="flex items-baseline gap-2">
          <span className="text-[17px] font-semibold tracking-tight text-ink">Signal</span>
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
        </div>
        <p className="mt-1 text-[11px] leading-snug text-ink-faint">
          Know what changed, why it matters, and what to do next.
        </p>
        <p className="mt-2 truncate text-[11px] text-ink-muted" title={account.email}>
          {account.email}
        </p>
      </div>

      <nav className="border-b border-line px-3 py-3">
        {nav.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const c = count(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cx(
                "flex items-center justify-between rounded px-2 py-1.5 text-[13px] transition-colors",
                active ? "bg-accent-soft font-medium text-accent" : "text-ink-muted hover:bg-canvas hover:text-ink",
              )}
            >
              <span>{item.label}</span>
              {c && (
                <span
                  title={item.href === "/" ? "High-priority developments this week" : undefined}
                  className={cx("tabular text-[11px]", c.high ? "font-semibold text-high" : "text-ink-faint")}
                >
                  {c.n}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <section className="px-5 py-4">
        <div className="flex items-center justify-between">
          <h3 className="eyebrow text-[10px] font-semibold text-ink-muted">Monitored topics</h3>
          <Link href="/topics/new" className="text-[11px] font-medium text-accent hover:underline">
            + Add
          </Link>
        </div>
        <ul className="mt-3 space-y-2">
          {topics.map((t) => {
            const state = t.active ? (topicStatus(t.id, runs).diagnosis?.state ?? "never") : null;
            return (
              <li key={t.id}>
                <Link
                  href={`/topics/${t.id}`}
                  className={cx(
                    "flex items-start gap-2 text-[12px] leading-snug hover:text-accent",
                    t.active ? "text-ink" : "text-ink-faint",
                  )}
                >
                  <span
                    aria-hidden
                    className={cx("mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full", state ? DOT[state] : "bg-line")}
                  />
                  <span>
                    {t.profile.program}
                    {!t.active && <span className="text-ink-faint"> (paused)</span>}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-[10px] leading-snug text-ink-faint">
          Amber: new developments. Green: checked, nothing new. Red: a check failed. Grey: not checked yet.
        </p>
      </section>
    </div>
  );
}
