// Export a document DXV OS created as PDF or Word (admin only).
//   /api/export/screen/<deckAnalysisId>    AI eligibility screen
//   /api/export/ai-draft/<memoAnalysisId>  AI Draft N (with the review banner)
//   /api/export/draft/<memoDraftId>        DXV Review Draft N (with the review banner)
//   /api/export/issue/<memoVersionId>      DXV Review Issue N (locked memo)
//   /api/export/dd/<ddReportJobId>         DD report
// ?format=pdf (default) or ?format=docx
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ddSpec } from "@/lib/dd-doc/build";
import type { DDContext } from "@/lib/dd-doc/context";
import type { DDPlan } from "@/lib/dd-doc/schema";
import type { EligibilityScreen } from "@/lib/deck-ai/schema";
import { renderDocx } from "@/lib/export/docx";
import { memoSpec, screenSpec } from "@/lib/export/documents";
import { renderPdf } from "@/lib/export/pdf";
import { DOCX_MIME, exportFileName, formatLongDate, PDF_MIME, type DocSpec } from "@/lib/export/spec";
import { aiDraftName, issueNumbers, reviewDraftName, reviewIssueName } from "@/lib/memo-ai/render";
import type { MemoContent } from "@/lib/memo-ai/schema";
import { ELIGIBILITY_DECISION_LABELS, PASS_REASON_LABELS } from "@/lib/pipeline";

type Loaded = { spec: DocSpec; docName: string; ventureName: string; date: Date } | null;

async function load(kind: string, id: string): Promise<Loaded> {
  switch (kind) {
    case "screen": {
      const a = await db.deckAnalysis.findUnique({
        where: { id },
        include: {
          venture: { select: { name: true } },
          reviews: { orderBy: { decidedAt: "asc" }, include: { decidedBy: { select: { name: true } } } },
        },
      });
      if (!a || a.status !== "COMPLETE" || !a.screen) return null;
      const screen = a.screen as EligibilityScreen;
      const ventureName = a.venture?.name ?? screen.companyName;
      const date = a.completedAt ?? a.createdAt;
      const decisions = a.reviews.map(
        (r) =>
          `${ELIGIBILITY_DECISION_LABELS[r.decision]} (${r.decidedBy.name}, ${formatLongDate(r.decidedAt)})` +
          (r.passReason ? `. Reason: ${PASS_REASON_LABELS[r.passReason]}` : "") +
          (r.note ? `. ${r.note}` : ""),
      );
      return {
        spec: screenSpec(screen, { ventureName, fileName: a.fileName, model: a.model, screenedAt: date, decisions }),
        docName: "DXV Eligibility Screen",
        ventureName,
        date,
      };
    }
    case "ai-draft": {
      const a = await db.memoAnalysis.findUnique({ where: { id }, include: { venture: { select: { name: true } } } });
      if (!a || a.status !== "COMPLETE" || !a.output) return null;
      const name = aiDraftName(a.number);
      const date = a.completedAt ?? a.createdAt;
      return {
        spec: memoSpec(a.output as MemoContent, { name, ventureName: a.venture.name, banner: true, date }),
        docName: name,
        ventureName: a.venture.name,
        date,
      };
    }
    case "draft": {
      const d = await db.memoDraft.findUnique({ where: { id }, include: { venture: { select: { name: true } } } });
      if (!d) return null;
      const name = reviewDraftName(d.number);
      return {
        spec: memoSpec(d.content as MemoContent, { name, ventureName: d.venture.name, banner: true, date: d.updatedAt }),
        docName: name,
        ventureName: d.venture.name,
        date: d.updatedAt,
      };
    }
    case "issue": {
      const v = await db.memoVersion.findUnique({
        where: { id },
        include: { venture: { select: { name: true } }, createdBy: { select: { name: true } } },
      });
      if (!v || v.kind !== "REVIEWED_MEMO" || !v.content) return null;
      const issues = await db.memoVersion.findMany({ where: { ventureId: v.ventureId, kind: "REVIEWED_MEMO" }, select: { id: true, version: true } });
      const name = reviewIssueName(issueNumbers(issues).get(v.id)!);
      const footer = `${name}, issued by ${v.createdBy.name} on ${formatLongDate(v.createdAt)}.${v.summary ? ` ${v.summary}` : ""}`;
      return {
        spec: memoSpec(v.content as MemoContent, { name, ventureName: v.venture.name, banner: false, footer, date: v.createdAt }),
        docName: name,
        ventureName: v.venture.name,
        date: v.createdAt,
      };
    }
    case "dd": {
      const j = await db.dDReportJob.findUnique({ where: { id } });
      if (!j || j.status !== "COMPLETE" || !j.output) return null;
      const ctx = j.context as DDContext;
      const date = j.completedAt ?? j.createdAt;
      return { spec: ddSpec(ctx, j.output as DDPlan, date), docName: "DXV DD Report", ventureName: ctx.ventureName, date };
    }
    default:
      return null;
  }
}

export async function GET(req: Request, ctx: RouteContext<"/api/export/[kind]/[id]">) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return new Response("Unauthorised", { status: 401 });

  const { kind, id } = await ctx.params;
  const format = new URL(req.url).searchParams.get("format") === "docx" ? "docx" : "pdf";
  const doc = await load(kind, id);
  if (!doc) return new Response("Not found", { status: 404 });

  const bytes = format === "pdf" ? await renderPdf(doc.spec) : await renderDocx(doc.spec);
  const fileName = exportFileName(doc.docName, doc.ventureName, doc.date, format);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": format === "pdf" ? PDF_MIME : DOCX_MIME,
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
