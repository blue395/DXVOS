import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, homeFor } from "@/lib/auth";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field, inputClass } from "@/components/ui";
import { mailConfigured } from "@/lib/mail";
import { login } from "./actions";
import { AuthCard } from "./auth-card";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user.role));
  const emailLinks = mailConfigured();

  return (
    <AuthCard subtitle="Sign in (DXV team and members)">
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
