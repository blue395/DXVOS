// Small presentational building blocks. Server-component safe (no hooks).
import type { CommsStatus, Stage } from "@/generated/prisma/enums";
import { stageLabel } from "@/lib/pipeline";

export function Card({ title, children, actions }: { title?: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-black/10 bg-white">
      {title && (
        <header className="flex items-center justify-between border-b border-black/10 px-4 py-2.5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-dxv-green">{title}</h2>
          {actions}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export const inputClass =
  "w-full rounded-md border border-black/20 bg-white px-2.5 py-1.5 text-sm placeholder:text-black/40 focus:border-dxv-green focus:outline-none";

export function Field({
  label,
  children,
  hint,
  aiSuggested,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  /** Marks a value pre-filled by AI, so the reviewer knows to check it. */
  aiSuggested?: boolean;
}) {
  return (
    <label className="block space-y-1">
      <span className="flex items-center gap-1.5 text-xs font-medium text-black/70">
        {label}
        {aiSuggested && <AiTag />}
      </span>
      {children}
      {hint && <span className="block text-xs text-black/50">{hint}</span>}
    </label>
  );
}

export function StageBadge({ stage }: { stage: Stage }) {
  const passed = stage === "PASSED";
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
        passed ? "bg-black text-white" : "bg-dxv-green text-white"
      }`}
    >
      {stageLabel(stage)}
    </span>
  );
}

const COMMS_LABELS: Record<CommsStatus, string> = {
  NOT_YET_SENT: "Not yet sent",
  SENT: "Sent",
  FOUNDER_ACKNOWLEDGED: "Founder acknowledged",
};

export function commsLabel(s: CommsStatus) {
  return COMMS_LABELS[s];
}

export function CommsBadge({ status }: { status: CommsStatus }) {
  const cls =
    status === "NOT_YET_SENT"
      ? "bg-dxv-yellow text-dxv-green"
      : status === "SENT"
        ? "bg-dxv-green/10 text-dxv-green"
        : "bg-dxv-green text-white";
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{COMMS_LABELS[status]}</span>;
}

export function AiTag({ children = "AI suggested" }: { children?: React.ReactNode }) {
  return (
    <span className="rounded bg-dxv-yellow px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-dxv-green">
      {children}
    </span>
  );
}

export function WarningIcon({ title }: { title: string }) {
  return (
    <span
      title={title}
      aria-label={title}
      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-dxv-yellow text-xs font-bold text-dxv-green"
    >
      !
    </span>
  );
}

export function formatDate(d: Date | null | undefined) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" }).format(d);
}

export function formatDateTime(d: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  }).format(d);
}

export function buttonClass(variant: "primary" | "secondary" | "accent" = "primary") {
  const base =
    "inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium transition disabled:opacity-50 cursor-pointer";
  switch (variant) {
    case "primary":
      return `${base} bg-dxv-green text-white hover:bg-dxv-green/90`;
    case "accent":
      return `${base} bg-dxv-yellow text-dxv-green hover:bg-dxv-yellow/80`;
    case "secondary":
      return `${base} border border-dxv-green/30 bg-white text-dxv-green hover:bg-dxv-green/5`;
  }
}
