import Link from "next/link";

export default function NotFound() {
  return (
    <div className="px-6 py-20 text-center lg:px-10">
      <p className="eyebrow text-[11px] font-semibold text-ink-faint">404</p>
      <h1 className="mt-2 text-[20px] font-semibold tracking-[-0.01em] text-ink">
        Page not found
      </h1>
      <p className="mt-1 text-[13px] text-ink-muted">
        That route isn&rsquo;t part of Signal.
      </p>
      <Link
        href="/"
        className="mt-4 inline-block text-[13px] font-medium text-accent hover:underline"
      >
        ← Today&rsquo;s Briefing
      </Link>
    </div>
  );
}
