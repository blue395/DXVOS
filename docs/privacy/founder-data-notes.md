# Founder data: notes for the privacy notice and DPIA

Notes for Kevin, one per change to how DXV OS uses founders' personal data (the docs/privacy
rule: "any new data field, third-party service or new use of existing data needs a
one-paragraph note"). The launch pack covers members; this file covers founders.

## 2026-10-28: founders' application answers go to the AI assessments

**What changed.** The AI-assisted eligibility screen, investment assessment (memo) and
Partner Review round summary now read the founders' own application form answers (one-line
description, sector, stage, raise, website) and their founder diversity, alongside the deck.
Before, only the deck (and, for the memo, the deal's details) was sent. **Why.** Blue asked
for it (2026-10-28): the assessments weren't picking up the diversity founders had shared,
which is central to DXV's thesis-fit assessment. **Founder diversity is special-category
data.** It's only kept with the founder's explicit consent on the application form ("I
consent to DXV recording the founder diversity information I've shared, using it when
assessing my application, and tracking who DXV sees and backs"), or recorded by the team in
the deal's Founder diversity only as founders stated it; using it in the AI-assisted
assessment is the "assessing my application" purpose they consented to. The AI is never told
to infer diversity and gets an explicit "not stated, don't infer it" when there is none.
**Recipient.** Anthropic (Claude API), already DXV's processor for reading decks; no new
processor. What was given is recorded with each screen (`DeckAnalysis.aiContext.founderInfo`)
and memo job (`MemoAnalysis.context`). **For Kevin to check:** that the founder privacy
wording on /apply ("DXV uses the information and deck you share to assess your application")
and the DPIA's processor register cover AI-assisted assessment by Anthropic, and whether the
diversity consent line should name AI assistance explicitly.

## 2026-11-05: partners' emails to several founders at once

**What changed.** Partners can write one email to the founders of several deals (Deals →
Email founders), e.g. the date of the pitch session, with optional attachments. **Data
used.** The founder email address and names already held on each deal, and the company
name; no new field is collected. Each founder gets their own copy (no founder sees another's
address), and a copy is kept on the deal, as with decision emails. Declined deals are left
out unless a partner ticks "Include declined deals". **Recipient.** Sent from
angels@diversityx.vc through Google Workspace (DXV's existing mail provider); no new
processor. **For Kevin to check:** that the founder privacy wording covers DXV contacting
founders about the process (pitch sessions, updates) after they apply, and whether emails to
declined founders (e.g. future events) need a separate basis or an opt-out line.

## 2026-11-05: founder diversity names follow Kevin's wording

**What changed.** Kevin signed off the founder wording, privacy policy and DPIA, asking that
the founder diversity categories read: Female Founder, Person of Colour Founder,
Neurodivergent Founder, Disabled Founder, Founder from socio-economic disadvantaged
background, LGBTQIA+ Founder, First time founder over 50. The platform's list now uses these
names; earlier themes with no match (Immigrant, Not university educated, Experienced
homelessness, Experienced Care) stay. Answers already stored were renamed to the matching new
name ("Ethnic Minority" and "Global majority" both became Person of Colour Founder), keeping
any detail the founder gave in brackets. Issued memos keep the wording they were issued with.
**New category.** "First time founder over 50" is new (age is a protected characteristic, not
special category data). **Members.** Members' questions and consent wording are unchanged
(no re-consent needed). Insights now also shows members' combined figures under the same
headings, worked out from existing answers, under the same small-number rule: no new data
and no new recipient.

## 2026-11-05: Kevin's signed-off wording goes live

**Application form.** The "Founder diversity (optional)" section and its consent box now use
Kevin's signed-off wording (`src/content/founder-application.ts`, version
`founder-diversity-v2 (2026-11-05)`). Founders who applied before this date consented to the
earlier box ("using it when assessing my application, and tracking who DXV sees and backs");
their answers stay as they are unless Kevin advises asking again. The consent box sits above
the tick boxes, as in Kevin's layout.
**Retention.** Founders' diversity answers on their application are deleted 24 months after
they applied (daily retention job; the consent date stays as the record). **Open question for
Blue/Kevin:** the same answers are also copied to the deal's Founder diversity, which feeds
portfolio reporting (including to the British Business Bank). The notice's "24 months after
collection" could be read to cover that copy too; it is NOT deleted automatically yet.
**Privacy notice.** Published by DXV OS at `/privacy` (public), with member terms at `/terms`;
every in-app link points there unless NEXT_PUBLIC_PRIVACY_NOTICE_URL / NEXT_PUBLIC_TERMS_URL
say otherwise. Invites stay paused until the controller details (legal name, company number,
registered address, data protection lead) are filled in.
