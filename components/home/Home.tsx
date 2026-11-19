"use client";

import Link from "next/link";
import { EmptyState, Puffin } from "@/components/brand/Puffin";
import { CheckNow } from "@/components/monitoring/CheckNow";
import { MonitoringStatus } from "@/components/monitoring/MonitoringStatus";
import { PaperCard, paperHref } from "@/components/papers/PaperCard";
import { READING_LABEL } from "@/components/papers/useLibrary";
import { Icon } from "@/components/ui/Icon";
import { Panel, authorLine, cx, timeAgo } from "@/components/ui/primitives";
import { byPriority, type Development } from "@/lib/developments";
import { topicStatus } from "@/lib/monitoring/status";
import { profileCompleteness } from "@/lib/profile/student";
import { useSignal } from "@/lib/store/SignalProvider";

const DAY = 86_400_000;
const RECOMMENDED_DAYS = 14;
const RECOMMENDED_MAX = 5;

const EMPTY = {
  never: {
    title: "Your first search hasn't run yet",
    body: "PaperPuffin searches for new papers every morning. Press Find new papers to run the first search now — it looks back over the last 30 days.",
    mood: "curious",
  },
  pending: {
    title: "PaperPuffin is reading new papers",
    body: "Recommendations appear here as soon as the current search finishes.",
    mood: "reading",
  },
  problem: {
    title: "Some sources couldn't be searched",
    body: "Nothing to recommend from what PaperPuffin could reach, but that isn't the same as nothing being published. Update status below shows which topics were affected.",
    mood: "curious",
  },
  quiet: {
    title: "A quiet couple of weeks",
    body: "PaperPuffin searched your topics and nothing new cleared the bar. It won't pad your feed with weak matches. Try Discover to search the literature yourself, or broaden a topic in My Research.",
    mood: "sleepy",
  },
} as const;

