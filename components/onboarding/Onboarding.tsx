"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Puffin, type PuffinMood } from "@/components/brand/Puffin";
import {
  AcademicLevelPicker,
  FieldInput,
  FoundationalPapersField,
  Label,
  inputClass,
} from "@/components/research/ProfileFields";
import { TagField } from "@/components/topics/TagField";
import { Button, cx } from "@/components/ui/primitives";
import { completeOnboardingAction, suggestTermsAction } from "@/lib/profile/actions";
import { EMPTY_STUDENT_PROFILE } from "@/lib/profile/student";
import type { StudentProfile } from "@/lib/types";

type Frequency = "weekly" | "daily" | "off";

interface Terms {
  program: string;
  keywords: string[];
  synonyms: string[];
  genes: string[];
  organisms: string[];
  diseases: string[];
  techniques: string[];
}

const EMPTY_TERMS: Terms = { program: "", keywords: [], synonyms: [], genes: [], organisms: [], diseases: [], techniques: [] };

const STEPS: { title: string; mood: PuffinMood; blurb: string }[] = [
  { title: "About you", mood: "default", blurb: "So explanations start at the right level." },
  { title: "Your research", mood: "curious", blurb: "In your own words — no jargon needed." },
  { title: "What to look for", mood: "reading", blurb: "The search terms PaperPuffin uses to find new papers." },
  { title: "Papers you build on", mood: "reading", blurb: "Optional: papers your project is based on." },
  { title: "Staying current", mood: "default", blurb: "How often you'd like a briefing." },
];

/**
 * First-run setup. Five short steps; only a topic name and one search term
 * are required (PaperPuffin can't look for papers without them), and the AI
 * suggests the search terms from the student's own description.
 */
