"use client";

import { useState, useTransition } from "react";
import { TagField } from "@/components/topics/TagField";
import { Button, Panel, cx } from "@/components/ui/primitives";
import { RELEVANCE_THRESHOLD, SENSITIVITY_LABEL } from "@/lib/developments";
import { SOURCE_LABEL } from "@/lib/monitoring/diagnosis";
import { suggestTermsAction } from "@/lib/profile/actions";
import { useSignal } from "@/lib/store/SignalProvider";
import { deleteTopicAction, saveTopicAction } from "@/lib/topics/actions";
import type { Sensitivity, SourceKey, TopicProfile } from "@/lib/types";

export interface TopicDraft {
  profile: TopicProfile;
  sensitivity: Sensitivity;
  sources: SourceKey[];
  active: boolean;
}

export const EMPTY_TOPIC: TopicDraft = {
  profile: {
    program: "",
    description: "",
    keywords: [],
    synonyms: [],
    genes: [],
    organisms: [],
    diseases: [],
    techniques: [],
    organizations: [],
    exclusions: [],
  },
  sensitivity: "balanced",
  sources: ["pubmed", "biorxiv", "medrxiv", "europepmc"],
  active: true,
};

const SOURCE_HINT: Record<SourceKey, string> = {
  pubmed: "Peer-reviewed literature, searched with your terms",
  clinicaltrials: "Clinical trial registrations. Only useful for clinical research topics",
  biorxiv: "Biology preprints, read daily",
  medrxiv: "Clinical preprints, read daily",
  europepmc: "Other preprint servers (Research Square, SSRN, …), searched with your terms",
};

/**
 * Create or edit one research topic. Retrieval searches every source with
 * the keywords, synonyms, genes, organisms and diseases; the AI reads the
 * name and question verbatim when it judges relevance.
 */
