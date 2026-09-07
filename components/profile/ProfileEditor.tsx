"use client";

import { useState } from "react";
import { useSignal } from "@/lib/store/SignalProvider";
import { TagField } from "@/components/profile/TagField";
import { Button, Panel, cx } from "@/components/ui/primitives";
import { changedPreferences } from "@/lib/preferences/model";
import type { ResearchProfile } from "@/lib/types";

export function ProfileEditor() {
  const { profile, updateProfile, learned, weights, feedback, resetAll, briefing } =
    useSignal();
  const [draft, setDraft] = useState<ResearchProfile>(profile);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // The stored profile hydrates after mount, so reset the draft when the
  // upstream profile object changes. (React's documented "adjust state during
  // render" pattern — cheaper and safer than an effect.)
  const [syncedProfile, setSyncedProfile] = useState(profile);
  if (syncedProfile !== profile) {
    setSyncedProfile(profile);
    setDraft(profile);
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(profile);
  const moved = new Set(changedPreferences(weights));

  const set = <K extends keyof ResearchProfile>(key: K, value: ResearchProfile[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  return (
    <div className="px-6 py-7 lg:px-10 lg:py-9">
      <header className="max-w-3xl">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-ink">
          Research profile
        </h1>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
          Everything Signal ranks is scored against this profile. Changes take
          effect immediately — the briefing re-ranks as soon as you save.
        </p>
      </header>

      <div className="mt-6 grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <Panel title="Program">
            <input
              value={draft.program}
              onChange={(e) => set("program", e.target.value)}
              className="w-full rounded border border-line bg-white px-2.5 py-1.5 text-[13px] text-ink outline-none focus:border-accent/50"
            />

            <div className="mt-4">
              <label className="text-[12px] font-medium text-ink">
                Research description
              </label>
              <textarea
                value={draft.description}
                onChange={(e) => set("description", e.target.value)}
                rows={5}
                className="mt-1.5 w-full resize-y rounded border border-line bg-white px-2.5 py-2 text-[13px] leading-relaxed text-ink outline-none focus:border-accent/50"
              />
              <p className="mt-1 text-[10px] text-ink-faint">
                Used to build the PubMed query and to phrase the &ldquo;why this
                matters&rdquo; line.
              </p>
            </div>
          </Panel>

          <Panel title="What Signal tracks for you">
            <div className="space-y-4">
              <TagField
                label="Keywords"
                hint="highest ranking weight"
                values={draft.keywords}
                onChange={(v) => set("keywords", v)}
              />
              <TagField
                label="Genes / proteins"
                values={draft.genes}
                onChange={(v) => set("genes", v)}
              />
              <TagField
                label="Diseases"
                values={draft.diseases}
                onChange={(v) => set("diseases", v)}
              />
              <TagField
                label="Techniques"
                values={draft.techniques}
                onChange={(v) => set("techniques", v)}
              />
              <TagField
                label="Companies / competitors"
                hint="drives strategic significance"
                values={draft.organizations}
                onChange={(v) => set("organizations", v)}
              />
            </div>
          </Panel>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="primary"
              disabled={!dirty}
              onClick={() => {
                updateProfile(draft);
                setSavedAt(Date.now());
              }}
            >
              Save profile
            </Button>
            <Button variant="ghost" disabled={!dirty} onClick={() => setDraft(profile)}>
              Discard changes
            </Button>
            {savedAt && !dirty && (
              <span className="text-[11px] text-positive">
                Saved — briefing re-ranked ({briefing.funnel.likelyRelevant} relevant,{" "}
                {briefing.funnel.important} important)
              </span>
            )}
          </div>
        </div>

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
              These are inferred from what you mark important, save, or dismiss —
              not entered by hand. {feedback.length} interaction
              {feedback.length === 1 ? "" : "s"} recorded this session.
            </p>
          </Panel>

          <Panel title="Demo controls">
            <p className="text-[11px] leading-relaxed text-ink-faint">
              Resets the profile, preference weights, saved items and dismissals
              back to their seeded state.
            </p>
            <div className="mt-2.5">
              <Button size="sm" variant="danger" onClick={resetAll}>
                Reset demo state
              </Button>
            </div>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
