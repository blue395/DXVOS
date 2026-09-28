// Stand-in memo for tests and local development (DECK_AI_MOCK=true, never production).
import type Anthropic from "@anthropic-ai/sdk";
import { CRITERIA, type MemoContent } from "./schema";

export function sampleMemo(name = "Sample Co"): MemoContent {
  const scores = [3, 4, 3, 2, 3, 3, 3, 2, 1, 4, 4];
  return {
    header: {
      businessName: name,
      round: "Not assigned",
      stage: "Pre-seed",
      businessModel: "B2B SaaS subscription for independent pharmacies",
      sdgs: ["SDG 3: Good health and well-being"],
      impactThesis: "Improves medication access for patients of independent pharmacies. Founder background: not stated.",
      impactThemes: ["Health"],
      diversityThemes: [],
    },
    executiveSummary: `${name} sells repeat-prescription software to independent UK pharmacies, which lose staff time to manual processes.`,
    investmentCase: ["Paid pilot with 12 pharmacies at £150 a month", "Founders are both former pharmacists", "Material risk: NHS integration dependency"],
    conclusion: "Moderate risk, moderate return; suits angels with health-sector experience.",
    scores: CRITERIA.map((criterion, i) => ({ criterion, score: scores[i], justification: `Sample justification for ${criterion}.` })),
    swot: {
      strengths: ["Domain-expert founders"],
      weaknesses: ["No technical co-founder"],
      opportunities: ["Consolidation among independents"],
      threats: ["Large EPOS vendors adding the feature"],
    },
    followUpQuestions: ["Can you confirm the founders' backgrounds against DXV's thesis?", "What is churn across the pilot?"],
  };
}

export function fakeMemoClient(opts: { memo?: MemoContent | null; stopReason?: string; onRequest?: (p: unknown) => void } = {}): Anthropic {
  return {
    messages: {
      parse: async (params: unknown) => {
        await mockDelay();
        opts.onRequest?.(params);
        return {
          model: "mock-model",
          stop_reason: opts.stopReason ?? "end_turn",
          parsed_output: opts.memo === undefined ? sampleMemo() : opts.memo,
          usage: { input_tokens: 4321, output_tokens: 2100 },
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
