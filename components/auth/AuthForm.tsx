"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { FormState } from "@/app/(auth)/actions";
import { Logo } from "@/components/brand/Puffin";
import { cx } from "@/components/ui/primitives";

export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-[400px]">
        <Link href="/" className="flex justify-center" aria-label="PaperPuffin">
          <Logo size="lg" />
        </Link>
        <div className="mt-6 rounded-3xl border border-line bg-surface px-6 py-7 shadow-[0_4px_24px_rgba(21,35,63,0.06)]">
          <h1 className="font-display text-[22px] font-semibold text-ink">{title}</h1>
          {subtitle && <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">{subtitle}</p>}
          <div className="mt-5">{children}</div>
        </div>
        {footer && <div className="mt-4 text-center text-[13px] text-ink-muted">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({
  label,
  name,
  type = "text",
  autoComplete,
  defaultValue,
  hint,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  defaultValue?: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="text-[12px] font-medium text-ink">{label}</span>
      <input
        name={name}
        type={type}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        required
        className="mt-1.5 block w-full rounded-xl border border-line-strong bg-white px-3 py-2.5 text-[14px] text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
      />
      {hint && <span className="mt-1 block text-[11px] text-ink-faint">{hint}</span>}
    </label>
  );
}

export function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex w-full items-center justify-center rounded-xl border border-accent bg-accent px-3 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-accent-strong disabled:cursor-wait disabled:opacity-70"
    >
      {pending ? "Working…" : children}
    </button>
  );
}

export function FormMessage({ state }: { state: FormState }) {
  if (state.error) {
    return (
      <p role="alert" className="rounded-xl border border-negative/25 bg-[#fdf1ee] px-3 py-2 text-[13px] text-negative">
        {state.error}
      </p>
    );
  }
  if (state.message) {
    return (
      <p role="status" className="rounded-xl border border-positive/25 bg-[#eef6f1] px-3 py-2 text-[13px] text-positive">
        {state.message}
      </p>
    );
  }
  return null;
}

/** A form bound to a server action, rendering its error/message state. */
export function ActionForm({
  action,
  initial = {},
  children,
  className,
}: {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  initial?: FormState;
  children: (state: FormState) => React.ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, initial);
  return (
    <form action={formAction} className={cx("space-y-4", className)}>
      <FormMessage state={state} />
      {children(state)}
    </form>
  );
}
