"use client";

import { useState, useTransition } from "react";
import { TagField } from "@/components/profile/TagField";
import { Button, Panel } from "@/components/ui/primitives";
import { saveProfileAction } from "@/lib/profile/actions";
import type { ResearchProfile } from "@/lib/types";

export const EMPTY_PROFILE: ResearchProfile = {
  program: "",
  description: "",
  keywords: [],
  genes: [],
  diseases: [],
  techniques: [],
  organizations: [],
};

/**
 * The research-profile form. Everything Signal reads is matched against these
 * fields, and the AI sees the description verbatim when it judges relevance.
 */
export function ProfileForm({
  initial,
  example,
  submitLabel = "Save profile",
  onSaved,
}: {
  initial: ResearchProfile;
  /** Offered as a one-click starting point, e.g. during onboarding. */
  example?: ResearchProfile;
  submitLabel?: string;
  onSaved?: () => void;
}) {
  const [draft, setDraft] = useState<ResearchProfile>(initial);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  // Reset when the server sends a new saved profile.
  const [synced, setSynced] = useState(initial);
  if (synced !== initial) {
    setSynced(initial);
    setDraft(initial);
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const set = <K extends keyof ResearchProfile>(key: K, value: ResearchProfile[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const save = () =>
    startTransition(async () => {
      setError(null);
      const result = await saveProfileAction(draft);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSavedAt(Date.now());
      onSaved?.();
    });

  return (
    <div className="space-y-5">
      {example && (
        <p className="text-[12px] text-ink-muted">
          Not sure what to write?{" "}
          <button
            type="button"
            onClick={() => setDraft(example)}
            className="font-medium text-accent hover:underline"
          >
            Start from an example profile
          </button>{" "}
          and edit it into yours.
        </p>
      )}

      <Panel title="Program">
        <label className="text-[12px] font-medium text-ink" htmlFor="program">
          Program name
        </label>
        <input
          id="program"
          value={draft.program}
          onChange={(e) => set("program", e.target.value)}
          placeholder="e.g. KRAS G12D resistance in NSCLC"
          className="mt-1.5 w-full rounded border border-line bg-white px-2.5 py-1.5 text-[13px] text-ink outline-none focus:border-accent/50"
        />

        <div className="mt-4">
          <label className="text-[12px] font-medium text-ink" htmlFor="description">
            Research description
          </label>
          <textarea
            id="description"
            value={draft.description}
            onChange={(e) => set("description", e.target.value)}
            rows={5}
            placeholder="What questions is your group working on, and what decisions are coming up?"
            className="mt-1.5 w-full resize-y rounded border border-line bg-white px-2.5 py-2 text-[13px] leading-relaxed text-ink outline-none focus:border-accent/50"
          />
          <p className="mt-1 text-[10px] text-ink-faint">
            The AI reads this when judging relevance, so be specific about your questions and
            upcoming decisions. It matters more than any single keyword.
          </p>
        </div>
      </Panel>

      <Panel title="What Signal tracks for you">
        <div className="space-y-4">
          <TagField
            label="Keywords"
            hint="required · used to search every source"
            values={draft.keywords}
            onChange={(v) => set("keywords", v)}
          />
          <TagField label="Genes / proteins" values={draft.genes} onChange={(v) => set("genes", v)} />
          <TagField label="Diseases" values={draft.diseases} onChange={(v) => set("diseases", v)} />
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
        <Button variant="primary" disabled={!dirty || pending} onClick={save}>
          {pending ? "Saving…" : submitLabel}
        </Button>
        {initial.program && (
          <Button variant="ghost" disabled={!dirty || pending} onClick={() => setDraft(initial)}>
            Discard changes
          </Button>
        )}
        {error && <span className="text-[12px] text-negative">{error}</span>}
        {savedAt && !dirty && !error && (
          <span className="text-[11px] text-positive">
            Saved. Your next briefing uses the new profile.
          </span>
        )}
      </div>
    </div>
  );
}
