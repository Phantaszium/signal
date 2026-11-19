"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/brand/Puffin";
import { LiteratureSearch } from "@/components/discover/LiteratureSearch";
import { PaperCard, paperHref } from "@/components/papers/PaperCard";
import { PageHeader, RelevanceBadge, cx, formatDate } from "@/components/ui/primitives";
import { toDevelopment, type Development } from "@/lib/developments";
import { useSignal } from "@/lib/store/SignalProvider";
import type { EvaluatedItem } from "@/lib/types";

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
      <span className="text-[11px] font-medium text-ink-faint">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="w-full rounded-lg border border-line-strong bg-white px-2.5 py-1.5 text-[13px] text-ink outline-none focus:border-accent"
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

type Tab = "for-you" | "search";

export function Discover({ initialTab, ruledOut }: { initialTab: Tab; ruledOut: EvaluatedItem[] }) {
  const [tab, setTab] = useState<Tab>(initialTab);

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
      <PageHeader
        title="Discover"
        description="Papers PaperPuffin picked for your research, and a search across PubMed, PubMed Central and preprint servers."
      />

      <div role="tablist" aria-label="Discover" className="mt-5 inline-flex rounded-xl border border-line bg-surface p-1">
        {(
          [
            ["for-you", "Recommended for you"],
            ["search", "Search the literature"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            type="button"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cx(
              "rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-colors",
              tab === key ? "bg-accent text-white" : "text-ink-muted hover:text-ink",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-5 max-w-4xl">{tab === "for-you" ? <ForYou ruledOut={ruledOut} /> : <LiteratureSearch />}</div>
    </div>
  );
}

type DateRange = "7" | "30" | "90" | "all";
type Relevance = "any" | "related" | "direct";
type Status = "all" | "unread" | "read" | "saved";

function ForYou({ ruledOut }: { ruledOut: EvaluatedItem[] }) {
  const { developments, topics, topicById, weights, now, savedIds, library } = useSignal();
  const [topic, setTopic] = useState("all");
  const [range, setRange] = useState<DateRange>("30");
  const [journal, setJournal] = useState("all");
  const [relevance, setRelevance] = useState<Relevance>("any");
  const [status, setStatus] = useState<Status>("all");
  const [showRuledOut, setShowRuledOut] = useState(false);

  const journals = useMemo(
    () => [...new Set(developments.map((d) => d.publication.source))].sort((a, b) => a.localeCompare(b)),
    [developments],
  );

  const filtered = developments.filter((d) => {
    if (topic !== "all" && d.topicId !== topic) return false;
    if (range !== "all" && now - Date.parse(d.evaluatedAt) > Number(range) * DAY) return false;
    if (journal !== "all" && d.publication.source !== journal) return false;
    if (relevance === "related" && d.relevance !== "related" && d.relevance !== "direct") return false;
    if (relevance === "direct" && d.relevance !== "direct") return false;
    const read = library.get(d.publication.id)?.readingStatus === "read";
    if (status === "unread" && read) return false;
    if (status === "read" && !read) return false;
    if (status === "saved" && !savedIds.includes(d.publication.id)) return false;
    return true;
  });

  const ruled: Development[] = useMemo(
    () => ruledOut.map((i) => toDevelopment(i, i.topicId ? topicById.get(i.topicId) : undefined, weights)),
    [ruledOut, topicById, weights],
  );

  return (
    <>
      <div className="grid grid-cols-2 gap-3 rounded-2xl border border-line bg-surface p-4 sm:grid-cols-5">
        <Select
          label="Topic"
          value={topic}
          onChange={setTopic}
          options={[{ value: "all", label: "All topics" }, ...topics.map((t) => ({ value: t.id, label: t.profile.program }))]}
        />
        <Select<DateRange>
          label="Found"
          value={range}
          onChange={setRange}
          options={[
            { value: "7", label: "Past week" },
            { value: "30", label: "Past month" },
            { value: "90", label: "Past 3 months" },
            { value: "all", label: "Any time" },
          ]}
        />
        <Select
          label="Journal / server"
          value={journal}
          onChange={setJournal}
          options={[{ value: "all", label: "All" }, ...journals.map((j) => ({ value: j, label: j }))]}
        />
        <Select<Relevance>
          label="Relevance"
          value={relevance}
          onChange={setRelevance}
          options={[
            { value: "any", label: "Any" },
            { value: "related", label: "Related or closer" },
            { value: "direct", label: "Directly relevant" },
          ]}
        />
        <Select<Status>
          label="Status"
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: "All" },
            { value: "unread", label: "Unread" },
            { value: "read", label: "Read" },
            { value: "saved", label: "Saved" },
          ]}
        />
      </div>

      <p className="mt-4 text-[12.5px] text-ink-faint">
        {filtered.length} paper{filtered.length === 1 ? "" : "s"} · newest first
      </p>
      <div className="mt-2 space-y-3">
        {filtered.length ? (
          filtered.map((d) => <PaperCard key={d.publication.id} item={d} />)
        ) : (
          <EmptyState
            title={developments.length ? "No papers match these filters" : "No recommendations yet"}
            body={
              developments.length
                ? "Try a longer date range or fewer filters."
                : "Once PaperPuffin has searched your topics, recommended papers appear here. You can also search the literature yourself."
            }
          />
        )}
      </div>

      {ruled.length > 0 && (
        <div className="mt-8 rounded-2xl border border-line bg-surface px-5 py-4">
          <button
            type="button"
            onClick={() => setShowRuledOut((v) => !v)}
            aria-expanded={showRuledOut}
            className="text-[13px] font-medium text-accent hover:underline"
          >
            {showRuledOut ? "Hide" : "Show"} {ruled.length} paper{ruled.length === 1 ? "" : "s"} PaperPuffin read and didn&rsquo;t recommend
          </button>
          <p className="mt-1 text-[12px] text-ink-faint">
            Shown for transparency, so you can check what a quiet week actually contained.
          </p>
          {showRuledOut && (
            <ul className="mt-2 divide-y divide-line">
              {ruled.map((d) => (
                <li key={d.publication.id} className="py-2.5">
                  <div className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-ink-faint">
                    <span>{d.publication.source}</span>
                    <span aria-hidden>·</span>
                    <span>{formatDate(d.publication.publishedAt)}</span>
                    <RelevanceBadge cls={d.relevance} score={d.scores.researchRelevance} />
                  </div>
                  <Link href={paperHref(d.publication.id)} className="mt-1 block text-[13px] text-ink-muted hover:text-accent">
                    {d.publication.title}
                  </Link>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-ink-faint">{d.whyThisMatters}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}
