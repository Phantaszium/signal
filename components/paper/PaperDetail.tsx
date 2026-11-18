"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/brand/Puffin";
import { StudyGuide } from "@/components/paper/StudyGuide";
import { READING_LABEL, useLibraryEntry } from "@/components/papers/useLibrary";
import { Icon } from "@/components/ui/Icon";
import {
  Button,
  Chip,
  ORIGIN_LABEL,
  Panel,
  ProvenanceTag,
  RelevanceBadge,
  ScoreBar,
  SignificanceBadge,
  TypeChip,
  formatDate,
} from "@/components/ui/primitives";
import { LocalTime } from "@/components/ui/LocalTime";
import { RELEVANCE_THRESHOLD, toDevelopment, type Development } from "@/lib/developments";
import { explainPaperAction, markViewedAction } from "@/lib/papers/actions";
import { defaultExplanationLevel } from "@/lib/profile/student";
import { buildRankingRationale } from "@/lib/ranking/explain";
import { useSignal } from "@/lib/store/SignalProvider";
import type { EvaluatedItem, Publication, ReadingStatus } from "@/lib/types";

function Meta({ pub }: { pub: Publication }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-ink-faint">
        <TypeChip type={pub.type} />
        <span className="font-medium text-ink-muted">{pub.source}</span>
        <span aria-hidden>·</span>
        <time dateTime={pub.publishedAt}>{formatDate(pub.publishedAt)}</time>
        <Chip tone="quiet">via {ORIGIN_LABEL[pub.origin]}</Chip>
      </div>
      <h1 className="mt-2 font-display text-[25px] leading-[1.25] font-semibold text-ink sm:text-[28px]">{pub.title}</h1>
      <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">{pub.authors.join(", ") || "Authors not listed"}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {pub.url && (
          <a
            href={pub.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-accent bg-accent px-3 py-1.5 text-[13px] font-medium text-white hover:bg-accent-strong"
          >
            Read the original <Icon name="external" size={14} />
          </a>
        )}
        {pub.doi && <span className="font-mono text-[11.5px] text-ink-faint">DOI {pub.doi}</span>}
      </div>
    </>
  );
}

function Abstract({ pub }: { pub: Publication }) {
  return (
    <section className="rounded-2xl border border-line bg-surface px-5 py-4">
      <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
        Abstract <ProvenanceTag kind="paper" />
      </h2>
      <p className="mt-2 text-[14px] leading-[1.75] whitespace-pre-line text-ink-muted">
        {pub.abstract || "No abstract is available for this record. Open the original to read it."}
      </p>
    </section>
  );
}

