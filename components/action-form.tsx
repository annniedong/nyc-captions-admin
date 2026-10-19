"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { buttonClass } from "@/lib/ui";

type State = { error?: string; ok?: string };

export function ActionForm({
  action,
  children,
  className,
  confirmMessage,
}: {
  action: (prev: State, formData: FormData) => Promise<State>;
  children: React.ReactNode;
  className?: string;
  confirmMessage?: string;
}) {
  const [state, formAction] = useActionState(action, {} as State);

  return (
    <form
      action={formAction}
      className={className}
      onSubmit={(event) => {
        if (confirmMessage && !window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
    >
      {children}
      {state.error && (
        <p role="alert" className="mt-2 text-sm font-extrabold text-danger">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p role="status" className="mt-2 text-sm font-extrabold text-primary">
          {state.ok}
        </p>
      )}
    </form>
  );
}

export function SubmitButton({
  children,
  pendingLabel = "Working…",
  variant = "primary",
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "danger";
}) {
  const { pending } = useFormStatus();
  const base =
    variant === "danger"
      ? "inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-danger px-5 text-sm font-extrabold uppercase tracking-wide text-white shadow-[0_4px_0_var(--danger-dark)] transition-[transform,box-shadow] duration-100 hover:brightness-110 active:translate-y-1 active:shadow-none disabled:opacity-50"
      : buttonClass(variant, "md");

  return (
    <button type="submit" disabled={pending} className={base}>
      {pending ? pendingLabel : children}
    </button>
  );
}
