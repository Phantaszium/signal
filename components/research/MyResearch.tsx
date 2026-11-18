"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { resetPreferencesAction, setDigestSettingsAction } from "@/app/(app)/actions";
import {
  AcademicLevelPicker,
  ExplanationLevelPicker,
  FieldInput,
  FoundationalPapersField,
  Label,
  inputClass,
} from "@/components/research/ProfileFields";
import { Button, Chip, LinkButton, PageHeader, Panel, cx, timeAgo } from "@/components/ui/primitives";
import { FREQUENCY_LABEL } from "@/lib/digests/plan";
import { changedPreferences } from "@/lib/preferences/model";
import { saveStudentProfileAction } from "@/lib/profile/actions";
import { useSignal } from "@/lib/store/SignalProvider";
import type { DigestFrequency, StudentProfile } from "@/lib/types";

const DAY = 86_400_000;

function ProfileEditor() {
  const { student } = useSignal();
  const router = useRouter();
  const [draft, setDraft] = useState<StudentProfile>(student);
  const [synced, setSynced] = useState(student);
  if (synced !== student) {
    setSynced(student);
    setDraft(student);
  }
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(student);
  const set = <K extends keyof StudentProfile>(k: K, v: StudentProfile[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const save = () =>
    startTransition(async () => {
      const { updatedAt: _ignored, ...input } = draft;
      void _ignored;
      const r = await saveStudentProfileAction(input);
      setMessage(r.ok ? { ok: true, text: "Saved. New recommendations and explanations use this from now on." } : { ok: false, text: r.error });
      if (r.ok) router.refresh();
    });

  return (
    <Panel title="Research profile">
      <div className="space-y-5">
        <div>
          <Label>Academic level</Label>
          <div className="mt-1.5">
            <AcademicLevelPicker value={draft.academicLevel} onChange={(v) => set("academicLevel", v)} />
          </div>
        </div>
        <div>
          <Label htmlFor="field">Research field</Label>
          <FieldInput value={draft.field} onChange={(v) => set("field", v)} />
        </div>
        <div>
          <Label htmlFor="question">Research topic or question</Label>
          <input
            id="question"
            value={draft.researchQuestion}
            onChange={(e) => set("researchQuestion", e.target.value)}
            maxLength={600}
            placeholder="e.g. How does Vibrio natriegens become resistant to spectinomycin?"
            className={inputClass}
          />
        </div>
        <div>
          <Label htmlFor="project" hint="optional">
            About your project
          </Label>
          <textarea
            id="project"
            value={draft.projectDescription}
            onChange={(e) => set("projectDescription", e.target.value)}
            rows={4}
            maxLength={4000}
            placeholder="What are you doing in the lab or at the computer? Which organisms, methods or datasets? What would you love to find?"
            className={cx(inputClass, "resize-y leading-relaxed")}
          />
        </div>
        <div>
          <Label hint="optional · up to 10">Foundational papers</Label>
          <p className="mt-0.5 mb-2 text-[12px] text-ink-muted">Papers your project builds on. PaperPuffin uses their titles to judge relevance.</p>
          <FoundationalPapersField value={draft.foundationalPapers} onChange={(v) => set("foundationalPapers", v)} />
        </div>
        <div>
          <Label>Explanation depth</Label>
          <div className="mt-1.5">
            <ExplanationLevelPicker value={draft.explanationLevel} onChange={(v) => set("explanationLevel", v)} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <Button variant="primary" disabled={!dirty || pending} onClick={save}>
            {pending ? "Saving…" : "Save profile"}
          </Button>
          {dirty && (
            <Button variant="ghost" onClick={() => setDraft(student)}>
              Discard changes
            </Button>
          )}
          {message && !dirty && (
            <span className={cx("text-[12.5px]", message.ok ? "text-positive" : "text-negative")}>{message.text}</span>
          )}
        </div>
      </div>
    </Panel>
  );
}

function BriefingPreferences() {
  const { account } = useSignal();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const choose = (f: DigestFrequency) =>
    startTransition(async () => {
      await setDigestSettingsAction({ digestFrequency: f, alertsEnabled: account.alertsEnabled });
      router.refresh();
    });
  return (
    <Panel title="Briefing frequency">
      <div className="space-y-1.5">
        {(Object.keys(FREQUENCY_LABEL) as DigestFrequency[]).map((f) => (
          <label key={f} className={cx("flex cursor-pointer items-start gap-2.5 rounded-xl px-2 py-1.5", account.digestFrequency === f && "bg-accent-soft/60")}>
            <input
              type="radio"
              name="frequency"
              checked={account.digestFrequency === f}
              disabled={pending}
              onChange={() => choose(f)}
              className="mt-1 accent-[var(--accent)]"
            />
            <span>
              <span className="block text-[13px] font-medium text-ink">{FREQUENCY_LABEL[f].label}</span>
              <span className="block text-[11.5px] leading-snug text-ink-muted">{FREQUENCY_LABEL[f].detail}</span>
            </span>
          </label>
        ))}
      </div>
      <p className="mt-2 text-[11.5px] text-ink-faint">
        Email and alert options are in{" "}
        <Link href="/settings" className="text-accent hover:underline">
          account settings
        </Link>
        .
      </p>
    </Panel>
  );
}

function WhatPaperPuffinKnows() {
  const { learned, weights, feedbackCount, savedIds, dismissedIds, library } = useSignal();
  const router = useRouter();
  const moved = new Set(changedPreferences(weights));
  const [pending, startTransition] = useTransition();
  const viewed = [...library.values()].filter((e) => e.viewedAt).length;

  return (
    <Panel title="What PaperPuffin uses">
      <p className="text-[12.5px] leading-relaxed text-ink-muted">
        Recommendations are judged against your topics and research profile. On top of that, your feedback adjusts how
        recommendations are <em>ordered</em> — never which papers count as relevant.
      </p>
      <ul className="mt-3 space-y-1 text-[12.5px] text-ink">
        <li>{savedIds.length} saved paper{savedIds.length === 1 ? "" : "s"}</li>
        <li>{dismissedIds.length} marked not relevant</li>
        <li>{viewed} paper{viewed === 1 ? "" : "s"} opened</li>
        <li>{feedbackCount} feedback interaction{feedbackCount === 1 ? "" : "s"} in total</li>
      </ul>
      <p className="mt-4 text-[12px] font-semibold text-ink">Reading preferences learned from feedback</p>
      <ul className="mt-2 space-y-2.5">
        {learned.map((pref) => (
          <li key={pref.id}>
            <p className="text-[12px] leading-snug text-ink">{pref.statement}</p>
            <div className="mt-1 flex items-center gap-2">
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-line">
                <div
                  className={cx("h-full rounded-full", moved.has(pref.key) ? "bg-beak" : "bg-accent/50")}
                  style={{ width: `${Math.round(pref.confidence * 100)}%` }}
                />
              </div>
              <span className="tabular text-[10.5px] text-ink-faint">{Math.round(pref.confidence * 100)}%</span>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">
        Everyone starts at 50%. These move a little each time you save, open, or dismiss a paper.
      </p>
      <Button
        size="sm"
        className="mt-3"
        disabled={pending || moved.size === 0}
        onClick={() =>
          startTransition(async () => {
            await resetPreferencesAction();
            router.refresh();
          })
        }
      >
        Reset learned preferences
      </Button>
      <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">
        You can delete your account and everything stored with it from{" "}
        <Link href="/settings" className="text-accent hover:underline">
          account settings
        </Link>
        .
      </p>
    </Panel>
  );
}

export function MyResearch() {
  const { topics, developments, now } = useSignal();

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
      <PageHeader
        title="My Research"
        description="Tell PaperPuffin what you're working on. Your topics decide which papers it looks for; your profile shapes how it explains them."
      />

      <div className="mt-6 grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,1fr)_330px]">
        <div className="min-w-0 space-y-6">
          <section>
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="font-display text-[20px] font-semibold text-ink">Topics you follow</h2>
                <p className="text-[12.5px] text-ink-muted">Up to eight. Each is searched in PubMed and preprint servers every morning.</p>
              </div>
              <LinkButton href="/topics/new" variant="primary">
                + New topic
              </LinkButton>
            </div>
            <ul className="mt-3 space-y-3">
              {topics.map((t) => {
                const recent = developments.filter((d) => d.topicId === t.id && now - Date.parse(d.evaluatedAt) < 30 * DAY).length;
                const terms = [...t.profile.keywords, ...t.profile.synonyms, ...t.profile.organisms];
                return (
                  <li key={t.id} className={cx("rounded-2xl border border-line bg-surface px-5 py-4", !t.active && "opacity-70")}>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <Link href={`/topics/${t.id}`} className="text-[15.5px] font-semibold text-ink hover:text-accent">
                        {t.profile.program}
                      </Link>
                      <span className="text-[11.5px] text-ink-faint">
                        {t.active ? (t.lastCheckedAt ? `Searched ${timeAgo(t.lastCheckedAt, now)}` : "Not searched yet") : "Paused"} ·{" "}
                        {recent} paper{recent === 1 ? "" : "s"} this month
                      </span>
                    </div>
                    {t.profile.description && <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-ink-muted">{t.profile.description}</p>}
                    <div className="mt-2 flex flex-wrap gap-1">
                      {terms.slice(0, 8).map((term) => (
                        <Chip key={term}>{term}</Chip>
                      ))}
                      {terms.length > 8 && <Chip tone="quiet">+{terms.length - 8}</Chip>}
                    </div>
                    <div className="mt-3 flex gap-3 border-t border-line pt-2.5 text-[12.5px]">
                      <Link href={`/topics/${t.id}`} className="font-medium text-accent hover:underline">
                        Edit topic
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <ProfileEditor />
        </div>

        <aside className="space-y-5">
          <BriefingPreferences />
          <WhatPaperPuffinKnows />
          <Panel title="Behind the scenes">
            <Link href="/monitoring" className="block text-[13px] font-medium text-accent hover:underline">
              Search history →
            </Link>
            <p className="mt-1 text-[11.5px] leading-relaxed text-ink-faint">
              Exactly what each search looked at, per topic and source, and why papers were or weren&rsquo;t recommended.
            </p>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