function LibraryPanel({ id }: { id: string }) {
  const { savedIds, recordFeedback } = useSignal();
  const lib = useLibraryEntry(id);
  const saved = savedIds.includes(id);
  const [draft, setDraft] = useState<string | null>(null);
  const notes = draft ?? lib.notes;

  return (
    <Panel title="My Library">
      <Button active={saved} onClick={() => recordFeedback(id, "save")} className="w-full">
        <Icon name="bookmark" size={15} />
        {saved ? "Saved to My Library" : "Save to My Library"}
      </Button>
      {lib.ready ? (
        <>
          <label className="mt-3 block text-[12px] font-medium text-ink-muted">
            Reading status
            <select
              value={lib.status ?? ""}
              onChange={(e) => lib.setStatus((e.target.value || null) as ReadingStatus | null)}
              className="mt-1 w-full rounded-lg border border-line-strong bg-white px-2.5 py-1.5 text-[13px] text-ink"
            >
              <option value="">No status</option>
              {(Object.keys(READING_LABEL) as ReadingStatus[]).map((s) => (
                <option key={s} value={s}>
                  {READING_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-3 block text-[12px] font-medium text-ink-muted">
            My notes
            <textarea
              value={notes}
              onChange={(e) => setDraft(e.target.value)}
              rows={5}
              placeholder="What did you take away? What do you want to ask your PI?"
              className="mt-1 w-full resize-y rounded-lg border border-line-strong bg-white px-2.5 py-2 text-[13px] leading-relaxed text-ink outline-none focus:border-accent"
            />
          </label>
          <div className="mt-1.5 flex items-center gap-2">
            <Button
              size="sm"
              variant="primary"
              disabled={draft === null || draft === lib.notes || lib.pending}
              onClick={() => {
                lib.setNotes(notes);
                setDraft(null);
              }}
            >
              Save notes
            </Button>
            {lib.pending && <span className="text-[11.5px] text-ink-faint">Saving…</span>}
          </div>
        </>
      ) : (
        <p className="mt-3 text-[11.5px] leading-relaxed text-ink-faint">
          Reading status and notes become available once the latest database update (migration 0004) has been applied.
        </p>
      )}
      {lib.error && <p className="mt-2 text-[11.5px] text-negative">{lib.error}</p>}
    </Panel>
  );
}

function WhyRecommended({ item }: { item: Development }) {
  const { recordFeedback, dismissedIds } = useSignal();
  const dismissed = dismissedIds.includes(item.publication.id);
  return (
    <Panel title="Why you're seeing this">
      <p className="text-[12.5px] leading-relaxed text-ink-muted">
        {item.explanations.find((e) => e.dimension === "researchRelevance")?.reasons[0]}
      </p>
      {item.matchedInterests.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1">
          {item.matchedInterests.map((m) => (
            <Chip key={m} tone="accent">
              {m}
            </Chip>
          ))}
        </div>
      )}
      <p className="mt-3 text-[12px] font-medium text-ink">Was this useful?</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        <Button size="sm" onClick={() => recordFeedback(item.publication.id, "important")}>
          More like this
        </Button>
        <Button size="sm" variant="danger" active={dismissed} onClick={() => recordFeedback(item.publication.id, "not_relevant")}>
          {dismissed ? "Marked not relevant" : "Not relevant"}
        </Button>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">
        Your feedback re-orders future recommendations. &ldquo;Not relevant&rdquo; also hides this paper.
      </p>
      <details className="mt-3 border-t border-line pt-2.5">
        <summary className="cursor-pointer text-[12px] font-medium text-ink-muted">How this was ranked</summary>
        <p className="mt-2 text-[11.5px] leading-relaxed text-ink-faint">{buildRankingRationale(item)}</p>
        <div className="mt-2 space-y-2">
          {item.explanations.map((e) => (
            <div key={e.dimension}>
              <ScoreBar value={e.score} label={e.label} />
              <p className="mt-0.5 text-[10.5px] leading-snug text-ink-faint">{e.reasons[0]}</p>
            </div>
          ))}
        </div>
      </details>
    </Panel>
  );
}

export function PaperDetail({
  id,
  fallback,
  publication,
}: {
  id: string;
  /** The stored assessment, when it is outside the app's loaded window. */
  fallback: EvaluatedItem | null;
  /** A stored paper PaperPuffin has not assessed yet (saved from search). */
  publication: Publication | null;
}) {
  const { getItem, topicById, weights, student } = useSignal();
  const router = useRouter();
  const item =
    getItem(id) ??
    (fallback ? toDevelopment(fallback, fallback.topicId ? topicById.get(fallback.topicId) : undefined, weights) : undefined);
  const pub = item?.publication ?? publication;
  const [explaining, setExplaining] = useState(false);
  const [explainError, setExplainError] = useState<string | null>(null);

  useEffect(() => {
    if (pub) void markViewedAction(pub.id);
  }, [pub?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!pub) {
    return (
      <div className="px-6 py-16 lg:px-10">
        <EmptyState
          title="Paper not found"
          body="PaperPuffin doesn't have this paper. Try finding it with Discover's search."
          action={
            <Link href="/discover?tab=search" className="text-[13px] font-semibold text-accent hover:underline">
              Search the literature →
            </Link>
          }
        />
      </div>
    );
  }

  const topic = item?.topicId ? topicById.get(item.topicId) : undefined;

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
      <button type="button" onClick={() => router.back()} className="text-[12.5px] font-medium text-ink-muted hover:text-accent">
        ← Back
      </button>

      <div className="mt-4 grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <Meta pub={pub} />

          {item ? (
            <>
              <div className="mt-4 flex flex-wrap items-center gap-1.5">
                <Chip tone="accent">{item.topicName ?? "Removed topic"}</Chip>
                <RelevanceBadge cls={item.relevance} score={item.scores.researchRelevance} />
                <SignificanceBadge level={item.significance.level} inferred={item.significance.inferred} />
              </div>
              {!item.isDevelopment && topic && (
                <p className="mt-2 text-[12px] text-ink-faint">
                  Below the bar for &ldquo;{topic.profile.program}&rdquo; (relevance {RELEVANCE_THRESHOLD[topic.sensitivity]}+), so it
                  isn&rsquo;t in your recommendations.
                </p>
              )}

              <div className="mt-5 rounded-2xl border border-accent/25 bg-accent-soft/60 px-5 py-4">
                <p className="flex flex-wrap items-center gap-2 text-[12px] font-semibold text-accent">
                  Why this matters to your research <ProvenanceTag kind="ai" />
                </p>
                <p className="mt-1.5 text-[15px] leading-relaxed text-ink">{item.whyThisMatters}</p>
                {item.nextSteps.length > 0 && (
                  <>
                    <p className="mt-3 text-[12px] font-semibold text-ink-muted">Reading suggestions</p>
                    <ul className="mt-1 space-y-1 text-[13.5px] leading-relaxed text-ink">
                      {item.nextSteps.map((n) => (
                        <li key={n} className="flex gap-2">
                          <span aria-hidden className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent/50" />
                          {n}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                <p className="mt-3 text-[11px] text-ink-faint">
                  Read by PaperPuffin <LocalTime iso={item.evaluatedAt} />, from the title and abstract.
                </p>
              </div>

              <div className="mt-8">
                <StudyGuide
                  publicationId={pub.id}
                  cached={item.guides}
                  defaultLevel={defaultExplanationLevel(student)}
                />
              </div>

              {(pub.authorsReport?.length || item.implications.length) ? (
                <section className="mt-8 rounded-2xl border border-line bg-surface px-5 py-4">
                  <h2 className="text-[15px] font-semibold text-ink">What the authors claim vs. what PaperPuffin infers</h2>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div className="rounded-xl bg-sea-soft/60 p-3.5">
                      <ProvenanceTag kind="paper" />
                      <ul className="mt-2 space-y-2 text-[13px] leading-relaxed text-ink">
                        {(pub.authorsReport ?? []).map((c) => (
                          <li key={c}>{c}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-xl border border-dashed border-accent/35 bg-accent-soft/40 p-3.5">
                      <ProvenanceTag kind="ai" />
                      <ul className="mt-2 space-y-2 text-[13px] leading-relaxed text-ink-muted">
                        {item.implications.map((c) => (
                          <li key={c}>{c}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </section>
              ) : null}
            </>
          ) : (
            <div className="mt-6 rounded-2xl border border-accent/25 bg-accent-soft/50 px-5 py-5">
              <p className="text-[14px] font-semibold text-ink">PaperPuffin hasn&rsquo;t read this paper yet.</p>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
                Ask it to explain how this paper relates to your research, with a study guide at your level.
              </p>
              <Button
                variant="primary"
                className="mt-3"
                disabled={explaining}
                onClick={async () => {
                  setExplaining(true);
                  setExplainError(null);
                  const r = await explainPaperAction({ id: pub.id, doi: pub.doi });
                  if (r.ok) router.refresh();
                  else setExplainError(r.error);
                  setExplaining(false);
                }}
              >
                <Icon name="sparkle" size={15} />
                {explaining ? "Reading the paper…" : "Explain for my research"}
              </Button>
              {explainError && <p className="mt-2 text-[12.5px] text-negative">{explainError}</p>}
            </div>
          )}

          <div className="mt-8">
            <Abstract pub={pub} />
          </div>
          <p className="mt-3 text-[11.5px] text-ink-faint">
            Record from {ORIGIN_LABEL[pub.origin]}. PaperPuffin shows the abstract only; the full text is at the original source
            and may need institutional access.
          </p>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <LibraryPanel id={pub.id} />
          {item && <WhyRecommended item={item} />}
        </aside>
      </div>
    </div>
  );
}
