import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { EmailSwitchOffer, SignInMethods, loadSignInMethods } from "@/components/sign-in-methods";

export const metadata = { title: "Your account · DXV OS" };

/** A team member's own login: email and sign-in methods. (Members manage theirs on My profile.) */
export default async function AccountPage({ searchParams }: PageProps<"/account">) {
  const [me, sp] = await Promise.all([requireAdmin(), searchParams]);
  const identities = await loadSignInMethods(me.id);
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-dxv-green">Your account</h1>
        <p className="text-sm text-black/60">
          {me.name} · {me.email}. Team logins and access are managed on the{" "}
          <Link href="/team" className="font-medium text-dxv-green underline">
            Team page
          </Link>
          .
        </p>
      </div>
      <EmailSwitchOffer email={me.email} identities={identities} />
      <SignInMethods email={me.email} identities={identities} returnTo="/account" connectStatus={typeof sp.connect === "string" ? sp.connect : undefined} />
    </div>
  );
}
