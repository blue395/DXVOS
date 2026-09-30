import { redirect } from "next/navigation";
import { Card } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { ANGEL_STATUS_LABELS, suggestAngelMatch } from "@/lib/pipeline";
import { ChooseRecord, ThatsMeButton } from "./member-access-client";

export const metadata = { title: "Member view · DXV OS" };

/**
 * The team's "Member portal" button, before a team member's login is linked to their
 * angel record: find (or create) their record, then go straight to the portal.
 */
export default async function MemberAccessPage() {
  const me = await requireAdmin();
  if (me.angelId) redirect("/portal");
  const angels = await db.angel.findMany({
    where: { archivedAt: null, user: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, status: true },
  });
  const suggestedId = angels.find((a) => a.email?.toLowerCase() === me.email.toLowerCase())?.id ?? suggestAngelMatch(me.name, angels);
  const suggested = angels.find((a) => a.id === suggestedId);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-dxv-green">See DXV as an angel</h1>
        <p className="text-sm text-black/65">
          Your team login can also be your member login: the same portal, views and actions as every DXV angel, as yourself. The first time,
          you&apos;ll check your details and sign your own investor statement; then you see shared deals, vote and record your interest like any
          member. The yellow <strong>Team app</strong> button brings you back here.
        </p>
      </div>

      <Card title="Which angel record is yours?">
        <div className="space-y-4 text-sm">
          {suggested && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-dxv-green/30 bg-dxv-green/[0.04] p-3">
              <span>
                <strong>{suggested.name}</strong>
                <span className="block text-xs text-black/60">
                  {suggested.email ?? "no email"} · {ANGEL_STATUS_LABELS[suggested.status]}
                </span>
              </span>
              <ThatsMeButton angelId={suggested.id} label="Yes, that's me" />
            </div>
          )}
          {angels.length > 0 && (
            <div className="space-y-1">
              <p className="text-black/65">{suggested ? "Not you? Choose your record:" : "Choose your record from the angels list:"}</p>
              <ChooseRecord options={angels.map((a) => ({ id: a.id, label: `${a.name}${a.email ? ` (${a.email})` : ""}` }))} />
            </div>
          )}
          <div className="border-t border-black/10 pt-3">
            <p className="mb-2 text-black/65">Not in the angels list yet? Create your member record from your team details ({me.name}, {me.email}).</p>
            <ThatsMeButton angelId={null} label="Create my member record" />
          </div>
          <p className="text-xs text-black/50">Linking your record makes it a Member and is recorded in its history and the Team page.</p>
        </div>
      </Card>
    </div>
  );
}
