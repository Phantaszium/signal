"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/brand/Puffin";
import { PaperCard, PaperRow } from "@/components/papers/PaperCard";
import { LocalTime } from "@/components/ui/LocalTime";
import { PageHeader, cx } from "@/components/ui/primitives";
import { byPriority, toDevelopment, type Development } from "@/lib/developments";
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

const READ_FIRST = 3;

/** Reading priorities: the top few to read first, then the rest grouped by topic. */
function Prioritised({ items }: { items: Development[] }) {
  const sorted = [...items].sort(byPriority);
  const first = sorted.slice(0, READ_FIRST);
  const rest = sorted.slice(READ_FIRST);
  const byTopic = new Map<string, Development[]>();
  for (const d of rest) {
    const key = d.topicName ?? "Other";
    byTopic.set(key, [...(byTopic.get(key) ?? []), d]);
  }
  return (
    <div className="space-y-6">
      <div>
        <h3 className="flex items-center gap-2 text-[14px] font-semibold text-ink">
          <span className="h-2 w-2 rounded-full bg-beak" /> Read these first
        </h3>
        <div className="mt-2.5 space-y-3">
          {first.map((d) => (
            <PaperCard key={d.publication.id} item={d} priority />
          ))}
        </div>
      </div>
      {byTopic.size > 0 && (
        <div>
          <h3 className="text-[14px] font-semibold text-ink">Also worth a look</h3>
          {[...byTopic.entries()].map(([topic, list]) => (
            <div key={topic} className="mt-3 rounded-2xl border border-line bg-surface px-5 py-2">
              <p className="pt-2 text-[12px] font-semibold text-accent">{topic}</p>
              <ul className="divide-y divide-line">
                {list.map((d) => (
                  <PaperRow key={d.publication.id} item={d} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Briefings collect the papers PaperPuffin recommended over a period. They
 * are assembled from stored, sourced assessments — never free-written — and
 * a period with nothing relevant says so.
 */
export function Briefings({ digests, items }: { digests: DigestView[]; items: EvaluatedItem[] }) {
  const { account, developments, topicById, weights, now } = useSignal();
  const [open, setOpen] = useState<string | null>(null);
  const frequency = FREQUENCY_LABEL[account.digestFrequency];

  const byId = useMemo(() => {
    const map = new Map(items.map((i) => [i.publication.id, i]));
    return (id: string) => {
      const item = map.get(id);
      return item ? toDevelopment(item, item.topicId ? topicById.get(item.topicId) : undefined, weights) : null;
    };
  }, [items, topicById, weights]);

  const since =
    digests[0]?.periodEnd ?? new Date(now - (PERIOD_MS[account.digestFrequency] ?? 7 * 86_400_000)).toISOString();
  const soFar = developments.filter((d) => d.evaluatedAt >= since);
  const topicCount = new Set(soFar.map((d) => d.topicId)).size;

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
      <PageHeader
        title="Briefings"
        description={
          <>
            The most relevant new papers for your topics, with why they matter and what to read first. You get a{" "}
            <strong className="font-semibold text-ink">{frequency.label.toLowerCase()}</strong>.{" "}
            <Link href="/research" className="font-medium text-accent hover:underline">
              Change
            </Link>
          </>
        }
      />

      <div className="mt-7 max-w-4xl space-y-8">
        <section>
          <div className="rounded-3xl border border-line bg-gradient-to-br from-accent-soft to-sea-soft/60 px-6 py-5">
            <p className="eyebrow text-[10.5px] font-semibold text-accent">Your current briefing · since {short(since)}</p>
            <h2 className="mt-1 font-display text-[22px] font-semibold text-ink">
              {soFar.length
                ? `${soFar.length} new paper${soFar.length === 1 ? "" : "s"} across ${topicCount} topic${topicCount === 1 ? "" : "s"}`
                : "A quiet stretch so far"}
            </h2>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
              {soFar.length
                ? "Ordered by how directly each paper bears on your research and how significant it is."
                : "Nothing new has cleared the bar for your topics since the last briefing. PaperPuffin will keep looking every morning."}
            </p>
          </div>
          {soFar.length > 0 && (
            <div className="mt-5">
              <Prioritised items={soFar} />
            </div>
          )}
        </section>

        <section>
          <h2 className="font-display text-[20px] font-semibold text-ink">Past briefings</h2>
          {digests.length === 0 ? (
            <div className="mt-3">
              <EmptyState
                mood="sleepy"
                title={
                  account.digestFrequency === "off" || account.digestFrequency === "important_only"
                    ? "Regular briefings are off"
                    : "Your first briefing is on its way"
                }
                body={
                  account.digestFrequency === "off" || account.digestFrequency === "important_only"
                    ? "Turn on a weekly or daily briefing in My Research to get a regular summary."
                    : "It's put together after the next scheduled search."
                }
              />
            </div>
          ) : (
            <ul className="mt-3 space-y-2">
              {digests.map((d) => {
                const expanded = open === d.id;
                const entries = d.publicationIds.map(byId).filter((x) => x !== null);
                return (
                  <li key={d.id} className="rounded-2xl border border-line bg-surface">
                    <button
                      type="button"
                      onClick={() => setOpen(expanded ? null : d.id)}
                      aria-expanded={expanded}
                      className="flex w-full flex-wrap items-baseline justify-between gap-2 px-5 py-3.5 text-left"
                    >
                      <span className="text-[14px] font-semibold text-ink">
                        {FREQUENCY_LABEL[d.frequency].label} · {short(d.periodStart)} – {short(d.periodEnd)}
                      </span>
                      <span className={cx("text-[12.5px]", d.highPriority ? "text-high" : "text-ink-muted")}>
                        {d.developments
                          ? `${d.developments} paper${d.developments === 1 ? "" : "s"}${d.highPriority ? `, ${d.highPriority} to read first` : ""}`
                          : d.topics.some((t) => t.state !== "quiet" && t.state !== "developments")
                            ? "Nothing found · some searches incomplete"
                            : "Quiet period"}
                        {d.emailedAt ? " · emailed" : ""}
                      </span>
                    </button>
                    {expanded && (
                      <div className="space-y-4 border-t border-line px-5 py-4">
                        {d.topics.length > 0 && (
                          <ul className="space-y-1 text-[12.5px] text-ink-muted">
                            {d.topics.map((t) => (
                              <li key={t.topicId}>
                                <strong className="font-medium text-ink">{t.name}</strong> · {t.headline}
                              </li>
                            ))}
                          </ul>
                        )}
                        {entries.length > 0 && <Prioritised items={entries} />}
                        {entries.length < d.publicationIds.length && (
                          <p className="text-[11.5px] text-ink-faint">
                            {d.publicationIds.length - entries.length} paper(s) are no longer available (their topic was deleted).
                          </p>
                        )}
                        <p className="text-[11.5px] text-ink-faint">
                          Put together <LocalTime iso={d.periodEnd} />.
                        </p>
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
