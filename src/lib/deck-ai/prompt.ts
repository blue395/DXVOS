// The prompt DXV OS sends to Claude with each founder deck.
//
// The screening prompt itself is built from the Playbook (src/lib/playbook): DXV's
// criteria, edited by the team in DXV OS and versioned. Version 0 is DXV's
// "Eligibility Screening — AI Prompt Template", verbatim (playbook/defaults.ts).
// The output shape is defined separately in schema.ts.
//
// Shared by the Next.js app and the Netlify background function: keep this module
// free of Next-only imports (no "server-only", no "@/" aliases).

/** Model that reads decks. Chosen by DXV: Claude Sonnet 5 (fast, lower cost). */
export const DECK_AI_MODEL = "claude-sonnet-5";
