"use client";

import Link from "next/link";
import { useState } from "react";
import { useSignal } from "@/lib/store/SignalProvider";
import {
  Button,
  Chip,
  ORIGIN_LABEL,
  RelevanceBadge,
  SignificanceBadge,
  TypeChip,
  cx,
  formatDate,
} from "@/components/ui/primitives";
import type { Development } from "@/lib/developments";

function Labelled({
  label,
  note,
  tone = "neutral",
  children,
}: {
  label: string;
  note?: string;
  tone?: "neutral" | "accent" | "speculative";
  children: React.ReactNode;
}) {
  return (
    <div
      className={cx(
        "rounded border px-3 py-2.5",
        tone === "accent" && "border-accent/20 bg-accent-soft/40",
        tone === "speculative" && "border-dashed border-line-strong bg-canvas",
        tone === "neutral" && "border-line bg-white",
      )}
    >
      <p className="flex flex-wrap items-baseline gap-x-2 text-[10px]">
        <span
          className={cx(
            "eyebrow font-semibold",
            tone === "accent" ? "text-accent" : "text-ink-muted",
          )}
        >
          {label}
        </span>
        {note && <span className="text-ink-faint">{note}</span>}
      </p>
      <div className="mt-1.5 text-[13px] leading-relaxed text-ink">{children}</div>
    </div>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1">
      {items.map((t) => (
        <li key={t} className="flex gap-2">
          <span aria-hidden className="mt-[8px] h-1 w-1 shrink-0 rounded-full bg-line-strong" />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * One development. Collapsed, it answers what it is, which topic it bears on,
 * how relevant and how important it is, and why it matters. Expanded, it adds
 * what changed (as reported), Signal's interpretation, and suggested next
 * steps — each labelled for what it is.
 */
export function DevelopmentCard({
  item,
  defaultOpen = false,
  showTopic = true,
}: {
  item: Development;
  defaultOpen?: boolean;
  showTopic?: boolean;
}) {
  const { publication: pub } = item;
  const { savedIds, dismissedIds, recordFeedback } = useSignal();
  const [open, setOpen] = useState(defaultOpen);
  const saved = savedIds.includes(pub.id);
  const dismissed = dismissedIds.includes(pub.id);
  const detailHref = `/paper/${encodeURIComponent(pub.id)}`;

  return (
    <article
      className={cx(
        "rounded-md border bg-surface transition-colors",
        item.highPriority
          ? "border-high-line border-l-[3px] border-l-high shadow-[0_1px_3px_rgba(15,23,42,0.06)]"
          : "border-line",
        dismissed && "opacity-55",
      )}
    >
      <div className="px-4 py-3.5">
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-ink-faint">
          {item.highPriority && (
            <span className="eyebrow mr-1 text-[10px] font-semibold text-high">High priority</span>
          )}
          <TypeChip type={pub.type} />
          <span className="font-medium text-ink-muted">{pub.source}</span>
          <span aria-hidden>·</span>
          <time dateTime={pub.publishedAt}>{formatDate(pub.publishedAt)}</time>
          {pub.origin !== "pubmed" && pub.origin !== "clinicaltrials" && (
            <Chip tone="quiet">via {ORIGIN_LABEL[pub.origin]}</Chip>
          )}
          {showTopic && (
            <Chip tone="accent" title="The monitored topic this bears on">
              {item.topicName ?? "Removed topic"}
            </Chip>
          )}
        </div>

        <h3 className="mt-1.5 text-[15px] leading-[1.35] font-semibold tracking-[-0.01em] text-ink">
          <Link
            href={detailHref}
            onClick={() => recordFeedback(pub.id, "read")}
            className="decoration-1 underline-offset-2 hover:text-accent hover:underline"
          >
            {pub.title}
          </Link>
        </h3>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <RelevanceBadge cls={item.relevance} score={item.scores.researchRelevance} />
          <SignificanceBadge level={item.significance.level} inferred={item.significance.inferred} />
        </div>

        <div
          className={cx(
            "mt-3 rounded border-l-2 py-2 pr-3 pl-3",
            item.highPriority ? "border-l-high bg-high-soft" : "border-l-accent/40 bg-accent-soft/50",
          )}
        >
          <p
            className={cx(
              "eyebrow text-[9px] font-semibold",
              item.highPriority ? "text-high" : "text-accent",
            )}
          >
            Why it matters to you
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-ink">{item.whyThisMatters}</p>
        </div>

        {open && (
          <div className="mt-3 space-y-2.5">
            <Labelled label="What changed" note="as reported by the source">
              {item.whatChanged ?? pub.summary}
            </Labelled>
            {item.implications.length > 0 && (
              <Labelled label="Implications for your research" note="Signal's interpretation" tone="accent">
                <Bullets items={item.implications} />
              </Labelled>
            )}
            {item.nextSteps.length > 0 && (
              <Labelled
                label="What you could do next"
                note="AI suggestions, not findings"
                tone="speculative"
              >
                <Bullets items={item.nextSteps} />
              </Labelled>
            )}
            <p className="text-[11px] leading-relaxed text-ink-faint">
              {item.significance.reason}{" "}
              Assessed by AI from the {pub.type === "trial" ? "registry summary" : "title and abstract"}, not
              the full text.
            </p>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
          <div className="flex flex-wrap items-center gap-3 text-[12px]">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className="font-medium text-accent hover:underline"
            >
              {open ? "Show less" : "What changed & next steps"}
            </button>
            <Link href={detailHref} className="text-ink-muted hover:text-accent">
              Full analysis
            </Link>
            {pub.url && (
              <a
                href={pub.url}
                target="_blank"
                rel="noreferrer"
                className="text-ink-muted hover:text-accent"
              >
                Original source ↗
              </a>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Button size="sm" active={saved} onClick={() => recordFeedback(pub.id, "save")}>
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
          </div>
        </div>
      </div>
    </article>
  );
}
