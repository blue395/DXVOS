import Link from "next/link";
import { redirect } from "next/navigation";
import { FOUNDER_EMAIL_STARTERS } from "@/content/founder-emails";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { loadFounderAudienceDeals } from "@/lib/founder-bulk-emails";
import { mailConfigured } from "@/lib/mail";
import { loadMemberEvents } from "@/lib/member-events";
import { FounderComposer } from "./composer";

export const metadata = { title: "New email to founders · DXV OS" };

export default async function NewFounderEmailPage() {
  // Checked and loaded in parallel (like requireAdminWith); nothing is shown unless the check passes.
  const [me, deals, memberRound, events] = await Promise.all([
    requireAdmin(),
    loadFounderAudienceDeals(),
    db.memberRound.findFirst({ orderBy: { createdAt: "desc" }, select: { round: true } }),
    loadMemberEvents(),
  ]);
  if (!mailConfigured()) redirect("/deals/founder-emails");
  const rounds = [...new Set(deals.map((d) => d.round).filter((r): r is number => r !== null))].sort((a, b) => b - a);
  const next = events.find((e) => e.kind === "PITCH_SESSION") ?? null;
  const defaultRound = memberRound?.round != null && rounds.includes(memberRound.round) ? memberRound.round : (rounds[0] ?? null);
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <Link href="/deals/founder-emails" className="text-sm text-dxv-green hover:underline">
        ← Email founders
      </Link>
      <h1 className="text-2xl font-semibold text-dxv-green">New email to founders</h1>
      <FounderComposer
        deals={deals}
        rounds={rounds}
        defaultRound={defaultRound}
        starters={FOUNDER_EMAIL_STARTERS}
        session={next && { title: next.title, startsAt: next.startsAt.toISOString(), location: next.location, lumaUrl: next.lumaUrl }}
        myEmail={me.email}
      />
    </div>
  );
}
