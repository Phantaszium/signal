"use client";

import Link from "next/link";
import { useSignal } from "@/lib/store/SignalProvider";
import {
  Chip,
  TypeChip,
  Button,
  SignalScoreBlock,
  cx,
  formatDate,
} from "@/components/ui/primitives";
import type { ScoredPublication } from "@/lib/types";

function authorLine(authors: string[]) {
  if (!authors.length) return "Authors not listed";
  if (authors.length <= 3) return authors.join(", ");
  return `${authors[0]}, ${authors[1]} … ${authors[authors.length - 1]} (+${authors.length - 2})`;
}

export function PaperCard({ item }: { item: ScoredPublication }) {
  const { publication: pub, tier } = item;
  const { savedIds, dismissedIds, recordFeedback } = useSignal();
  const saved = savedIds.includes(pub.id);
  const dismissed = dismissedIds.includes(pub.id);
  const isHigh = tier === "HIGH";

  return (
    <article
      className={cx(
        "rounded-md border bg-surface transition-colors",
        isHigh
          ? "border-high-line border-l-[3px] border-l-high shadow-[0_1px_3px_rgba(15,23,42,0.06)]"
          : "border-line",
        dismissed && "opacity-55",
      )}
    >
      <div className="flex gap-4 px-4 py-3.5">
        <div className="min-w-0 flex-1">
          {/* Metadata line */}
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-ink-faint">
            <TypeChip type={pub.type} />
            <span className="font-medium text-ink-muted">{pub.source}</span>
            <span aria-hidden>·</span>
            <time dateTime={pub.publishedAt}>{formatDate(pub.publishedAt)}</time>
            {pub.origin === "seed" ? (
              <Chip tone="quiet" title="Fictional record created for this demo">
                Demo
              </Chip>
            ) : (
              <Chip tone="accent" title="Retrieved live from PubMed">
                PubMed
              </Chip>
            )}
          </div>

          {/* Title */}
          <h3
            className={cx(
              "mt-1.5 font-semibold tracking-[-0.01em] text-ink",
              isHigh ? "text-[17px] leading-6" : "text-[15px] leading-[1.35]",
            )}
          >
            <Link
              href={`/paper/${pub.id}`}
              className="hover:text-accent hover:underline decoration-1 underline-offset-2"
            >
              {pub.title}
            </Link>
          </h3>

          <p className="mt-1 text-[12px] text-ink-faint">{authorLine(pub.authors)}</p>

          {/* One-sentence summary */}
          <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
            {pub.summary}
          </p>

          {/* The most important element on the card */}
          <div
            className={cx(
              "mt-3 rounded border-l-2 py-2 pl-3 pr-3",
              isHigh
                ? "border-l-high bg-high-soft"
                : "border-l-accent/40 bg-accent-soft/50",
            )}
          >
            <p
              className={cx(
                "eyebrow text-[9px] font-semibold",
                isHigh ? "text-high" : "text-accent",
              )}
            >
              Why this matters to you
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-ink">
              {item.whyThisMatters}
            </p>
          </div>

          {/* Tags */}
          {pub.tags.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1">
              {pub.tags.map((tag) => (
                <Chip
                  key={tag}
                  tone={item.matchedInterests.some(
                    (m) => m.toLowerCase() === tag.toLowerCase(),
                  )
                    ? "accent"
                    : "neutral"}
                >
                  {tag}
                </Chip>
              ))}
            </div>
          )}

          {/* Scores + actions */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
            <div className="flex items-center gap-4 text-[11px] text-ink-faint">
              <span className="tabular">
                Relevance{" "}
                <strong className="font-semibold text-ink">
                  {item.scores.researchRelevance}
                </strong>
              </span>
              <span className="tabular">
                Importance{" "}
                <strong className="font-semibold text-ink">{item.signalScore}</strong>
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                size="sm"
                active={saved}
                onClick={() => recordFeedback(pub.id, "save")}
              >
                {saved ? "Saved" : "Save"}
              </Button>
              <Button
                size="sm"
                variant="danger"
                active={dismissed}
                onClick={() => recordFeedback(pub.id, "not_relevant")}
              >
                {dismissed ? "Dismissed" : "Not relevant"}
              </Button>
              <Link
                href={`/paper/${pub.id}`}
                onClick={() => recordFeedback(pub.id, "read")}
                className="inline-flex items-center rounded border border-accent bg-accent px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-[#105066]"
              >
                Read
              </Link>
            </div>
          </div>
        </div>

        <SignalScoreBlock score={item.signalScore} emphasis={isHigh} />
      </div>
    </article>
  );
}
