import Link from "next/link";
import type { PublicationType, Tier } from "@/lib/types";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

/** Small neutral chip used for tags, types and provenance. */
export function Chip({
  children,
  tone = "neutral",
  title,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "accent" | "warn" | "quiet";
  title?: string;
}) {
  const tones = {
    neutral: "border-line bg-white text-ink-muted",
    accent: "border-accent/25 bg-accent-soft text-accent",
    warn: "border-high-line bg-high-soft text-high",
    quiet: "border-transparent bg-canvas text-ink-faint",
  } as const;
  return (
    <span
      title={title}
      className={cx(
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] leading-4 font-medium whitespace-nowrap",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

const TYPE_LABEL: Record<PublicationType, string> = {
  journal: "Journal",
  preprint: "Preprint",
  trial: "Trial",
  regulatory: "Regulatory",
};

export function TypeChip({ type }: { type: PublicationType }) {
  return <Chip tone={type === "preprint" ? "quiet" : "neutral"}>{TYPE_LABEL[type]}</Chip>;
}

export function TierLabel({ tier }: { tier: Tier }) {
  const copy: Record<Tier, string> = {
    HIGH: "Read these",
    NOTABLE: "Worth knowing about",
    CONTEXT: "Background",
  };
  return (
    <div className="flex items-baseline gap-3 border-b border-line pb-2">
      <h2
        className={cx(
          "eyebrow text-xs font-semibold",
          tier === "HIGH" ? "text-high" : "text-ink-muted",
        )}
      >
        {tier}
      </h2>
      <span className="text-xs text-ink-faint">{copy[tier]}</span>
    </div>
  );
}

/** Horizontal 0–100 bar. Used for every score in the app. */
export function ScoreBar({
  value,
  label,
  emphasis = false,
}: {
  value: number;
  label?: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      {label && (
        <span className="w-36 shrink-0 text-[11px] text-ink-muted">{label}</span>
      )}
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
        <div
          className={cx("h-full rounded-full", emphasis ? "bg-high" : "bg-accent")}
          style={{ width: `${Math.max(2, value)}%` }}
        />
      </div>
      <span className="tabular w-8 shrink-0 text-right text-[11px] font-medium text-ink">
        {value}
      </span>
    </div>
  );
}

/** The composite Signal score, shown as a compact block. */
export function SignalScoreBlock({
  score,
  emphasis = false,
}: {
  score: number;
  emphasis?: boolean;
}) {
  return (
    <div
      className={cx(
        "flex w-14 shrink-0 flex-col items-center self-start rounded border px-1 py-1.5",
        emphasis ? "border-high-line bg-high-soft" : "border-line bg-canvas",
      )}
    >
      <span
        className={cx(
          "tabular text-lg leading-none font-semibold",
          emphasis ? "text-high" : "text-ink",
        )}
      >
        {score}
      </span>
      <span className="eyebrow mt-1 text-[9px] font-medium text-ink-faint">
        Signal
      </span>
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = "secondary",
  size = "md",
  active = false,
  type = "button",
  disabled = false,
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  active?: boolean;
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
}) {
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded border font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const sizes = { sm: "px-2.5 py-1 text-xs", md: "px-3 py-1.5 text-[13px]" };
  const variants = {
    primary:
      "border-accent bg-accent text-white hover:bg-[#105066] active:bg-[#0d4457]",
    secondary: active
      ? "border-accent/40 bg-accent-soft text-accent"
      : "border-line-strong bg-white text-ink-muted hover:border-ink-faint hover:text-ink",
    ghost: "border-transparent bg-transparent text-ink-muted hover:text-ink",
    danger: active
      ? "border-negative/30 bg-[#fdf1ee] text-negative"
      : "border-line-strong bg-white text-ink-muted hover:border-negative/40 hover:text-negative",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cx(base, sizes[size], variants[variant], className)}
    >
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  children,
  variant = "secondary",
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
}) {
  const variants = {
    primary: "border-accent bg-accent text-white hover:bg-[#105066]",
    secondary:
      "border-line-strong bg-white text-ink-muted hover:border-ink-faint hover:text-ink",
  };
  return (
    <Link
      href={href}
      className={cx(
        "inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-[13px] font-medium transition-colors",
        variants[variant],
      )}
    >
      {children}
    </Link>
  );
}

export function Panel({
  title,
  action,
  children,
  className,
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cx("rounded-md border border-line bg-surface", className)}
    >
      {title && (
        <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
          <h3 className="eyebrow text-[11px] font-semibold text-ink-muted">
            {title}
          </h3>
          {action}
        </header>
      )}
      <div className="px-4 py-3">{children}</div>
    </section>
  );
}

/** Date-only ISO strings must be parsed as local, not UTC, or dates shift a day. */
function parseDate(iso: string): Date {
  return new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T00:00:00` : iso);
}

export function formatDate(iso: string) {
  return parseDate(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function relativeDay(iso: string, now = new Date()) {
  const days = Math.round(
    (now.getTime() - parseDate(iso).getTime()) / 86_400_000,
  );
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return formatDate(iso);
}
