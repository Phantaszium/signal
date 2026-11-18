import { cx } from "@/components/ui/primitives";

export type PuffinMood = "default" | "reading" | "sleepy" | "curious";

/**
 * The PaperPuffin mascot. One flat, geometric drawing used everywhere — logo,
 * onboarding, empty states and loading — so the illustration style stays
 * consistent. Moods change only small details (eyes, a paper, a tilt).
 */
export function Puffin({
  size = 48,
  mood = "default",
  className,
  bob = false,
  title,
}: {
  size?: number;
  mood?: PuffinMood;
  className?: string;
  /** Gentle loading animation. */
  bob?: boolean;
  /** Accessible name; decorative when omitted. */
  title?: string;
}) {
  const tilt = mood === "curious" ? "rotate(-8 32 40)" : undefined;
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      className={cx(bob && "puffin-bob", className)}
    >
      {title && <title>{title}</title>}
      <g transform={tilt}>
        {/* Feet */}
        <path d="M24 58.5c0-1.6 1.6-2.5 4-2.5s3 .9 3 2.5z" fill="var(--beak)" />
        <path d="M33 58.5c0-1.6 1.6-2.5 4-2.5s3 .9 3 2.5z" fill="var(--beak)" />
        {/* Body and head */}
        <path
          d="M32 10c8.3 0 14 6.2 14 14.5 0 3-.6 5.3-1.4 7.4C48.2 36 50 41 50 45.5 50 53 43.3 58 32 58S14 53 14 45.5c0-5 2.4-10.3 5.6-14C18.6 29.2 18 27 18 24.5 18 16.2 23.7 10 32 10z"
          fill="var(--ink)"
        />
        {/* Belly */}
        <path d="M33.5 33c6.4 0 10.5 5 10.5 11.5S39.6 55 33 55s-9.5-4.4-9.5-10.5S27.1 33 33.5 33z" fill="#fff" />
        {/* Face disc */}
        <path
          d="M34.5 15.5c5.4 0 9.5 3.9 9.5 9 0 4.6-3.5 7.8-8.6 7.8-5.6 0-10.4-3.4-10.4-8.3 0-4.9 4.1-8.5 9.5-8.5z"
          fill="#f6f3ee"
        />
        {/* Cheek */}
        <circle cx="31" cy="27.5" r="2.2" fill="var(--beak)" opacity="0.18" />
        {/* Eye */}
        {mood === "sleepy" ? (
          <path d="M34 23.2c1 .9 2.6.9 3.6 0" stroke="var(--ink)" strokeWidth="1.3" strokeLinecap="round" fill="none" />
        ) : (
          <>
            <circle cx="36" cy="22.8" r="2.1" fill="var(--ink)" />
            <circle cx="36.7" cy="22.1" r="0.7" fill="#fff" />
          </>
        )}
        {/* Beak: the puffin's tri-colour bill */}
        <path d="M42.5 20.5c4.2.4 8.5 2.6 9.5 5.6.4 1.3-.5 2.4-2 2.7-2.7.5-5.5.3-7.6-.4z" fill="var(--beak)" />
        <path d="M42.5 20.5c1.4.2 2.7.6 3.8 1.1l-.7 7c-1-.1-2.2-.4-3.2-.7z" fill="var(--accent)" />
        <path d="M46.8 22c.4 2.1.4 4.4.1 6.7" stroke="#f9c86b" strokeWidth="1" strokeLinecap="round" fill="none" />
        {/* Wing */}
        <path d="M19 39c-2.2 4.2-2.3 9.4.4 12.6 1.3-4 1.6-8.2-.4-12.6z" fill="#0d1830" />
        {mood === "reading" && (
          <g transform="rotate(-8 34 47)">
            <rect x="24" y="39" width="20" height="15" rx="2" fill="#fff" stroke="var(--line-strong)" />
            <path d="M27.5 43.5h13M27.5 46.5h13M27.5 49.5h8" stroke="var(--accent)" strokeWidth="1.2" strokeLinecap="round" />
          </g>
        )}
        {mood === "sleepy" && (
          <text x="47" y="14" fontSize="7" fontWeight="700" fill="var(--accent)" fontFamily="sans-serif">
            z
          </text>
        )}
      </g>
    </svg>
  );
}

/** The PaperPuffin wordmark with its mascot. */
export function Logo({ size = "md", showName = true }: { size?: "sm" | "md" | "lg"; showName?: boolean }) {
  const px = { sm: 26, md: 32, lg: 44 }[size];
  const text = { sm: "text-[16px]", md: "text-[19px]", lg: "text-[26px]" }[size];
  return (
    <span className="inline-flex items-center gap-2">
      <Puffin size={px} />
      {showName && (
        <span className={cx("font-display font-semibold tracking-[-0.01em] text-ink", text)}>
          Paper<span className="text-accent">Puffin</span>
        </span>
      )}
    </span>
  );
}

/** Loading indicator: a bobbing puffin over a short message. */
export function PuffinLoader({ message = "Looking through the literature…" }: { message?: string }) {
  return (
    <div role="status" className="flex flex-col items-center gap-2 py-8 text-center">
      <Puffin size={52} mood="reading" bob />
      <p className="text-[13px] text-ink-muted">{message}</p>
    </div>
  );
}

/** Friendly empty state used across the app. */
export function EmptyState({
  title,
  body,
  mood = "curious",
  action,
}: {
  title: string;
  body?: React.ReactNode;
  mood?: PuffinMood;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-line-strong bg-surface/60 px-6 py-9 text-center">
      <Puffin size={56} mood={mood} className="mx-auto" />
      <p className="mt-3 text-[15px] font-semibold text-ink">{title}</p>
      {body && <div className="mx-auto mt-1 max-w-md text-[13px] leading-relaxed text-ink-muted">{body}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