export function TopicForm({
  id,
  initial,
  example,
  submitLabel = "Save topic",
  canDelete = false,
  onSaved,
  onDeleted,
}: {
  id: string | null;
  initial: TopicDraft;
  example?: TopicProfile;
  submitLabel?: string;
  canDelete?: boolean;
  onSaved?: (id: string) => void;
  onDeleted?: () => void;
}) {
  const [draft, setDraft] = useState<TopicDraft>(initial);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();
  const [suggesting, startSuggesting] = useTransition();
  const [suggestNote, setSuggestNote] = useState<string | null>(null);
  const { student } = useSignal();

  // Reset when the server sends a new saved topic.
  const [synced, setSynced] = useState(initial);
  if (synced !== initial) {
    setSynced(initial);
    setDraft(initial);
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const set = <K extends keyof TopicProfile>(key: K, value: TopicProfile[K]) =>
    setDraft((d) => ({ ...d, profile: { ...d.profile, [key]: value } }));

  const save = () =>
    startTransition(async () => {
      setError(null);
      const result = await saveTopicAction(id, draft);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSavedAt(Date.now());
      onSaved?.(result.id);
    });

  const remove = () =>
    startTransition(async () => {
      if (!id) return;
      const result = await deleteTopicAction(id);
      if (!result.ok) {
        setError(result.error);
        setConfirmDelete(false);
        return;
      }
      onDeleted?.();
    });

  const toggleSource = (s: SourceKey) =>
    setDraft((d) => ({
      ...d,
      sources: d.sources.includes(s) ? d.sources.filter((x) => x !== s) : [...d.sources, s],
    }));

  return (
    <div className="space-y-5">
      {example && (
        <p className="text-[12px] text-ink-muted">
          Not sure what to write?{" "}
          <button
            type="button"
            onClick={() => setDraft((d) => ({ ...d, profile: example }))}
            className="font-medium text-accent hover:underline"
          >
            Start from an example topic
          </button>{" "}
          and edit it into yours.
        </p>
      )}

      <Panel title="Topic">
        <label className="text-[12px] font-medium text-ink" htmlFor="program">
          Name
        </label>
        <input
          id="program"
          value={draft.profile.program}
          onChange={(e) => set("program", e.target.value)}
          placeholder="e.g. Antibiotic resistance in Vibrio natriegens"
          className="mt-1.5 w-full rounded-xl border border-line bg-white px-2.5 py-1.5 text-[13px] text-ink outline-none focus:border-accent/50"
        />

        <div className="mt-4">
          <label className="text-[12px] font-medium text-ink" htmlFor="description">
            What do you want to learn about?
          </label>
          <textarea
            id="description"
            value={draft.profile.description}
            onChange={(e) => set("description", e.target.value)}
            rows={4}
            placeholder="Describe the question in your own words: what you are studying, with which organism, system or method, and what kinds of papers would help you."
            className="mt-1.5 w-full resize-y rounded-xl border border-line bg-white px-2.5 py-2 text-[13px] leading-relaxed text-ink outline-none focus:border-accent/50"
          />
          <p className="mt-1 text-[10px] leading-relaxed text-ink-faint">
            PaperPuffin reads this when judging relevance, so a paper can match without using your
            exact keywords. Be specific: it matters more than any single term.
          </p>
        </div>
      </Panel>

      <Panel
        title="What to search for"
        action={
          <Button
            size="sm"
            disabled={suggesting || (!draft.profile.program.trim() && !draft.profile.description.trim())}
            onClick={() =>
              startSuggesting(async () => {
                setSuggestNote(null);
                const r = await suggestTermsAction({
                  field: student.field,
                  researchQuestion: draft.profile.program,
                  projectDescription: draft.profile.description,
                });
                if (!r.ok) {
                  setSuggestNote(r.error);
                  return;
                }
                const merge = (a: string[], b: string[]) => [...new Set([...a, ...b])];
                setDraft((d) => ({
                  ...d,
                  profile: {
                    ...d.profile,
                    keywords: merge(d.profile.keywords, r.value.keywords),
                    synonyms: merge(d.profile.synonyms, r.value.synonyms),
                    genes: merge(d.profile.genes, r.value.genes),
                    organisms: merge(d.profile.organisms, r.value.organisms),
                    diseases: merge(d.profile.diseases, r.value.diseases),
                    techniques: merge(d.profile.techniques, r.value.techniques),
                  },
                }));
                setSuggestNote("Suggested by AI from your description. Remove anything that doesn't fit.");
              })
            }
          >
            {suggesting ? "Thinking…" : "✨ Suggest terms"}
          </Button>
        }
      >
        {suggestNote && <p className="mb-3 text-[12px] text-ink-muted">{suggestNote}</p>}
        <div className="space-y-4">
          <TagField
            label="Keywords"
            hint="required · searched in every source"
            values={draft.profile.keywords}
            onChange={(v) => set("keywords", v)}
          />
          <TagField
            label="Synonyms and alternative spellings"
            hint="drug codes, abbreviations, older names"
            values={draft.profile.synonyms}
            onChange={(v) => set("synonyms", v)}
          />
          <TagField label="Genes / proteins" values={draft.profile.genes} onChange={(v) => set("genes", v)} />
          <TagField
            label="Organisms"
            hint="write species names in full"
            values={draft.profile.organisms}
            onChange={(v) => set("organisms", v)}
          />
          <TagField label="Diseases" values={draft.profile.diseases} onChange={(v) => set("diseases", v)} />
          <TagField
            label="Techniques"
            hint="used for ranking, not searching"
            values={draft.profile.techniques}
            onChange={(v) => set("techniques", v)}
          />
          <TagField
            label="Labs, groups or consortia"
            hint="optional · helps PaperPuffin notice their work"
            values={draft.profile.organizations}
            onChange={(v) => set("organizations", v)}
          />
          <TagField
            label="Exclusions"
            hint="optional · records mentioning these are skipped"
            values={draft.profile.exclusions}
            onChange={(v) => set("exclusions", v)}
          />
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">
          Avoid very common terms (a routine method, a broad disease area, a sequencing technique):
          they pull in unrelated records that the AI then has to rule out.
        </p>
      </Panel>

      <details className="rounded-2xl border border-line bg-surface/60">
        <summary className="cursor-pointer px-5 py-3 text-[13px] font-semibold text-ink-muted hover:text-ink">
          Advanced: how picky to be, and which sources to search
        </summary>
        <div className="space-y-5 px-3 pb-3">
      <Panel title="How picky should recommendations be?">
        <div className="grid gap-2 sm:grid-cols-3">
          {(Object.keys(SENSITIVITY_LABEL) as Sensitivity[]).map((s) => (
            <label
              key={s}
              className={cx(
                "flex cursor-pointer flex-col rounded-xl border px-3 py-2.5 transition-colors",
                draft.sensitivity === s ? "border-accent/50 bg-accent-soft/50" : "border-line hover:border-line-strong",
              )}
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name="sensitivity"
                  checked={draft.sensitivity === s}
                  onChange={() => setDraft((d) => ({ ...d, sensitivity: s }))}
                  className="accent-[var(--accent)]"
                />
                <span className="text-[13px] font-medium text-ink">{SENSITIVITY_LABEL[s].label}</span>
                <span className="tabular text-[10px] text-ink-faint">{RELEVANCE_THRESHOLD[s]}+</span>
              </span>
              <span className="mt-1 text-[11px] leading-snug text-ink-muted">{SENSITIVITY_LABEL[s].detail}</span>
            </label>
          ))}
        </div>
      </Panel>

      <Panel title="Sources">
        <div className="grid gap-2 sm:grid-cols-2">
          {(Object.keys(SOURCE_LABEL) as SourceKey[]).map((s) => (
            <label key={s} className="flex cursor-pointer items-start gap-2.5 rounded px-1 py-1">
              <input
                type="checkbox"
                checked={draft.sources.includes(s)}
                onChange={() => toggleSource(s)}
                className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
              />
              <span>
                <span className="block text-[13px] font-medium text-ink">{SOURCE_LABEL[s]}</span>
                <span className="block text-[11px] text-ink-muted">{SOURCE_HINT[s]}</span>
              </span>
            </label>
          ))}
        </div>
      </Panel>
        </div>
      </details>

      {id && (
        <Panel title="Following">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(e) => setDraft((d) => ({ ...d, active: e.target.checked }))}
              className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
            />
            <span>
              <span className="block text-[13px] font-medium text-ink">Search for new papers on this topic</span>
              <span className="block text-[12px] text-ink-muted">
                Paused topics are not searched. Papers already recommended stay in your library and Discover.
              </span>
            </span>
          </label>
        </Panel>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" disabled={!dirty || pending} onClick={save}>
          {pending ? "Saving…" : submitLabel}
        </Button>
        {id && (
          <Button variant="ghost" disabled={!dirty || pending} onClick={() => setDraft(initial)}>
            Discard changes
          </Button>
        )}
        {error && <span className="text-[12px] text-negative">{error}</span>}
        {savedAt && !dirty && !error && (
          <span className="text-[11px] text-positive">Saved. The next search uses these settings.</span>
        )}
      </div>

      {canDelete && (
        <div className="border-t border-line pt-4">
          {confirmDelete ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[12px] text-ink">
                Delete this topic? Its recommendations leave Home and Discover; anything you saved
                stays in My Library, and its papers are not read again. Pausing keeps everything.
              </span>
              <Button variant="danger" active disabled={pending} onClick={remove}>
                Delete topic
              </Button>
              <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="text-[12px] text-ink-muted hover:text-negative"
            >
              Delete this topic…
            </button>
          )}
        </div>
      )}
    </div>
  );
}
