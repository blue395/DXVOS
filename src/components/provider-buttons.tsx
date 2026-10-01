"use client";

// "Continue with Google / Microsoft" buttons (sign-in page and invite page), and the
// connect / disconnect / use-this-email controls on My profile and Account.

import { ActionButton } from "./action-button";
import { ActionForm, SubmitButton } from "./action-form";
import type { OAuthProvider } from "@/generated/prisma/enums";
import { disconnectIdentity, keepMyEmail, startProviderConnect, startProviderJoin, startProviderSignIn, switchToIdentityEmail } from "@/app/login/oauth-actions";

const LABEL: Record<OAuthProvider, string> = { GOOGLE: "Google", MICROSOFT: "Microsoft" };

/** Sign-in page. */
export function ProviderSignInButtons({ providers }: { providers: OAuthProvider[] }) {
  return (
    <div className="space-y-2">
      {providers.map((p) => (
        <ActionForm key={p} action={() => startProviderSignIn(p)} resetOnSuccess={false}>
          <ProviderSubmit provider={p} />
        </ActionForm>
      ))}
    </div>
  );
}

/** Invite page: needs the member terms ticked first (passed in as `agreed`). */
export function ProviderJoinButtons({ token, providers, agreed }: { token: string; providers: OAuthProvider[]; agreed: boolean }) {
  return (
    <div className="space-y-2">
      {providers.map((p) => (
        <ActionForm key={p} action={startProviderJoin.bind(null, token, p)} resetOnSuccess={false}>
          <input type="hidden" name="terms" value={agreed ? "on" : ""} />
          <ProviderSubmit provider={p} />
        </ActionForm>
      ))}
    </div>
  );
}

function ProviderSubmit({ provider }: { provider: OAuthProvider }) {
  return (
    <span className="block [&_button]:w-full [&_button]:justify-center">
      <SubmitButton variant="secondary" pendingLabel={`Opening ${LABEL[provider]}…`} doneLabel={`Opening ${LABEL[provider]}…`}>
        Continue with {LABEL[provider]}
      </SubmitButton>
    </span>
  );
}

export function ConnectButton({ provider, returnTo }: { provider: OAuthProvider; returnTo: "/portal/profile" | "/account" }) {
  return (
    <ActionButton variant="secondary" pendingLabel={`Opening ${LABEL[provider]}…`} run={() => startProviderConnect(provider, returnTo)}>
      Connect {LABEL[provider]}
    </ActionButton>
  );
}

export function DisconnectButton({ identityId, provider }: { identityId: string; provider: OAuthProvider }) {
  return (
    <ActionButton
      variant="secondary"
      pendingLabel="Disconnecting…"
      confirm={`Disconnect this ${LABEL[provider]} account? You can still sign in with your email and password, or an emailed link.`}
      run={() => disconnectIdentity(identityId)}
    >
      Disconnect
    </ActionButton>
  );
}

export function EmailSwitchButtons({ identityId, newEmail, oldEmail }: { identityId: string; newEmail: string; oldEmail: string }) {
  return (
    <span className="flex flex-wrap items-center gap-2">
      <ActionButton
        pendingLabel="Switching…"
        confirm={`Use ${newEmail} as your DXV email? You'll sign in with it from now on, and we'll let ${oldEmail} know.`}
        run={() => switchToIdentityEmail(identityId)}
      >
        Use {newEmail}
      </ActionButton>
      <ActionButton variant="secondary" pendingLabel="Saving…" run={() => keepMyEmail(identityId)}>
        Keep {oldEmail}
      </ActionButton>
    </span>
  );
}
