"use client";

import Link from "next/link";
import { useState } from "react";
import { EmptyState } from "@/components/brand/Puffin";
import { paperHref } from "@/components/papers/PaperCard";
import { READING_LABEL, useLibraryEntry } from "@/components/papers/useLibrary";
import { Icon } from "@/components/ui/Icon";
import { Button, Chip, PageHeader, Panel, ProvenanceTag, authorLine, cx, formatDate, timeAgo } from "@/components/ui/primitives";
import type { Development } from "@/lib/developments";
import { useSignal } from "@/lib/store/SignalProvider";
import type { Publication, ReadingStatus } from "@/lib/types";

type Filter = "all" | ReadingStatus;

interface Entry {
  pub: Publication;
  item?: Development;
}

function LibraryItem({ entry }: { entry: Entry }) {
  const { pub, item } = entry;
  const { recordFeedback } = useSignal();
  const lib = useLibraryEntry(pub.id);

  return (
    <li className="rounded-2xl border border-line bg-surface px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-ink-faint">
            <span className="font-medium text-ink-muted">{pub.source}</span>
            <span aria-hidden>·</span>
            <span>{formatDate(pub.publishedAt)}</span>
            {item?.topicName && <Chip tone="accent">{item.topicName}</Chip>}
            {!item && <Chip tone="quiet">Saved from search</Chip>}
          </div>
          <Link href={paperHref(pub.id)} className="mt-1 block text-[15px] leading-snug font-semibold text-ink hover:text-accent">
            {pub.title}
          </Link>
          <p className="mt-0.5 text-[12.5px] text-ink-muted">{authorLine(pub.authors)}</p>
        </div>
        {lib.ready && (
          <select
            aria-label="Reading status"
            value={lib.status ?? ""}
            onChange={(e) => lib.setStatus((e.target.value || null) as ReadingStatus | null)}
            className={cx(
              "rounded-lg border px-2.5 py-1.5 text-[12.5px] font-medium",
              lib.status === "read" ? "border-sea/40 bg-sea-soft text-sea" : lib.status === "reading" ? "border-high-line bg-high-soft text-high" : "border-line-strong bg-white text-ink",
            )}
          >
            <option value="">No status</option>
            {(Object.keys(READING_LABEL) as ReadingStatus[]).map((s) => (
              <option key={s} value={s}>
                {READING_LABEL[s]}
              </option>
            ))}
          </select>
        )}
      </div>

      {item && (
        <p className="mt-2.5 text-[12.5px] leading-relaxed text-ink-muted">
          <span className="mr-1.5 inline-block align-middle">
            <ProvenanceTag kind="ai" />
          </span>
          <span className="font-medium text-ink">Recommended because:</span> {item.whyThisMatters}
        </p>
      )}
      {lib.notes && (
        <p className="mt-2 rounded-xl bg-canvas px-3 py-2 text-[12.5px] leading-relaxed whitespace-pre-line text-ink">
          <span className="font-semibold">My notes: </span>
          {lib.notes.length > 280 ? `${lib.notes.slice(0, 280)}…` : lib.notes}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-2.5 text-[12.5px]">
        <Link href={paperHref(pub.id)} className="font-semibold text-accent hover:underline">
          {item ? "Study guide & notes" : "Open & explain"}
        </Link>
        {pub.url && (
          <a href={pub.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-ink-muted hover:text-accent">
            Original source <Icon name="external" size={13} />
          </a>
        )}
        <button type="button" onClick={() => recordFeedback(pub.id, "save")} className="ml-auto text-ink-faint hover:text-negative">
          Remove from library
        </button>
      </div>
      {lib.error && <p className="mt-2 text-[11.5px] text-negative">{lib.error}</p>}
    </li>
  );
}

export function Library() {
  const { savedIds, allItems, unassessed, library, libraryReady, topics, dismissedIds, recordFeedback, now } = useSignal();
  const [filter, setFilter] = useState<Filter>("all");
  const [topic, setTopic] = useState("all");

  const byId = new Map(allItems.map((d) => [d.publication.id, d]));
  const toEntry = (id: string): Entry | null => {
    const item = byId.get(id);
    const pub = item?.publication ?? unassessed.find((p) => p.id === id);
    return pub ? { pub, item } : null;
  };

  // Newest saves first.
  const saved = [...savedIds]
    .reverse()
    .map(toEntry)
    .filter((e): e is Entry => e !== null);
  const counts: Record<Filter, number> = {
    all: saved.length,
    to_read: 0,
    reading: 0,
    read: 0,
  };
  for (const e of saved) {
    const s = library.get(e.pub.id)?.readingStatus;
    if (s) counts[s] += 1;
  }
  const shown = saved.filter(
    (e) =>
      (filter === "all" || library.get(e.pub.id)?.readingStatus === filter) &&
      (topic === "all" || e.item?.topicId === topic || (topic === "none" && !e.item?.topicId)),
  );

  const history = [...library.values()]
    .filter((e) => e.viewedAt)
    .sort((a, b) => Date.parse(b.viewedAt!) - Date.parse(a.viewedAt!))
    .slice(0, 12)
    .map((e) => ({ entry: toEntry(e.publicationId), viewedAt: e.viewedAt! }))
    .filter((h): h is { entry: Entry; viewedAt: string } => h.entry !== null);

  const dismissed = allItems.filter((d) => dismissedIds.includes(d.publication.id));

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
      <PageHeader
        title="My Library"
        description="Papers you've saved, with your reading status, notes, and why each one was recommended."
      />

      {!libraryReady && (
        <p className="mt-4 max-w-4xl rounded-xl border border-high-line bg-high-soft px-4 py-3 text-[12.5px] leading-relaxed text-ink">
          Saving works. Reading status, notes and reading history need the latest database update: run{" "}
          <code className="font-mono text-[11.5px]">supabase/migrations/0004_paperpuffin_library.sql</code> in the Supabase SQL editor.
        </p>
      )}

      <div className="mt-6 grid max-w-6xl gap-7 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div role="tablist" aria-label="Reading status" className="inline-flex flex-wrap rounded-xl border border-line bg-surface p-1">
              {(["all", "to_read", "reading", "read"] as Filter[]).map((f) => (
                <button
                  key={f}
                  role="tab"
                  type="button"
                  aria-selected={filter === f}
                  onClick={() => setFilter(f)}
                  disabled={f !== "all" && !libraryReady}
                  className={cx(
                    "rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors disabled:opacity-40",
                    filter === f ? "bg-accent text-white" : "text-ink-muted hover:text-ink",
                  )}
                >
                  {f === "all" ? "All saved" : READING_LABEL[f]} <span className="tabular opacity-70">{counts[f]}</span>
                </button>
              ))}
            </div>
            <select
              aria-label="Filter by topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="rounded-lg border border-line-strong bg-white px-2.5 py-1.5 text-[12.5px] text-ink"
            >
              <option value="all">All topics</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.profile.program}
                </option>
              ))}
              <option value="none">No topic (saved from search)</option>
            </select>
          </div>

          <ul className="mt-4 space-y-3">
            {shown.map((e) => (
              <LibraryItem key={e.pub.id} entry={e} />
            ))}
          </ul>
          {shown.length === 0 && (
            <div className="mt-4">
              <EmptyState
                mood="reading"
                title={saved.length ? "Nothing here with these filters" : "Your library is empty"}
                body={
                  saved.length
                    ? "Try another status or topic."
                    : "Save papers from Home, Discover or a briefing and they'll collect here, ready to read and annotate."
                }
                action={
                  !saved.length && (
                    <Link href="/discover" className="text-[13px] font-semibold text-accent hover:underline">
                      Find papers in Discover →
                    </Link>
                  )
                }
              />
            </div>
          )}
        </section>

        <aside className="space-y-5">
          <Panel title="Recently opened">
            {history.length ? (
              <ul className="divide-y divide-line">
                {history.map(({ entry, viewedAt }) => (
                  <li key={entry.pub.id} className="py-2 first:pt-0 last:pb-0">
                    <Link href={paperHref(entry.pub.id)} className="line-clamp-2 text-[12.5px] leading-snug font-medium text-ink hover:text-accent">
                      {entry.pub.title}
                    </Link>
                    <p className="text-[11px] text-ink-faint">{timeAgo(viewedAt, now)}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12.5px] text-ink-muted">
                {libraryReady ? "Papers you open will be listed here." : "Reading history becomes available after the database update."}
              </p>
            )}
          </Panel>

          {dismissed.length > 0 && (
            <Panel title="Marked not relevant">
              <p className="text-[11.5px] leading-relaxed text-ink-faint">
                Hidden from your recommendations. Restore any you dismissed by mistake.
              </p>
              <ul className="mt-2 divide-y divide-line">
                {dismissed.slice(0, 10).map((d) => (
                  <li key={d.publication.id} className="flex items-center justify-between gap-2 py-2">
                    <Link href={paperHref(d.publication.id)} className="line-clamp-2 min-w-0 text-[12px] text-ink-muted hover:text-accent">
                      {d.publication.title}
                    </Link>
                    <Button size="sm" onClick={() => recordFeedback(d.publication.id, "not_relevant")}>
                      Restore
                    </Button>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </aside>
      </div>
    </div>
  );
}
