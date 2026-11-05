import { connection } from "next/server";
import { ComplianceTextView } from "@/components/compliance-text";
import { formatDate } from "@/components/ui";
import { db } from "@/lib/db";
import { PRIVACY_EMAIL } from "@/lib/legal-links";

export const metadata = { title: "Member terms · Diversity X Ventures" };

// Public (no sign-in): the member terms currently in use, exactly as approved on Angels →
// Statements & terms (the same version members accept at sign-up).
export default async function TermsPage() {
  await connection();
  const terms = await db.complianceText.findFirst({ where: { kind: "MEMBER_TERMS", status: "APPROVED" }, orderBy: { version: "desc" } });
  return (
    <main className="flex flex-1 justify-center bg-dxv-green px-4 py-10">
      <article className="w-full max-w-3xl space-y-5 rounded-xl bg-white p-6 shadow-xl sm:p-10">
        <p className="inline-block rounded bg-dxv-yellow px-2 py-0.5 text-xs font-bold tracking-widest text-dxv-green">DXV</p>
        {terms ? (
          <>
            <ComplianceTextView title={terms.title} body={terms.body} criteria={[]} />
            <p className="text-xs text-black/55">
              Version {terms.version}
              {terms.approvedAt ? `, in use since ${formatDate(terms.approvedAt)}` : ""}. Questions: {PRIVACY_EMAIL}.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold text-dxv-green">Member terms</h1>
            <p className="text-sm text-black/70">The member terms haven&apos;t been published yet. Questions: {PRIVACY_EMAIL}.</p>
          </>
        )}
      </article>
    </main>
  );
}
