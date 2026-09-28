"use client";

import { createContext, startTransition, useActionState, useContext, useEffect, useRef, useState } from "react";
import type { ActionResult } from "@/lib/action-result";
import { buttonClass, Spinner, type ButtonVariant } from "./ui";

type Props = {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  className?: string;
  /** Clear the inputs after a successful submit (true for "add X" forms). */
  resetOnSuccess?: boolean;
  /** Called after a successful submit (e.g. to close a panel). */
  onSuccess?: () => void;
};

const FormStateContext = createContext({ pending: false, justSaved: false });

// Wraps a server action with pending state, a brief "saved" confirmation, and
// inline error display.
//
// Why onSubmit instead of just `action={formAction}`: React 19 automatically resets
// a form after its action runs — even when the action returned an error — which
// wipes what the user typed. Dispatching ourselves inside startTransition skips that
// auto-reset, so we only clear the form on success. `action` stays set so the form
// still works before JavaScript has loaded.
export function ActionForm({ action, children, className, resetOnSuccess = true, onSuccess }: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  const ref = useRef<HTMLFormElement>(null);
  const [seen, setSeen] = useState(state);
  const [justSaved, setJustSaved] = useState(false);
  const onSuccessRef = useRef(onSuccess);
  useEffect(() => {
    onSuccessRef.current = onSuccess;
  });

  // A new result arrived: flag success for the button (adjust-state-on-change pattern, no effect).
  if (state !== seen) {
    setSeen(state);
    setJustSaved(!!state.ok);
  }

  useEffect(() => {
    if (!state.ok) return;
    if (resetOnSuccess) ref.current?.reset();
    onSuccessRef.current?.();
    const t = setTimeout(() => setJustSaved(false), 2000);
    return () => clearTimeout(t);
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
      <FormStateContext.Provider value={{ pending, justSaved: justSaved && !pending }}>{children}</FormStateContext.Provider>
      {state.error && (
        <p role="alert" className="mt-2 rounded border-l-4 border-dxv-yellow bg-dxv-yellow/20 px-3 py-2 text-sm">
          {state.error}
        </p>
      )}
    </form>
  );
}

export function SubmitButton({
  children,
  variant = "primary",
  pendingLabel = "Saving…",
  doneLabel = "Saved",
}: {
  children: React.ReactNode;
  variant?: ButtonVariant;
  pendingLabel?: string;
  doneLabel?: string;
}) {
  const { pending, justSaved } = useContext(FormStateContext);
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={buttonClass(variant)}>
      {pending ? (
        <>
          <Spinner />
          {pendingLabel}
        </>
      ) : justSaved ? (
        <>
          <span aria-hidden>✓</span>
          {doneLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}
