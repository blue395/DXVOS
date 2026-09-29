// The angel's portal home, as a plain view of their data, so admins can preview it
// ("Preview as angel") exactly as the angel sees it. Server-component safe.
import Link from "next/link";
import { buttonClass, formatDate } from "@/components/ui";
import { CERTIFICATION_LABELS, certState, canSeeLiveDeals, type CertLike } from "@/lib/pipeline";
import type { AngelStatus, CertificationType } from "@/generated/prisma/enums";

export type PortalAngel = {
  name: string;
  email: string | null;
  status: AngelStatus;
  archivedAt: Date | null;
  sectors: string[];
  ticketRange: string | null;
  experience: string | null;
  location: string | null;
  restrictedDeclaredAt: Date | null;
};

export function PortalHome({ angel, cert, preview = false }: { angel: PortalAngel; cert: (CertLike & { type: CertificationType }) | null; preview?: boolean }) {
  const state = certState(cert);
  const access = canSeeLiveDeals(angel, cert);
  const first = angel.name.split(" ")[0];
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-dxv-green">Hello {first}</h1>
        <p className="text-sm text-black/60">Your DXV member home.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-lg border border-black/10 bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-dxv-green">Your investor statement</h2>
          {cert && (state === "current" || state === "due-soon") ? (
            <div className="mt-2 space-y-2 text-sm">
              <p>
                <strong>{CERTIFICATION_LABELS[cert.type]}</strong>, signed {formatDate(cert.signedOn)}.
              </p>
              <p className={state === "due-soon" ? "rounded bg-dxv-yellow/40 px-2 py-1" : "text-black/65"}>
                {state === "due-soon" ? "Expires soon: " : "Valid until "}
                {formatDate(cert.expiresOn)}.{state === "due-soon" && " Renew it to keep seeing deals."}
              </p>
              {state === "due-soon" && !preview && (
                <Link href="/portal/certify" className={buttonClass()}>
                  Renew my statement
                </Link>
              )}
            </div>
          ) : (
            <div className="mt-2 space-y-2 text-sm">
              <p className="rounded bg-dxv-yellow/40 px-2 py-1">
                {angel.restrictedDeclaredAt && !cert
                  ? "You told us neither investor statement applies to you, so we can't share investment opportunities with you. You're still part of the DXV community."
                  : cert
                    ? `Your statement expired on ${formatDate(cert.expiresOn)}. Sign a new one to see deals again.`
                    : "You haven't signed an investor statement yet."}
              </p>
              {!preview && (
                <Link href="/portal/certify" className={buttonClass()}>
                  {angel.restrictedDeclaredAt && !cert ? "My circumstances have changed" : "Sign my statement"}
                </Link>
              )}
            </div>
          )}
        </section>

        <section className="rounded-lg border border-black/10 bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-dxv-green">Deals</h2>
          <p className="mt-2 text-sm text-black/65">
            {access
              ? "No deals are shared with you right now. When DXV opens a deal for members' pitch selection vote, it will appear here with its pitch deck."
              : "Deals appear here for members with a current investor statement."}
          </p>
        </section>

        <section className="rounded-lg border border-black/10 bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-dxv-green">Your profile</h2>
          <dl className="mt-2 space-y-1 text-sm">
            <Row label="Email" value={angel.email} />
            <Row label="Location" value={angel.location} />
            <Row label="Interested in" value={angel.sectors.join(", ")} />
            <Row label="Typical cheque" value={angel.ticketRange} />
            <Row label="Experience" value={angel.experience} />
          </dl>
          {!preview && (
            <Link href="/portal/profile" className="mt-3 inline-block text-sm font-medium text-dxv-green underline">
              Update my details
            </Link>
          )}
        </section>

        <section className="rounded-lg border border-black/10 bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-dxv-green">How DXV works</h2>
          <VideoSlot />
        </section>
      </div>
    </div>
  );
}

/** Where the how-to video goes (added later). */
export function VideoSlot() {
  return (
    <div className="mt-2 flex aspect-video items-center justify-center rounded-md bg-dxv-green/[0.06] text-center text-sm text-black/55 ring-1 ring-dxv-green/15">
      <span>
        <span className="block text-2xl text-dxv-green" aria-hidden>
          ▶
        </span>
        A short how-to video is coming soon.
      </span>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex gap-2">
      <dt className="w-28 shrink-0 text-black/50">{label}</dt>
      <dd>{value || "–"}</dd>
    </div>
  );
}
