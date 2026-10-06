import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminWith } from "@/lib/auth";
import { db } from "@/lib/db";
import { TemplateForm } from "./template-form";

export const metadata = { title: "Email template · DXV OS" };

export default async function TemplatePage({ params }: PageProps<"/angels/emails/templates/[id]">) {
  const { id } = await params;
  const template = await requireAdminWith(() => (id === "new" ? Promise.resolve(null) : db.emailTemplate.findUnique({ where: { id } })));
  if (id !== "new" && (!template || template.archivedAt)) notFound();
  const welcome = template?.key === "welcome";
  const founder = !!template?.key?.startsWith("founder-");
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <Link href={founder ? "/deals/submissions" : "/angels/emails"} className="text-sm text-dxv-green hover:underline">
        {founder ? "← Website submissions" : "← Email angels"}
      </Link>
      <div>
        <h1 className="text-2xl font-semibold text-dxv-green">{template ? template.name : "New template"}</h1>
        <p className="text-sm text-black/60">
          {founder
            ? "An email to founders, from angels@diversityx.vc. Use {{first_name}}, {{company}} and (for moving forward) {{next_step}}. Decision emails are drafted from this and checked by a partner before sending."
            : welcome
            ? "Sent automatically with the sign-up link when you invite a new applicant (Angels → Invite an angel, or Email invite for a Prospect)."
            : "A starting point for emails to angels. You can still change the words each time you send it."}
        </p>
      </div>
      <TemplateForm id={template?.id ?? null} keyed={!!template?.key} bulk={!template?.key} initial={{ name: template?.name ?? "", subject: template?.subject ?? "", body: template?.body ?? "" }} />
    </div>
  );
}
