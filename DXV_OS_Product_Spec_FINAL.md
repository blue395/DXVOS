# Diversity X Ventures — Operating System
Product specification — final, consolidated (supersedes v1–v5)
Primary build tool: Claude Code. Blue building hands-on, fast-and-explain pairing style.

## 1. What this is

A system of record for DXV's two core workflows — the founder/deal pipeline and the angel membership lifecycle — replacing the current mix of Google Drive, Forms, Sheets and email. Information architecture is inspired by AngelOS (angelos.vc); the pipeline stages, vote types, instruments and compliance requirements are DXV's own, drawn from DXV's Investment Process Manual.

DXV may start charging angels a membership fee this winter. Nothing in this MVP should assume that's decided (it isn't), but the data model shouldn't need reshaping when it is.

## 2. Build approach

> **Amended 2026-09-28 (Blue): DXV OS is the document store for the deal lifecycle.**
> Decks, memos, DD papers, legal and financial documents (PDF, Word, Excel) are stored in
> DXV OS (private Supabase Storage), not Google Drive. Drive links are removed from the app.
> **Declined deals are kept, with their data and files**, to understand DXV's dealflow and
> build feedback loops (a future "DXV brain"); nothing is automatically deleted. Founders
> must be told this in the privacy notice on the submission form / website (UK GDPR
> transparency; lawful basis: legitimate interests). Kevin to confirm the wording.

- Built by Blue, hands-on, in Claude Code. Explain what's being built and why as you go — this is a learning project as much as a delivery, not a silent generate-and-hand-over.
- Two weeks of focused build time available now, then ongoing at a 4-day-week pace.
- Files (decks, memos) stay linked into the existing Google Drive structure rather than rebuilding file storage.
- Domain: diversityxventures.com (brand site, DNS managed via Squarespace). The app belongs on a subdomain (e.g. `app.diversityxventures.com`), added as a Squarespace DNS record once there's a deployment to point it at.

## 3. Users and roles

| Role | Who | MVP access |
|---|---|---|
| Admin | Blue, Anna, Kevin | Full access, only role with a login in MVP |
| Syndicate member (angel) | ~50+ certified investors | No login yet; added once the certification gate is proven |
| Prospective member | Website/event leads, not yet certified | Same — no login in MVP |
| Founder / applicant | Companies raising | Admin-entered only; no founder-facing submission portal in MVP |
| Scout | Tim, Lisa, future scouts | Admin-entered only in MVP |

## 4. Navigation

> **Amended 2026-09-28 (Blue):** when angel members get logins, the **Dashboard and
> Activity pages must not be visible or accessible to them** (admin-only). What the
> platform looks like for angels is still to be designed.
> Dashboard headline metrics are now: Angels, Live Deals (not passed and not yet
> invested), In DD, Investments (number), Investment total (£, from each deal's
> "Amount invested by DXV"), plus Deals by stage and Founders awaiting a decision update.

