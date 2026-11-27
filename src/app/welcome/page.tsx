import Link from "next/link";
import { connection } from "next/server";
import { WELCOME as W } from "@/content/welcome";
import { db } from "@/lib/db";

export const metadata = {
  title: "Diversity X Ventures",
  description: "Join the DXV angel syndicate, or learn about angel investing with our free course.",
};

/** The approved investor statements' criteria (the same wording members sign), or null before one is approved. */
async function statementCriteria() {
  const texts = await db.complianceText.findMany({
    where: { kind: { in: ["HNW_STATEMENT", "SOPHISTICATED_STATEMENT"] }, status: "APPROVED" },
    orderBy: { version: "desc" },
    select: { kind: true, criteria: true },
  });
  const pick = (kind: string) => texts.find((t) => t.kind === kind)?.criteria ?? null;
  return { hnw: pick("HNW_STATEMENT"), sophisticated: pick("SOPHISTICATED_STATEMENT") };
}

// Public: the first screen at DXV OS's address for anyone not signed in (src/proxy.ts sends
// them here from "/"). Two routes: angel investors request to join (approve-first), everyone
// else can take the free course. Wording in src/content/welcome.ts (Kevin to check).
export default async function WelcomePage() {
  await connection(); // read on every visit, so a newly approved statement shows straight away
  const criteria = await statementCriteria();
  return (
    <main className="flex-1 bg-dxv-green text-white">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
        <div className="flex items-center justify-between gap-3">
          {/* The Diversity X Ventures wordmark in DXV yellow (the image is used as a mask, as on the course page). */}
          <span
            role="img"
            aria-label="Diversity X Ventures"
            className="block aspect-[640/77] w-44 bg-dxv-yellow sm:w-56"
            style={{ WebkitMask: "url(/brand/dxv-logo.png) center/contain no-repeat", mask: "url(/brand/dxv-logo.png) center/contain no-repeat" }}
          />
          <Link href="/login" className="text-sm text-white/85 underline-offset-4 hover:underline">
            <span className="hidden sm:inline">Already have an account? </span>
            <span className="font-semibold text-dxv-yellow">Sign in</span>
          </Link>
        </div>

        <div className="mt-10 max-w-2xl sm:mt-14">
          <h1 className="text-3xl font-semibold text-dxv-yellow sm:text-5xl">{W.title}</h1>
          <p className="mt-4 text-lg text-white/85">{W.intro}</p>
        </div>

        <div className="mt-8 grid gap-4 sm:mt-10 lg:grid-cols-3">
          <RouteCard tag={W.member.tag} title={W.member.title} text={W.member.text} cta={W.member.cta} href="/login" />
          <RouteCard tag={W.investor.tag} title={W.investor.title} text={W.investor.text} cta={W.investor.cta} href="/join/request" />
          <RouteCard tag={W.learner.tag} title={W.learner.title} text={W.learner.text} cta={W.learner.cta} href="/learn/join" plain />
        </div>
      </div>

      <section id="who-qualifies" className="bg-white text-black">
        <div className="mx-auto max-w-6xl space-y-5 px-4 py-10">
          <h2 className="text-2xl font-semibold text-dxv-green">{W.qualifies.title}</h2>
          <p className="max-w-3xl text-black/75">{W.qualifies.intro}</p>
          <div className="grid gap-4 md:grid-cols-2">
            <Criteria title={W.qualifies.hnw} lead={W.qualifies.lead} items={criteria.hnw} />
            <Criteria title={W.qualifies.sophisticated} lead={W.qualifies.lead} items={criteria.sophisticated} />
          </div>
          <p className="rounded-lg border-l-4 border-dxv-yellow bg-dxv-yellow/15 px-4 py-3 text-sm text-black/80">{W.risk}</p>
        </div>
      </section>
    </main>
  );
}

function RouteCard({ tag, title, text, cta, href, plain }: { tag: string; title: string; text: string; cta: string; href: string; plain?: boolean }) {
  // The course is a page of its own: a plain link (full page load).
  const Tag = plain ? "a" : Link;
  return (
    <Tag
      href={href}
      className="group flex flex-col rounded-2xl bg-white p-6 text-black shadow-xl transition hover:-translate-y-0.5 focus-visible:outline-4 focus-visible:outline-dxv-yellow sm:p-8"
    >
      <span className="self-start rounded-full bg-dxv-yellow px-3 py-0.5 text-xs font-semibold text-dxv-green">{tag}</span>
      <span className="mt-4 text-2xl font-semibold text-dxv-green">{title}</span>
      <span className="mt-2 flex-1 text-black/75">{text}</span>
      <span className="mt-6 inline-flex items-center gap-2 self-start rounded-full bg-dxv-green px-5 py-2.5 font-semibold text-white transition group-hover:bg-black">
        {cta} <span aria-hidden>→</span>
      </span>
    </Tag>
  );
}

function Criteria({ title, lead, items }: { title: string; lead: string; items: string[] | null }) {
  return (
    <div className="rounded-xl border border-black/10 p-5">
      <h3 className="font-semibold text-dxv-green">{title}</h3>
      {items ? (
        <>
          <p className="mt-1 text-sm text-black/60">{lead}</p>
          <ul className="mt-3 space-y-2 text-sm text-black/80">
            {items.map((c) => (
              <li key={c} className="flex gap-2">
                <span aria-hidden className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-dxv-green" />
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-2 text-sm font-medium">The wording for this statement is being finalised. Ask us at angels@diversityx.vc.</p>
      )}
    </div>
  );
}
