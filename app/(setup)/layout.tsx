import Link from "next/link";
import { signOutAction } from "@/app/(auth)/actions";

/** Minimal chrome for account setup steps that happen before the main app. */
export default function SetupLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
          <Link href="/" className="flex items-baseline gap-2">
            <span className="text-[17px] font-semibold tracking-tight text-ink">Signal</span>
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          </Link>
          <form action={signOutAction}>
            <button type="submit" className="text-[12px] text-ink-muted hover:text-ink">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-8">{children}</main>
    </div>
  );
}
