import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, homeFor } from "@/lib/auth";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field, inputClass } from "@/components/ui";
import { mailConfigured } from "@/lib/mail";
import { PROVIDER_LABEL, enabledProviders, providerFromSlug } from "@/lib/oauth";
import { ProviderSignInButtons } from "@/components/provider-buttons";
import { login } from "./actions";
import { AuthCard } from "./auth-card";

/** Why a Google / Microsoft sign-in came back without signing them in. */
function providerMessage(code: string | undefined, provider: string, email: string | undefined): string | null {
  switch (code) {
    case "nomatch":
      return `There's no DXV login for ${email && /^[^\s@<>]+@[^\s@<>]+$/.test(email) ? email : `that ${provider} account`} yet. If you're a member, sign in with your email (or an emailed link), then connect your ${provider} account in My profile. New to DXV? Ask the team for an invite.`;
    case "revoked":
      return "That login's access is switched off. Please contact the DXV team.";
    case "cancelled":
      return "Sign-in was cancelled.";
    case "expired":
      return "That took too long or was interrupted. Please try again.";
    case "failed":
      return `${provider} sign-in didn't work just now. Try again, or sign in with your email.`;
    default:
      return null;
  }
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const [user, sp] = await Promise.all([getCurrentUser(), searchParams]);
  if (user) redirect(homeFor(user.role));
  const emailLinks = mailConfigured();
  const providers = enabledProviders();
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const slug = providerFromSlug(one(sp.provider) ?? "");
  const message = providerMessage(one(sp.signin), slug ? PROVIDER_LABEL[slug] : "Google or Microsoft", one(sp.email));

  return (
    <AuthCard subtitle="Sign in (DXV team and members)">
      {message && (
        <p role="alert" className="mb-4 rounded border-l-4 border-dxv-yellow bg-dxv-yellow/20 px-3 py-2 text-sm">
          {message}
        </p>
      )}
      {providers.length > 0 && (
        <>
          <ProviderSignInButtons providers={providers} />
          <p className="my-4 flex items-center gap-3 text-xs text-black/50 before:h-px before:flex-1 before:bg-black/10 after:h-px after:flex-1 after:bg-black/10">
            or with your email
          </p>
        </>
      )}
      <ActionForm action={login} className="space-y-4" resetOnSuccess={false}>
        <Field label="Email">
          <input name="email" type="email" autoComplete="email" required className={inputClass} />
        </Field>
        <Field label="Password">
          <input name="password" type="password" autoComplete="current-password" required className={inputClass} />
        </Field>
        <SubmitButton pendingLabel="Signing in…" doneLabel="Signed in">
          Sign in
        </SubmitButton>
      </ActionForm>
      {emailLinks ? (
        <div className="mt-5 space-y-1 border-t border-black/10 pt-4 text-sm">
          <Link href="/login/help?kind=RESET" className="block font-medium text-dxv-green underline">
            Forgot your password?
          </Link>
          <Link href="/login/help?kind=MAGIC" className="block text-dxv-green underline">
            Email me a sign-in link instead
          </Link>
        </div>
      ) : (
        <p className="mt-5 border-t border-black/10 pt-4 text-xs text-black/55">Forgotten your password? Ask the DXV team for a reset link.</p>
      )}
    </AuthCard>
  );
}