export function Onboarding({ email }: { email: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [student, setStudent] = useState<StudentProfile>(EMPTY_STUDENT_PROFILE);
  const [terms, setTerms] = useState<Terms>(EMPTY_TERMS);
  const [frequency, setFrequency] = useState<Frequency>("weekly");
  const [suggested, setSuggested] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [suggesting, startSuggest] = useTransition();
  const [finishing, startFinish] = useTransition();

  const setS = <K extends keyof StudentProfile>(k: K, v: StudentProfile[K]) => setStudent((s) => ({ ...s, [k]: v }));
  const setT = <K extends keyof Terms>(k: K, v: Terms[K]) => setTerms((t) => ({ ...t, [k]: v }));

  const suggest = () =>
    startSuggest(async () => {
      setNote(null);
      const r = await suggestTermsAction({
        field: student.field,
        researchQuestion: student.researchQuestion,
        projectDescription: student.projectDescription,
      });
      setSuggested(true);
      if (!r.ok) {
        setNote(`${r.error} You can add terms yourself below.`);
        return;
      }
      const merge = (a: string[], b: string[]) => [...new Set([...a, ...b])];
      setTerms((t) => ({
        program: t.program || r.value.topicName || student.researchQuestion.slice(0, 120),
        keywords: merge(t.keywords, r.value.keywords),
        synonyms: merge(t.synonyms, r.value.synonyms),
        genes: merge(t.genes, r.value.genes),
        organisms: merge(t.organisms, r.value.organisms),
        diseases: merge(t.diseases, r.value.diseases),
        techniques: merge(t.techniques, r.value.techniques),
      }));
      setNote("Suggested by AI from your description. Remove anything that doesn't fit, and add what's missing.");
    });

  const goTo = (next: number) => {
    setError(null);
    if (next === 2 && !suggested && (student.researchQuestion.trim() || student.projectDescription.trim())) {
      if (!terms.program) setT("program", student.researchQuestion.trim().slice(0, 120));
      suggest();
    }
    setStep(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const canLeaveResearch = student.researchQuestion.trim().length >= 3;
  const canLeaveTerms = terms.program.trim().length >= 2 && terms.keywords.length > 0;

  const finish = () =>
    startFinish(async () => {
      setError(null);
      const { updatedAt: _u, ...profile } = student;
      void _u;
      const r = await completeOnboardingAction({
        student: profile,
        topic: {
          program: terms.program.trim(),
          description: [student.researchQuestion, student.projectDescription].filter((x) => x.trim()).join("\n\n"),
          keywords: terms.keywords,
          synonyms: terms.synonyms,
          genes: terms.genes,
          organisms: terms.organisms,
          diseases: terms.diseases,
          techniques: terms.techniques,
        },
        digestFrequency: frequency,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.push("/home");
      router.refresh();
    });

  const meta = STEPS[step];

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center gap-1.5" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
        {STEPS.map((s, i) => (
          <span key={s.title} className={cx("h-1.5 flex-1 rounded-full transition-colors", i <= step ? "bg-accent" : "bg-line")} />
        ))}
      </div>

      <div className="mt-6 flex items-start gap-4">
        <Puffin size={64} mood={meta.mood} className="shrink-0" />
        <div>
          <p className="eyebrow text-[10.5px] font-semibold text-accent">
            Step {step + 1} of {STEPS.length}
          </p>
          <h1 className="font-display text-[26px] leading-tight font-semibold text-ink sm:text-[30px]">{meta.title}</h1>
          <p className="mt-1 text-[14px] text-ink-muted">{meta.blurb}</p>
        </div>
      </div>

      <div className="mt-7 rounded-3xl border border-line bg-surface px-5 py-6 shadow-[0_1px_3px_rgba(21,35,63,0.04)] sm:px-7">
        {step === 0 && (
          <div className="space-y-6">
            <p className="text-[13.5px] leading-relaxed text-ink-muted">
              Welcome! You&rsquo;re signed in as <strong className="text-ink">{email}</strong>. This takes about two minutes, and you
              can change everything later in My Research.
            </p>
            <div>
              <Label>Where are you in your studies?</Label>
              <div className="mt-2">
                <AcademicLevelPicker value={student.academicLevel} onChange={(v) => setS("academicLevel", v)} />
              </div>
            </div>
            <div>
              <Label htmlFor="field">Research field</Label>
              <FieldInput value={student.field} onChange={(v) => setS("field", v)} />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6">
            <div>
              <Label htmlFor="question">What are you researching?</Label>
              <input
                id="question"
                autoFocus
                value={student.researchQuestion}
                onChange={(e) => setS("researchQuestion", e.target.value)}
                maxLength={600}
                placeholder="e.g. How Vibrio natriegens becomes resistant to spectinomycin"
                className={inputClass}
              />
              <p className="mt-1.5 text-[12px] text-ink-faint">A topic or a question, a sentence is plenty.</p>
            </div>
            <div>
              <Label htmlFor="project" hint="optional, but it helps a lot">
                Tell PaperPuffin about your project
              </Label>
              <textarea
                id="project"
                value={student.projectDescription}
                onChange={(e) => setS("projectDescription", e.target.value)}
                rows={5}
                maxLength={4000}
                placeholder="What are you doing in the lab or at the computer? Which organisms, methods or datasets? What would you love to find out?"
                className={cx(inputClass, "resize-y leading-relaxed")}
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            {suggesting ? (
              <div className="flex items-center gap-3 rounded-2xl bg-accent-soft/60 px-4 py-3">
                <Puffin size={34} mood="reading" bob />
                <p className="text-[13px] text-ink">Reading your description and choosing search terms…</p>
              </div>
            ) : (
              note && <p className="rounded-xl bg-accent-soft/60 px-4 py-2.5 text-[12.5px] text-ink">{note}</p>
            )}
            <div>
              <Label htmlFor="program">Topic name</Label>
              <input
                id="program"
                value={terms.program}
                onChange={(e) => setT("program", e.target.value)}
                maxLength={120}
                placeholder="A short name for this research topic"
                className={inputClass}
              />
            </div>
            <TagField label="Search terms" hint="at least one · searched in PubMed and preprints" values={terms.keywords} onChange={(v) => setT("keywords", v)} />
            <TagField label="Organisms" hint="optional · full species names" values={terms.organisms} onChange={(v) => setT("organisms", v)} />
            <TagField label="Genes / proteins" hint="optional" values={terms.genes} onChange={(v) => setT("genes", v)} />
            <TagField label="Methods you use" hint="optional · used for ranking, not searching" values={terms.techniques} onChange={(v) => setT("techniques", v)} />
            {(terms.synonyms.length > 0 || terms.diseases.length > 0) && (
              <>
                <TagField label="Other spellings and abbreviations" values={terms.synonyms} onChange={(v) => setT("synonyms", v)} />
                <TagField label="Diseases" values={terms.diseases} onChange={(v) => setT("diseases", v)} />
              </>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm" onClick={suggest} disabled={suggesting || !(student.researchQuestion.trim() || student.projectDescription.trim())}>
                ✨ {suggested ? "Suggest more terms" : "Suggest terms with AI"}
              </Button>
              <span className="text-[11.5px] text-ink-faint">Specific phrases work better than broad ones like &ldquo;bacteria&rdquo; or &ldquo;sequencing&rdquo;.</span>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <p className="text-[13.5px] leading-relaxed text-ink-muted">
              Paste a DOI, a PubMed ID or a link for papers your project builds on — maybe ones your PI asked you to read.
              PaperPuffin looks each one up and uses it to understand your project.
            </p>
            <FoundationalPapersField value={student.foundationalPapers} onChange={(v) => setS("foundationalPapers", v)} />
          </div>
        )}

        {step === 4 && (
          <div className="space-y-2">
            {(
              [
                ["weekly", "Weekly briefing", "The most relevant new papers each week and why they matter. Recommended."],
                ["daily", "Daily briefing", "Each morning, only when something new turns up."],
                ["off", "No email", "Check your briefings in the app whenever you like."],
              ] as [Frequency, string, string][]
            ).map(([value, label, detail]) => (
              <label
                key={value}
                className={cx(
                  "flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition-colors",
                  frequency === value ? "border-accent bg-accent-soft/60" : "border-line-strong hover:border-ink-faint",
                )}
              >
                <input type="radio" name="frequency" checked={frequency === value} onChange={() => setFrequency(value)} className="mt-1 accent-[var(--accent)]" />
                <span>
                  <span className="block text-[14px] font-semibold text-ink">{label}</span>
                  <span className="block text-[12.5px] text-ink-muted">{detail}</span>
                </span>
              </label>
            ))}
            <p className="pt-2 text-[12px] leading-relaxed text-ink-faint">
              After you finish, PaperPuffin looks back over the last 30 days of papers for your topic. It also searches
              each morning.
            </p>
          </div>
        )}

        {error && (
          <p role="alert" className="mt-5 rounded-xl border border-negative/25 bg-[#fdf1ee] px-4 py-2.5 text-[13px] text-negative">
            {error}
          </p>
        )}

        <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
          <Button variant="ghost" onClick={() => goTo(step - 1)} disabled={step === 0 || finishing}>
            ← Back
          </Button>
          <div className="flex items-center gap-2">
            {(step === 0 || step === 3) && (
              <Button variant="ghost" onClick={() => goTo(step + 1)}>
                Skip
              </Button>
            )}
            {step < STEPS.length - 1 ? (
              <Button
                variant="primary"
                onClick={() => goTo(step + 1)}
                disabled={(step === 1 && !canLeaveResearch) || (step === 2 && (!canLeaveTerms || suggesting))}
              >
                Continue →
              </Button>
            ) : (
              <Button variant="primary" onClick={finish} disabled={finishing || !canLeaveTerms}>
                {finishing ? "Setting up…" : "Start exploring"}
              </Button>
            )}
          </div>
        </div>
        {step === 2 && !canLeaveTerms && !suggesting && (
          <p className="mt-2 text-right text-[11.5px] text-ink-faint">Add a topic name and at least one search term to continue.</p>
        )}
      </div>
    </div>
  );
}