Dashboard · Angels · Deals · Portfolio · Activity, plus a **View as Angel** preview mode (lets an admin see exactly what a given angel's restricted view looks like — the practical test that the certification gate works, once it exists).

- **Dashboard** — deals by stage, cert-overdue count, founders-awaiting-a-decision-update count, upcoming pitch event
- **Angels** — member directory and certification tracking (§7)
- **Deals** — the pipeline (§5), the primary build target
- **Portfolio** — invested companies (deferred past MVP, see §9)
- **Activity** — global audit log of stage changes, votes, comms sends (MVP: raw stage-history log is enough; a dedicated feed screen is a later refinement)

## 5. The Deals pipeline

> **Amended 2026-09-28 (Blue): simplified stages.** The pipeline is now:
> 1 Submitted, 2 Eligibility Screen, 3 DXV Partner Review, 4 Member Pitch Selection,
> 5 Pitch Outcome, 6 Investment Commitments, 7 Due Diligence, 8 Capital Transfer,
> 9 Investment Complete, 10 S/EIS Certificate (if applicable), plus Passed.
> Pass/decline decision gates are at stages 2 to 7 (DXV Partner Review is now a gate).
> "Add to pipeline" was retired; existing deals there moved to DXV Partner Review.
> Each deal also has a **Round** (Round 1, Round 2, ...).
> **Amended again 2026-09-28:** the £20k-in-one-week momentum threshold is removed;
> Investment Commitments shows a running total of commitments instead. The list below is the original
> wording, kept for context; `src/lib/pipeline.ts` is the source of truth.
> **Amended 2026-09-30 (Blue): Playbook.** DXV's eligibility and investment assessment criteria are
> edited by the team in DXV OS (versioned; the AI uses the latest version, and every screen and memo records
> the version it used). A Lessons list captures what DXV learns; the AI suggests lessons at key moments for
> the team to approve, and approved lessons feed the AI steps. Both are the knowledge base for the future
> DXV Brain (an AI assistant for the team across deals, portfolio, declined deals and research).
> **Amended 2026-09-29 (Blue): deal lifecycle.** Capital Transfer is retired (deals there moved
> back to Due Diligence); payments are ticked off per angel in a new **Final Investment** section,
> and paid tickets on deals at Investment Complete make the dashboard's Investment Total.
> "Passed" is shown as **Declined**; a Decline button works at any live stage and records where
> in the dealflow the deal was declined, and the founder comm says so. The board has no S/EIS
> column (those deals show under Investment Complete). Each deal has a **Lead angel**. The
> Investment Assessment and Investment Memo are one section. EOIs and final tickets can be
> edited and removed, with every change kept in an audit history.

Ten linear stages plus one cross-cutting terminal state:

1. **Founder deck** — deck/materials received; admin-entered Venture record with a deck link
2. **Eligibility screening** — stage, sector, team, thesis-fit checked against DXV's underestimated-founder criteria
3. **Add to pipeline** — formally tracked from here; visible as a kanban card
4. **DXV internal team review** — investment memo drafted (versioned, linked to this Venture)
5. **Pitch selection** — syndicate pre-selection vote; up to 6 memos shared, top 3 chosen
6. **Pitch outcome** — presented at the monthly pitch event; outcome recorded
7. **Investment votes** — post-pitch EOI window; interest + max ticket size per angel, tracked against the momentum threshold (currently £20k in one week)
8. **Due Diligence** — DD group formed, checklist in progress
9. **Capital Transfer** — SPV formation and execution
10. **Investment** — closed, moves to Portfolio

**Passed** — reachable from any stage above, with a required reason (insufficient interest, DD flag, valuation gap, founder withdrew, ineligible). Every declined deal lands here rather than being deleted.

Every Venture needs a `current_stage` field and a **stage-history log** (timestamp, who moved it, from/to) — this is what makes "how long has this sat here" and "why did we pass" answerable later.

## 6. Decision gates and founder communications

Six stages are decision gates — points where a founder is owed a response, not just an internal status change:

| Gate | Decision |
|---|---|
| After Eligibility screening | Proceed, or decline |
| After Pitch selection | Invited to pitch, or not selected this round |
| After Pitch outcome | Proceeding to EOI, or not |
| After Investment votes | Threshold met and proceeding to DD, or passing |
| After Due Diligence | Proceeding to investment, or passing |
| Passed (any stage) | Always owed a response |

**Founder Comms record** (new entity, distinct from angel-facing comms — different audience, different purpose): Venture, gate, status (Not yet sent / Sent / Founder acknowledged), date, sender.

**Dashboard metric**: "Founders awaiting a decision update" — Ventures at a passed gate with no Founder Comms record marked Sent. Flags, doesn't block.

## 7. Vote types

Two distinct entities, never collapsed into one field:

- **Pre-Selection Vote** — angel + Venture + interest (no ticket size), used at the Pitch selection stage
- **Investment Vote / EOI** — angel + Venture + interest + max ticket size + timestamp, used at the Investment votes stage

Both are append-only: a new record per vote, never overwritten, so "what did the syndicate vote at pre-selection versus after the actual pitch" stays answerable as two different questions.

## 8. Angels module

Week 2 priority, once dealflow is working.

- **Angel record**: contact info, certification status + expiry, sectors of interest, cumulative committed/invested totals, on-platform status, an empty `membership_tier` field reserved for the future fee decision
- **Import**: certification data via CSV export from Squarespace (the website sign-up form's backend) — confirmed clean, not a reconciliation job
- **Dashboard stat cards**: total angels, cert overdue count (this is the headline compliance metric — make it as hard to miss as AngelOS makes it)
- **Bulk tools** (should-have, not week-2-critical): CSV import/export, copy email list, find duplicates

## 9. MVP scope

**Week 1 — Dealflow:**
- Venture record, eleven-state pipeline (ten + Passed), stage-history logging
- Kanban board across the pipeline
- Deal Review detail page: memo, DD checklist, both vote types, Founder Comms status
- Decision-gate flags and the founders-awaiting-update dashboard count
- Admin-only auth

**Week 2 — Angels:**
- Angel record, Squarespace CSV import, cert-status dashboard
- Connect votes/EOIs recorded in week 1 to real Angel records rather than free text

**Should have, after weeks 1–2:**
- Portfolio module
- Deal Share (visibility controls for co-investment partners: GIN, Tabu Ventures, Ada Ventures — a real current DXV practice, not speculative)
- Founder-facing application intake
- Event management (pitch night attendee lists)
- Dedicated Activity feed screen

**Explicitly deferred:**
- Angel self-service login (comes after the certification gate is proven, not before)
- Multi-tenancy / white-labelling for other syndicates (relevant to DXV's BBB training contract, but a distinct project)
- Billing/Stripe integration (membership fee model still undecided)
- Automated financial-promotion compliance checking beyond the access gate itself (stays admin-driven until Kevin signs off on what's safe to automate)

## 10. Compliance principle

Certification status must gate access to live deal terms and voting once angels log in themselves — enforced server-side, not just hidden in the UI. Not urgent for weeks 1–2 (admin-only), but the Angel record's certification field and status logic should be built correctly in week 2 so the gate is real, not retrofitted, when self-service login is added later.

## 11. Non-functional requirements

- Treat certification and financial data as sensitive by default
- Prefer append-only records (votes, memo versions, stage history) over edit-in-place
- Design for a small admin team (3 people), not concurrent-editing scale

## 12. Suggested technical approach

Single deployable web app — a Next.js/TypeScript-class framework Claude Code can scaffold cleanly. Postgres for the relational pipeline/vote/certification data (inherently relational, not document-shaped). Simple auth with a role field driving visibility. Deployed on a low-cost platform (Vercel/Railway-class) appropriate for pre-revenue internal tooling, with the `app.diversityxventures.com` subdomain pointed at it once live.

## 13. Not yet decided, but not blocking

- Whether the "diversity representation" stat (if added to the Angels dashboard later) should track the angel base itself, founder diversity in the pipeline, or both
- Exact conditions for the deal-card warning icon beyond the two drafted (stalled past the EOI window, overdue DD item)
- Membership fee shape and timing (winter 2026, structure undecided)

