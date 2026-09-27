"use client";

import { createContext, startTransition, useActionState, useContext, useEffect, useRef } from "react";
import type { ActionResult } from "@/lib/action-result";
import { buttonClass } from "./ui";

type Props = {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  className?: string;
  /** Clear the inputs after a successful submit (true for "add X" forms). */
  resetOnSuccess?: boolean;
};

const PendingContext = createContext(false);

// Wraps a server action with pending state + inline error display.
//
// Why onSubmit instead of just `action={formAction}`: React 19 automatically resets
// a form after its action runs — even when the action returned an error — which
// wipes what the user typed. Dispatching ourselves inside startTransition skips that
// auto-reset, so we only clear the form on success. `action` stays set so the form
// still works before JavaScript has loaded.
export function ActionForm({ action, children, className, resetOnSuccess = true }: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form
      ref={ref}
      action={formAction}
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
    >
      <PendingContext.Provider value={pending}>{children}</PendingContext.Provider>
      {state.error && (
        <p role="alert" className="mt-2 rounded border-l-4 border-dxv-yellow bg-dxv-yellow/20 px-3 py-2 text-sm">
          {state.error}
        </p>
      )}
    </form>
  );
}

export function SubmitButton({ children, variant = "primary" }: { children: React.ReactNode; variant?: "primary" | "secondary" }) {
  const pending = useContext(PendingContext);
  return (
    <button type="submit" disabled={pending} className={buttonClass(variant)}>
      {pending ? "Saving…" : children}
    </button>
  );
}
