import Link from "next/link";
import { signOutAction } from "@/app/(auth)/actions";
import { Logo } from "@/components/brand/Puffin";

/** Minimal chrome for account setup steps that happen before the main app. */
export default function SetupLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-canvas/90">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-3">
          <Link href="/" aria-label="PaperPuffin">
            <Logo size="sm" />
          </Link>
          <form action={signOutAction}>
            <button type="submit" className="text-[12.5px] text-ink-muted hover:text-ink">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-5 py-8 sm:py-10">{children}</main>
    </div>
  );
}
