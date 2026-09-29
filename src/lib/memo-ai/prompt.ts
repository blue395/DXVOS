// The prompt DXV OS sends to Claude to draft an Investment Assessment and Memo.
//
// The prompt itself is built from the Playbook (src/lib/playbook): DXV's scoring
// criteria and taxonomy, edited by the team in DXV OS and versioned. Version 0 is
// sections 1 to 3 of DXV's "AI Venture Assessment & Memo Assistant", verbatim.
// Section 4 (the review banner) is added by the app (see render.ts), never the model.
//
// Shared with the Netlify background function: no Next-only imports, no "@/" aliases.

/** Model that drafts memos. Chosen by DXV: Claude Sonnet 5. */
export const MEMO_AI_MODEL = "claude-sonnet-5";
