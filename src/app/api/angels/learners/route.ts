// Course learners as a CSV (team only). No notes or quiz answers: progress, self-description and opt-ins.
import { getCurrentUser } from "@/lib/auth";
import { describesAsLabel } from "@/content/course";
import { loadCourseLearners } from "@/lib/course-admin";
import { LESSON_COUNT } from "@/lib/course";
import { csvCell } from "@/lib/csv";

const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return new Response("Unauthorised", { status: 401 });
  const rows = await loadCourseLearners();
  const header = [
    "Name",
    "Email",
    "Type",
    "Email confirmed",
    "Signed up",
    "Last active",
    "Describes themselves as",
    `Lessons complete (of ${LESSON_COUNT})`,
    "Quiz answers correct",
    "Contact about the syndicate",
    "Consent changed",
    "Join request",
  ];
  const lines = rows.map((r) =>
    [
      r.name,
      r.email,
      r.kind,
      r.confirmed ? "Yes" : "No",
      day(r.createdAt),
      day(r.lastActiveAt),
      r.describesAs ? describesAsLabel(r.describesAs) : "",
      r.summary.lessonsComplete,
      r.summary.answeredOf ? `${r.summary.correct} of ${r.summary.answeredOf}` : "",
      r.wantsContact ? "Yes" : "No",
      day(r.syndicateContact?.createdAt),
      r.request?.status ?? "",
    ]
      .map(csvCell)
      .join(","),
  );
  const csv = "﻿" + [header.map(csvCell).join(","), ...lines].join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="dxv-course-learners-${day(new Date())}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
