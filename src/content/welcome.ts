// The public welcome page (Blue, 2026-11-27): the first screen at DXV OS's address for anyone
// not signed in. DRAFT for Kevin to check against the Financial Promotion Order: it describes
// DXV in general only (no companies, figures or returns). The investor criteria shown come from
// the approved ComplianceText statements (the same versioned wording members sign).

export const WELCOME = {
  title: "Welcome to DXV",
  intro:
    "Diversity X Ventures is a UK angel syndicate backing Underestimated Founders® building impact ventures at pre-seed and seed. Choose the option that fits you.",
  member: {
    tag: "Members",
    title: "Already a DXV member?",
    text: "Sign in to see the deals open to you, record your votes, follow your portfolio and carry on with your learning.",
    cta: "Sign in",
  },
  investor: {
    tag: "For angel investors",
    title: "Already an angel investor?",
    text: "Already an angel investor* and want to see deals from Underestimated Founders building impact ventures? Request to join the DXV syndicate. Once the DXV team has approved your request, you'll set up your profile and complete your investor statement.",
    cta: "Request to join",
  },
  learner: {
    tag: "Free training",
    title: "Curious about angel investing?",
    text: "Want to learn more? Access our free foundational training: six short lessons on building an investment thesis, finding and screening startups, due diligence, EIS and SEIS, building a portfolio and supporting the companies you back.",
    cta: "Start the free course",
  },
  qualifies: {
    title: "* Who counts as an angel investor?",
    intro:
      "UK financial promotion rules mean DXV can only share investment opportunities with people who are certified high net worth individuals or self-certified sophisticated investors, and who have signed a statement saying so in the last 12 months. You sign your statement on the DXV platform after your request is approved. Not sure you qualify? The free course is open to everyone.",
    hnw: "High net worth individual",
    sophisticated: "Self-certified sophisticated investor",
    lead: "The statement you'd sign says at least one of these applies to you:",
  },
  risk: "Investing in early-stage companies is high risk: you could lose all the money you invest, and you may not be able to sell your shares. DXV does not give investment, tax or legal advice.",
} as const;
