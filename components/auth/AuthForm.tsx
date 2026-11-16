"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { FormState } from "@/app/(auth)/actions";
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
        <Link href="/" className="flex items-baseline gap-2">
          <span className="text-[19px] font-semibold tracking-tight text-ink">Signal</span>
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
        </Link>
        <div className="mt-5 rounded-md border border-line bg-surface px-6 py-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <h1 className="text-[19px] font-semibold tracking-[-0.01em] text-ink">{title}</h1>
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
        className="mt-1.5 block w-full rounded border border-line-strong bg-white px-3 py-2 text-[14px] text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
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
      className="inline-flex w-full items-center justify-center rounded border border-accent bg-accent px-3 py-2 text-[14px] font-medium text-white transition-colors hover:bg-[#105066] disabled:cursor-wait disabled:opacity-70"
    >
      {pending ? "Working…" : children}
    </button>
  );
}

export function FormMessage({ state }: { state: FormState }) {
  if (state.error) {
    return (
      <p role="alert" className="rounded border border-negative/25 bg-[#fdf1ee] px-3 py-2 text-[13px] text-negative">
        {state.error}
      </p>
    );
  }
  if (state.message) {
    return (
      <p role="status" className="rounded border border-positive/25 bg-[#eef6f1] px-3 py-2 text-[13px] text-positive">
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
