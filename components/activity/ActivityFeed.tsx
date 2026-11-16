"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DevelopmentCard } from "@/components/developments/DevelopmentCard";
import { RelevanceBadge, cx, formatDate } from "@/components/ui/primitives";
import { toDevelopment, type Development } from "@/lib/developments";
import { useSignal } from "@/lib/store/SignalProvider";
import type { EvaluatedItem, PublicationType } from "@/lib/types";

type DateRange = "7" | "30" | "90" | "all";
type RelevanceFilter = "any" | "related" | "direct";
type ImportanceFilter = "any" | "moderate" | "major";

const DAY = 86_400_000;

function Select<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[10px] font-medium text-ink-faint">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="rounded border border-line bg-white px-2 py-1.5 text-[12px] text-ink outline-none focus:border-accent/50"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Groups are UTC days, so the heading is formatted in UTC too (and renders the same on server and client). */
const dayHeading = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });

/** Records Signal assessed and ruled out: shown on request, for transparency. */
function RuledOutRow({ item }: { item: Development }) {
  return (
    <li className="py-2.5">
      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-ink-faint">
        <span>{item.publication.source}</span>
        <span aria-hidden>·</span>
        <span>{formatDate(item.publication.publishedAt)}</span>
        {item.topicName && <span>· {item.topicName}</span>}
        <RelevanceBadge cls={item.relevance} score={item.scores.researchRelevance} />
      </div>
      <Link
        href={`/paper/${encodeURIComponent(item.publication.id)}`}
        className="mt-1 block text-[13px] text-ink-muted hover:text-accent"
      >
        {item.publication.title}
      </Link>
      <p className="mt-0.5 text-[11px] leading-relaxed text-ink-faint">
        {item.explanations.find((e) => e.dimension === "researchRelevance")?.reasons[0]}
      </p>
    </li>
  );
}

/**
 * Chronological feed of developments, newest detection first, with filters.
 * Can also show what Signal assessed and ruled out, so a quiet feed can be
 * checked rather than taken on trust.
 */
