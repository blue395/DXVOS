import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, homeFor } from "@/lib/auth";
import { mailConfigured } from "@/lib/mail";
import { LOGIN_LINK_MINUTES } from "@/lib/pipeline";
import { AuthCard } from "../auth-card";
import { LinkRequestForm } from "./link-request-form";

export const metadata = { title: "Forgot password · DXV OS" };

export default async function LoginHelpPage({ searchParams }: PageProps<"/login/help">) {
  const [user, sp] = await Promise.all([getCurrentUser(), searchParams]);
  if (user) redirect(homeFor(user.role));
  const kind = sp.kind === "RESET" ? "RESET" : "MAGIC";
  return (
    <AuthCard subtitle="Get back into your account">
      {mailConfigured() ? (
        <LinkRequestForm initialKind={kind} minutes={LOGIN_LINK_MINUTES} />
      ) : (
        <p className="text-sm text-black/70">Emailed links aren&apos;t set up yet. Ask the DXV team for a password reset link.</p>
      )}
      <Link href="/login" className="mt-5 block border-t border-black/10 pt-4 text-sm text-dxv-green underline">
        ← Back to sign in
      </Link>
    </AuthCard>
  );
}
