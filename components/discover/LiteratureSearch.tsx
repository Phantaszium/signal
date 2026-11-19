"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { EmptyState, PuffinLoader } from "@/components/brand/Puffin";
import { paperHref } from "@/components/papers/PaperCard";
import { Icon } from "@/components/ui/Icon";
import { Button, Chip, ProvenanceTag, RelevanceBadge, TypeChip, authorLine, cx, formatDate } from "@/components/ui/primitives";
import type { SearchHit } from "@/lib/ingestion/europepmc";
import { explainPaperAction, searchAction, toggleSaveAction } from "@/lib/papers/actions";
import { useSignal } from "@/lib/store/SignalProvider";

type Since = "any" | "1" | "5";

const sinceDate = (years: Since) => {
  if (years === "any") return undefined;
  const d = new Date();
  d.setFullYear(d.getFullYear() - Number(years));
  return d.toISOString().slice(0, 10);
};

/**
 * Live search through Europe PMC (PubMed, PubMed Central and preprints).
 * Results are shown as the source returns them, without AI: "Explain for my
 * research" runs the same assessment monitoring does, on request.
 */
export function LiteratureSearch() {
  const { topics } = useSignal();
  const [query, setQuery] = useState("");
  const [since, setSince] = useState<Since>("5");
  const [type, setType] = useState<"all" | "journal" | "preprint">("all");
  const [openAccessOnly, setOpenAccessOnly] = useState(false);
  const [sort, setSort] = useState<"relevance" | "date">("relevance");
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [total, setTotal] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const suggestions = [...new Set(topics.flatMap((t) => t.profile.keywords))].slice(0, 6);

  const run = (q: string, more = false) =>
    startTransition(async () => {
      setError(null);
      const result = await searchAction({
        query: q,
        from: sinceDate(since),
        type,
        openAccessOnly,
        sort,
        cursor: more ? (cursor ?? undefined) : undefined,
      });
      if (!result.ok) {
        setError(result.error);
        if (!more) setHits([]);
        return;
      }
      setHits((prev) => (more && prev ? [...prev, ...result.value.hits] : result.value.hits));
      setTotal(result.value.total);
      setCursor(result.value.nextCursor);
    });

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (query.trim()) run(query.trim());
        }}
        className="rounded-2xl border border-line bg-surface p-4"
      >
        <div className="flex gap-2">
          <label className="relative flex-1">
            <span className="sr-only">Search papers</span>
            <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='e.g. "Vibrio natriegens" growth rate'
              className="w-full rounded-xl border border-line-strong bg-white py-2.5 pr-3 pl-10 text-[14px] text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
            />
          </label>
          <Button type="submit" variant="primary" disabled={pending || !query.trim()}>
            Search
          </Button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12.5px] text-ink-muted">
          <label className="flex items-center gap-1.5">
            Published
            <select value={since} onChange={(e) => setSince(e.target.value as Since)} className="rounded-lg border border-line-strong bg-white px-2 py-1 text-ink">
              <option value="1">in the last year</option>
              <option value="5">in the last 5 years</option>
              <option value="any">any time</option>
            </select>
          </label>
          <label className="flex items-center gap-1.5">
            Type
            <select value={type} onChange={(e) => setType(e.target.value as typeof type)} className="rounded-lg border border-line-strong bg-white px-2 py-1 text-ink">
              <option value="all">Papers and preprints</option>
              <option value="journal">Peer-reviewed only</option>
              <option value="preprint">Preprints only</option>
            </select>
          </label>
          <label className="flex items-center gap-1.5">
            Sort
            <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="rounded-lg border border-line-strong bg-white px-2 py-1 text-ink">
              <option value="relevance">Best match</option>
              <option value="date">Newest</option>
            </select>
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={openAccessOnly} onChange={(e) => setOpenAccessOnly(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
            Free to read only
          </label>
        </div>

        {hits === null && suggestions.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-[12px] text-ink-faint">From your topics:</span>
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setQuery(`"${s}"`);
                  run(`"${s}"`);
                }}
                className="rounded-full border border-accent/25 bg-accent-soft px-2.5 py-0.5 text-[12px] font-medium text-accent hover:border-accent/50"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </form>

      <p className="mt-3 text-[11.5px] text-ink-faint">
        Results come straight from{" "}
        <a href="https://europepmc.org" target="_blank" rel="noreferrer" className="underline hover:text-accent">
          Europe PMC
        </a>
        , which indexes PubMed, PubMed Central and preprint servers. Many papers are behind a paywall; &ldquo;Free to read&rdquo; marks those with open full text.
      </p>

      {error && (
        <p role="alert" className="mt-4 rounded-xl border border-negative/25 bg-[#fdf1ee] px-4 py-3 text-[13px] text-negative">
          {error}
        </p>
      )}

      {pending && !hits?.length && <PuffinLoader message="Searching the literature…" />}

      {hits && !pending && hits.length === 0 && !error && (
        <div className="mt-4">
          <EmptyState title="No papers found" body="Try fewer or different words, a longer date range, or remove filters." />
        </div>
      )}

      {hits && hits.length > 0 && (
        <>
          <p className="mt-4 text-[12.5px] text-ink-faint">
            {total.toLocaleString("en-US")} result{total === 1 ? "" : "s"} · showing {hits.length}
          </p>
          <ul className="mt-2 space-y-3">
            {hits.map((h) => (
              <SearchResult key={h.publication.id} hit={h} />
            ))}
          </ul>
          {cursor && (
            <div className="mt-4 text-center">
              <Button onClick={() => run(query.trim(), true)} disabled={pending}>
                {pending ? "Loading…" : "Load more"}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SearchResult({ hit }: { hit: SearchHit }) {
  const pub = hit.publication;
  const { getItem, savedIds } = useSignal();
  const router = useRouter();
  const assessed = getItem(pub.id);
  const [saved, setSaved] = useState(savedIds.includes(pub.id));
  const [showAbstract, setShowAbstract] = useState(false);
  const [busy, setBusy] = useState<"save" | "explain" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ref = { id: pub.id, doi: pub.doi };

  const toggleSave = async () => {
    setBusy("save");
    setError(null);
    const result = await toggleSaveAction(ref, !saved);
    if (result.ok) setSaved(result.value.saved);
    else setError(result.error);
    setBusy(null);
    router.refresh();
  };

  const explain = async () => {
    setBusy("explain");
    setError(null);
    const result = await explainPaperAction(ref);
    if (result.ok) router.push(paperHref(result.value.id));
    else {
      setError(result.error);
      setBusy(null);
    }
  };

  return (
    <li className="rounded-2xl border border-line bg-surface px-5 py-4">
      <div className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-ink-faint">
        <TypeChip type={pub.type} />
        <span className="font-medium text-ink-muted">{pub.source}</span>
        <span aria-hidden>·</span>
        <time dateTime={pub.publishedAt}>{formatDate(pub.publishedAt)}</time>
        {hit.openAccess && <Chip tone="accent">Free to read</Chip>}
      </div>
      <h3 className="mt-1.5 text-[15.5px] leading-snug font-semibold text-ink">
        {pub.url ? (
          <a href={pub.url} target="_blank" rel="noreferrer" className="hover:text-accent hover:underline">
            {pub.title}
          </a>
        ) : (
          pub.title
        )}
      </h3>
      <p className="mt-1 text-[12.5px] text-ink-muted">{authorLine(pub.authors)}</p>

      {assessed && (
        <div className="mt-2.5 rounded-xl bg-accent-soft/60 px-3.5 py-2.5">
          <p className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-accent">
            Why this matters to your research <ProvenanceTag kind="ai" />
            <RelevanceBadge cls={assessed.relevance} score={assessed.scores.researchRelevance} />
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-ink">{assessed.whyThisMatters}</p>
        </div>
      )}

      {showAbstract && (
        <p className="mt-2.5 text-[13px] leading-relaxed whitespace-pre-line text-ink-muted">
          {pub.abstract || "No abstract is available for this record."}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px]">
          <button type="button" onClick={() => setShowAbstract((v) => !v)} className="text-ink-muted hover:text-ink" aria-expanded={showAbstract}>
            {showAbstract ? "Hide abstract" : "Abstract"}
          </button>
          {pub.url && (
            <a href={pub.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-ink-muted hover:text-accent">
              Original source <Icon name="external" size={13} />
            </a>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" active={saved} onClick={toggleSave} disabled={busy !== null}>
            <Icon name="bookmark" size={14} />
            {busy === "save" ? "…" : saved ? "Saved" : "Save"}
          </Button>
          {assessed ? (
            <Link
              href={paperHref(pub.id)}
              className="inline-flex items-center gap-1 rounded-lg border border-accent bg-accent px-2.5 py-1 text-xs font-medium text-white hover:bg-accent-strong"
            >
              Understand this paper
            </Link>
          ) : (
            <Button size="sm" variant="primary" onClick={explain} disabled={busy !== null}>
              <Icon name="sparkle" size={14} />
              {busy === "explain" ? "Reading the paper…" : "Explain for my research"}
            </Button>
          )}
        </div>
      </div>
      {error && <p className={cx("mt-2 text-[12px] text-negative")}>{error}</p>}
    </li>
  );
}
