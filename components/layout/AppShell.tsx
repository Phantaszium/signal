"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/brand/Puffin";
import { Sidebar } from "@/components/layout/Sidebar";
import { Icon } from "@/components/ui/Icon";
import { NAV, isActive } from "@/components/layout/nav";
import { cx } from "@/components/ui/primitives";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen">
      {/* Mobile top bar */}
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-canvas/95 px-4 py-2.5 backdrop-blur lg:hidden">
        <Link href="/home" aria-label="PaperPuffin home">
          <Logo size="sm" />
        </Link>
        <Link href="/settings" aria-label="Account settings" className="rounded-lg p-1.5 text-ink-muted hover:bg-surface">
          <Icon name="settings" />
        </Link>
      </div>

      <div className="mx-auto flex w-full max-w-[1400px]">
        <aside className="sticky top-0 hidden h-screen w-[264px] shrink-0 overflow-y-auto border-r border-line bg-canvas-deep/50 lg:block">
          <Sidebar pathname={pathname} />
        </aside>
        <main className="min-w-0 flex-1 pb-24 lg:pb-0">{children}</main>
      </div>

      {/* Mobile tab bar */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        {NAV.map((item) => {
          const active = isActive(item, pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cx(
                "flex flex-col items-center gap-0.5 py-2 text-[10.5px] font-medium",
                active ? "text-accent" : "text-ink-faint",
              )}
            >
              <Icon name={item.icon} size={20} />
              {item.short}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