export function Home() {
  const { developments, activeTopics, topics, runs, now, student, savedIds, library, allItems, unassessed } = useSignal();

  const week = developments.filter((d) => now - Date.parse(d.evaluatedAt) < 7 * DAY);
  const recommended = developments
    .filter((d) => now - Date.parse(d.evaluatedAt) < RECOMMENDED_DAYS * DAY)
    .sort(byPriority)
    .slice(0, RECOMMENDED_MAX);

  const states = activeTopics.map((t) => topicStatus(t.id, runs).diagnosis?.state ?? null);
  const emptyKind =
    states.length === 0 || states.every((s) => s === null)
      ? "never"
      : states.some((s) => s === "pending")
        ? "pending"
        : states.some((s) => s === "failed" || s === "incomplete")
          ? "problem"
          : "quiet";

  // Continue reading: saved papers not finished, then recently opened ones.
  const byId = new Map(allItems.map((d) => [d.publication.id, d]));
  const continueIds = [
    ...savedIds.filter((id) => library.get(id)?.readingStatus !== "read").reverse(),
    ...[...library.values()]
      .filter((e) => e.viewedAt)
      .sort((a, b) => Date.parse(b.viewedAt!) - Date.parse(a.viewedAt!))
      .map((e) => e.publicationId),
  ].filter((id, i, all) => all.indexOf(id) === i);
  const continueReading = continueIds
    .map((id) => {
      const d = byId.get(id);
      const pub = d?.publication ?? unassessed.find((p) => p.id === id);
      return pub ? { pub, item: d } : null;
    })
    .filter((x) => x !== null)
    .slice(0, 5);

  const completeness = profileCompleteness(student);
  const topThree = [...week].sort(byPriority).slice(0, 3);

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
      <header className="flex max-w-6xl flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <Puffin size={52} mood={week.length ? "reading" : "default"} className="hidden sm:block" />
          <div>
            <h1 className="font-display text-[26px] leading-tight font-semibold text-ink sm:text-[30px]">Welcome back</h1>
            <p className="mt-1 text-[14px] text-ink-muted">
              {week.length
                ? `${week.length} new paper${week.length === 1 ? "" : "s"} for your research this week.`
                : "No new recommendations this week yet."}
            </p>
          </div>
        </div>
        <CheckNow />
      </header>

      {completeness.done < completeness.total && (
        <div className="mt-5 flex max-w-6xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-high-line bg-high-soft px-5 py-3">
          <p className="text-[13px] text-ink">
            <strong className="font-semibold">Help PaperPuffin understand your project.</strong>{" "}
            <span className="text-ink-muted">Adding your {completeness.missing.slice(0, 2).join(" and ")} sharpens recommendations and explanations.</span>
          </p>
          <Link href="/research" className="text-[13px] font-semibold text-high hover:underline">
            Complete your profile →
          </Link>
        </div>
      )}

      <div className="mt-7 grid max-w-6xl gap-7 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section aria-labelledby="recommended" className="min-w-0">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="recommended" className="font-display text-[20px] font-semibold text-ink">
              Recommended papers
            </h2>
            <Link href="/discover" className="text-[12.5px] font-medium text-accent hover:underline">
              See all in Discover →
            </Link>
          </div>
          <p className="mt-0.5 text-[12.5px] text-ink-faint">
            Found in the last {RECOMMENDED_DAYS} days · most important first
          </p>
          <div className="mt-3 space-y-3">
            {recommended.length ? (
              recommended.map((d) => <PaperCard key={d.publication.id} item={d} />)
            ) : (
              <EmptyState
                title={EMPTY[emptyKind].title}
                body={EMPTY[emptyKind].body}
                mood={EMPTY[emptyKind].mood}
                action={
                  <Link href="/discover" className="text-[13px] font-semibold text-accent hover:underline">
                    Search the literature →
                  </Link>
                }
              />
            )}
          </div>
        </section>

        <aside className="min-w-0 space-y-5">
          <Panel
            title="Your weekly briefing"
            action={
              <Link href="/briefings" className="text-[12px] font-medium text-accent hover:underline">
                Open
              </Link>
            }
          >
            {week.length ? (
              <>
                <p className="text-[13px] leading-relaxed text-ink-muted">
                  {week.length} new paper{week.length === 1 ? "" : "s"} across{" "}
                  {new Set(week.map((d) => d.topicName).filter(Boolean)).size} of your topics. Start with:
                </p>
                <ol className="mt-3 space-y-3">
                  {topThree.map((d, i) => (
                    <BriefingLine key={d.publication.id} item={d} n={i + 1} />
                  ))}
                </ol>
              </>
            ) : (
              <p className="text-[13px] leading-relaxed text-ink-muted">
                Nothing new this week yet. Your briefing fills in as PaperPuffin finds papers for your topics.
              </p>
            )}
          </Panel>

          <Panel
            title="My research topics"
            action={
              <Link href="/topics/new" className="text-[12px] font-medium text-accent hover:underline">
                + Add
              </Link>
            }
          >
            <ul className="space-y-3">
              {topics.map((t) => {
                const recent = developments.filter((d) => d.topicId === t.id && now - Date.parse(d.evaluatedAt) < 30 * DAY).length;
                return (
                  <li key={t.id}>
                    <div className="flex items-baseline justify-between gap-2">
                      <Link href={`/topics/${t.id}`} className={cx("text-[13.5px] font-semibold hover:text-accent", t.active ? "text-ink" : "text-ink-faint")}>
                        {t.profile.program}
                      </Link>
                      <span className="tabular shrink-0 text-[11px] text-ink-faint">
                        {t.active ? `${recent} this month` : "Paused"}
                      </span>
                    </div>
                    {t.profile.description && (
                      <p className="mt-0.5 line-clamp-2 text-[12px] leading-relaxed text-ink-muted">{t.profile.description}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          </Panel>

          <Panel
            title="Continue reading"
            action={
              <Link href="/library" className="text-[12px] font-medium text-accent hover:underline">
                My Library
              </Link>
            }
          >
            {continueReading.length ? (
              <ul className="divide-y divide-line">
                {continueReading.map(({ pub }) => {
                  const entry = library.get(pub.id);
                  return (
                    <li key={pub.id} className="py-2.5 first:pt-0 last:pb-0">
                      <Link href={paperHref(pub.id)} className="line-clamp-2 text-[13px] leading-snug font-medium text-ink hover:text-accent">
                        {pub.title}
                      </Link>
                      <p className="mt-0.5 text-[11.5px] text-ink-faint">
                        {authorLine(pub.authors, 1)}
                        {entry?.readingStatus ? ` · ${READING_LABEL[entry.readingStatus]}` : ""}
                        {entry?.viewedAt ? ` · opened ${timeAgo(entry.viewedAt, now)}` : ""}
                      </p>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="flex items-start gap-2 text-[13px] leading-relaxed text-ink-muted">
                <Icon name="bookmark" size={16} className="mt-0.5 shrink-0 text-ink-faint" />
                Save papers you want to come back to and they&rsquo;ll wait for you here.
              </p>
            )}
          </Panel>

          <MonitoringStatus />
        </aside>
      </div>
    </div>
  );
}

function BriefingLine({ item, n }: { item: Development; n: number }) {
  return (
    <li className="flex gap-2.5">
      <span className="tabular mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent">
        {n}
      </span>
      <div className="min-w-0">
        <Link href={paperHref(item.publication.id)} className="line-clamp-2 text-[13px] leading-snug font-medium text-ink hover:text-accent">
          {item.publication.title}
        </Link>
        <p className="mt-0.5 line-clamp-2 text-[12px] leading-relaxed text-ink-muted">{item.whyThisMatters}</p>
      </div>
    </li>
  );
}
