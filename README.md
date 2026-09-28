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
- **Momentum threshold** (£20k within 7 days of entering Investment votes) is a constant in
  `src/lib/pipeline.ts` — change it there if the syndicate's rule changes.
- **Auth is checked server-side in every page and action**, not just in `proxy.ts`
  (spec §10 principle, ready for angel logins later).
- **Money in whole pounds** (`Int`).

## Week 2 hooks already in place

- Votes carry a nullable `angelId` next to the free-text `angelName`, ready to link to Angel records.
- `Role` enum is ready to gain `ANGEL`; `requireAdmin()` is the pattern for a future `requireCertifiedAngel()`.
- Nav shows Angels / Portfolio as disabled placeholders.

## Deployment

Netlify (app) + Supabase (Postgres, London region). Step-by-step: [`docs/DEPLOY.md`](docs/DEPLOY.md).

- `netlify.toml`: production deploys run `prisma migrate deploy` before building.
- Two DB URLs in production: `DATABASE_URL` (pooled, for the app) and `DIRECT_URL` (for migrations).
- Every table has Row Level Security enabled (no policies) so Supabase's Data API can't expose it.
- Remote DB connections are always TLS-encrypted; `DATABASE_CA_CERT` adds server verification (`src/lib/db-ssl.ts`).
