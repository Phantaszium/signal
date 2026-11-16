"use client";

import Link from "next/link";
import { useSignal } from "@/lib/store/SignalProvider";
import { PaperCard } from "@/components/briefing/PaperCard";
import { Button, Panel, formatDate } from "@/components/ui/primitives";

export function SavedList() {
  const { savedItems, dismissedIds, allItems, recordFeedback, feedbackCount } = useSignal();
  const dismissed = allItems.filter((s) => dismissedIds.includes(s.publication.id));

  return (
    <div className="px-6 py-7 lg:px-10 lg:py-9">
      <header className="max-w-3xl">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-ink">Saved</h1>
        <p className="mt-1 text-[13px] text-ink-muted">
          {savedItems.length === 0
            ? "Nothing saved yet. Use Save on any card in the briefing."
            : `${savedItems.length} item${savedItems.length === 1 ? "" : "s"} saved for follow-up.`}
        </p>
      </header>

      <div className="mt-6 max-w-4xl space-y-3">
        {savedItems.map((item) => (
          <PaperCard key={item.publication.id} item={item} />
        ))}

        {savedItems.length === 0 && (
          <div className="rounded-md border border-dashed border-line px-6 py-10 text-center">
            <p className="text-[13px] text-ink-muted">No saved items.</p>
            <Link
              href="/"
              className="mt-2 inline-block text-[13px] font-medium text-accent hover:underline"
            >
              Go to Today&rsquo;s Briefing
            </Link>
          </div>
        )}
      </div>

      {dismissed.length > 0 && (
        <div className="mt-10 max-w-4xl">
          <Panel title="Marked not relevant">
            <p className="text-[11px] leading-relaxed text-ink-faint">
              These are excluded from your briefing. Each dismissal also adjusts
              the preference model.
            </p>
            <ul className="mt-3 divide-y divide-line">
              {dismissed.map((item) => (
                <li
                  key={item.publication.id}
                  className="flex items-center justify-between gap-4 py-2.5"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/paper/${encodeURIComponent(item.publication.id)}`}
                      className="block truncate text-[13px] text-ink hover:text-accent"
                    >
                      {item.publication.title}
                    </Link>
                    <p className="text-[11px] text-ink-faint">
                      {item.publication.source} ·{" "}
                      {formatDate(item.publication.publishedAt)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => recordFeedback(item.publication.id, "not_relevant")}
                  >
                    Restore
                  </Button>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      )}

      {feedbackCount > 0 && (
        <p className="mt-6 max-w-4xl text-[11px] text-ink-faint">
          {feedbackCount} interaction{feedbackCount === 1 ? "" : "s"} recorded so far,
          feeding the preference model in the sidebar.
        </p>
      )}
    </div>
  );
}
