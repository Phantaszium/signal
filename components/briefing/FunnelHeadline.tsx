"use client";

import { cx } from "@/components/ui/primitives";
import type { FunnelCounts } from "@/lib/types";

/**
 * The funnel is the product thesis in one line: we looked at a lot, and we are
 * telling you to read three things. It appears on every page.
 */
export function FunnelHeadline({
  funnel,
  compact = false,
}: {
  funnel: FunnelCounts;
  compact?: boolean;
}) {
  const steps = [
    {
      value: funnel.ingested.toLocaleString(),
      label: "records read",
      tone: "muted" as const,
    },
    {
      value: funnel.likelyRelevant.toString(),
      label: "likely relevant",
      tone: "mid" as const,
    },
    {
      value: funnel.important.toString(),
      label: "important — read these",
      tone: "high" as const,
    },
  ];

  return (
    <div
      className={cx(
        "flex flex-wrap items-stretch gap-0 overflow-hidden rounded-md border border-line bg-surface",
        compact ? "" : "shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
      )}
    >
      {steps.map((step, i) => (
        <div
          key={step.label}
          className={cx(
            "flex min-w-[150px] flex-1 items-center gap-3 px-4",
            compact ? "py-2.5" : "py-4",
            i > 0 && "border-t border-line sm:border-t-0 sm:border-l",
            step.tone === "high" && "bg-high-soft",
          )}
        >
          {i > 0 && (
            <span
              aria-hidden
              className="-ml-1 text-sm text-ink-faint select-none"
            >
              →
            </span>
          )}
          <div className="min-w-0">
            <div
              className={cx(
                "tabular font-semibold tracking-tight",
                compact ? "text-lg" : "text-[28px] leading-none",
                step.tone === "high"
                  ? "text-high"
                  : step.tone === "mid"
                    ? "text-ink"
                    : "text-ink-muted",
              )}
            >
              {step.value}
            </div>
            <div
              className={cx(
                "mt-1 text-[11px] leading-tight",
                step.tone === "high" ? "font-medium text-high" : "text-ink-faint",
              )}
            >
              {step.label}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
