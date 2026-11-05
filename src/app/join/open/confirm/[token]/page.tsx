import { ActionForm, SubmitButton } from "@/components/action-form";
import { AuthCard } from "../../../../login/auth-card";
import { confirmMyEmail } from "../../actions";

export const metadata = { title: "Confirm your email · DXV", robots: { index: false }, referrer: "no-referrer" };

// Public: the "confirm your email" link from a join request. Opening the page uses nothing
// up (email scanners open links); it's confirmed only when the person presses the button.
export default async function ConfirmJoinPage({ params, searchParams }: PageProps<"/join/open/confirm/[token]">) {
  const [{ token }, sp] = await Promise.all([params, searchParams]);
  if (sp.done === "1") {
    return (
      <AuthCard subtitle="Thanks, your email is confirmed">
        <p className="text-sm text-black/75">
          The DXV team will review your request. Once it&apos;s approved, you&apos;ll get an email from angels@diversityx.vc with your personal link to set up
          your account.
        </p>
      </AuthCard>
    );
  }
  if (sp.done === "0") {
    return (
      <AuthCard subtitle="This link doesn't work any more">
        <p className="text-sm text-black/70">
          It may have expired (links last 48 hours) or already been used. Open the sign-up link you were given and ask again.
        </p>
      </AuthCard>
    );
  }
  return (
    <AuthCard subtitle="Confirm your email">
      <p className="mb-4 text-sm text-black/75">Press the button to confirm your email and send your request to the DXV team.</p>
      <ActionForm action={confirmMyEmail.bind(null, token)} resetOnSuccess={false}>
        <SubmitButton pendingLabel="Confirming…" doneLabel="Confirmed">
          Confirm my email
        </SubmitButton>
      </ActionForm>
    </AuthCard>
  );
}
