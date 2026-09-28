# DXV OS

Diversity X Ventures Operating System — system of record for DXV's deal pipeline
(and, from week 2, angel membership). Product spec: [`DXV_OS_Product_Spec_FINAL.md`](DXV_OS_Product_Spec_FINAL.md).

**Status: Week 1 (Dealflow)** — ventures, the eleven-state pipeline with stage history,
kanban board, Deal Review page, Pre-Selection and Investment (EOI) votes, decision gates
with Founder Comms tracking, admin-only auth.

## Stack

| Layer | Choice | Why |
|---|---|---|
| App | Next.js 16 (App Router) + TypeScript | One deployable; server components read the DB directly, server actions handle writes — no separate API |
| DB | Postgres + Prisma 7 | Relational data (pipeline, votes, certification); `prisma/schema.prisma` is the readable source of truth |
| Styling | Tailwind CSS 4 | DXV palette defined once as theme tokens in `src/app/globals.css` |
| Auth | Email + bcrypt password, signed JWT in HttpOnly cookie (`jose`) | Zero external setup for 3 admins |
| Drag & drop | dnd-kit | Accessible (keyboard support), maintained |
| Tests | Vitest | Unit tests for the pure pipeline rules |

## Getting started

```bash
npm install                      # also runs `prisma generate`
cp .env.example .env             # set DATABASE_URL and SESSION_SECRET
npm run db:migrate               # create tables
npm run db:seed                  # DEV ONLY: sample ventures + admin@dxv.local / dxv-dev-password
npm run dev                      # http://localhost:3000
```

Create a real admin (prints a generated password once):

```bash
npm run admin:create -- anna@diversityxventures.com "Anna"
```

Checks: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.

## Where things live

```
prisma/schema.prisma          Data model (all entities, with comments on each)
src/lib/pipeline.ts           Domain rules — stages, gates, momentum threshold, warnings (pure, unit-tested)
src/lib/ventures.ts           moveVentureStage(): the ONE place a stage changes (venture + history + comms, in a transaction)
src/lib/auth.ts               requireAdmin() — the real access check
src/lib/session.ts            Session cookie signing/verification
src/proxy.ts                  Optimistic redirect to /login (convenience, not security)
src/app/login/                Login page + login/logout actions
src/app/(app)/                Signed-in area (route group — the folder name isn't in URLs)
  page.tsx                    Dashboard
  deals/page.tsx              Kanban board (server: loads data)
  deals/kanban-board.tsx      Kanban board (client: drag & drop)
  deals/[id]/page.tsx         Deal Review page
  deals/actions.ts            All deal server actions
  activity/page.tsx           Stage-history log
  deals/deck-actions.ts       Deck upload, AI analysis trigger, eligibility decision
  deals/[id]/eligibility-*    Eligibility screen card + human decision form
src/lib/deck-ai/              AI deck reading: prompt (edit here), output schema, rendering, mock
src/lib/deck-worker.ts        Runs one analysis (claim job, read deck, call Claude, save)
src/lib/deck-storage.ts       Supabase Storage (prod) / .data/<bucket> (dev), for decks and documents
src/lib/documents.ts          Document rules: allowed types (PDF/Word/Excel), 50 MB limit, categories
src/app/(app)/deals/document-actions.ts   Upload, confirm, archive documents
netlify/functions/            analyze-deck-background, analyze-memo-background, generate-dd-background: the long-running workers
src/lib/memo-ai/              AI memo: prompt (edit here), schema + scoring criteria, rendering, context, mock
src/lib/memo-worker.ts        Runs one memo assessment
src/lib/dd-doc/               DD document: prompt (edit here), schema, context, Word builder (docx), mock
src/lib/dd-worker.ts          Runs one DD document job (AI plan, build .docx, store under Documents)
src/app/(app)/deals/[id]/assessment/   Full assessment page (AI drafts, review copy, reviewed versions)
src/components/               Shared UI (ActionForm, Card, badges…)
scripts/                      seed.ts (dev), create-admin.ts
```

## Key design decisions

- **Append-only history.** `StageChange`, `MemoVersion`, `PreSelectionVote`, `InvestmentVote`
  are insert-only — there is no update/delete code path. A re-vote creates a new row; the
  latest per angel counts (older ones show as "superseded").
- **Two vote entities, never collapsed** (spec §7).
- **Founder comms are created automatically.** Moving a deal out of a gate stage (or to Passed)
  creates a `FounderComm` row as *Not yet sent*, so the dashboard's "founders awaiting a decision
  update" can't be forgotten. Skipping stages creates one per gate skipped; moving backwards creates none.
- **Passed is pinned** on the board's right edge — it's reachable from every stage, so it's always a drop target.
- **Investment commitments** show a running total of each angel's latest interested EOI (no threshold);
  a deal sitting in Investment Commitments for over 7 days gets a warning (`src/lib/pipeline.ts`).
