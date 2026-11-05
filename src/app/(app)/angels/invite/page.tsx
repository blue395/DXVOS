import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { CopyLink } from "@/components/copy-link";
import { Card, Field, formatDate, formatDateTime, inputClass } from "@/components/ui";
import { loadJoinLinkAdmin } from "@/lib/join-link-admin";
import { JOIN_LINK_DAY_OPTIONS } from "@/lib/pipeline";
import { createJoinLink } from "../join-actions";
import { JoinRequestButtons, SwitchOffLinkButton } from "./join-link-parts";
import { requireAdminWith } from "@/lib/auth";
import { complianceReady, inviteBlockReason } from "@/lib/compliance";
import { mailConfigured } from "@/lib/mail";
import { InviteForm } from "./invite-form";

export const metadata = { title: "Invite an angel · DXV OS" };

export default async function InviteAngelPage() {
  const [ready, join] = await requireAdminWith(() => Promise.all([complianceReady(), loadJoinLinkAdmin()]));
  const STATE_LABEL = { open: "Open", "switched-off": "Switched off", expired: "Expired", full: "Used up" } as const;
  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-24">
      <Link href="/angels" className="text-sm text-dxv-green hover:underline">
        ← Angels
      </Link>
      <div>
        <h1 className="text-2xl font-semibold text-dxv-green">Invite an angel</h1>
        <p className="text-sm text-black/60">
          Adds them to the directory and emails them a one-time sign-up link from angels@diversityx.vc (or gives you the link to send yourself). The link takes
          them through sign-up: set a password and accept the member terms, confirm their profile, then sign their investor statement. They become a Member when
          they sign up.
        </p>
      </div>
      <Card>
        {ready.ready ? (
          <InviteForm canEmail={mailConfigured()} />
        ) : (
          <div className="space-y-1 rounded bg-dxv-yellow/40 px-2 py-1 text-sm">
            <p>{inviteBlockReason(ready)}</p>
            {ready.missing.length > 0 && (
              <Link href="/angels/statements" className="font-medium text-dxv-green underline">
                Statements &amp; terms
              </Link>
            )}
          </div>
        )}
      </Card>
      <section id="join-requests">
        <Card title={`Join requests waiting (${join.pending.length})`}>
          {join.pending.length === 0 ? (
            <p className="text-sm text-black/55">
              Nobody is waiting. Requests appear here once the person has confirmed their email, and every partner gets an email.
            </p>
          ) : (
            <ul className="divide-y divide-black/10">
              {join.pending.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                  <span className="min-w-0">
                    <span className="font-medium">{r.name}</span> <span className="break-all text-black/55">{r.email}</span>
                    <span className="block text-xs text-black/55">
                      Via &ldquo;{r.link.label}&rdquo; · confirmed {r.confirmedAt ? formatDateTime(r.confirmedAt) : ""}
                    </span>
                    {r.angel ? (
                      <span className="mt-1 block text-xs">
                        Already in the directory as{" "}
                        <Link href={`/angels/${r.angel.id}`} className="font-medium text-dxv-green underline">
                          {r.angel.name}
                        </Link>{" "}
                        ({r.angel.status.toLowerCase()}): approving invites that record, so their history is kept.
                      </span>
                    ) : (
                      <span className="mt-1 block text-xs text-black/55">New to DXV: approving adds them as a Prospect.</span>
                    )}
                  </span>
                  {ready.ready ? (
                    <JoinRequestButtons id={r.id} name={r.name} />
                  ) : (
                    <span className="text-xs text-black/55">Invites are paused (see above).</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      <Card title="Shareable sign-up links">
        <div className="space-y-4 text-sm">
          <p className="text-black/65">
            Share one link (e.g. in the members&apos; WhatsApp group). Anyone with it can ask to join: they confirm their email, a partner approves here, and
            only then do they get their own sign-up link. People who already have a login are sent a sign-in link instead; anyone already in the directory keeps
            their record.
          </p>
          <ActionForm action={createJoinLink} className="grid gap-3 rounded-lg border border-black/10 p-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
            <Field label="Where you'll share it">
              <input name="label" required maxLength={80} placeholder="WhatsApp group, Nov 2026" className={inputClass} />
            </Field>
            <Field label="Works for">
              <select name="days" defaultValue="30" className={inputClass}>
                {JOIN_LINK_DAY_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d} days
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Max sign-ups (optional)">
              <input name="maxUses" inputMode="numeric" placeholder="No limit" className={`${inputClass} sm:w-32`} />
            </Field>
            <SubmitButton pendingLabel="Creating…" doneLabel="Created">
              Create link
            </SubmitButton>
          </ActionForm>
          {join.links.length > 0 && (
            <ul className="divide-y divide-black/10">
              {join.links.map((l) => (
                <li key={l.id} className="space-y-2 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="min-w-0">
                      <span className="font-medium">{l.label}</span>{" "}
                      <span className={`rounded-full px-2 py-0.5 text-xs ${l.state === "open" ? "bg-dxv-green text-white" : "bg-black/5 text-black/60"}`}>
                        {STATE_LABEL[l.state]}
                      </span>
                      <span className="block text-xs text-black/55">
                        {l.state === "open" ? `Works until ${formatDate(l.expiresAt)}` : `Until ${formatDate(l.expiresAt)}`} · {l.used}
                        {l.maxUses ? ` of ${l.maxUses}` : ""} confirmed · {l.approved} approved{l.waiting ? ` · ${l.waiting} waiting` : ""} · made by{" "}
                        {l.createdBy}
                      </span>
                    </span>
                    {l.state === "open" && <SwitchOffLinkButton id={l.id} label={l.label} />}
                  </div>
                  {l.state === "open" && <CopyLink url={l.url} label={`Sign-up link: ${l.label}`} />}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      <p className="text-xs text-black/50">
        Already in the directory? Open their page and use <strong>Email invite</strong> in its Member portal section, so they keep one record.
      </p>
    </div>
  );
}
