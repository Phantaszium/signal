"use client";

import Link from "next/link";
import { Chip, LinkButton, Panel, cx, timeAgo } from "@/components/ui/primitives";
import { SENSITIVITY_LABEL } from "@/lib/developments";
import { SOURCE_LABEL } from "@/lib/monitoring/diagnosis";
import { topicStatus } from "@/lib/monitoring/status";
import { changedPreferences } from "@/lib/preferences/model";
import { useSignal } from "@/lib/store/SignalProvider";

const DAY = 86_400_000;

export function TopicList() {
  const { topics, runs, developments, learned, weights, feedbackCount, now } = useSignal();
  const moved = new Set(changedPreferences(weights));

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
      <header className="flex max-w-6xl flex-wrap items-end justify-between gap-3">
        <div className="max-w-2xl">
          <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-ink">Monitored topics</h1>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
            Each topic is one research question Signal watches for you. Every source is searched with
            each topic&rsquo;s terms, and every record is judged against the topic&rsquo;s question.
          </p>
        </div>
        <LinkButton href="/topics/new" variant="primary">
          + New topic
        </LinkButton>
      </header>

      <div className="mt-6 grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <ul className="space-y-3">
          {topics.map((topic) => {
            const status = topicStatus(topic.id, runs);
            const recent = developments.filter(
              (d) => d.topicId === topic.id && now - Date.parse(d.evaluatedAt) < 30 * DAY,
            ).length;
            const terms = [...topic.profile.keywords, ...topic.profile.synonyms, ...topic.profile.organisms];
            return (
              <li key={topic.id} className={cx("rounded-md border border-line bg-surface px-4 py-3.5", !topic.active && "opacity-70")}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <Link href={`/topics/${topic.id}`} className="text-[15px] font-semibold text-ink hover:text-accent">
                    {topic.profile.program}
                  </Link>
                  <span className="text-[11px] text-ink-faint">
                    {topic.active ? (topic.lastCheckedAt ? `Checked ${timeAgo(topic.lastCheckedAt, now)}` : "Not checked yet") : "Paused"}
                  </span>
                </div>
                {topic.profile.description && (
                  <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-ink-muted">{topic.profile.description}</p>
                )}
                <div className="mt-2 flex flex-wrap gap-1">
                  {terms.slice(0, 8).map((t) => (
                    <Chip key={t}>{t}</Chip>
                  ))}
                  {terms.length > 8 && <Chip tone="quiet">+{terms.length - 8}</Chip>}
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-line pt-2.5 text-[11px] sm:grid-cols-4">
                  <div>
                    <dt className="text-ink-faint">Developments (30 days)</dt>
                    <dd className="tabular font-medium text-ink">{recent}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-faint">Sensitivity</dt>
                    <dd className="font-medium text-ink">{SENSITIVITY_LABEL[topic.sensitivity].label}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-ink-faint">Sources</dt>
                    <dd className="text-ink">{topic.sources.map((s) => SOURCE_LABEL[s]).join(", ")}</dd>
                  </div>
                </dl>
                {topic.active && status.diagnosis && (
                  <p className="mt-2 text-[11px] text-ink-muted">
                    Latest check: {status.diagnosis.headline}
                  </p>
                )}
              </li>
            );
          })}
        </ul>

        <aside className="space-y-4">
          <Panel title="What Signal has learned">
            <ul className="space-y-3">
              {learned.map((pref) => (
                <li key={pref.id}>
                  <p className="text-[12px] leading-snug text-ink">&ldquo;{pref.statement}&rdquo;</p>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-line">
                      <div
                        className={cx(
                          "h-full rounded-full transition-all duration-500",
                          moved.has(pref.key) ? "bg-high" : "bg-accent",
                        )}
                        style={{ width: `${Math.round(pref.confidence * 100)}%` }}
                      />
                    </div>
                    <span className="tabular text-[10px] text-ink-faint">{Math.round(pref.confidence * 100)}%</span>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[10.5px] leading-relaxed text-ink-faint">
              Learned across all your topics from what you save, dismiss and read; it orders
              developments but never decides what counts as one. Everyone starts at 50%.{" "}
              {feedbackCount} interaction{feedbackCount === 1 ? "" : "s"} so far.
            </p>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
