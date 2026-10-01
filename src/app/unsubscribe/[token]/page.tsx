import { db } from "@/lib/db";
import { angelFromUnsubscribeToken } from "@/lib/unsubscribe";
import { AuthCard } from "@/app/login/auth-card";
import { OptOutButton } from "./opt-out-button";

export const metadata = { title: "Email preferences · DXV", robots: { index: false }, referrer: "no-referrer" };

// Public: reached from the link at the bottom of a DXV email. Opening it changes nothing.
export default async function UnsubscribePage({ params }: PageProps<"/unsubscribe/[token]">) {
  const { token } = await params;
  const angelId = await angelFromUnsubscribeToken(token);
  const angel = angelId ? await db.angel.findUnique({ where: { id: angelId }, select: { email: true, emailOptOutAt: true } }) : null;
  return (
    <AuthCard subtitle="Email preferences">
      {!angel ? (
        <p className="text-sm text-black/70">This link doesn&apos;t work. Reply to any DXV email and we&apos;ll sort it out.</p>
      ) : angel.emailOptOutAt ? (
        <div className="space-y-3 text-sm">
          <p>
            <strong>You&apos;re unsubscribed.</strong> {angel.email} won&apos;t get DXV&apos;s emails to angels. We&apos;ll still send anything you
            ask for, such as sign-in links.
          </p>
          <OptOutButton token={token} optOut={false} label="Subscribe again" />
        </div>
      ) : (
        <div className="space-y-3 text-sm">
          <p>
            Stop DXV&apos;s emails to angels (platform news, deal rounds, events) going to <strong>{angel.email}</strong>?
          </p>
          <OptOutButton token={token} optOut label="Unsubscribe" />
        </div>
      )}
    </AuthCard>
  );
}
