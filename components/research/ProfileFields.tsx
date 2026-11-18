"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/ui/Icon";
import { Button, cx } from "@/components/ui/primitives";
import { resolvePaperAction } from "@/lib/profile/actions";
import { ACADEMIC_LEVELS, EXPLANATION_LEVELS, SUGGESTED_FIELDS } from "@/lib/profile/student";
import type { AcademicLevel, ExplanationLevel, FoundationalPaper } from "@/lib/types";

export const inputClass =
  "mt-1.5 w-full rounded-xl border border-line-strong bg-white px-3 py-2 text-[14px] text-ink outline-none placeholder:text-ink-faint focus:border-accent focus:ring-2 focus:ring-accent/15";

export function Label({ htmlFor, children, hint }: { htmlFor?: string; children: React.ReactNode; hint?: string }) {
  return (
    <label htmlFor={htmlFor} className="block text-[13px] font-semibold text-ink">
      {children}
      {hint && <span className="ml-1.5 font-normal text-ink-faint">{hint}</span>}
    </label>
  );
}

export function AcademicLevelPicker({
  value,
  onChange,
}: {
  value: AcademicLevel | null;
  onChange: (v: AcademicLevel | null) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Academic level" className="grid gap-2 sm:grid-cols-2">
      {ACADEMIC_LEVELS.map((l) => (
        <button
          key={l.value}
          type="button"
          role="radio"
          aria-checked={value === l.value}
          onClick={() => onChange(value === l.value ? null : l.value)}
          className={cx(
            "rounded-xl border px-3.5 py-2.5 text-left transition-colors",
            value === l.value ? "border-accent bg-accent-soft" : "border-line-strong bg-white hover:border-ink-faint",
          )}
        >
          <span className="block text-[13.5px] font-semibold text-ink">{l.label}</span>
          {l.hint && <span className="block text-[12px] text-ink-muted">{l.hint}</span>}
        </button>
      ))}
    </div>
  );
}

export function FieldInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <>
      <input
        id="field"
        list="field-suggestions"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. Microbiology"
        maxLength={120}
        className={inputClass}
      />
      <datalist id="field-suggestions">
        {SUGGESTED_FIELDS.map((f) => (
          <option key={f} value={f} />
        ))}
      </datalist>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {SUGGESTED_FIELDS.slice(0, 8).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => onChange(f)}
            className={cx(
              "rounded-full border px-2.5 py-0.5 text-[12px] transition-colors",
              value === f ? "border-accent bg-accent-soft text-accent" : "border-line bg-white text-ink-muted hover:border-line-strong",
            )}
          >
            {f}
          </button>
        ))}
      </div>
    </>
  );
}

export function ExplanationLevelPicker({
  value,
  onChange,
}: {
  value: ExplanationLevel | null;
  onChange: (v: ExplanationLevel | null) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-4">
      {[{ value: null, label: "Automatic", detail: "Based on your academic level" }, ...EXPLANATION_LEVELS].map((l) => (
        <button
          key={l.label}
          type="button"
          aria-pressed={value === l.value}
          onClick={() => onChange(l.value as ExplanationLevel | null)}
          className={cx(
            "rounded-xl border px-3 py-2 text-left transition-colors",
            value === l.value ? "border-accent bg-accent-soft" : "border-line-strong bg-white hover:border-ink-faint",
          )}
        >
          <span className="block text-[13px] font-semibold text-ink">{l.label}</span>
          <span className="block text-[11.5px] leading-snug text-ink-muted">{l.detail}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * Foundational papers: paste a DOI, PMID or link and it is looked up in
 * Europe PMC. Unfound identifiers are kept as typed and marked as such.
 */
export function FoundationalPapersField({
  value,
  onChange,
}: {
  value: FoundationalPaper[];
  onChange: (v: FoundationalPaper[]) => void;
}) {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const add = () =>
    startTransition(async () => {
      setError(null);
      const text = input.trim();
      if (!text) return;
      if (value.some((p) => p.input === text)) {
        setError("Already added.");
        return;
      }
      const result = await resolvePaperAction(text);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onChange([...value, result.value].slice(0, 10));
      setInput("");
    });

  return (
    <div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="DOI, PMID or PubMed link — e.g. 10.1038/nmeth.4019"
          className={cx(inputClass, "mt-0")}
          aria-label="Add a foundational paper"
        />
        <Button onClick={add} disabled={pending || !input.trim() || value.length >= 10}>
          {pending ? "Looking up…" : "Add"}
        </Button>
      </div>
      {error && <p className="mt-1.5 text-[12px] text-negative">{error}</p>}
      {value.length > 0 && (
        <ul className="mt-3 space-y-2">
          {value.map((p) => (
            <li key={p.input} className="flex items-start justify-between gap-3 rounded-xl border border-line bg-canvas px-3 py-2">
              <div className="min-w-0">
                {p.resolved ? (
                  <>
                    <p className="text-[13px] leading-snug font-medium text-ink">
                      {p.url ? (
                        <a href={p.url} target="_blank" rel="noreferrer" className="hover:text-accent hover:underline">
                          {p.title}
                        </a>
                      ) : (
                        p.title
                      )}
                    </p>
                    <p className="text-[11.5px] text-ink-faint">
                      {[p.authors, p.journal, p.year].filter(Boolean).join(" · ")}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-mono text-[12px] text-ink">{p.input}</p>
                    <p className="text-[11.5px] text-ink-faint">Not found in Europe PMC — kept as you entered it, but not used for recommendations.</p>
                  </>
                )}
              </div>
              <button
                type="button"
                aria-label="Remove paper"
                onClick={() => onChange(value.filter((x) => x.input !== p.input))}
                className="shrink-0 rounded-lg p-1 text-ink-faint hover:bg-white hover:text-negative"
              >
                <Icon name="x" size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
