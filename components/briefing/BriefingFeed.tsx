"use client";

import { useSignal } from "@/lib/store/SignalProvider";
import { FunnelHeadline } from "@/components/briefing/FunnelHeadline";
import { GenerateBriefing } from "@/components/briefing/GenerateBriefing";
import { PaperCard } from "@/components/briefing/PaperCard";
import { TierLabel } from "@/components/ui/primitives";
import type { ScoredPublication, Tier } from "@/lib/types";

function Section({
  tier,
  items,
}: {
  tier: Tier;
  items: ScoredPublication[];
}) {
  return (
    <section className="mt-8 first:mt-0">
      <TierLabel tier={tier} />
      <div className="mt-3 space-y-3">
        {items.length === 0 ? (
          <p className="rounded-md border border-dashed border-line px-4 py-6 text-center text-[13px] text-ink-faint">
            Nothing in this section today.
          </p>
        ) : (
          items.map((item) => <PaperCard key={item.publication.id} item={item} />)
        )}
      </div>
    </section>
  );
}

export function BriefingFeed() {
  const { briefing, dismissedIds, hasBriefing, running } = useSignal();
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="px-6 py-7 lg:px-10 lg:py-9">
      <header className="max-w-4xl">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h1 className="text-[26px] font-semibold tracking-[-0.02em] text-ink">
              Today&rsquo;s Signal
            </h1>
            <p className="mt-1 text-[13px] text-ink-muted">
              {today} · {briefing.sourceNote}
            </p>
          </div>
        </div>

        <div className="mt-5">
          {hasBriefing && <FunnelHeadline funnel={briefing.funnel} />}
        </div>

        <p className="mt-3 text-[12px] leading-relaxed text-ink-faint">
          Signal is not here to summarise everything. It decides what is worth
          your attention, and shows you why it decided that.
        </p>

        <div className="mt-5">
          <GenerateBriefing />
        </div>

        {running?.mode === "nightly" && (
          <p className="mt-3 text-[12px] text-ink-muted">
            This morning&rsquo;s briefing is being assessed now. It will appear here, and in
            your inbox, when it is ready.
          </p>
        )}

        {dismissedIds.length > 0 && (
          <p className="mt-3 text-[11px] text-ink-faint">
            {dismissedIds.length} item{dismissedIds.length === 1 ? "" : "s"} marked not
            relevant — removed from the briefing and fed back into your preference model.
          </p>
        )}
      </header>

      {hasBriefing ? (
        <div className="mt-9 max-w-4xl">
          <Section tier="HIGH" items={briefing.high} />
          <Section tier="NOTABLE" items={briefing.notable} />
          <Section tier="CONTEXT" items={briefing.context} />
        </div>
      ) : (
        <div className="mt-9 max-w-4xl rounded-md border border-dashed border-line px-6 py-10 text-center">
          <p className="text-[14px] font-medium text-ink">No briefing yet</p>
          <p className="mx-auto mt-1 max-w-md text-[13px] leading-relaxed text-ink-muted">
            Build your first one now from the past week of literature, or wait for
            tomorrow morning&rsquo;s sweep.
          </p>
        </div>
      )}
    </div>
  );
}
