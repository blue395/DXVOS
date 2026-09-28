// Shape of the AI's DD plan (structured outputs + zod). Shared with the worker.
import { z } from "zod";
import { DD_AREAS } from "./prompt";

export const DDAreaSchema = z.object({
  area: z.enum(DD_AREAS),
  focus: z.string(),
  questions: z.array(z.string()),
  evidenceToRequest: z.array(z.string()),
  watchFor: z.array(z.string()),
});

export const DDPlanSchema = z.object({
  scope: z.string(),
  areas: z.array(DDAreaSchema),
  priorityRisks: z.array(z.string()),
  documentsRequested: z.array(z.string()),
});

export type DDArea = z.infer<typeof DDAreaSchema>;
export type DDPlan = z.infer<typeof DDPlanSchema>;

export class DDPlanError extends Error {}

/** One entry per area, in report order; missing areas are an error (a bad draft). */
export function normaliseAreas(areas: DDArea[]): DDArea[] {
  const byArea = new Map(areas.map((a) => [a.area, a]));
  const missing = DD_AREAS.filter((a) => !byArea.has(a));
  if (missing.length) throw new DDPlanError(`The AI didn't cover: ${missing.join(", ")}. Try again.`);
  return DD_AREAS.map((a) => byArea.get(a)!);
}
