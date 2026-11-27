import Link from "next/link";
import { connection } from "next/server";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field, inputClass } from "@/components/ui";
import { issueJoinFormToken } from "@/lib/join-links";
import { PRIVACY_NOTICE_URL } from "@/lib/legal-links";
import { AuthCard } from "../../login/auth-card";
import { askToJoinFromWebsite } from "../open/actions";

export const metadata = { title: "Request to join DXV", referrer: "no-referrer" };

// Public: "Already an angel investor?" from the welcome page. Approve first, like a shareable
// link: they confirm their email, a partner approves, then they get a personal set-up link.
export default async function JoinRequestPage({ searchParams }: PageProps<"/join/request">) {
  await connection();
  const sp = await searchParams;
  if (sp.sent === "1") {
    return (
      <AuthCard subtitle="Check your email">
        <div className="space-y-3 text-sm text-black/75">
          <p>
            We&apos;ve sent you an email from angels@diversityx.vc. Open it and confirm your email address (check your spam folder if it isn&apos;t there in a
            few minutes).
          </p>
          <p>The DXV team then reviews your request and emails you a personal link to set up your account.</p>
          <p className="text-black/60">Already have a DXV login? We&apos;ve emailed you a link to sign in instead.</p>
        </div>
      </AuthCard>
    );
  }
  return (
    <AuthCard subtitle="Request to join the DXV angel syndicate">
      <div className="space-y-4">
        <p className="text-sm text-black/70">
          For angel investors who are high net worth or sophisticated investors (
          <Link href="/welcome#who-qualifies" className="text-dxv-green underline">
            who qualifies
          </Link>
          ). Tell us who you are and we&apos;ll email you to confirm your address. Once the DXV team has approved your request, you&apos;ll get a personal link
          to set up your account, confirm your details and complete your investor statement.
        </p>
        <ActionForm action={askToJoinFromWebsite} resetOnSuccess={false} className="space-y-3">
          <input type="hidden" name="formToken" value={issueJoinFormToken()} />
          {/* Left empty by people; bots fill it in. */}
          <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label>
              Website <input name="website" tabIndex={-1} autoComplete="off" />
            </label>
          </div>
          <Field label="Your name">
            <input name="name" required maxLength={120} autoComplete="name" className={inputClass} />
          </Field>
          <Field label="Your email">
            <input name="email" type="email" required maxLength={200} autoComplete="email" className={inputClass} />
          </Field>
          <p className="text-xs text-black/55">
            We use your name and email only to handle your request. See our{" "}
            <a href={PRIVACY_NOTICE_URL} target="_blank" rel="noopener noreferrer" className="text-dxv-green underline">
              privacy notice
            </a>
            .
          </p>
          <SubmitButton pendingLabel="Sending…" doneLabel="Sent">
            Request to join
          </SubmitButton>
        </ActionForm>
        <p className="text-sm text-black/60">
          Not an investor yet?{" "}
          <a href="/learn/join" className="text-dxv-green underline">
            Take our free course
          </a>{" "}
          ·{" "}
          <Link href="/welcome" className="text-dxv-green underline">
            Back
          </Link>
        </p>
      </div>
    </AuthCard>
  );
}
