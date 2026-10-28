// Small pieces shared by the members' deals board and deal room: progress towards the
// £25k minimum (aggregate only), where the member stands in the round's vote, and the
// "How this works" explainer. Server components (no client code).
import Link from "next/link";
import { HOW_IT_WORKS } from "@/content/member-help";
import { EOI_MINIMUM_GBP, EOI_PROGRESS_MIN_INTERESTED, formatGbpCompact, type EoiProgress } from "@/lib/pipeline";
import type { RoundVoting } from "@/lib/portal-deals";

/** UK time with the weekday, e.g. "Thu 5 Nov, 18:00". */
export function formatWhen(d: Date, opts: { year?: boolean } = {}) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(opts.year ? { year: "numeric" } : {}),
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  }).format(d);
}

/** Members' combined interest towards the minimum. `compact` is the board card's version. */
export function EoiProgressBar({ progress, compact = false }: { progress: EoiProgress; compact?: boolean }) {
  const minimum = formatGbpCompact(EOI_MINIMUM_GBP);
  if (!progress.show) {
    return compact ? (
      <span className="mt-2 block text-[11px] text-black/50">Gathering interest towards {minimum}</span>
    ) : (
      <p className="text-sm text-black/60">
        Gathering interest. Progress towards the {minimum} minimum shows here once at least {EOI_PROGRESS_MIN_INTERESTED} members are interested.
      </p>
    );
  }
  const label = progress.reached ? `${minimum} minimum reached` : `${formatGbpCompact(progress.totalGbp)} of ${minimum}`;
  return (
    <div className={compact ? "mt-2" : "space-y-1.5"}>
      {!compact && (
        <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
          <span className="font-semibold text-dxv-green">{label}</span>
          <span className="text-xs text-black/55">From {progress.interestedCount} interested members (their stated maximums)</span>
        </p>
      )}
      <div
        role="progressbar"
        aria-label={`Members' interest: ${label}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress.percent}
        className={`overflow-hidden rounded-full bg-dxv-green/10 ${compact ? "h-1.5" : "h-2.5"}`}
      >
        <div className="h-full rounded-full bg-dxv-green" style={{ width: `${Math.max(progress.percent, 2)}%` }} />
      </div>
      {compact && <span className="mt-1 block text-[11px] text-black/60">{label}</span>}
    </div>
  );
}

/** "2 of 3 votes used · Voting closes Thu 5 Nov, 18:00" (or that it has closed). */
export function VotingStatus({ voting, now = new Date() }: { voting: RoundVoting; now?: Date }) {
  const closed = voting.closesAt && now >= voting.closesAt;
  const left = voting.limit - voting.used.size;
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {voting.round !== null && !closed && (
        <span className="font-semibold text-dxv-green">
          {voting.used.size} of {voting.limit} votes used
          {left > 0 ? ` (${left} left)` : ""}
        </span>
      )}
      <span className="text-black/65">
        {closed
          ? `Voting closed ${formatWhen(voting.closesAt!)}`
          : voting.closesAt
            ? `Voting closes ${formatWhen(voting.closesAt)}`
            : "Voting deadline to be confirmed"}
      </span>
    </span>
  );
}

/** The steps of a round and what each means for a member, behind a "How this works" toggle. */
export function HowThisWorks({ open = false }: { open?: boolean }) {
  return (
    <details className="group rounded-lg border border-black/10 bg-white" open={open}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5 text-sm font-semibold text-dxv-green [&::-webkit-details-marker]:hidden">
        How this works
        <span aria-hidden className="text-black/40 transition group-open:rotate-180">
          ▾
        </span>
      </summary>
      <ol className="space-y-3 border-t border-black/10 px-4 py-3 text-sm">
        {HOW_IT_WORKS.map((s, i) => (
          <li key={s.title} className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-dxv-green text-xs font-semibold text-white">{i + 1}</span>
            <span className="min-w-0">
              <span className="block font-semibold">
                {s.title}
                {s.column && <span className="ml-2 text-xs font-normal text-black/50">Board: {s.column}</span>}
              </span>
              <span className="block text-black/70">{s.text}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="border-t border-black/10 px-4 py-2.5 text-xs text-black/60">
        More in{" "}
        <Link href="/portal/help" className="font-medium text-dxv-green underline">
          Help and FAQs
        </Link>
        .
      </p>
    </details>
  );
}
