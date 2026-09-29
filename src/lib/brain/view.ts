// A DXV Brain chat as the panel receives it (from /api/brain/[id]).
import type { DeckStatus } from "../deck-status";
import type { BrainSource } from "./run";

export type BrainChatMessage = {
  id: string;
  role: "USER" | "ASSISTANT";
  text: string;
  status: DeckStatus;
  activity: string | null;
  error: string | null;
  sources: BrainSource[];
};

export type BrainChat = { id: string; title: string; messages: BrainChatMessage[] };

export type BrainChatSummary = { id: string; title: string; updatedAt: string };

export const isAnswering = (m: Pick<BrainChatMessage, "role" | "status">) => m.role === "ASSISTANT" && (m.status === "PENDING" || m.status === "PROCESSING");
