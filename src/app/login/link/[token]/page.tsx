import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field, inputClass } from "@/components/ui";
import { findUsableLoginLink } from "@/lib/login-links";
import { MIN_PASSWORD_LENGTH } from "@/lib/pipeline";
import { resetPasswordWithLink, signInWithLink } from "../../actions";
import { AuthCard } from "../../auth-card";

export const metadata = { title: "Sign in · DXV OS", referrer: "no-referrer" };

// Public: the one-time token is the credential. Opening the page uses nothing up (email
// scanners open links); the link is only used when the person presses the button.
export default async function LoginLinkPage({ params }: PageProps<"/login/link/[token]">) {
  const { token } = await params;
  const link = await findUsableLoginLink(token);

  if (!link) {
    return (
      <AuthCard subtitle="This link doesn't work any more">
        <p className="text-sm text-black/70">It has expired or has already been used. Links work once, for a short time.</p>
        <Link href="/login/help" className="mt-4 inline-block font-medium text-dxv-green underline">
          Email me a new link
        </Link>
      </AuthCard>
    );
  }

  if (link.kind === "MAGIC") {
    return (
      <AuthCard subtitle="Sign in with your emailed link">
        <p className="mb-4 text-sm">
          Signing in as <strong>{link.user.email}</strong>.
        </p>
        <ActionForm action={signInWithLink.bind(null, token)} resetOnSuccess={false}>
          <SubmitButton pendingLabel="Signing in…" doneLabel="Signed in">
            Sign me in
          </SubmitButton>
        </ActionForm>
      </AuthCard>
    );
  }

  return (
    <AuthCard subtitle="Choose a new password">
      <p className="mb-4 text-sm">
        For <strong>{link.user.email}</strong>.
      </p>
      <ActionForm action={resetPasswordWithLink.bind(null, token)} className="space-y-4" resetOnSuccess={false}>
        <input type="email" name="username" autoComplete="username" value={link.user.email} readOnly hidden />
        <Field label="New password" hint={`At least ${MIN_PASSWORD_LENGTH} characters`}>
          <input name="password" type="password" autoComplete="new-password" required minLength={MIN_PASSWORD_LENGTH} className={inputClass} />
        </Field>
        <Field label="Type it again">
          <input name="confirm" type="password" autoComplete="new-password" required className={inputClass} />
        </Field>
        <SubmitButton pendingLabel="Saving…" doneLabel="Saved">
          Save and sign in
        </SubmitButton>
      </ActionForm>
    </AuthCard>
  );
}
