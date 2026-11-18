"use client";

import Link from "next/link";
import { signOutAction } from "@/app/(auth)/actions";
import { Logo } from "@/components/brand/Puffin";
import { NAV, isActive } from "@/components/layout/nav";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/components/ui/primitives";
import { useSignal } from "@/lib/store/SignalProvider";

const WEEK = 7 * 86_400_000;

export function Sidebar({ pathname }: { pathname: string }) {
  const { account, savedIds, developments, topics, now, library } = useSignal();
  const newThisWeek = developments.filter((d) => now - Date.parse(d.evaluatedAt) < WEEK).length;
  const toRead = savedIds.filter((id) => library.get(id)?.readingStatus !== "read").length;

  const count = (href: string): number | null => {
    if (href === "/discover" && newThisWeek) return newThisWeek;
    if (href === "/library" && toRead) return toRead;
    return null;
  };

  return (
    <div className="flex min-h-full flex-col px-4 py-5">
      <Link href="/home" className="px-2" aria-label="PaperPuffin home">
        <Logo />
      </Link>
      <p className="mt-1 px-2 text-[11.5px] text-ink-faint">Your research companion.</p>

      <nav aria-label="Main" className="mt-6 space-y-0.5">
        {NAV.map((item) => {
          const active = isActive(item, pathname);
          const c = count(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cx(
                "flex items-center gap-2.5 rounded-xl px-3 py-2 text-[14px] transition-colors",
                active ? "bg-surface font-semibold text-accent shadow-[0_1px_2px_rgba(21,35,63,0.06)]" : "text-ink-muted hover:bg-surface/70 hover:text-ink",
              )}
            >
              <Icon name={item.icon} />
              <span className="flex-1">{item.label}</span>
              {c !== null && (
                <span
                  title={item.href === "/discover" ? "New recommendations this week" : "Saved papers not yet read"}
                  className="tabular rounded-full bg-accent-soft px-1.5 text-[11px] font-semibold text-accent"
                >
                  {c}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <section className="mt-7 px-2">
        <div className="flex items-center justify-between">
          <h3 className="eyebrow text-[10px] font-semibold text-ink-faint">Topics you follow</h3>
          <Link href="/topics/new" className="text-[11.5px] font-medium text-accent hover:underline">
            + Add
          </Link>
        </div>
        <ul className="mt-2.5 space-y-1.5">
          {topics.map((t) => (
            <li key={t.id}>
              <Link
                href={`/topics/${t.id}`}
                className={cx(
                  "flex items-start gap-2 text-[12.5px] leading-snug hover:text-accent",
                  t.active ? "text-ink" : "text-ink-faint",
                )}
              >
                <span aria-hidden className={cx("mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full", t.active ? "bg-sea" : "bg-line-strong")} />
                <span>
                  {t.profile.program}
                  {!t.active && <span className="text-ink-faint"> (paused)</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-auto space-y-1 border-t border-line px-2 pt-4 text-[12.5px]">
        <p className="truncate text-ink-faint" title={account.email}>
          {account.email}
        </p>
        <Link href="/settings" className="flex items-center gap-2 text-ink-muted hover:text-ink">
          <Icon name="settings" size={15} /> Account settings
        </Link>
        {account.isAdmin && (
          <Link href="/admin" className="flex items-center gap-2 text-ink-muted hover:text-ink">
            <Icon name="check" size={15} /> Beta access
          </Link>
        )}
        <form action={signOutAction}>
          <button type="submit" className="flex items-center gap-2 text-ink-muted hover:text-ink">
            <Icon name="logout" size={15} /> Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
