// What members read on the Help page and in the deals board's "How this works".
// EDIT THE WORDING HERE: plain text, one string per paragraph. DRAFT (Claude, 2026-10-28)
// for Blue and Kevin to check; the S/EIS answers in particular need Kevin's word.
// The numbers (votes per round, the £25k minimum) come from pipeline.ts, so they can't drift.

import { EOI_MINIMUM_GBP, EOI_PROGRESS_MIN_INTERESTED, PRE_SELECTION_VOTE_LIMIT, SHARE_CERT_EXPECTED_WEEKS, formatGbp } from "@/lib/pipeline";

const MINIMUM = formatGbp(EOI_MINIMUM_GBP);

/** The steps of a DXV round, in order, with what each means for a member. `column` is the board column it appears in, if any. */
export const HOW_IT_WORKS: {
  title: string;
  column: string | null;
  text: string;
}[] = [
  {
    title: "Deal sourcing and review",
    column: "DXV Partner Review",
    text: "Founders apply to DXV. The team checks each one against our criteria, meets the founders and writes an investment memo. You'll see these companies on the board, but their details open later.",
  },
  {
    title: "Pre-selection vote",
    column: "Member Pitch Selection",
    text: `DXV shares up to six companies with a deck and memo. Vote for your top ${PRE_SELECTION_VOTE_LIMIT}: the ${PRE_SELECTION_VOTE_LIMIT} companies with the most votes are invited to pitch. You can change your votes until voting closes. A vote is not a commitment to invest.`,
  },
  {
    title: "Monthly pitch",
    column: "Pitch Outcome",
    text: "The chosen founders pitch to members at DXV's monthly session: about 10 minutes each, then questions. Sessions are listed on your home page with a link to book.",
  },
  {
    title: "Expression of interest",
    column: "Investment Commitments",
    text: `After the pitch, tell DXV whether you're interested in investing and the most you'd put in. We aim for ${MINIMUM} of interest in total before a deal goes forward. This isn't a commitment: DXV confirms final amounts with you before anything is paid.`,
  },
  {
    title: "Due diligence (opt-in)",
    column: "Due Diligence",
    text: "Members who said they're interested can join due diligence. The due diligence documents open to you on the deal page, and the team shares what it finds.",
  },
  {
    title: "Investment decision, SPV and closing",
    column: "Investment Complete",
    text: "You confirm your final amount. Investments go through a special purpose vehicle (SPV). Once the round closes, the deal appears in My portfolio, and DXV follows up on share certificates and S/EIS certificates.",
  },
];

export type FaqSection = { title: string; items: { q: string; a: string[] }[] };

export const FAQ: FaqSection[] = [
  {
    title: "The deals board",
    items: [
      {
        q: "What's on the deals board?",
        a: [
          "Every DXV deal in the round open to members, in the column for the step it has reached. Deals you've voted for, said you're interested in, or invested in are highlighted.",
          "A company's deck and memo open from the pre-selection vote, once DXV has shared it with members. Before that you'll see its name, sector and what it's raising.",
        ],
      },
      {
        q: "Why can't I open some companies?",
        a: ["They're still with the DXV team (sourcing and review), or DXV hasn't shared them with members yet. Declined companies aren't shown."],
      },
    ],
  },
  {
    title: "Voting",
    items: [
      {
        q: "How does the pre-selection vote work?",
        a: [
          `Each round you have ${PRE_SELECTION_VOTE_LIMIT} votes. Vote "Yes" on the ${PRE_SELECTION_VOTE_LIMIT} companies you'd most like to hear pitch. The ${PRE_SELECTION_VOTE_LIMIT} companies with the most votes are invited to the monthly pitch.`,
          'You can change your mind until voting closes: change a vote to "No" to free it up for another company. The voting deadline is shown on the board and on each deal.',
        ],
      },
      {
        q: "Does voting commit me to invest?",
        a: ["No. A vote only says you'd like to hear the company pitch. Only the DXV team sees how you voted."],
      },
      {
        q: "What is an expression of interest?",
        a: [
          `After the pitch you can say whether you're interested in investing and the most you'd put in. DXV aims for ${MINIMUM} of interest in total before going ahead, and each deal shows progress towards it once at least ${EOI_PROGRESS_MIN_INTERESTED} members are interested (as a total only: nobody's name or amount is shown).`,
          "An expression of interest isn't a commitment. DXV confirms the final amount with you before anything is paid.",
        ],
      },
    ],
  },
  {
    title: "S/EIS tax relief",
    items: [
      {
        q: "What are SEIS and EIS?",
        a: [
          "The Seed Enterprise Investment Scheme (SEIS) and Enterprise Investment Scheme (EIS) are UK government schemes that give income tax relief to people who invest in qualifying early-stage companies.",
          "In broad terms, SEIS relief is 50% of the amount invested and EIS relief is 30%, if you hold the shares for at least 3 years and the company and investment keep qualifying. There are annual limits and other conditions.",
        ],
      },
      {
        q: "How do I claim the relief?",
        a: [
          "Once the company has HMRC's approval, it issues an SEIS3 or EIS3 certificate. DXV passes it on to you, and you use it to claim through your Self Assessment tax return (or by asking HMRC to adjust your tax code).",
          "The S/EIS figures in My portfolio are estimates to help you keep track, not a calculation of what you'll get.",
        ],
      },
      {
        q: "Is this tax advice?",
        a: [
          "No. This is general information, not tax or financial advice. Your own circumstances decide what relief you can claim, so speak to a qualified tax adviser.",
        ],
      },
    ],
  },
  {
    title: "My portfolio",
    items: [
      {
        q: "When will I get my share certificate?",
        a: [
          `The company issues share certificates after the round completes, usually within about ${SHARE_CERT_EXPECTED_WEEKS} weeks of investing (My portfolio shows the expected date). DXV requests them from the founders for you. If yours hasn't arrived by then, contact the team.`,
        ],
      },
      {
        q: "Who can see my portfolio?",
        a: ["Only you. Investments you add from outside DXV, and the notes you write, are private to you and aren't shown to the DXV team."],
      },
    ],
  },
];
