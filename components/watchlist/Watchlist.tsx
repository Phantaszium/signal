"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useSignal } from "@/lib/store/SignalProvider";
import { Chip, Panel, cx, formatDate } from "@/components/ui/primitives";
import type { ScoredPublication } from "@/lib/types";

interface WatchRow {
  term: string;
  matches: ScoredPublication[];
}

function buildRows(terms: string[], items: ScoredPublication[]): WatchRow[] {
  return terms
    .map((term) => {
      const needle = term.toLowerCase();
      const matches = items.filter((s) => {
        const hay = [
          s.publication.title,
          s.publication.summary,
          s.publication.abstract,
          ...s.publication.tags,
          ...s.publication.organizations,
        ]
          .join(" ")
          .toLowerCase();
        // "Mirati/BMS" should match either half.
        return needle.split("/").some((part) => hay.includes(part.trim()));
      });
      return { term, matches };
    })
    .sort((a, b) => b.matches.length - a.matches.length);
}

function WatchTable({ rows, emptyLabel }: { rows: WatchRow[]; emptyLabel: string }) {
  if (!rows.length) {
    return <p className="text-[12px] text-ink-faint">{emptyLabel}</p>;
  }
  return (
    <ul className="divide-y divide-line">
      {rows.map((row) => {
        const top = row.matches[0];
        return (
          <li key={row.term} className="py-2.5 first:pt-0 last:pb-0">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[13px] font-medium text-ink">{row.term}</span>
              <span
                className={cx(
                  "tabular shrink-0 text-[11px]",
                  row.matches.length ? "text-ink-muted" : "text-ink-faint",
                )}
              >
                {row.matches.length} item{row.matches.length === 1 ? "" : "s"}
              </span>
            </div>
            {top ? (
              <p className="mt-1 text-[12px] leading-snug text-ink-muted">
                Most recent:{" "}
                <Link
                  href={`/paper/${encodeURIComponent(top.publication.id)}`}
                  className="text-accent hover:underline"
                >
                  {top.publication.title}
                </Link>{" "}
                <span className="text-ink-faint">
                  · {formatDate(top.publication.publishedAt)}
                </span>
              </p>
            ) : (
              <p className="mt-1 text-[12px] text-ink-faint">
                No matching items in your latest briefing.
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function Watchlist() {
  const { profile, allItems } = useSignal();

  const sorted = useMemo(
    () =>
      [...allItems].sort(
        (a, b) =>
          new Date(b.publication.publishedAt).getTime() -
          new Date(a.publication.publishedAt).getTime(),
      ),
    [allItems],
  );

  const topics = buildRows([...profile.keywords, ...profile.genes.slice(0, 4)], sorted);
  const orgs = buildRows(profile.organizations, sorted);

  return (
    <div className="px-6 py-7 lg:px-10 lg:py-9">
      <header className="max-w-3xl">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-ink">
          Watchlist
        </h1>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
          Topics and organizations Signal monitors on your behalf, with how many
          items in your latest briefing and saved list touch each one. Edit these
          on your{" "}
          <Link href="/profile" className="text-accent hover:underline">
            research profile
          </Link>
          .
        </p>
      </header>

      <div className="mt-6 grid max-w-5xl gap-5 lg:grid-cols-2">
        <Panel title="Tracked organizations">
          <WatchTable rows={orgs} emptyLabel="No organizations tracked." />
          <div className="mt-3 flex flex-wrap gap-1 border-t border-line pt-3">
            {profile.organizations.map((o) => (
              <Chip key={o} tone="warn">
                {o}
              </Chip>
            ))}
          </div>
        </Panel>

        <Panel title="Tracked topics">
          <WatchTable rows={topics} emptyLabel="No topics tracked." />
        </Panel>
      </div>
    </div>
  );
}
