"use client";

import Link from "next/link";
import { useSignal } from "@/lib/store/SignalProvider";
import { buildRankingRationale } from "@/lib/ranking/explain";
import { DIMENSION_WEIGHTS } from "@/lib/ranking/scoring";
import {
  Button,
  Chip,
  Panel,
  ScoreBar,
  SignalScoreBlock,
  TypeChip,
  cx,
  formatDate,
} from "@/components/ui/primitives";
import type { ScoreBreakdown } from "@/lib/types";

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line pt-5">
      <h2 className="eyebrow text-[10px] font-semibold text-ink-muted">{title}</h2>
      <div className="mt-2.5">{children}</div>
    </section>
  );
}

export function PaperDetail({ id }: { id: string }) {
  const { getScored, savedIds, dismissedIds, recordFeedback, profile } = useSignal();
  const item = getScored(id);

  if (!item) {
    return (
      <div className="px-6 py-16 text-center lg:px-10">
        <p className="text-[15px] font-medium text-ink">Publication not found</p>
        <p className="mt-1 text-[13px] text-ink-muted">
          This item is not in the current corpus. It may have come from a live
          search in a previous session.
        </p>
        <Link
          href="/"
          className="mt-4 inline-block text-[13px] font-medium text-accent hover:underline"
        >
          ← Back to Today&rsquo;s Briefing
        </Link>
      </div>
    );
  }

  const { publication: pub } = item;
  const saved = savedIds.includes(pub.id);
  const dismissed = dismissedIds.includes(pub.id);
  const isHigh = item.tier === "HIGH";

  return (
    <div className="px-6 py-7 lg:px-10 lg:py-9">
      <Link href="/" className="text-[12px] font-medium text-ink-muted hover:text-accent">
        ← Today&rsquo;s Briefing
      </Link>

      <div className="mt-4 grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-ink-faint">
            <TypeChip type={pub.type} />
            <span className="font-medium text-ink-muted">{pub.source}</span>
            <span aria-hidden>·</span>
            <time dateTime={pub.publishedAt}>{formatDate(pub.publishedAt)}</time>
            {pub.origin === "seed" ? (
              <Chip tone="quiet" title="Fictional record created for this demo">
                Demo record
              </Chip>
            ) : (
              <Chip tone="accent">PubMed</Chip>
            )}
            <span
              className={cx(
                "eyebrow ml-1 text-[10px] font-semibold",
                isHigh ? "text-high" : "text-ink-muted",
              )}
            >
              {item.tier}
            </span>
          </div>

          <h1 className="mt-2 text-[24px] leading-[1.25] font-semibold tracking-[-0.02em] text-ink">
            {pub.title}
          </h1>

          <p className="mt-2 text-[13px] text-ink-muted">{pub.authors.join(", ")}</p>

          <p className="mt-1 font-mono text-[11px] text-ink-faint">
            {pub.doi ? `DOI ${pub.doi}` : null}
            {pub.doi && pub.url ? " · " : null}
            {pub.url ? (
              <a
                href={pub.url}
                target="_blank"
                rel="noreferrer"
                className="text-accent hover:underline"
              >
                View source
              </a>
            ) : null}
          </p>

          {pub.origin === "seed" && (
            <p className="mt-3 rounded border border-line bg-canvas px-3 py-2 text-[11px] leading-relaxed text-ink-faint">
              This is a <strong className="font-medium">fictional demo record</strong>.
              Authors, findings, identifiers and any organisation attribution are
              invented for demonstration and should not be cited or attributed to any
              real publication or company.
            </p>
          )}

          <div
            className={cx(
              "mt-5 rounded border-l-2 px-3 py-2.5",
              isHigh ? "border-l-high bg-high-soft" : "border-l-accent/40 bg-accent-soft/50",
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
            <p className="mt-1 text-[14px] leading-relaxed text-ink">
              {item.whyThisMatters}
            </p>
          </div>

          <div className="mt-6 space-y-5">
            <Block title="Abstract">
              <p className="text-[13.5px] leading-[1.7] text-ink-muted">{pub.abstract}</p>
            </Block>

            {pub.keyFindings?.length ? (
              <Block title="Key findings">
                <ol className="space-y-2">
                  {pub.keyFindings.map((f, i) => (
                    <li key={f} className="flex gap-3 text-[13.5px] leading-relaxed text-ink">
                      <span className="tabular mt-0.5 shrink-0 text-[11px] font-medium text-ink-faint">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ol>
              </Block>
            ) : null}

            {(pub.studyDesign || pub.modelSystem) && (
              <Block title="Study design & system">
                <dl className="grid gap-4 sm:grid-cols-2">
                  {pub.studyDesign && (
                    <div>
                      <dt className="text-[10px] font-medium text-ink-faint">Study design</dt>
                      <dd className="mt-1 text-[13px] leading-relaxed text-ink-muted">
                        {pub.studyDesign}
                      </dd>
                    </div>
                  )}
                  {pub.modelSystem && (
                    <div>
                      <dt className="text-[10px] font-medium text-ink-faint">
                        Model / system used
                      </dt>
                      <dd className="mt-1 text-[13px] leading-relaxed text-ink-muted">
                        {pub.modelSystem}
                      </dd>
                    </div>
                  )}
                </dl>
              </Block>
            )}

            {pub.limitations?.length ? (
              <Block title="Major limitations">
                <ul className="space-y-1.5">
                  {pub.limitations.map((l) => (
                    <li key={l} className="flex gap-2.5 text-[13px] leading-relaxed text-ink-muted">
                      <span
                        aria-hidden
                        className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-line-strong"
                      />
                      <span>{l}</span>
                    </li>
                  ))}
                </ul>
              </Block>
            ) : null}

            {(pub.authorsReport?.length || pub.signalInterpretation?.length) && (
              <Block title="Evidence">
                <p className="mb-3 text-[11px] leading-relaxed text-ink-faint">
                  Signal keeps the authors&rsquo; claims and its own reading of them
                  apart. Anything in the right-hand column is Signal&rsquo;s inference,
                  not a statement by the authors.
                </p>
                <div className="grid gap-0 overflow-hidden rounded border border-line md:grid-cols-2">
                  <div className="border-b border-line p-3.5 md:border-r md:border-b-0">
                    <h3 className="eyebrow text-[9px] font-semibold text-ink-muted">
                      What the authors report
                    </h3>
                    <ul className="mt-2 space-y-2">
                      {(pub.authorsReport ?? []).map((c) => (
                        <li key={c} className="text-[13px] leading-relaxed text-ink">
                          {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-accent-soft/40 p-3.5">
                    <h3 className="eyebrow text-[9px] font-semibold text-accent">
                      Signal&rsquo;s interpretation
                    </h3>
                    <ul className="mt-2 space-y-2">
                      {(pub.signalInterpretation ?? []).map((c) => (
                        <li key={c} className="text-[13px] leading-relaxed text-ink-muted">
                          {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Block>
            )}
          </div>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <Panel title="Why Signal ranked this">
            <div className="flex items-start gap-3">
              <SignalScoreBlock score={item.signalScore} emphasis={isHigh} />
              <p className="text-[12px] leading-relaxed text-ink-muted">
                {buildRankingRationale(item)}
              </p>
            </div>

            <div className="mt-4 space-y-3">
              {item.explanations.map((e) => (
                <div key={e.dimension}>
                  <ScoreBar value={e.score} label={e.label} emphasis={isHigh && e.score >= 80} />
                  <p className="mt-1 text-[10.5px] leading-snug text-ink-faint">
                    {e.reasons[0]}
                  </p>
                </div>
              ))}
            </div>

            <p className="mt-3 border-t border-line pt-2.5 text-[10px] leading-snug text-ink-faint">
              Weights:{" "}
              {(Object.keys(DIMENSION_WEIGHTS) as (keyof ScoreBreakdown)[])
                .map((k) => `${Math.round(DIMENSION_WEIGHTS[k] * 100)}%`)
                .join(" / ")}{" "}
              in the order shown.
            </p>
          </Panel>

          <Panel title="Relationship to your interests">
            {item.matchedInterests.length ? (
              <div className="flex flex-wrap gap-1">
                {item.matchedInterests.map((m) => (
                  <Chip key={m} tone="accent">
                    {m}
                  </Chip>
                ))}
              </div>
            ) : (
              <p className="text-[12px] text-ink-faint">
                No direct term match with your profile.
              </p>
            )}

            {item.matchedOrganizations.length > 0 && (
              <div className="mt-3">
                <p className="text-[10px] font-medium text-ink-faint">
                  Tracked organizations
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {item.matchedOrganizations.map((o) => (
                    <Chip key={o} tone="warn">
                      {o}
                    </Chip>
                  ))}
                </div>
              </div>
            )}

            <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">
              Matched against your {profile.program} profile.
            </p>
          </Panel>

          <Panel title="Feedback">
            <div className="flex flex-wrap gap-1.5">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => recordFeedback(pub.id, "important")}
              >
                Important
              </Button>
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
            <p className="mt-2.5 text-[11px] leading-relaxed text-ink-faint">
              Feedback updates the preference model in the sidebar and re-ranks
              tomorrow&rsquo;s briefing.
            </p>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
