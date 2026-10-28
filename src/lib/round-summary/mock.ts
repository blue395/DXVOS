// Stand-in round summaries for tests and local development (DECK_AI_MOCK=true, never production).
import type Anthropic from "@anthropic-ai/sdk";
import type { DealSummaryAi } from "./schema";

export function sampleDealSummary(name = "Sample Co"): DealSummaryAi {
  return {
    headline: `${name} sells repeat-prescription software to independent UK pharmacies, which lose hours a week to manual processes.`,
    dealTerms: "£250k SEIS on a £2m pre-money (as the deck states)",
    strengths: ["Paid pilot with 12 pharmacies at £150 a month", "Both founders are former pharmacists", "Clear wedge before NHS integration"],
    concerns: ["No technical co-founder", "NHS integration dependency", "Small pilot: churn not yet shown"],
    dxvFit: "Health impact through access to medicines in underserved areas; founder background not stated.",
    impactThemes: ["Health"],
    diversityThemes: [],
    keyQuestion: "What does churn look like across the pilot after six months?",
  };
}

/** A fake client: `fail` names deals (by a word in the context) whose call throws. */
export function fakeSummaryClient(opts: { fail?: string[]; onRequest?: (p: unknown) => void } = {}): Anthropic {
  return {
    messages: {
      parse: async (params: { messages: { content: { type: string; text?: string }[] }[] }) => {
        const ms = Number(process.env.DECK_AI_MOCK_DELAY_MS ?? 0);
        if (ms > 0) await new Promise((r) => setTimeout(r, ms));
        opts.onRequest?.(params);
        const text = params.messages[0].content.find((c) => c.type === "text")?.text ?? "";
        const name = /Venture: (.+)/.exec(text)?.[1] ?? "Sample Co";
        if (opts.fail?.some((f) => text.includes(f))) throw new Error(`Simulated failure for ${name}`);
        return { model: "mock-model", stop_reason: "end_turn", parsed_output: sampleDealSummary(name), usage: { input_tokens: 2000, output_tokens: 400 } };
      },
    },
  } as unknown as Anthropic;
}
