// Stand-in DD plan for tests and local development (DECK_AI_MOCK=true, never production).
import type Anthropic from "@anthropic-ai/sdk";
import { DD_AREAS } from "./prompt";
import type { DDPlan } from "./schema";

export function samplePlan(): DDPlan {
  return {
    scope: "Confirm the evidence behind the pilot traction, the NHS integration dependency and S/EIS eligibility before DXV commits.",
    areas: DD_AREAS.map((area) => ({
      area,
      focus: `Sample focus for ${area}.`,
      questions: [`Sample question on ${area}?`],
      evidenceToRequest: [`Sample evidence for ${area}`],
      watchFor: [`Sample concern for ${area}`],
    })),
    priorityRisks: ["NHS integration dependency", "No technical co-founder"],
    documentsRequested: ["Cap table (fully diluted)", "Management accounts, last 12 months", "S/EIS advance assurance letter"],
  };
}

export function fakeDDClient(opts: { plan?: DDPlan | null; stopReason?: string; onRequest?: (p: unknown) => void } = {}): Anthropic {
  return {
    messages: {
      parse: async (params: unknown) => {
        await mockDelay();
        opts.onRequest?.(params);
        return {
          model: "mock-model",
          stop_reason: opts.stopReason ?? "end_turn",
          parsed_output: opts.plan === undefined ? samplePlan() : opts.plan,
          usage: { input_tokens: 5000, output_tokens: 3000 },
        };
      },
    },
  } as unknown as Anthropic;
}

/** Local dev only: DECK_AI_MOCK_DELAY_MS makes the fake AI take a while, to see progress UI. */
async function mockDelay() {
  const ms = Number(process.env.DECK_AI_MOCK_DELAY_MS ?? 0);
  if (ms > 0) await new Promise((r) => setTimeout(r, ms));
}
