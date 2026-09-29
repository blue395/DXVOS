import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { ComplianceTextView } from "@/components/compliance-text";
import { Field, inputClass } from "@/components/ui";
import { db } from "@/lib/db";
import { MIN_PASSWORD_LENGTH } from "@/lib/pipeline";
import { acceptInvite } from "./actions";
import { findUsableInvite } from "./invite";

export const metadata = { title: "Join DXV", robots: { index: false } };

export default async function JoinPage({ params }: PageProps<"/join/[token]">) {
  const { token } = await params;
  const [invite, terms] = await Promise.all([
    findUsableInvite(token),
    db.complianceText.findFirst({ where: { kind: "MEMBER_TERMS", status: "APPROVED" } }),
  ]);
  const reset = invite?.kind === "RESET";

  return (
    <main className="flex flex-1 items-start justify-center bg-dxv-green px-4 py-10">
      <div className="w-full max-w-xl rounded-xl bg-white p-8 shadow-xl">
        <p className="inline-block rounded bg-dxv-yellow px-2 py-0.5 text-xs font-bold tracking-widest text-dxv-green">DXV</p>
        {!invite || (!reset && !terms) ? (
          <div className="mt-4 space-y-3">
            <h1 className="text-2xl font-semibold text-dxv-green">This link doesn&apos;t work</h1>
            <p className="text-sm text-black/70">
              It may have expired, already been used, or been replaced by a newer link. Ask the DXV team to send you a new one.
            </p>
            <Link href="/login" className="text-sm font-medium text-dxv-green underline">
              Already set up? Sign in
            </Link>
          </div>
        ) : (
          <div className="mt-4 space-y-5">
            <div>
              <h1 className="text-2xl font-semibold text-dxv-green">
                {reset ? "Set a new password" : `Welcome to the DXV syndicate, ${invite.angel.name.split(" ")[0]}`}
              </h1>
              <p className="mt-1 text-sm text-black/65">
                {reset
                  ? "Choose a new password for your DXV member login."
                  : "Diversity X Ventures invests in underestimated founders. First, set up your member login. Next you'll check your details and complete your investor statement, which takes about five minutes."}
              </p>
            </div>
            <ActionForm action={acceptInvite.bind(null, token)} className="space-y-4" resetOnSuccess={false}>
              <Field label="Your email (your login)">
                <input value={invite.angel.email ?? ""} readOnly className={`${inputClass} bg-black/[0.03]`} />
              </Field>
              <Field label="Choose a password" hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}>
                <input name="password" type="password" autoComplete="new-password" required minLength={MIN_PASSWORD_LENGTH} className={inputClass} />
              </Field>
              <Field label="Type it again">
                <input name="confirm" type="password" autoComplete="new-password" required className={inputClass} />
              </Field>
              {!reset && terms && (
                <div className="space-y-2">
                  <div className="max-h-64 overflow-y-auto rounded-md border border-black/15 bg-black/[0.02] p-3 text-sm">
                    <ComplianceTextView title={terms.title} body={terms.body} criteria={[]} />
                  </div>
                  <label className="flex items-start gap-2 text-sm">
                    <input type="checkbox" name="terms" required className="mt-1" />
                    <span>I have read and accept the DXV member terms and privacy notice.</span>
                  </label>
                </div>
              )}
              <SubmitButton pendingLabel="Setting up…" doneLabel="Done">
                {reset ? "Save new password" : "Create my login"}
              </SubmitButton>
            </ActionForm>
          </div>
        )}
      </div>
    </main>
  );
}
