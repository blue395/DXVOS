import Link from "next/link";
import { DiversityForm } from "@/components/portal/diversity-form";
import { CarriedOverNote } from "@/components/portal/diversity-parts";
import { WithdrawPanel, YourData } from "@/components/portal/diversity-controls";
import { formatDate } from "@/components/ui";
import { requireAngel } from "@/lib/auth";
import { CONSENT_V1 } from "@/lib/diversity/consent-v1";
import { CATEGORY_LABELS, byCategory } from "@/lib/diversity/questions";
import { loadMyDiversity } from "@/lib/diversity/store";
import { trackPortalView } from "@/lib/portal-analytics";
import { saveDiversityAnswers } from "../../diversity/actions";

export const metadata = { title: "My diversity information · DXV Members" };

const METHOD_LABELS: Record<string, string> = {
  signup_screen: "on the sign-up screen",
  profile_edit: "in your profile",
  admin_on_request: "by DXV at your request",
  retention: "automatically (retention period)",
  migration: "carried over",
};

/** Profile > My diversity information: view, change (consent again), withdraw, consent history. Private to the member. */
export default async function MyDiversityPage() {
  const who = await requireAngel();
  const [mine] = await Promise.all([loadMyDiversity(who.angel.id), trackPortalView(who, "OTHER")]);
  const given = mine.consents.filter((c) => c.status === "given").map((c) => c.category);
  return (
    <div className="space-y-4">
      <Link href="/portal/profile" className="text-sm text-dxv-green hover:underline">
        ← My profile
      </Link>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-dxv-green">My diversity information</h1>
        <p className="text-sm text-black/70">{CONSENT_V1.profileHeading}</p>
      </div>
      {mine.pending.length > 0 && <CarriedOverNote expires={mine.pendingExpiresAt} />}
      <section className="space-y-3 rounded-lg border border-black/10 bg-white p-5">
        <p className="text-sm text-black/60">{CONSENT_V1.profileChange}</p>
        <DiversityForm
          mode="profile"
          saved={byCategory(mine.answers)}
          carriedOver={byCategory(mine.pending)}
          consentGiven={given}
          action={saveDiversityAnswers.bind(null, "profile")}
        />
      </section>

      <section className="space-y-3 rounded-lg border border-black/10 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-dxv-green">Your consent history</h2>
        {mine.history.length ? (
          <ul className="divide-y divide-black/10 text-sm">
            {mine.history.map((h, i) => (
              <li key={i} className="flex flex-wrap justify-between gap-2 py-1.5">
                <span>
                  {CATEGORY_LABELS[h.category]}: consent {h.action === "given" ? "given" : "withdrawn"} {METHOD_LABELS[h.method] ?? ""}
                </span>
                <span className="text-xs text-black/50">
                  {formatDate(h.at)} · wording {h.wordingVersion}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-black/55">You haven&apos;t given consent for anything yet.</p>
        )}
        <div className="border-t border-black/10 pt-3">
          <WithdrawPanel hasAnything={mine.answers.length > 0 || mine.pending.length > 0} />
        </div>
      </section>

      <YourData partner={who.user.role === "ADMIN"} />
    </div>
  );
}
