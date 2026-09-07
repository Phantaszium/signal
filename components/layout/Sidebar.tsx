"use client";

import Link from "next/link";
import { useSignal } from "@/lib/store/SignalProvider";
import { changedPreferences } from "@/lib/preferences/model";
import { cx } from "@/components/ui/primitives";

interface NavItem {
  href: string;
  label: string;
}

export function Sidebar({
  nav,
  pathname,
}: {
  nav: NavItem[];
  pathname: string;
}) {
  const { profile, learned, savedIds, weights, briefing } = useSignal();
  const moved = new Set(changedPreferences(weights));

  return (
    <div className="flex min-h-full flex-col">
      {/* Brand */}
      <div className="border-b border-line px-5 py-5">
        <div className="flex items-baseline gap-2">
          <span className="text-[17px] font-semibold tracking-tight text-ink">
            Signal
          </span>
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
        </div>
        <p className="mt-1 text-[11px] leading-snug text-ink-faint">
          Know what changed before it changes your field.
        </p>
      </div>

      {/* Navigation */}
      <nav className="border-b border-line px-3 py-3">
        {nav.map((item) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cx(
                "flex items-center justify-between rounded px-2 py-1.5 text-[13px] transition-colors",
                active
                  ? "bg-accent-soft font-medium text-accent"
                  : "text-ink-muted hover:bg-canvas hover:text-ink",
              )}
            >
              <span>{item.label}</span>
              {item.href === "/" && (
                <span className="tabular text-[11px] text-ink-faint">
                  {briefing.funnel.important}
                </span>
              )}
              {item.href === "/saved" && savedIds.length > 0 && (
                <span className="tabular text-[11px] text-ink-faint">
                  {savedIds.length}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Your Research Profile */}
      <section className="border-b border-line px-5 py-4">
        <div className="flex items-center justify-between">
          <h3 className="eyebrow text-[10px] font-semibold text-ink-muted">
            Your Research Profile
          </h3>
          <Link
            href="/profile"
            className="text-[11px] font-medium text-accent hover:underline"
          >
            Edit Profile
          </Link>
        </div>

        <dl className="mt-3 space-y-3">
          <div>
            <dt className="text-[10px] font-medium text-ink-faint">Program</dt>
            <dd className="mt-0.5 text-[13px] font-medium text-ink">
              {profile.program}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-medium text-ink-faint">
              Scientific interests
            </dt>
            <dd className="mt-1 flex flex-wrap gap-1">
              {profile.keywords.slice(0, 6).map((k) => (
                <span
                  key={k}
                  className="rounded border border-line bg-canvas px-1.5 py-0.5 text-[11px] text-ink-muted"
                >
                  {k}
                </span>
              ))}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-medium text-ink-faint">
              Tracked organizations
            </dt>
            <dd className="mt-1 text-[12px] leading-relaxed text-ink-muted">
              {profile.organizations.join(" · ")}
            </dd>
          </div>
        </dl>
      </section>

      {/* What Signal has learned */}
      <section className="px-5 py-4">
        <h3 className="eyebrow text-[10px] font-semibold text-ink-muted">
          What Signal has learned
        </h3>
        <ul className="mt-3 space-y-2.5">
          {learned.map((pref) => (
            <li key={pref.id}>
              <p className="text-[12px] leading-snug text-ink">
                &ldquo;{pref.statement}&rdquo;
              </p>
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
                <span className="tabular text-[10px] text-ink-faint">
                  {Math.round(pref.confidence * 100)}%
                </span>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[10px] leading-snug text-ink-faint">
          Confidence updates as you mark items important or not relevant. Bars in
          amber have moved from their starting values this session.
        </p>
      </section>
    </div>
  );
}
