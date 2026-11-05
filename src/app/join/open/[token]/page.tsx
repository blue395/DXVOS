import { connection } from "next/server";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field, inputClass } from "@/components/ui";
import { issueJoinFormToken, LINK_STATE_MESSAGE, loadJoinLink } from "@/lib/join-links";
import { PRIVACY_NOTICE_URL } from "@/lib/legal-links";
import { AuthCard } from "../../../login/auth-card";
import { askToJoin } from "../actions";

export const metadata = { title: "Join DXV", robots: { index: false }, referrer: "no-referrer" };

// Public: a shareable sign-up link. Asking to join sends a "confirm your email" link; a
// partner then approves and the person gets their own sign-up link (src/lib/join-links.ts).
export default async function JoinOpenPage({ params, searchParams }: PageProps<"/join/open/[token]">) {
  await connection();
  const [{ token }, sp] = await Promise.all([params, searchParams]);
  const link = await loadJoinLink(token);

  if (!link || link.state !== "open") {
    return (
      <AuthCard subtitle="Join the DXV angel syndicate">
        <p className="text-sm text-black/70">
          {link ? LINK_STATE_MESSAGE[link.state as Exclude<typeof link.state, "open">] : "This sign-up link doesn't work. Ask the DXV team for a new one."}
        </p>
      </AuthCard>
    );
  }
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
    <AuthCard subtitle="Join the DXV angel syndicate">
      <div className="space-y-4">
        <p className="text-sm text-black/70">
          Tell us who you are and we&apos;ll email you to confirm your address. Once the DXV team has approved your request, you&apos;ll get a personal link to
          set up your account, confirm your details and complete your investor statement.
        </p>
        <ActionForm action={askToJoin.bind(null, token)} resetOnSuccess={false} className="space-y-3">
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
            Ask to join
          </SubmitButton>
        </ActionForm>
      </div>
    </AuthCard>
  );
}
