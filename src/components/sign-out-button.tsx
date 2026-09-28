"use client";

import { useFormStatus } from "react-dom";
import { Spinner } from "./ui";

function Inner() {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-white/80 transition hover:bg-white/10 hover:text-white disabled:opacity-60"
    >
      {pending && <Spinner className="h-3 w-3" />}
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}

export function SignOutButton({ action }: { action: () => Promise<void> }) {
  return (
    <form action={action}>
      <Inner />
    </form>
  );
}
