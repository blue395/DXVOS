"use client";

import { useFormStatus } from "react-dom";
import { Spinner, buttonClass } from "./ui";

function Inner({ onLight }: { onLight: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className={
        onLight
          ? buttonClass("secondary")
          : "inline-flex items-center gap-1.5 rounded px-2 py-1 text-white/80 transition hover:bg-white/10 hover:text-white disabled:opacity-60"
      }
    >
      {pending && <Spinner className="h-3 w-3" />}
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}

/** `onLight`: an ordinary button on a white page (e.g. My profile), not the green header's link style. */
export function SignOutButton({ action, onLight = false }: { action: () => Promise<void>; onLight?: boolean }) {
  return (
    <form action={action}>
      <Inner onLight={onLight} />
    </form>
  );
}
