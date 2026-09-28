@AGENTS.md

# DXV OS — project conventions

Spec: `DXV_OS_Product_Spec_FINAL.md`. Architecture overview: `README.md`.

- Blue is building this hands-on to learn: explain what you're doing and why as you go; ask before big, hard-to-reverse architecture calls.
- Palette is exactly `#fbe45b` (dxv-yellow), `#1a3c35` (dxv-green), white, black. Tints via opacity (`black/10`), never new colours. Warnings use yellow, not red.
- Domain rules go in `src/lib/pipeline.ts` (pure + unit-tested), not in components.
- Stage changes only via `moveVentureStage()` in `src/lib/ventures.ts`.
- Every page and server action calls `requireAdmin()` itself; `src/proxy.ts` is not a security boundary.
- Future angel logins: the **Dashboard and Activity pages stay admin-only** (Blue's requirement). When an angel role is added, keep `requireAdmin()` on them; the angel experience is still to be designed, so ask Blue before exposing any existing page to angels.
- Append-only tables (StageChange, MemoVersion, PreSelectionVote, InvestmentVote): never add update/delete paths.
- Forms use `ActionForm` (`src/components/action-form.tsx`); actions return `ActionResult`.
- Helpers used by server components must not live in `"use client"` files.
- Prisma 7: client is generated to `src/generated/prisma` (import from `@/generated/prisma/client` or `/enums`). Scripts run via `tsx --conditions=react-server`.
- Deployed on Netlify + Supabase (`docs/DEPLOY.md`). Every migration that creates a table must also `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` (Supabase Data API exposure).
- AI deck reading: prompt/model in `src/lib/deck-ai/prompt.ts`; the AI suggests, humans decide (never auto-move a deal on AI output). Modules shared with `netlify/functions/` must not import `server-only` or use `@/` aliases.
- AI memo assessment: prompt in `src/lib/memo-ai/prompt.ts` (DXV's document, verbatim); the review banner is app-rendered, never model-generated. AI drafts (`MemoAnalysis`) and finalised reviewed memos (`MemoVersion`) are never edited; only `MemoDraft` is, and score overrides are logged.
- Documents: DXV OS (Supabase Storage) is the document store; **no Google Drive links**. Nothing is deleted, declined deals included (Blue's decision, for dealflow learning); mistaken uploads are archived. Allowed types and limits live in `src/lib/documents.ts`.
- Before pushing: `npm test && npm run typecheck && npm run lint && npm run build`.
- PRs: Claude opens a PR for its work and may merge its own PRs once those checks pass (Blue's standing permission). Merging to `main` deploys to production and runs migrations, so always tell Blue what merged, and call out any database migration explicitly.
