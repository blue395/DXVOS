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
