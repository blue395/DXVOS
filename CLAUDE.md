@AGENTS.md

# DXV OS — project conventions

Spec: `DXV_OS_Product_Spec_FINAL.md`. Architecture overview: `README.md`.

- Blue is building this hands-on to learn: explain what you're doing and why as you go; ask before big, hard-to-reverse architecture calls.
- Palette is exactly `#fbe45b` (dxv-yellow), `#1a3c35` (dxv-green), white, black. Tints via opacity (`black/10`), never new colours. Warnings use yellow, not red.
- Domain rules go in `src/lib/pipeline.ts` (pure + unit-tested), not in components.
- Stage changes only via `moveVentureStage()` in `src/lib/ventures.ts`.
- Every page and server action calls `requireAdmin()` itself; `src/proxy.ts` is not a security boundary. Pages may use `requireAdminWith(() => load())` to check and read in parallel; actions always check before writing.
- Speed: every database round trip costs ~80ms+ in production, so load a page's data in one `Promise.all` (Prisma `relationJoins` puts a record and its relations in one query); avoid sequential awaits.
- Future angel logins: the **Dashboard and Activity pages stay admin-only** (Blue's requirement). When an angel role is added, keep `requireAdmin()` on them; the angel experience is still to be designed, so ask Blue before exposing any existing page to angels.
- Append-only tables (StageChange, MemoVersion, PreSelectionVote, EntryAudit): never add update/delete paths. EOIs (`InvestmentVote`) and `FinalInvestment` are editable (Blue, 2026-09-29) but every edit, payment tick and removal writes an `EntryAudit` row, and removal only sets `removedAt` (always filter `removedAt: null`).
- "Passed" is labelled **Declined** in the UI (enum stays `PASSED`; `passedFromStage` records where). Capital Transfer is retired. The board shows declined deals only via the Declined filter pill (read-only, grouped by `passedFromStage`); the live board has no Declined column. Investment Total = paid Final Investment tickets (`investedGbp()` in pipeline.ts).
- Forms use `ActionForm` (`src/components/action-form.tsx`); actions return `ActionResult`. Every clickable thing gives feedback: buttons use `buttonClass` / `SubmitButton` / `ActionButton` (spinner + working label, "✓ Saved" after); no bare `<form action>` buttons.
- Long AI jobs: call `announceJobStarted()` after starting one; the floating `JobTray` (`src/components/job-tray.tsx`, reads `/api/jobs`) shows progress and refreshes the page when done. Pages must not poll themselves.
- Deal page layout follows the stage: `focusSections()` / `advanceTarget()` in `pipeline.ts` decide which sections start open ("Now") and where one-click Advance goes; other sections collapse (`Card collapse`). Entry forms sit behind `Reveal` ("+ Add…") buttons.
- Every page has a `loading.tsx` skeleton next to it (route groups keep one route's skeleton from showing for another).
- Helpers used by server components must not live in `"use client"` files.
- Prisma 7: client is generated to `src/generated/prisma` (import from `@/generated/prisma/client` or `/enums`). Scripts run via `tsx --conditions=react-server`.
- Deployed on Netlify + Supabase (`docs/DEPLOY.md`). Every migration that creates a table must also `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` (Supabase Data API exposure).
- AI deck reading: prompt/model in `src/lib/deck-ai/prompt.ts`; the AI suggests, humans decide (never auto-move a deal on AI output). Modules shared with `netlify/functions/` must not import `server-only` or use `@/` aliases.
- AI memo assessment: prompt in `src/lib/memo-ai/prompt.ts` (DXV's document, verbatim); the review banner is app-rendered, never model-generated. Naming: AI Draft N → DXV Review Draft N (one working draft per issue) → DXV Review Issue N (locked) → revise → Draft N+1 (helpers in `src/lib/memo-ai/render.ts`). AI drafts (`MemoAnalysis`) and issues (`MemoVersion`) are never edited; only `MemoDraft` is, and score overrides are logged.
- DD document: prompt in `src/lib/dd-doc/prompt.ts`, Word layout in `src/lib/dd-doc/build.ts`; the "DRAFT: AI-assisted" notice is app-rendered. Generated files are ordinary `Document` rows (category DUE_DILIGENCE), never overwritten.
- Documents: DXV OS (Supabase Storage) is the document store; **no Google Drive links**. Nothing is deleted, declined deals included (Blue's decision, for dealflow learning); mistaken uploads are archived. Allowed types and limits live in `src/lib/documents.ts`.
- Before pushing: `npm test && npm run typecheck && npm run lint && npm run build`.
- PRs: Claude opens a PR for its work and may merge its own PRs once those checks pass (Blue's standing permission). Merging to `main` deploys to production and runs migrations, so always tell Blue what merged, and call out any database migration explicitly.
