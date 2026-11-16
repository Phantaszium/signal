"use client";

import { useRouter } from "next/navigation";
import { useSignal } from "@/lib/store/SignalProvider";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { Panel, cx } from "@/components/ui/primitives";
import { changedPreferences } from "@/lib/preferences/model";

export function ProfileEditor() {
  const { profile, learned, weights, feedbackCount } = useSignal();
  const router = useRouter();
  const moved = new Set(changedPreferences(weights));

  return (
    <div className="px-6 py-7 lg:px-10 lg:py-9">
      <header className="max-w-3xl">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-ink">
          Research profile
        </h1>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
          Everything Signal reads is searched for and assessed against this profile.
          Changes apply from your next briefing; use Refresh on the briefing page to
          apply them now.
        </p>
      </header>

      <div className="mt-6 grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <ProfileForm initial={profile} onSaved={() => router.refresh()} />

        <aside className="space-y-4">
          <Panel title="What Signal has learned">
            <ul className="space-y-3">
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
            <p className="mt-3 text-[10.5px] leading-relaxed text-ink-faint">
              Inferred from what you mark important, save, or dismiss, not entered by
              hand. Everyone starts at 50%. {feedbackCount} interaction
              {feedbackCount === 1 ? "" : "s"} recorded so far.
            </p>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
