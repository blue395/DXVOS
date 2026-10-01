import Link from "next/link";
import { Card } from "@/components/ui";
import { requireAdminWith } from "@/lib/auth";
import { complianceReady } from "@/lib/compliance";
import { mailConfigured } from "@/lib/mail";
import { InviteForm } from "./invite-form";

export const metadata = { title: "Invite an angel · DXV OS" };

export default async function InviteAngelPage() {
  const ready = await requireAdminWith(() => complianceReady());
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/angels" className="text-sm text-dxv-green hover:underline">
        ← Angels
      </Link>
      <div>
        <h1 className="text-2xl font-semibold text-dxv-green">Invite an angel</h1>
        <p className="text-sm text-black/60">
          Adds them to the directory and emails them a one-time sign-up link from angels@diversityx.vc (or gives you the link to send yourself). The link takes them through sign-up: set a password and
          accept the member terms, confirm their profile, then sign their investor statement. They become a Member when they sign up.
        </p>
      </div>
      <Card>
        {ready.ready ? (
          <InviteForm canEmail={mailConfigured()} />
        ) : (
          <p className="rounded bg-dxv-yellow/40 px-2 py-1 text-sm">
            Approve the investor statements and member terms before inviting anyone:{" "}
            <Link href="/angels/statements" className="font-medium text-dxv-green underline">
              Statements &amp; terms
            </Link>
            .
          </p>
        )}
      </Card>
      <p className="text-xs text-black/50">
        Already in the directory? Open their page and use <strong>Email invite</strong> in its Member portal section, so they keep one record.
      </p>
    </div>
  );
}
