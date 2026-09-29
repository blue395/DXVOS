// Display labels for the Playbook (safe to import from server and client components).
import type { LessonScope } from "@/generated/prisma/enums";

export const SCOPE_LABELS: Record<LessonScope, string> = {
  GENERAL: "General",
  ELIGIBILITY: "Eligibility screen",
  ASSESSMENT: "Investment assessment",
  DUE_DILIGENCE: "Due diligence",
  PORTFOLIO: "Portfolio",
};
