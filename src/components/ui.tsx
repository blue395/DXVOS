// Small presentational building blocks. Server-component safe (no hooks).
import type { CommsStatus, Stage } from "@/generated/prisma/enums";
import { stageLabel } from "@/lib/pipeline";

export type CardCollapse = {
  /** Open on page load (the section matters at the deal's current stage). */
  open: boolean;
  /** One line shown in the header while collapsed, e.g. "£20k from 2 angels". */
  summary?: React.ReactNode;
  /** Mark as relevant to the current stage. */
  now?: boolean;
};

/**
 * A titled panel. With `collapse`, it becomes a native <details> section: click the
 * header to open or close it (no JavaScript needed). `id` makes it a jump target.
 */
export function Card({
  title,
  children,
  actions,
  id,
  collapse,
}: {
  title?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  id?: string;
  collapse?: CardCollapse;
}) {
  if (collapse && title) {
    return (
      <details id={id} open={collapse.open} className="group scroll-mt-16 rounded-lg border border-black/10 bg-white">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-4 py-2.5 transition hover:bg-dxv-green/[0.04] [&::-webkit-details-marker]:hidden">
          <span className="flex min-w-0 items-center gap-2">
            <span aria-hidden className="text-xs text-dxv-green transition-transform group-open:rotate-90">
              ▶
            </span>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-dxv-green">{title}</h2>
            {collapse.now && (
              <span className="rounded-full bg-dxv-yellow px-2 py-px text-[10px] font-semibold uppercase tracking-wide text-dxv-green">Now</span>
            )}
          </span>
          <span className="flex min-w-0 items-center gap-3">
            {collapse.summary && <span className="truncate text-xs text-black/55 group-open:hidden">{collapse.summary}</span>}
            {actions && <span className="hidden group-open:inline">{actions}</span>}
          </span>
        </summary>
        <div className="border-t border-black/10 p-4">{children}</div>
      </details>
    );
  }
  return (
    <section id={id} className="scroll-mt-16 rounded-lg border border-black/10 bg-white">
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
  // Fixed width, one line: badges line up whatever the status.
  return (
    <span className={`inline-flex w-40 shrink-0 justify-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {COMMS_LABELS[status]}
    </span>
  );
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

export type ButtonVariant = "primary" | "secondary" | "accent";

/**
 * Buttons lift slightly and gain a ring on hover, press down on click, and show a
 * "not allowed" cursor while disabled, so it's always clear they do something.
 */
export function buttonClass(variant: ButtonVariant = "primary") {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium cursor-pointer select-none " +
    "transition duration-150 hover:-translate-y-px active:translate-y-0 active:scale-[0.98] " +
    "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-60 disabled:translate-y-0";
  switch (variant) {
    case "primary":
      return `${base} bg-dxv-green text-white shadow-sm hover:shadow-md hover:ring-2 hover:ring-dxv-yellow`;
    case "accent":
      return `${base} bg-dxv-yellow text-dxv-green shadow-sm hover:shadow-md hover:ring-2 hover:ring-dxv-green/40`;
    case "secondary":
      return `${base} border border-dxv-green/30 bg-white text-dxv-green hover:border-dxv-green hover:bg-dxv-green/10 hover:shadow-sm`;
  }
}

/** Small spinner that inherits the text colour. */
export function Spinner({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return <span aria-hidden className={`${className} inline-block shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent`} />;
}

/** Grey placeholder block for loading screens. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-md bg-black/[0.06] ${className}`} />;
}
