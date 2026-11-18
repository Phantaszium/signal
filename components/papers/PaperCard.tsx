"use client";

import Link from "next/link";
import { useState } from "react";
import { READING_LABEL, useLibraryEntry } from "@/components/papers/useLibrary";
import { Icon } from "@/components/ui/Icon";
import {
  Chip,
  ORIGIN_LABEL,
  ProvenanceTag,
  RelevanceBadge,
  TypeChip,
  authorLine,
  cx,
  formatDate,
} from "@/components/ui/primitives";
import type { Development } from "@/lib/developments";
import { useSignal } from "@/lib/store/SignalProvider";

export const paperHref = (id: string) => `/paper/${encodeURIComponent(id)}`;

/** Save, dismiss and read controls shared by every paper card. */
function CardActions({ item, compact }: { item: Development; compact?: boolean }) {
  const pub = item.publication;
  const { savedIds, dismissedIds, recordFeedback } = useSignal();
  const lib = useLibraryEntry(pub.id);
  const saved = savedIds.includes(pub.id);
  const dismissed = dismissedIds.includes(pub.id);
  const read = lib.status === "read";

  const btn =
    "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[12px] font-medium transition-colors disabled:opacity-50";
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        onClick={() => recordFeedback(pub.id, "save")}
        aria-pressed={saved}
        className={cx(btn, saved ? "border-accent/40 bg-accent-soft text-accent" : "border-line-strong bg-white text-ink-muted hover:text-ink")}
      >
        <Icon name="bookmark" size={14} />
        {saved ? "Saved" : "Save"}
      </button>
      {lib.ready && (
        <button
          type="button"
          disabled={lib.pending}
          onClick={() => lib.setStatus(read ? (saved ? "to_read" : null) : "read")}
          aria-pressed={read}
          className={cx(btn, read ? "border-sea/40 bg-sea-soft text-sea" : "border-line-strong bg-white text-ink-muted hover:text-ink")}
        >
          <Icon name="check" size={14} />
          {read ? "Read" : "Mark read"}
        </button>
      )}
      {!compact && (
        <button
          type="button"
          onClick={() => recordFeedback(pub.id, "not_relevant")}
          aria-pressed={dismissed}
          title="Not relevant: hides it and teaches PaperPuffin what to skip"
          className={cx(btn, dismissed ? "border-negative/30 bg-[#fdf1ee] text-negative" : "border-line-strong bg-white text-ink-muted hover:text-negative")}
        >
          <Icon name="x" size={14} />
          {dismissed ? "Dismissed" : "Not relevant"}
        </button>
      )}
    </div>
  );
}

/**
 * One recommended paper. Shows what it is (title, authors, journal, date),
 * the topic it relates to, and why it matters to the student's research —
 * with the abstract one click away and the original source always linked.
 */
export function PaperCard({
  item,
  showTopic = true,
  priority = false,
}: {
  item: Development;
  showTopic?: boolean;
  /** Visually emphasise (e.g. "read this first" in a briefing). */
  priority?: boolean;
}) {
  const pub = item.publication;
  const { dismissedIds, recordFeedback } = useSignal();
  const [showAbstract, setShowAbstract] = useState(false);
  const lib = useLibraryEntry(pub.id);
  const dismissed = dismissedIds.includes(pub.id);
  const highlight = priority || item.highPriority;

  return (
    <article
      className={cx(
        "rounded-2xl border bg-surface px-5 py-4 transition-shadow hover:shadow-[0_2px_10px_rgba(21,35,63,0.06)]",
        highlight ? "border-high-line" : "border-line",
        dismissed && "opacity-55",
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-ink-faint">
        {item.highPriority && <Chip tone="warn">Worth reading first</Chip>}
        <TypeChip type={pub.type} />
        <span className="font-medium text-ink-muted">{pub.source}</span>
        <span aria-hidden>·</span>
        <time dateTime={pub.publishedAt}>{formatDate(pub.publishedAt)}</time>
        {lib.status && <Chip tone="quiet">{READING_LABEL[lib.status]}</Chip>}
      </div>

      <h3 className="mt-1.5 text-[16px] leading-snug font-semibold text-ink">
        <Link
          href={paperHref(pub.id)}
          onClick={() => recordFeedback(pub.id, "read")}
          className="decoration-accent/40 underline-offset-2 hover:text-accent hover:underline"
        >
          {pub.title}
        </Link>
      </h3>
      <p className="mt-1 text-[12.5px] text-ink-muted">{authorLine(pub.authors)}</p>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {showTopic && item.topicName && <Chip tone="accent">{item.topicName}</Chip>}
        <RelevanceBadge cls={item.relevance} score={item.scores.researchRelevance} />
      </div>

      <div className="mt-3 rounded-xl bg-accent-soft/60 px-3.5 py-2.5">
        <p className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-accent">
          Why this matters to your research
          <ProvenanceTag kind="ai" />
        </p>
        <p className="mt-1 text-[13.5px] leading-relaxed text-ink">{item.whyThisMatters}</p>
      </div>

      {showAbstract && (
        <div className="mt-3">
          <p className="flex items-center gap-2 text-[11px] font-semibold text-ink-muted">
            Abstract <ProvenanceTag kind="paper" />
          </p>
          <p className="mt-1 text-[13px] leading-relaxed whitespace-pre-line text-ink-muted">
            {pub.abstract || "No abstract is available for this record."}
          </p>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px]">
          <Link href={paperHref(pub.id)} className="font-semibold text-accent hover:underline">
            Understand this paper
          </Link>
          <button type="button" onClick={() => setShowAbstract((v) => !v)} className="text-ink-muted hover:text-ink" aria-expanded={showAbstract}>
            {showAbstract ? "Hide abstract" : "Abstract"}
          </button>
          {pub.url && (
            <a href={pub.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-ink-muted hover:text-accent">
              {ORIGIN_LABEL[pub.origin] === "PubMed" ? "PubMed" : "Original source"} <Icon name="external" size={13} />
            </a>
          )}
        </div>
        <CardActions item={item} />
      </div>
      {lib.error && <p className="mt-2 text-[11.5px] text-negative">{lib.error}</p>}
    </article>
  );
}

/** One-line row for compact lists (Continue Reading, briefing extras). */
export function PaperRow({ item, meta }: { item: Development; meta?: React.ReactNode }) {
  const pub = item.publication;
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 py-3">
      <div className="min-w-0 flex-1">
        <Link href={paperHref(pub.id)} className="block text-[14px] leading-snug font-medium text-ink hover:text-accent">
          {pub.title}
        </Link>
        <p className="mt-0.5 text-[12px] text-ink-faint">
          {authorLine(pub.authors, 2)} · {pub.source} · {formatDate(pub.publishedAt)}
          {meta}
        </p>
      </div>
      <CardActions item={item} compact />
    </li>
  );
}