- **Auth is checked server-side in every page and action**, not just in `proxy.ts`
  (spec §10 principle, ready for angel logins later).
- **Money in whole pounds** (`Int`).

## AI deck reading & eligibility screen

Upload a deck on **New venture** and Claude (Sonnet 5) pre-fills the form and drafts the
eligibility screen using DXV's prompt template (`src/lib/deck-ai/prompt.ts`).
- AI output is stored separately (`DeckAnalysis`) and shown *alongside* human judgement, never in place of it.
- Nothing moves without a person: Proceed / Decline / Request more info are recorded in
  `EligibilityReview` (append-only) with who and when; Proceed/Decline go through `moveVentureStage()`.
- "Not stated" thesis fit is flagged for a human to ask the founder, never auto-declined.
- House style (no em-dashes, arrows, emoji) is enforced mechanically after the model responds.
- Setup: `docs/DEPLOY.md` §5.

## AI-assisted investment assessment (DXV Partner Review)

From DXV Partner Review onwards, a partner can click **Generate AI assessment** on a deal. Claude (Sonnet 5)
drafts a memo in DXV's template (header, executive summary, investment case, conclusion, eleven-criterion
scoring table, SWOT, follow-up questions) from the stored deck plus what DXV OS already knows (eligibility
screen, partner decisions, founder comms notes). Prompt: `src/lib/memo-ai/prompt.ts`.
- Naming: **AI Draft N** (`MemoAnalysis`, immutable, records its context; banner added by the app) →
  **DXV Review Draft N** (`MemoDraft`, one working draft per issue; saving updates it; scores overruled
  individually, logged in `MemoScoreChange`) → **Mark complete** → **DXV Review Issue N** (locked `MemoVersion`,
  kind `REVIEWED_MEMO`) → **Revise** → DXV Review Draft N+1 → Issue N+1.
- Full memo UI at `/deals/[id]/assessment`; runs in the Netlify background function `analyze-memo-background`.

## Due Diligence document (AI first draft, Word)

On the deal's **Due Diligence** card (DXV Partner Review onwards), **Create DD document** asks Claude (Sonnet 5)
for a DD plan built on UK pre-seed/seed best practice, using the deck, the latest memo (Issue, else Review Draft,
else AI Draft), the eligibility screen and existing DD items. DXV OS turns it into a DXV-branded Word file
(cover and deal summary, purpose and scope, priority risks, eight DD areas each with questions, evidence to
request, what to watch for and a findings box, documents-requested tracker, conclusion and sign-off) and stores
it under Documents → Due diligence. Each run is recorded in `DDReportJob`; a new run makes a new file (old ones
are kept). Prompt: `src/lib/dd-doc/prompt.ts`; layout: `src/lib/dd-doc/build.ts`. Runs in the Netlify background
function `generate-dd-background`.

## Documents (DXV OS is the document store)

Every deal has a **Documents** section: PDF, Word and Excel files up to 50 MB, tagged Deck, Memo, Due
diligence, Legal, Financials or Other, stored in the private Supabase bucket `documents` (browser uploads
straight to storage via one-time signed URLs; an upload only appears once confirmed in storage).
- Decks uploaded for the AI eligibility screen are listed automatically (bucket `decks`).
- DD checklist items can have files attached. Uploading a Memo file also creates a memo version.
- Nothing is deleted (declined deals included); mistaken uploads are **archived** (hidden, kept).
- Google Drive links were retired on 2026-09-28. The old `Venture.deckUrl` / `driveFolderUrl` columns and
  `DRIVE_LINK` memo versions are no longer used or shown; drop them once confirmed empty.

## Week 2 hooks already in place

- Votes carry a nullable `angelId` next to the free-text `angelName`, ready to link to Angel records.
- `Role` enum is ready to gain `ANGEL`; `requireAdmin()` is the pattern for a future `requireCertifiedAngel()`.
- Nav shows Angels / Portfolio as disabled placeholders.

## Deployment

Netlify (app) + Supabase (Postgres, London region). Step-by-step: [`docs/DEPLOY.md`](docs/DEPLOY.md).

- `netlify.toml`: production deploys run `prisma migrate deploy` before building.
- Two DB URLs in production: `DATABASE_URL` (pooled, for the app) and `DIRECT_URL` (for migrations).
- Every table has Row Level Security enabled (no policies) so Supabase's Data API can't expose it.
- Remote DB connections are always TLS-encrypted (`src/lib/db-ssl.ts`). Server verification via `DATABASE_CA_CERT` is supported in code but **not yet usable** with Supabase's pooler — see `docs/DEPLOY.md` §1.4.
