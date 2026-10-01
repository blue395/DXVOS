// "Sign-in methods": the Google / Microsoft accounts connected to the signed-in login, and
// the offer to switch their DXV email to a connected account's. Server component, shown on
// My profile (members) and Account (team). Only ever the signed-in person's own login.

import type { OAuthProvider } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { PROVIDER_LABEL, enabledProviders } from "@/lib/oauth";
import { emailSwitchOffer } from "@/lib/pipeline";
import { formatDate } from "./ui";
import { ConnectButton, DisconnectButton, EmailSwitchButtons } from "./provider-buttons";

const CONNECT_MESSAGES: Record<string, string> = {
  ok: "✓ Connected. You can now sign in with it.",
  taken: "That account is already connected to another DXV login, so it can't be connected here. Ask the DXV team if that's a mistake.",
};

export async function loadSignInMethods(userId: string) {
  return db.loginIdentity.findMany({ where: { userId, removedAt: null }, orderBy: { createdAt: "asc" } });
}

/** The banner offering a connected account's email as their DXV email (null when there's nothing to offer). */
export function EmailSwitchOffer({ email, identities }: { email: string; identities: Awaited<ReturnType<typeof loadSignInMethods>> }) {
  const offer = emailSwitchOffer(email, identities);
  if (!offer?.email) return null;
  return (
    <section className="space-y-2 rounded-lg border-2 border-dxv-yellow bg-dxv-yellow/20 p-4 text-sm">
      <p>
        You connected your {PROVIDER_LABEL[offer.provider]} account, <strong>{offer.email}</strong>. Would you like to use it as your DXV email? You&apos;d
        sign in and hear from DXV at that address instead of <strong>{email}</strong>.
      </p>
      <EmailSwitchButtons identityId={offer.id} newEmail={offer.email} oldEmail={email} />
    </section>
  );
}

export async function SignInMethods({
  email,
  identities,
  returnTo,
  connectStatus,
}: {
  email: string;
  identities: Awaited<ReturnType<typeof loadSignInMethods>>;
  returnTo: "/portal/profile" | "/account";
  connectStatus?: string;
}) {
  const providers = enabledProviders();
  const connected = new Set(identities.map((i) => i.provider));
  const toConnect = providers.filter((p: OAuthProvider) => !connected.has(p));
  return (
    <section className="space-y-3 rounded-lg border border-black/10 bg-white p-5">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-dxv-green">Sign-in methods</h2>
        <p className="text-sm text-black/60">
          You sign in as <strong>{email}</strong>, with your password or an emailed link{providers.length > 0 ? ", or a connected account below" : ""}.
        </p>
      </div>
      {connectStatus && CONNECT_MESSAGES[connectStatus] && (
        <p role="status" className={`rounded px-3 py-2 text-sm ${connectStatus === "ok" ? "bg-dxv-green/[0.06] text-dxv-green" : "bg-dxv-yellow/30"}`}>
          {CONNECT_MESSAGES[connectStatus]}
        </p>
      )}
      {identities.length > 0 && (
        <ul className="divide-y divide-black/10 rounded-md border border-black/10">
          {identities.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
              <span>
                <strong>{PROVIDER_LABEL[i.provider]}</strong> {i.email && <span className="text-black/70">· {i.email}</span>}
                <span className="block text-xs text-black/50">
                  Connected {formatDate(i.createdAt)}
                  {i.lastUsedAt ? ` · last used ${formatDate(i.lastUsedAt)}` : ""}
                </span>
              </span>
              <DisconnectButton identityId={i.id} provider={i.provider} />
            </li>
          ))}
        </ul>
      )}
      {toConnect.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {toConnect.map((p) => (
            <ConnectButton key={p} provider={p} returnTo={returnTo} />
          ))}
        </div>
      )}
      {providers.length === 0 && identities.length === 0 && <p className="text-xs text-black/50">Google and Microsoft sign-in aren&apos;t switched on yet.</p>}
    </section>
  );
}
