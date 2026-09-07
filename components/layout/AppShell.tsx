"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { cx } from "@/components/ui/primitives";

const NAV = [
  { href: "/", label: "Today's Briefing" },
  { href: "/saved", label: "Saved" },
  { href: "/watchlist", label: "Watchlist" },
  { href: "/profile", label: "Profile" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen">
      {/* Compact nav for narrow viewports; the sidebar carries it on desktop. */}
      <div className="sticky top-0 z-20 flex items-center gap-4 border-b border-line bg-surface px-4 py-2 lg:hidden">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          Signal
        </Link>
        <nav className="flex gap-3 overflow-x-auto text-xs">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cx(
                "whitespace-nowrap py-1",
                pathname === item.href
                  ? "font-medium text-accent"
                  : "text-ink-muted",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="mx-auto flex w-full max-w-[1440px] gap-0">
        <aside className="sticky top-0 hidden h-screen w-[318px] shrink-0 overflow-y-auto border-r border-line bg-surface lg:block">
          <Sidebar nav={NAV} pathname={pathname} />
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
