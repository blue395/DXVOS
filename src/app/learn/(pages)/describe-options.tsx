// "Which best describes you?" (shared by the welcome step and the account page). For the two
// "I may qualify" options, the criteria come from DXV's approved investor statement wording (the
// same versioned text the Deal Platform uses), or a marked placeholder until one is approved.
import { DESCRIBES_AS, DESCRIBES_AS_NOTE, FCA_WORDING_PLACEHOLDER } from "@/content/course";
import { learnMuted } from "./card";

export type StatementCriteria = Record<string, { title: string; criteria: string[] } | null>;

export function DescribeOptions({ current, statements }: { current: string | null; statements: StatementCriteria }) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 font-semibold">Which best describes you?</legend>
      {DESCRIBES_AS.map((d) => {
        const st = d.statement ? statements[d.statement] : undefined;
        return (
          <label
            key={d.key}
            className="flex cursor-pointer items-start gap-2 rounded-lg border border-[#d6dfda] px-3 py-2.5 text-sm has-[:checked]:border-[#5c3d68] dark:border-[#274540] dark:has-[:checked]:border-[#d3b1e2]"
          >
            <input type="radio" name="describesAs" value={d.key} defaultChecked={current === d.key} required className="mt-1" />
            <span className="min-w-0">
              {d.label}
              {d.statement && (
                <details className={`mt-1 text-xs ${learnMuted}`}>
                  <summary className="cursor-pointer">What this means</summary>
                  {st ? (
                    <div className="mt-1 space-y-1">
                      <p>From the {st.title}:</p>
                      <ul className="list-disc space-y-0.5 pl-4">
                        {st.criteria.map((c) => (
                          <li key={c}>{c}</li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="mt-1 font-semibold text-[#971914] dark:text-[#ff9b8f]">{FCA_WORDING_PLACEHOLDER}</p>
                  )}
                </details>
              )}
            </span>
          </label>
        );
      })}
      <p className={`text-xs ${learnMuted}`}>{DESCRIBES_AS_NOTE}</p>
    </fieldset>
  );
}
