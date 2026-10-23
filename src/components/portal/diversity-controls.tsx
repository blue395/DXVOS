"use client";

// Profile > My diversity information: remove everything (withdraw consent), and the
// account-wide "Your data" tools (download, delete my account).
import { useState } from "react";
import { ActionButton } from "@/components/action-button";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { inputClass } from "@/components/ui";
import { CONSENT_V1 } from "@/lib/diversity/consent-v1";
import { BACKUP_DAYS } from "@/lib/legal-links";
import { deleteMyAccount, withdrawMyDiversity } from "@/app/portal/diversity/actions";

export function WithdrawPanel({ hasAnything }: { hasAnything: boolean }) {
  const [done, setDone] = useState(false);
  if (done) {
    return (
      <p role="status" className="rounded bg-dxv-green/[0.06] px-3 py-2 text-sm text-dxv-green">
        {CONSENT_V1.withdrawDone.replace("[30 days]", `${BACKUP_DAYS} days`)}
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-sm text-black/70">{CONSENT_V1.profileWithdraw}</p>
      <ActionButton
        variant="secondary"
        pendingLabel="Removing…"
        confirm="Remove all your diversity information? Your answers will be deleted."
        run={async () => {
          const r = await withdrawMyDiversity();
          if (r.ok) setDone(true);
          return r;
        }}
      >
        {hasAnything ? "Remove my diversity information" : "Remove my diversity information (nothing saved)"}
      </ActionButton>
    </div>
  );
}

export function YourData({ partner }: { partner: boolean }) {
  return (
    <section className="space-y-3 rounded-lg border border-black/10 bg-white p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-dxv-green">Your data</h2>
      <div className="space-y-1">
        <p className="text-sm text-black/70">{CONSENT_V1.downloadMyData}</p>
        <p className="flex flex-wrap gap-3 text-sm">
          <a href="/api/portal/my-data?format=json" className="font-medium text-dxv-green underline" download>
            Download (JSON)
          </a>
          <a href="/api/portal/my-data?format=csv" className="font-medium text-dxv-green underline" download>
            Download (CSV)
          </a>
        </p>
      </div>
      <div className="space-y-2 border-t border-black/10 pt-3">
        <p className="text-sm font-medium">{CONSENT_V1.deleteAccount}</p>
        {partner ? (
          <p className="text-sm text-black/60">You&apos;re a DXV partner, so your login is a team login: another partner can revoke it on the Team page first.</p>
        ) : (
          <ActionForm action={deleteMyAccount} className="space-y-2">
            <p className="text-xs text-black/60">
              This closes your login and erases your personal details and diversity answers. To keep deal records accurate, amounts you invested and
              your investor statement records (type and dates) stay, with your name removed. This can&apos;t be undone.
            </p>
            <label className="block text-sm">
              Type <strong>delete</strong> to confirm
              <input name="confirm" autoComplete="off" className={`${inputClass} mt-1 max-w-xs`} />
            </label>
            <SubmitButton variant="secondary" pendingLabel="Deleting…">
              Delete my account and all my data
            </SubmitButton>
          </ActionForm>
        )}
      </div>
    </section>
  );
}
