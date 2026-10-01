import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { mailConfigured } from "@/lib/mail";
import { loadAudiences } from "../audience";
import { Composer } from "./composer";

export const metadata = { title: "New email · DXV OS" };

export default async function NewEmailPage({ searchParams }: PageProps<"/angels/emails/new">) {
  const [me, sp] = await Promise.all([requireAdmin(), searchParams]);
  if (!mailConfigured()) redirect("/angels/emails");
  const [templates, audiences] = await Promise.all([
    db.emailTemplate.findMany({ where: { archivedAt: null, key: null }, orderBy: { name: "asc" }, select: { id: true, name: true, subject: true, body: true } }),
    loadAudiences(),
  ]);
  const start = templates.find((t) => t.id === sp.template) ?? null;
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <Link href="/angels/emails" className="text-sm text-dxv-green hover:underline">
        ← Email angels
      </Link>
      <h1 className="text-2xl font-semibold text-dxv-green">New email to angels</h1>
      <Composer templates={templates} audiences={audiences} start={start} myEmail={me.email} myFirstName={me.name.split(" ")[0]} />
    </div>
  );
}
