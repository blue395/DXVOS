# Angel Foundations course: data notes for Kevin

DRAFT (Blue, 2026-11-27). The free course at `/learn` is open to anyone who signs up. This note
lists what it collects, so the privacy notice, DPIA and records of processing can be updated.
The course has its own short notice at `/learn/privacy` (wording in `src/content/course.ts`).

## What we collect, and why

| Data | Why | Lawful basis (proposed) | Kept |
| --- | --- | --- | --- |
| Name, email | Sign-in (emailed one-time links), saving progress | Contract (the service they asked for) | Until deleted, or 24 months after last use |
| Lessons opened, quiz answers and scores, notes | Saving progress across devices | Contract | As above |
| "Which best describes you?" (high net worth / sophisticated / already an angel / here to learn) | Telling angels from angels-in-training; planning education work (combined figures only) | Legitimate interests | As above |
| "Contact me about joining the syndicate" (its own unticked box), with timestamp and exact wording | Contacting them about membership | Consent (withdrawable on their account page) | As above |
| 18+ and "I have read the privacy notice", with timestamp and exact wording | Record of what they agreed to | Legal obligation / accountability | As above |
| Keyed hash of the sign-up IP address | Limits automated sign-ups (5 a day per connection) | Legitimate interests | As above |

## Safeguards
- Learners' notes and quiz answers are never shown to the DXV team: the "Course learners" page and its CSV show progress, self-description and the opt-in only.
- Learners never see deals, decks or memos: their login type (LEARNER) is refused by every portal page and API. Joining needs a partner's approval, the member terms, and the FCA investor statement signed on the Deal Platform.
- The self-description is not a legal statement. The "What this means" text for the two investor options shows DXV's approved statement wording (the same versioned text the platform uses), or a marked placeholder until it is approved.
- Learners can download their course data (JSON) and delete it themselves. Deleting closes a course-only login; members keep their login and lose only course data.
- Retention (daily job): sign-ups never confirmed are deleted after 7 days; course-only learners inactive for 24 months are deleted when `RETENTION_DELETE_INACTIVE=on` (counted until then, like members).
- No tracking cookies. The course page loads its fonts from Google Fonts (as DXV's standalone course did): this tells Google the visitor's IP address. Kevin to decide whether to keep this or self-host the fonts.

## For Kevin to confirm
1. The course privacy notice wording, and whether to fold it into the main notice.
2. The FCA wording shown under "What this means" (approve the statements under Angels > Statements and terms; the 2024 changes to the high net worth criteria).
3. The consent wording in `src/content/course.ts` (a change means a new version string).
4. Google Fonts on the course page (above).

## Welcome page (Blue, 2026-11-27)
DXV OS's address now opens a public welcome page (`/welcome`, wording in `src/content/welcome.ts`) for anyone not signed in, with two routes:
- **"Already an angel investor?"** goes to `/join/request`: name and email only, the same approve-first journey as a shareable sign-up link (confirm email, then a partner approves before any invite; requests that never become members are deleted after 90 days). New records show the source "DXV website request".
- **"Curious about angel investing?"** goes to the course sign-up above.

For Kevin: the page describes DXV in general terms only (no companies, figures or returns), shows the approved investor statement criteria word for word, and carries a risk warning. Please check it against the Financial Promotion Order.
