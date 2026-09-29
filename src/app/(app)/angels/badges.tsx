// Small presentational pieces for the Angels screens. Server-component safe.
import type { AngelStatus } from "@/generated/prisma/enums";
import { ANGEL_STATUS_LABELS, CERT_STATE_LABELS, type CertState } from "@/lib/pipeline";
import { formatDate } from "@/components/ui";

export function AngelStatusBadge({ status }: { status: AngelStatus }) {
  const cls = status === "MEMBER" ? "bg-dxv-green text-white" : status === "PROSPECT" ? "bg-white text-dxv-green ring-1 ring-dxv-green/40" : "bg-black/10 text-black/70";
  return <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>{ANGEL_STATUS_LABELS[status]}</span>;
}

/** Certification state. Overdue (or none, for a member) is the compliance flag: yellow, never missable. */
export function CertBadge({ state, expiresOn, member }: { state: CertState; expiresOn?: Date | null; member: boolean }) {
  const alarm = state === "overdue" || (state === "none" && member);
  const cls = alarm
    ? "bg-dxv-yellow text-black ring-1 ring-black/20 font-semibold"
    : state === "due-soon"
      ? "bg-dxv-yellow/40 text-black"
      : state === "current"
        ? "bg-dxv-green/10 text-dxv-green"
        : "bg-black/5 text-black/55";
  const label = state === "none" && member ? "Not certified" : CERT_STATE_LABELS[state];
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] ${cls}`}>
      {alarm && <span aria-hidden>!</span>}
      {label}
      {expiresOn && state !== "none" && <span className="font-normal opacity-70">· {state === "overdue" ? "expired" : "to"} {formatDate(expiresOn)}</span>}
    </span>
  );
}

export function Chips({ items, className = "bg-dxv-green/10 text-dxv-green" }: { items: string[]; className?: string }) {
  if (!items.length) return null;
  return (
    <span className="flex flex-wrap gap-1">
      {items.map((s) => (
        <span key={s} className={`rounded-full px-2 py-0.5 text-[11px] ${className}`}>
          {s}
        </span>
      ))}
    </span>
  );
}
