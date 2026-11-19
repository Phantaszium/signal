"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PuffinLoader } from "@/components/brand/Puffin";
import { Button, ProvenanceTag, cx } from "@/components/ui/primitives";
import { generateGuideAction } from "@/lib/papers/actions";
import { EXPLANATION_LEVELS } from "@/lib/profile/student";
import type { ExplanationLevel, PaperGuide } from "@/lib/types";

function Section({
  n,
  title,
  kind,
  children,
}: {
  n: number;
  title: string;
  kind: "paper" | "ai" | "mixed";
  children: React.ReactNode;
}) {
  return (
    <section className={cx("rounded-2xl border px-5 py-4", kind === "ai" ? "border-dashed border-accent/35 bg-accent-soft/30" : "border-line bg-surface")}>
      <h3 className="flex flex-wrap items-center gap-2">
        <span className="tabular flex h-6 w-6 items-center justify-center rounded-full bg-canvas-deep text-[12px] font-semibold text-ink-muted">{n}</span>
        <span className="text-[15px] font-semibold text-ink">{title}</span>
        <ProvenanceTag kind={kind} />
      </h3>
      <div className="mt-2 text-[14px] leading-[1.7] text-ink">{children}</div>
    </section>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5">
      {items.map((t) => (
        <li key={t} className="flex gap-2.5">
          <span aria-hidden className="mt-[10px] h-1.5 w-1.5 shrink-0 rounded-full bg-line-strong" />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * The paper-understanding guide: seven sections at a chosen explanation
 * level. Sections restating the paper are labelled "From the paper"; the
 * relevance and learning sections are labelled as AI interpretation.
 */
export function StudyGuide({
  publicationId,
  cached,
  defaultLevel,
}: {
  publicationId: string;
  cached: Partial<Record<ExplanationLevel, PaperGuide>>;
  defaultLevel: ExplanationLevel;
}) {
  const [level, setLevel] = useState<ExplanationLevel>(defaultLevel);
  const [guides, setGuides] = useState(cached);
  const [loading, setLoading] = useState<ExplanationLevel | null>(cached[defaultLevel] ? null : defaultLevel);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(new Set<ExplanationLevel>());

  // State only changes after the request returns, so this is safe to start from an effect.
  const fetchGuide = useCallback(
    async (l: ExplanationLevel) => {
      if (started.current.has(l)) return;
      started.current.add(l);
      const result = await generateGuideAction(publicationId, l);
      if (result.ok) setGuides((g) => ({ ...g, [l]: result.value }));
      else {
        setError(result.error);
        started.current.delete(l);
      }
      setLoading((cur) => (cur === l ? null : cur));
    },
    [publicationId],
  );

  const load = (l: ExplanationLevel) => {
    setLoading(l);
    setError(null);
    void fetchGuide(l);
  };

  // The default level is written as soon as the paper is opened.
  useEffect(() => {
    if (cached[defaultLevel] || started.current.has(defaultLevel)) return;
    started.current.add(defaultLevel);
    generateGuideAction(publicationId, defaultLevel).then((result) => {
      if (result.ok) setGuides((g) => ({ ...g, [defaultLevel]: result.value }));
      else {
        setError(result.error);
        started.current.delete(defaultLevel);
      }
      setLoading((cur) => (cur === defaultLevel ? null : cur));
    });
  }, [cached, defaultLevel, publicationId]);

  const guide = guides[level];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-[21px] font-semibold text-ink">Understand this paper</h2>
          <p className="mt-0.5 text-[12.5px] text-ink-muted">Choose how deep the explanation goes.</p>
        </div>
        <div role="radiogroup" aria-label="Explanation level" className="inline-flex rounded-xl border border-line bg-surface p-1">
          {EXPLANATION_LEVELS.map((l) => (
            <button
              key={l.value}
              type="button"
              role="radio"
              aria-checked={level === l.value}
              title={l.detail}
              onClick={() => {
                setLevel(l.value);
                if (!guides[l.value]) load(l.value);
              }}
              className={cx(
                "rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors",
                level === l.value ? "bg-accent text-white" : "text-ink-muted hover:text-ink",
              )}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        {guide ? (
          <div className="space-y-3">
            <Section n={1} title="Quick summary" kind="paper">
              <p>{guide.quickSummary}</p>
            </Section>
            <Section n={2} title="Research question" kind="paper">
              <p>{guide.researchQuestion}</p>
            </Section>
            <Section n={3} title="Methods" kind="paper">
              <List items={guide.methods} />
            </Section>
            <Section n={4} title="Key findings" kind="paper">
              <List items={guide.keyFindings} />
            </Section>
            <Section n={5} title="Limitations" kind="mixed">
              <ul className="space-y-2">
                {guide.limitations.map((l) => (
                  <li key={l.text} className="flex flex-wrap items-baseline gap-2">
                    <span className="flex-1">{l.text}</span>
                    <span
                      className={cx(
                        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        l.source === "authors" ? "bg-sea-soft text-sea" : "bg-accent-soft text-accent",
                      )}
                    >
                      {l.source === "authors" ? "Stated by the authors" : "AI critique"}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
            <Section n={6} title="Why it matters to your research" kind="ai">
              <p>{guide.whyItMatters}</p>
            </Section>
            <Section n={7} title="Concepts to understand" kind="ai">
              <dl className="space-y-2.5">
                {guide.concepts.map((c) => (
                  <div key={c.term}>
                    <dt className="font-semibold text-ink">{c.term}</dt>
                    <dd className="text-[13.5px] text-ink-muted">{c.explanation}</dd>
                  </div>
                ))}
              </dl>
            </Section>
            {guide.openQuestions.length > 0 && (
              <section className="rounded-2xl border border-line bg-canvas-deep/50 px-5 py-4">
                <h3 className="flex flex-wrap items-center gap-2 text-[14px] font-semibold text-ink">
                  Check in the full text <ProvenanceTag kind="ai" />
                </h3>
                <p className="mt-1 text-[12.5px] text-ink-muted">The abstract doesn&rsquo;t answer these. Look for them when you read the paper.</p>
                <div className="mt-2 text-[13.5px] leading-relaxed text-ink">
                  <List items={guide.openQuestions} />
                </div>
              </section>
            )}
            <p className="text-[11.5px] leading-relaxed text-ink-faint">
              Written by AI from the title and abstract only, not the full text. &ldquo;From the paper&rdquo; sections restate
              what the abstract reports; check the original before relying on a detail.
            </p>
          </div>
        ) : loading === level ? (
          <PuffinLoader message="Writing your study guide… this takes about half a minute." />
        ) : (
          <div className="rounded-2xl border border-line bg-surface px-5 py-6 text-center">
            {error && <p className="mb-3 text-[13px] text-negative">{error}</p>}
            <Button variant="primary" onClick={() => load(level)}>
              Write the {level} guide
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
