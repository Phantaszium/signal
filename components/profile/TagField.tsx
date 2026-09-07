"use client";

import { useState } from "react";
import { cx } from "@/components/ui/primitives";

/** Comma/Enter-delimited list editor used for every list field on the profile. */
export function TagField({
  label,
  hint,
  values,
  onChange,
  placeholder = "Add a term and press Enter",
}: {
  label: string;
  hint?: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");

  const commit = (raw: string) => {
    const items = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((s) => !values.some((v) => v.toLowerCase() === s.toLowerCase()));
    if (items.length) onChange([...values, ...items]);
    setDraft("");
  };

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label className="text-[12px] font-medium text-ink">{label}</label>
        {hint && <span className="text-[10px] text-ink-faint">{hint}</span>}
      </div>
      <div
        className={cx(
          "mt-1.5 flex flex-wrap gap-1.5 rounded border border-line bg-white px-2 py-2",
          "focus-within:border-accent/50",
        )}
      >
        {values.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1 rounded border border-line bg-canvas py-0.5 pr-1 pl-2 text-[12px] text-ink-muted"
          >
            {v}
            <button
              type="button"
              aria-label={`Remove ${v}`}
              onClick={() => onChange(values.filter((x) => x !== v))}
              className="rounded px-1 text-ink-faint hover:bg-line hover:text-ink"
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              commit(draft);
            } else if (e.key === "Backspace" && !draft && values.length) {
              onChange(values.slice(0, -1));
            }
          }}
          onBlur={() => draft && commit(draft)}
          placeholder={values.length ? "" : placeholder}
          className="min-w-[140px] flex-1 bg-transparent px-1 py-0.5 text-[12px] text-ink outline-none placeholder:text-ink-faint"
        />
      </div>
    </div>
  );
}
