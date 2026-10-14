"use client";

import { useActionState } from "react";

type Result = { error?: string; ok?: boolean };

export function ActionForm({
  action, children, submit, className = "space-y-4", submitClass = "btn-primary w-full",
}: {
  action: (prev: Result | undefined, form: FormData) => Promise<Result>;
  children: React.ReactNode;
  submit: string;
  className?: string;
  submitClass?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className={className}>
      {children}
      {state?.error && <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{state.error}</p>}
      <button className={submitClass} disabled={pending}>{pending ? "Working…" : submit}</button>
    </form>
  );
}