export function ActivityFeed({ ruledOut }: { ruledOut: EvaluatedItem[] }) {
  const { developments, allItems, topics, topicById, weights, dismissedIds, now } = useSignal();
  const [topic, setTopic] = useState("all");
  const [range, setRange] = useState<DateRange>("30");
  const [relevance, setRelevance] = useState<RelevanceFilter>("any");
  const [importance, setImportance] = useState<ImportanceFilter>("any");
  const [type, setType] = useState<"all" | PublicationType>("all");
  const [showRuledOut, setShowRuledOut] = useState(false);

  const matches = useMemo(() => {
    const since = range === "all" ? 0 : now - Number(range) * DAY;
    return (d: Development) =>
      (topic === "all" || d.topicId === topic) &&
      Date.parse(d.evaluatedAt) >= since &&
      (relevance === "any" ||
        (relevance === "direct" ? d.relevance === "direct" : d.relevance === "direct" || d.relevance === "related")) &&
      (importance === "any" ||
        (importance === "major" ? d.significance.level === "major" : d.significance.level !== "minor")) &&
      (type === "all" || d.publication.type === type);
  }, [topic, range, relevance, importance, type, now]);

  const shown = developments.filter(matches);

  const groups = useMemo(() => {
    const out: { day: string; items: Development[] }[] = [];
    for (const d of shown) {
      const day = d.evaluatedAt.slice(0, 10);
      const last = out[out.length - 1];
      if (last?.day === day) last.items.push(d);
      else out.push({ day, items: [d] });
    }
    return out;
  }, [shown]);

  const excluded = useMemo(() => {
    if (!showRuledOut) return [];
    const dismissed = new Set(dismissedIds);
    const belowThreshold = allItems.filter((d) => !d.isDevelopment);
    const rest = ruledOut
      .filter((i) => !allItems.some((d) => d.publication.id === i.publication.id))
      .map((i) => toDevelopment(i, i.topicId ? topicById.get(i.topicId) : undefined, weights));
    const relaxed = (d: Development) =>
      (topic === "all" || d.topicId === topic) &&
      (range === "all" || Date.parse(d.evaluatedAt) >= now - Number(range) * DAY);
    return [...belowThreshold, ...rest, ...allItems.filter((d) => d.isDevelopment && dismissed.has(d.publication.id))]
      .filter(relaxed)
      .sort((a, b) => Date.parse(b.evaluatedAt) - Date.parse(a.evaluatedAt));
  }, [showRuledOut, allItems, ruledOut, topicById, weights, dismissedIds, topic, range, now]);

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 rounded-md border border-line bg-surface p-3 sm:grid-cols-3 lg:grid-cols-5">
        <Select
          label="Topic"
          value={topic}
          onChange={setTopic}
          options={[
            { value: "all", label: "All topics" },
            ...topics.map((t) => ({ value: t.id, label: t.profile.program })),
          ]}
        />
        <Select<DateRange>
          label="Detected"
          value={range}
          onChange={setRange}
          options={[
            { value: "7", label: "Last 7 days" },
            { value: "30", label: "Last 30 days" },
            { value: "90", label: "Last 90 days" },
            { value: "all", label: "All loaded" },
          ]}
        />
        <Select<RelevanceFilter>
          label="Relevance"
          value={relevance}
          onChange={setRelevance}
          options={[
            { value: "any", label: "All developments" },
            { value: "related", label: "Related or direct" },
            { value: "direct", label: "Directly relevant" },
          ]}
        />
        <Select<ImportanceFilter>
          label="Importance"
          value={importance}
          onChange={setImportance}
          options={[
            { value: "any", label: "Any" },
            { value: "moderate", label: "Moderate or major" },
            { value: "major", label: "Major only" },
          ]}
        />
        <Select<"all" | PublicationType>
          label="Source type"
          value={type}
          onChange={setType}
          options={[
            { value: "all", label: "All types" },
            { value: "journal", label: "Journal articles" },
            { value: "preprint", label: "Preprints" },
            { value: "trial", label: "Clinical trials" },
          ]}
        />
      </div>

      <p className="mt-3 text-[12px] text-ink-muted">
        {shown.length} development{shown.length === 1 ? "" : "s"} match these filters.
      </p>

      {groups.length === 0 ? (
        <div className="mt-4 rounded-md border border-dashed border-line px-6 py-10 text-center">
          <p className="text-[14px] font-medium text-ink">No developments match</p>
          <p className="mx-auto mt-1 max-w-md text-[13px] leading-relaxed text-ink-muted">
            {developments.length
              ? "Try a wider date range or fewer filters."
              : "Signal has not found anything that clears your topics' relevance thresholds yet. It does not pad the feed with weak matches."}
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-7">
          {groups.map((g) => (
            <section key={g.day}>
              <h2 className="eyebrow border-b border-line pb-1.5 text-[10px] font-semibold text-ink-muted">
                Detected {dayHeading(g.items[0].evaluatedAt)}
              </h2>
              <div className="mt-3 space-y-3">
                {g.items.map((d) => (
                  <DevelopmentCard key={d.publication.id} item={d} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <div className="mt-10 border-t border-line pt-4">
        <button
          type="button"
          onClick={() => setShowRuledOut((v) => !v)}
          className={cx("text-[12px] font-medium", showRuledOut ? "text-ink" : "text-accent hover:underline")}
        >
          {showRuledOut ? "Hide records Signal ruled out" : "Show records Signal assessed and ruled out"}
        </button>
        {showRuledOut && (
          <div className="mt-2">
            <p className="text-[11px] leading-relaxed text-ink-faint">
              Assessed for your topics but below their relevance threshold, or dismissed by you. Shown so you
              can check Signal&rsquo;s judgement; they never appear as developments.
            </p>
            {excluded.length ? (
              <ul className="mt-2 divide-y divide-line">
                {excluded.slice(0, 100).map((d) => (
                  <RuledOutRow key={d.publication.id} item={d} />
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[12px] text-ink-muted">Nothing ruled out in this range.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
