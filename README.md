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
netlify/functions/            analyze-deck-background, analyze-memo-background, generate-dd-background, suggest-lessons-background, brain-reply-background: the long-running workers
src/lib/memo-ai/              AI memo: prompt (edit here), schema + scoring criteria, rendering, context, mock
src/lib/memo-worker.ts        Runs one memo assessment
src/lib/dd-doc/               DD document: prompt (edit here), schema, context, Word builder (docx), mock
src/lib/dd-worker.ts          Runs one DD document job (AI plan, build .docx, store under Documents)
src/lib/brain/                DXV Brain: instructions (from the Playbook), read-only tools, reply loop, mock
src/lib/brain-worker.ts       Writes one Brain reply (streams text into the database as Claude writes)
src/components/brain/         The floating Brain panel (on every page) and its Markdown renderer
src/app/(app)/deals/[id]/assessment/   Full assessment page (AI drafts, review copy, reviewed versions)
src/components/               Shared UI (ActionForm, Card, badges…)
scripts/                      seed.ts (dev), create-admin.ts
```

## Key design decisions

- **Append-only history.** `StageChange`, `MemoVersion`, `PreSelectionVote`, `InvestmentVote`
  are insert-only — there is no update/delete code path. A re-vote creates a new row; the
  latest per angel counts (older ones show as "superseded").
- **Two vote entities, never collapsed** (spec §7).
- **Founder comms are created automatically.** Moving a deal out of a gate stage (or declining it)
  creates a `FounderComm` row as *Not yet sent*, so the dashboard's "founders awaiting a decision
  update" can't be forgotten. Skipping stages creates one per gate skipped; moving backwards creates none.
- **Declined deals have their own board view** (stored as `PASSED`): the **Declined** pill next to the round pills (`/deals?declined=1`, combinable with a round) shows them read-only, grouped by the stage they were declined at. On the live board, drag a card onto the Declined pill to decline it (a reason is asked for), or use the deal page's Decline pill.
- **Redeploys and open pages.** A page open across a deploy can call server actions the new build doesn't know. `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` (Netlify env) keeps action IDs stable across builds; `stale-version-banner.tsx` offers a Reload when a deploy is detected (`/api/version`) or an action fails that way.
- **Investment commitments** show a running total of each angel's latest interested EOI (no threshold);
  a deal sitting in Investment Commitments for over 7 days gets a warning (`src/lib/pipeline.ts`).
- **Auth is checked server-side in every page and action**, not just in `proxy.ts`
  (spec §10 principle, ready for angel logins later).
- **Money in whole pounds** (`Int`).
- **Few database round trips per page.** Production talks to Supabase over the network, so each round trip
  is expensive. Prisma's `relationJoins` loads a record and its relations in one SQL query, and pages check
  the admin and load their data in parallel (`requireAdminWith`). With 80ms simulated database latency the
  deal page went from 555ms to 131ms. Keep Netlify's Functions region next to the database (London).

## Feel: feedback on every click

- **Page loads:** a yellow progress bar at the top (`nav-progress.tsx`) plus a skeleton per page (`loading.tsx`, preloaded by Next so clicks respond at once).
- **Buttons:** clear hover (lift + ring) and press states; spinner and a working label while running; "✓ Saved" after (`action-form.tsx`, `action-button.tsx`). DD ticks and board moves update instantly (optimistic) while the server saves.
- **Long AI jobs** (eligibility screen, investment assessment, DD document): a floating tray, bottom right, on every page, with elapsed time and an estimated progress bar, then "ready: Open" (`job-tray.tsx` + `/api/jobs`). It only checks while something is running. In local dev, `DECK_AI_MOCK_DELAY_MS=15000` makes the fake AI slow enough to see it.

## Deal page layout

The deal page follows the dealflow. Sections that matter at the deal's stage start open and are marked
**Now**; the others collapse to a one-line summary (e.g. "£20k from 2 angels"). Rules: `focusSections()` in
`src/lib/pipeline.ts`. A sticky menu jumps to any section. The header has one-click **Advance to <next stage>**
(the confirm says what founder update it queues; `advanceTarget()`), and **Other move…** for anything else,
including Declined, and a **Decline** pill that records where in the dealflow the deal was declined and flags the
founder update. Entry forms (votes, EOIs, DD items) open from "+ Record…" buttons and close after saving.

## Commitments, final investment and the Investment Total

- **Investment commitments / EOI:** running total of each angel's latest interested EOI.
- **Final investment** (after Due Diligence): each angel's actual ticket, ticked when the money arrives.
  "Add interested angels from EOIs" starts the list. Paid tickets on deals at Investment Complete (or S/EIS)
  make the dashboard's Investment Total (`investedGbp()` in `pipeline.ts`; deals from before this feature
  fall back to the old typed-in amount).
- Both lists can be edited and entries removed. Every change (and each payment tick) is written to
  `EntryAudit` and shown under **History**; removed entries are hidden, never deleted.

## AI deck reading & eligibility screen

Upload a deck on **New venture** and Claude (Sonnet 5) pre-fills the form and drafts the
eligibility screen using DXV's prompt template (`src/lib/deck-ai/prompt.ts`).
- AI output is stored separately (`DeckAnalysis`) and shown *alongside* human judgement, never in place of it.
- Nothing moves without a person: Proceed / Decline / Request more info are recorded in
  `EligibilityReview` (append-only) with who and when; Proceed/Decline go through `moveVentureStage()`.
- "Not stated" thesis fit is flagged for a human to ask the founder, never auto-declined.
- House style (no em-dashes, arrows, emoji) is enforced mechanically after the model responds.
- Setup: `docs/DEPLOY.md` §5.

**Board intake.** Drop founder decks (PDFs, several at once) on the board's **Submitted** column, or
click its drop box. Each becomes a Submitted deal with the deck under Documents; a quick read
(`src/lib/deck-ai/intake.ts`, `DeckAnalysis.intakeOnly`) fills only the company name, primary founder
and stage (never overwriting what a person typed). No screen runs: the card shows **Not screened**
until someone clicks **Run eligibility screen** on the deal page, which screens the stored deck.
Intake-only analyses have no `screen`, so anything reading "the latest screen" must skip them.

Company Stage is a dropdown (`COMPANY_STAGES` in `pipeline.ts`: Pre-Seed, Seed, Series A, Bridge Round,
or Other with free text); AI-read stages are normalised onto it with `normaliseCompanyStage()`.

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

## Playbook: DXV's criteria and lessons (`/playbook`)

The feedback loop behind the AI, and what the DXV Brain knows DXV's criteria and lessons from.
- **Eligibility criteria** and **Investment assessment criteria** are editable by the team (add, remove, rename,
  reorder; the four core eligibility criteria can be reworded but not removed). Every save is a new, noted
  version (`PlaybookVersion`, append-only) with history and restore; version 0 is DXV's original documents,
  verbatim. A preview shows the exact prompt the AI will get.
- The AI eligibility screen and investment assessment are built from the **latest version plus approved
  lessons** (`src/lib/playbook/prompts.ts`), snapshotted onto each job, so every screen and memo shows the
  "criteria vN" it used. Memos keep the criteria they were scored against and total out of their own maximum.
- **Lessons**: added by the team, or **suggested by the AI** (background job `suggest-lessons-background`) when
  a deal is declined, when the team changes the AI's scores before issuing a memo, or when an eligibility
  decision differs from the AI's recommendation. Suggestions wait for a person to approve (menu badge).
  Approved eligibility/assessment/general lessons (newest 40) are given to those AI steps.

## Angels (`/angels`)

DXV's members and prospects (spec §8), admin-only for now.
- **Directory**: stat cards led by **Certification needed** (members without a current statement: the
  headline compliance number, yellow when non-zero, also on the Dashboard's Angels card), due in 30 days,
  prospects, women members (self-declared tag); filters, search, copy emails, CSV export, duplicates review.
- **Certification**: each signed FCA statement (high net worth or self-certified sophisticated: 12 months;
  certified sophisticated from an FCA firm: 36 months, to be confirmed by Kevin) is an append-only
  `AngelCertification`, optionally with the signed file (private storage, served via `/api/angels/certifications/[id]`).
  The most recently signed one counts. `canSeeLiveDeals()` in `pipeline.ts` is the compliance gate for when
  angels log in (spec §10): current, non-archived members only; enforce it server-side on angel-facing data.
- **Angel page**: profile (sectors, self-declared tags, WhatsApp groups recorded, source), certification history,
  notes (append-only), and investments across deals (EOIs, pre-selection votes, final tickets) with totals.
- **Import**: `/angels/import` reads a CSV (e.g. the Squarespace export) in the browser; you match columns to
  fields (remembered per header row), preview, and import in batches. Matches by email, fills blanks only.
- **Linking votes**: votes recorded as typed names link to angels through confirmed aliases (`AngelAlias`,
  reviewed at `/angels/link`, with suggestions like "Kevin W" = Kevin Walker), so append-only votes are never
  edited. New votes and investments pick from an autocomplete of angel names and link on save.
- Not yet: angel logins and self-service (spec: after the certification gate is proven), automated
  self-certification links, WhatsApp integration (needs Meta's WhatsApp Business API and a compliance view on
  promotions), membership fees (`membershipTier` reserved). Ethnicity isn't recorded (special-category data)
  until Kevin confirms the lawful basis.

## DXV Brain (floating AI assistant, every page)

The **DXV Brain** button (bottom right, or Ctrl+J) opens a chat with Claude Opus 5.5 that is DXV-first:
- **Instructions** (`src/lib/brain/prompt.ts`) describe DXV and carry the current Playbook criteria and approved
  lessons (all scopes, newest 80), snapshotted onto each chat (`BrainConversation.context`), like every AI job.
- **Reads DXV OS, changes nothing.** Its tools (`src/lib/brain/tools.ts`) are read-only lookups: list deals, a
  deal's full record, the memo, the DD plan, the stored deck, pipeline totals, recent activity. There are no
  write tools; asked to change something, it says where a partner does that.
- **Knows the page**: each question carries a hidden note with the time and, on a deal page, which deal.
- **Web search** (Anthropic's server tool) for market and public facts, with cited sources shown under the answer;
  up to 12 searches per question (each follow-up gets a fresh allowance), spread across different sources.
  It's told never to search with confidential DXV information.
- **Setup versions**: the instructions and tools are fixed per chat (`BrainContext.setup`, `BRAIN_SETUP_VERSION`),
  because Claude rejects a follow-up if they change mid-chat; changes reach new chats only.
- **Chats are private** to the person who started them (`BrainConversation.userId`; every query is scoped to
  the signed-in user) and archived, never deleted. Each message stores exactly what went to and came back from
  Claude and is replayed unchanged, so follow-ups keep full context. A deck the Brain read is stored as a
  pointer to the PDF, not the file.
- **How a reply runs**: `askBrain()` saves the question and a pending reply, then starts the background function
  `brain-reply-background` (answers can take longer than a normal request allows). The worker streams Claude's
  text into the database every half second; the panel checks once a second while a reply is being written
  (the one place a component polls), so text appears as it's written. Safety-filter declines retry on
  Anthropic's designated fallback model (`fallbacks: "default"`).
- Local development: `DECK_AI_MOCK=true` gives a canned reply that exercises a lookup, streaming and a source.

## Exporting documents (PDF and Word)

Every document DXV OS writes has **Export: PDF | Word** buttons: the eligibility screen, the investment memo
(AI Draft, DXV Review Draft, DXV Review Issue) and the DD report (stored as Word; PDF on export).
- Each document type is described once as a `DocSpec` (`src/lib/export/spec.ts`: cover + blocks) in
  `src/lib/export/documents.ts` (screen, memo) and `src/lib/dd-doc/build.ts` (DD report).
- Two renderers turn the same spec into a DXV-branded file: `export/docx.ts` (docx library) and
  `export/pdf.ts` (pdf-lib, built-in Helvetica, so no browser or system fonts are needed on Netlify).
- Route: `/api/export/<screen|ai-draft|draft|issue|dd>/<id>?format=pdf|docx` (admin only). Drafts carry
  the app-rendered review banner; issues carry the "issued by" footer.

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
