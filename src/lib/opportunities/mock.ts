// Stand-in slides for tests and local development (DECK_AI_MOCK=true, never production).
import type Anthropic from "@anthropic-ai/sdk";
import type { OpportunityAi } from "./schema";

export function sampleOpportunity(name = "Sample Co", theme = "Health"): OpportunityAi {
  return {
    summary: `${name} sells repeat-prescription software to independent UK pharmacies, which lose hours a week to manual processes.`,
    dateFounded: "2023",
    revenue: "£12k to date",
    traction: "Paid pilot with 12 pharmacies at £150 a month; NHS supplier framework application submitted.",
    useOfFunds: "Product, first sales hire and NHS integration.",
    taxScheme: "SEIS",
    raising: "Pre-seed £250k",
    assessment: "Clear problem with paying early customers and domain-expert founders. Key risks: NHS integration dependency and a small pilot so far.",
    theme,
  };
}

/** A fake client: `fail` names companies (by a word in the context) whose call throws. */
export function fakeOpportunityClient(opts: { fail?: string[]; onRequest?: (p: unknown) => void } = {}): Anthropic {
  return {
    messages: {
      parse: async (params: { messages: { content: { type: string; text?: string }[] }[] }) => {
        const ms = Number(process.env.DECK_AI_MOCK_DELAY_MS ?? 0);
        if (ms > 0) await new Promise((r) => setTimeout(r, ms));
        opts.onRequest?.(params);
        const text = params.messages[0].content.find((c) => c.type === "text")?.text ?? "";
        const name = /Company: (.+)/.exec(text)?.[1] ?? "Sample Co";
        const theme = /impact themes to group under: ([^,\n]+)/.exec(text)?.[1] ?? "Health";
        if (opts.fail?.some((f) => text.includes(f))) throw new Error(`Simulated failure for ${name}`);
        return {
          model: "mock-model",
          stop_reason: "end_turn",
          parsed_output: sampleOpportunity(name, theme),
          usage: { input_tokens: 2000, output_tokens: 400 },
        };
      },
    },
  } as unknown as Anthropic;
}
