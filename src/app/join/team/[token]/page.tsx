import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field, inputClass } from "@/components/ui";
import { MIN_PASSWORD_LENGTH } from "@/lib/pipeline";
import { acceptTeamInvite } from "./actions";
import { findUsableTeamInvite } from "./invite";

export const metadata = { title: "Join the DXV team", robots: { index: false } };

export default async function JoinTeamPage({ params }: PageProps<"/join/team/[token]">) {
  const { token } = await params;
  const invite = await findUsableTeamInvite(token);
  const reset = invite?.kind === "RESET";

  return (
    <main className="flex flex-1 items-start justify-center bg-dxv-green px-4 py-10">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-xl">
        <p className="inline-block rounded bg-dxv-yellow px-2 py-0.5 text-xs font-bold tracking-widest text-dxv-green">DXV OS</p>
        {!invite ? (
          <div className="mt-4 space-y-3">
            <h1 className="text-2xl font-semibold text-dxv-green">This link doesn&apos;t work</h1>
            <p className="text-sm text-black/70">It may have expired, already been used, or been replaced by a newer link. Ask a DXV partner for a new one.</p>
            <Link href="/login" className="text-sm font-medium text-dxv-green underline">
              Already set up? Sign in
            </Link>
          </div>
        ) : (
          <div className="mt-4 space-y-5">
            <div>
              <h1 className="text-2xl font-semibold text-dxv-green">{reset ? "Set a new password" : `Welcome to DXV OS, ${invite.name.split(" ")[0]}`}</h1>
              <p className="mt-1 text-sm text-black/65">
                {reset ? "Choose a new password for your DXV OS team login." : "Choose a password for your DXV OS team login. It's only known to you."}
              </p>
            </div>
            <ActionForm action={acceptTeamInvite.bind(null, token)} className="space-y-4" resetOnSuccess={false}>
              <Field label="Your email (your login)">
                <input value={invite.email} readOnly className={`${inputClass} bg-black/[0.03]`} />
              </Field>
              <Field label="Choose a password" hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}>
                <input name="password" type="password" autoComplete="new-password" required minLength={MIN_PASSWORD_LENGTH} className={inputClass} />
              </Field>
              <Field label="Type it again">
                <input name="confirm" type="password" autoComplete="new-password" required className={inputClass} />
              </Field>
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
