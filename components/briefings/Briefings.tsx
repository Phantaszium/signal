"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DevelopmentCard } from "@/components/developments/DevelopmentCard";
import { LocalTime } from "@/components/ui/LocalTime";
import { Panel, cx } from "@/components/ui/primitives";
import { byPriority, toDevelopment } from "@/lib/developments";
import { FREQUENCY_LABEL, PERIOD_MS } from "@/lib/digests/plan";
import { useSignal } from "@/lib/store/SignalProvider";
import type { EvaluatedItem } from "@/lib/types";

export interface DigestView {
  id: string;
  frequency: keyof typeof FREQUENCY_LABEL;
  periodStart: string;
  periodEnd: string;
  publicationIds: string[];
  developments: number;
  highPriority: number;
  topics: { topicId: string; name: string; state: string; headline: string }[];
  emailedAt: string | null;
}

const short = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/**
 * Briefings are summaries of developments Signal has already found, over a
 * period the user chooses. They are assembled from stored assessments, never
 * generated, and a period with nothing qualifying says so.
 */
export function Briefings({ digests, items }: { digests: DigestView[]; items: EvaluatedItem[] }) {
  const { account, developments, topicById, weights, now } = useSignal();
  const [open, setOpen] = useState<string | null>(digests[0]?.id ?? null);
  const frequency = FREQUENCY_LABEL[account.digestFrequency];

  const byId = useMemo(() => {
    const map = new Map(items.map((i) => [i.publication.id, i]));
    return (id: string) => {
      const item = map.get(id);
      return item ? toDevelopment(item, item.topicId ? topicById.get(item.topicId) : undefined, weights) : null;
    };
  }, [items, topicById, weights]);

  const since = digests[0]?.periodEnd ?? new Date(now - (PERIOD_MS[account.digestFrequency] ?? 86_400_000)).toISOString();
  const soFar = developments.filter((d) => d.evaluatedAt >= since).sort(byPriority);

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
      <header className="max-w-4xl">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-ink">Briefings</h1>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
          Periodic summaries of the developments Signal found. Every entry is a real record Signal retrieved
          and assessed; a period with nothing qualifying is reported as quiet.
        </p>
        <p className="mt-3 text-[12px] text-ink-muted">
          You receive: <strong className="font-medium text-ink">{frequency.label}</strong> — {frequency.detail}{" "}
          <Link href="/settings" className="font-medium text-accent hover:underline">
            Change
          </Link>
        </p>
      </header>

      <div className="mt-6 max-w-4xl space-y-5">
        <Panel title={`This period so far · since ${short(since)}`}>
          {soFar.length ? (
            <div className="space-y-3">
              {soFar.slice(0, 5).map((d) => (
                <DevelopmentCard key={d.publication.id} item={d} />
              ))}
              {soFar.length > 5 && (
                <Link href="/activity" className="block text-[12px] font-medium text-accent hover:underline">
                  {soFar.length - 5} more in Activity →
                </Link>
              )}
            </div>
          ) : (
            <p className="text-[13px] text-ink-muted">
              No qualifying developments since the last briefing. Monitoring status on the dashboard shows what
              each check found.
            </p>
          )}
        </Panel>

        <section>
          <h2 className="eyebrow border-b border-line pb-2 text-xs font-semibold text-ink-muted">Past briefings</h2>
          {digests.length === 0 ? (
            <p className="mt-3 text-[13px] text-ink-muted">
              {account.digestFrequency === "off" || account.digestFrequency === "important_only"
                ? "You have periodic briefings turned off."
                : "Your first briefing is built after the next scheduled check."}
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {digests.map((d) => {
                const expanded = open === d.id;
                const entries = d.publicationIds.map(byId).filter((x) => x !== null);
                return (
                  <li key={d.id} className="rounded-md border border-line bg-surface">
                    <button
                      type="button"
                      onClick={() => setOpen(expanded ? null : d.id)}
                      aria-expanded={expanded}
                      className="flex w-full flex-wrap items-baseline justify-between gap-2 px-4 py-3 text-left"
                    >
                      <span className="text-[14px] font-medium text-ink">
                        {FREQUENCY_LABEL[d.frequency].label} · {short(d.periodStart)} – {short(d.periodEnd)}
                      </span>
                      <span className={cx("text-[12px]", d.highPriority ? "text-high" : "text-ink-muted")}>
                        {d.developments
                          ? `${d.developments} development${d.developments === 1 ? "" : "s"}${d.highPriority ? `, ${d.highPriority} high priority` : ""}`
                          : d.topics.some((t) => t.state !== "quiet" && t.state !== "developments")
                            ? "Nothing found · some checks incomplete"
                            : "Nothing qualifying"}
                        {d.emailedAt ? " · emailed" : ""}
                      </span>
                    </button>
                    {expanded && (
                      <div className="space-y-3 border-t border-line px-4 py-3">
                        {d.topics.length > 0 && (
                          <ul className="space-y-1 text-[12px] text-ink-muted">
                            {d.topics.map((t) => (
                              <li key={t.topicId}>
                                <strong className="font-medium text-ink">{t.name}</strong> · {t.headline}
                              </li>
                            ))}
                          </ul>
                        )}
                        {entries.map((e) => (
                          <DevelopmentCard key={e.publication.id} item={e} />
                        ))}
                        {entries.length < d.publicationIds.length && (
                          <p className="text-[11px] text-ink-faint">
                            {d.publicationIds.length - entries.length} item(s) are no longer available (their
                            topic was deleted).
                          </p>
                        )}
                        <p className="text-[11px] text-ink-faint">Built <LocalTime iso={d.periodEnd} />.</p>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
