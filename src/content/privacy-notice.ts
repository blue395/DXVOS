// DXV's privacy notice (website and platform), as Kevin signed it off on 5 Nov 2026 (Google
// Doc "DXV privacy policy"), published at /privacy. EDIT THE WORDING HERE; a material change
// is a new version: bump PRIVACY_NOTICE_VERSION and the date, and tell members and applicants.
// Square-bracketed items in the draft were approved as written; the website-specific bits
// (Squarespace cookies) and processor regions are for the website's own notice.
//
// PRIVACY_FACTS must be filled in before anyone is invited (complianceReady() checks it):
// UK GDPR requires the notice to say who the controller is and how to contact them.

export const PRIVACY_NOTICE_VERSION = 1;
export const PRIVACY_NOTICE_DATE = "5 November 2026";

export const PRIVACY_FACTS: {
  legalName: string | null; // e.g. "Diversity X Ventures Ltd"
  companyNumber: string | null;
  registeredAddress: string | null;
  dataProtectionLead: string | null; // the person who handles privacy requests
} = {
  legalName: null,
  companyNumber: null,
  registeredAddress: null,
  dataProtectionLead: null,
};

const FACT_LABELS: Record<keyof typeof PRIVACY_FACTS, string> = {
  legalName: "DXV's legal entity name",
  companyNumber: "company number",
  registeredAddress: "registered address",
  dataProtectionLead: "the data protection lead's name",
};

/** What's still missing from the privacy notice (empty: ready to publish). */
export function privacyNoticeGaps(facts = PRIVACY_FACTS): string[] {
  return (Object.keys(FACT_LABELS) as (keyof typeof PRIVACY_FACTS)[]).filter((k) => !facts[k]?.trim()).map((k) => FACT_LABELS[k]);
}

/** A block of the notice. Text may use **bold** for lead-ins. */
export type NoticeBlock = { p: string } | { list: string[] } | { table: { head: string[]; rows: string[][] }; caption?: string };
export type NoticeSection = { title: string; blocks: NoticeBlock[] };

export function privacyNotice(email: string, facts = PRIVACY_FACTS): NoticeSection[] {
  const f = (v: string | null, label: string) => v?.trim() || `[${label}]`;
  return [
    {
      title: "1. Who we are",
      blocks: [
        {
          p: `Diversity X Ventures ("DXV", "we") is a UK angel syndicate that backs underestimated founders at pre-seed and seed stage. ${f(facts.legalName, "Legal entity name")}, company number ${f(facts.companyNumber, "company number")}, ${f(facts.registeredAddress, "registered address")}, is the controller of the personal data described here.`,
        },
        { p: `Questions, requests or complaints: ${email}. ${f(facts.dataProtectionLead, "Name")}, our data protection lead, handles them.` },
      ],
    },
    {
      title: "2. Who this notice covers",
      blocks: [
        {
          list: [
            "**Website visitors** to diversityxventures.com.",
            "**Founders** who apply through our application form or send us a pitch deck, and the people named in their applications.",
            "**Members and prospective members**: angel investors we invite to join, and those who use the DXV OS member portal.",
            "**DXV's partners and team** who use DXV OS to run the syndicate.",
          ],
        },
      ],
    },
    {
      title: "3. What we collect and why",
      blocks: [
        {
          caption: "Founders",
          table: {
            head: ["Data", "Source", "What we use it for", "Legal basis"],
            rows: [
              [
                "Names, email, company details, website, LinkedIn, how you heard of us",
                "You, on the application form",
                "Assessing your application, keeping in touch about it",
                "Legitimate interests (running our investment process)",
              ],
              [
                "Your pitch deck and anything you send us",
                "You",
                "Assessing your application; if you progress, sharing with DXV's certified members",
                "Legitimate interests",
              ],
              [
                "Our notes, eligibility screens, investment memos, decisions and emails to you",
                "DXV team, with AI-assisted tools (section 5)",
                "Deciding whether to invest, and learning from our dealflow",
                "Legitimate interests",
              ],
              ["Optional founder diversity information", "You, if you choose to share it", "See section 4", "Explicit consent"],
              ["A one-way scrambled form of your IP address", "Your browser", "Stopping spam and abuse of the form", "Legitimate interests (security)"],
            ],
          },
        },
        {
          caption: "Members and prospective members",
          table: {
            head: ["Data", "Source", "What we use it for", "Legal basis"],
            rows: [
              [
                "Name, contact details, sign-in details (password or Google / Microsoft account)",
                "You, or DXV when we invite you",
                "Your account and membership",
                "Contract",
              ],
              [
                "Investor statement (high net worth or sophisticated investor), the wording signed, typed name, date and IP address",
                "You",
                "Showing that we only share investment opportunities with people the law allows",
                "Legal obligation (Financial Promotion Order)",
              ],
              [
                "Profile answers: location, sectors, typical cheque, experience, a short bio",
                "You",
                "Matching you with deals and roles in the syndicate",
                "Contract",
              ],
              ["Votes, expressions of interest, investments, payments", "You and DXV", "Running each deal and your investment", "Contract"],
              ["Your private portfolio (investments you add yourself)", "You", "Showing you your own portfolio; DXV's team can't see it", "Contract"],
              [
                "Pages of the member portal you visit (by type, not content)",
                "Generated by the platform",
                "Understanding how members use DXV OS, to improve it",
                "Legitimate interests",
              ],
              ["Optional diversity information", "You, if you choose to answer", "See section 4", "Explicit consent"],
            ],
          },
        },
        {
          caption: "Everyone",
          table: {
            head: ["Data", "Source", "What we use it for", "Legal basis"],
            rows: [
              [
                "Emails we send you and a record of them",
                "DXV",
                "Service emails about your application, account or deals; member updates you can unsubscribe from",
                "Legitimate interests; consent for marketing where the law requires it",
              ],
              [
                "Security records (sign-in attempts with a scrambled IP address, one-time link records)",
                "Generated by the platform",
                "Keeping accounts secure",
                "Legitimate interests (security)",
              ],
            ],
          },
        },
      ],
    },
    {
      title: "4. Diversity information",
      blocks: [
        {
          p: 'If you choose to answer our diversity questions, we process information about you such as your sex or gender, age, ethnicity, disability or neurodivergence, religion or belief, sexual orientation and background. Some of this is special category data under UK data protection law. We rely on your explicit consent to process it (Article 6(1)(a) and Article 9(2)(a) UK GDPR). Answering is always optional, and you can choose "Prefer not to say".',
        },
        {
          p: "**If you are a founder applying to DXV.** You can tell us whether your founding team includes a Female Founder, Person of Colour Founder, Neurodivergent Founder, Disabled Founder, Founder from socio-economic disadvantaged background, LGBTQIA+ Founder or First time founder over 50 (or Immigrant, Not university educated, Experienced homelessness, Experienced Care). DXV backs underestimated founders, so what you share forms part of how we assess your application's fit with our mission, alongside your deck. It can only count in your favour. Only the DXV team assessing applications sees it, and our AI-assisted screening tools process it on our behalf (section 5). We also combine founders' answers into anonymised statistics for our programme partners, including the British Business Bank.",
        },
        {
          p: "**If you are a member.** We use your answers only to monitor and improve representation across our programmes, and to produce anonymised, combined reports for our partners, including the British Business Bank. We never use them to make decisions about you. We never publish a figure for a group of fewer than 10 people, and we never share your answers in a form that identifies you. You can change or withdraw your answers at any time in your profile.",
        },
        {
          p: `**For everyone.** Members' answers are kept separate from the rest of their profile, and a team member can only open them with a recorded reason. Founders' answers are kept with their application, which only the DXV team can see, never members. We delete it 24 months after collection, or sooner if you withdraw consent or close your account. You can withdraw consent at any time by emailing ${email} (members can also do it in their profile). Withdrawing doesn't affect any processing before you withdrew, or your membership.`,
        },
      ],
    },
    {
      title: "5. AI-assisted tools",
      blocks: [
        {
          p: "We use AI to help the DXV team work through applications. It drafts an eligibility screen of each pitch deck against our published criteria, a first draft of an investment memo, short deal summaries for the partners, and answers to the team's questions in an internal assistant. For founders, it reads your deck and what you told us in your application, including any diversity information you chose to share.",
        },
        {
          p: "The AI only suggests. A DXV partner reads, edits and decides every time, so no decision about you is made by automated means alone (Article 22 UK GDPR). Members' diversity answers are never sent to the AI.",
        },
        {
          p: "The AI is Claude, provided by Anthropic, which acts as our processor: it processes the data only to give us its output, under contract, and does not use it to train its models.",
        },
      ],
    },
    {
      title: "6. Who we share data with",
      blocks: [
        {
          list: [
            "**DXV's certified members**, if a founder's company goes forward: its pitch deck, our issued investment memo and documents for that deal. Never eligibility screens, AI drafts, internal notes, other members' votes or diversity information.",
            "**Service providers** who process data for us under contract: Netlify (hosts DXV OS), Supabase (database and document storage), Google Workspace (our email, and Google sign-in if you use it), Microsoft (Microsoft sign-in, if you use it), Anthropic (AI-assisted tools, section 5; United States) and Squarespace (our website).",
            "**Partners and funders**, including the British Business Bank: anonymised, combined statistics only, never anything that identifies you.",
            "**Others where needed**: a deal's special purpose vehicle (SPV) and its advisers for members who invest (we tell you what before you invest), and anyone we're required to tell by law.",
          ],
        },
        { p: "We don't sell personal data." },
        {
          p: "**Transfers outside the UK.** Some providers process data outside the UK, including in the United States. Where they do, we rely on the UK Extension to the EU-US Data Privacy Framework or the UK addendum to the EU standard contractual clauses, depending on the provider. Ask us for details.",
        },
      ],
    },
    {
      title: "7. How long we keep data",
      blocks: [
        {
          table: {
            head: ["Data", "How long"],
            rows: [
              ["Diversity information (members and founders)", "24 months after collection, or until you withdraw consent or close your account, if sooner"],
              [
                "Founder applications, decks, our assessments and decisions",
                "6 years after our decision, including for declined applications, so we can learn from our dealflow and answer questions about past decisions",
              ],
              [
                "Member account and profile",
                "While you're a member. If you're inactive for 24 months we email you, and delete your account 30 days later unless you sign in",
              ],
              ["Investor statements, votes and investment records", "6 years after membership ends, for legal, tax and SPV records"],
              ["Your private portfolio", "Until you remove it or close your account"],
              ["Sign-in attempt records (scrambled IP)", "30 days"],
              ["One-time sign-in and reset link records", "90 days"],
              ["Backups", "Overwritten within 30 days"],
            ],
          },
        },
        {
          p: "When you close your account, or we delete it, we erase your personal details. Anonymous figures, such as a deal's total investment, stay in our records.",
        },
      ],
    },
    {
      title: "8. Your rights",
      blocks: [
        { p: "You can ask us to:" },
        {
          list: [
            "give you a copy of your data (members can download most of it from their profile);",
            "correct it;",
            "delete it (members can delete their account from their profile);",
            "restrict or object to how we use it;",
            "move it to another provider, where that applies;",
            "and you can withdraw consent at any time, including for diversity information.",
          ],
        },
        {
          p: `Email ${email}. We reply within one month. Some rights have limits, for example where we must keep investment records by law, and we'll explain if so.`,
        },
        {
          p: "If you're unhappy with how we've handled your data, please tell us first. You can also complain to the Information Commissioner's Office (ico.org.uk, 0303 123 1113).",
        },
      ],
    },
    {
      title: "9. Security, cookies, children and changes",
      blocks: [
        {
          p: "**Security.** Data is encrypted in transit and at rest. Only DXV's team can sign in to the team side of DXV OS. Members' diversity answers sit in a separate, locked-down part of the database that the rest of the platform can't read, and every time a team member opens one it is logged.",
        },
        { p: "**Cookies.** DXV OS uses only the cookies needed to keep you signed in. No tracking or advertising cookies." },
        { p: "**Children.** DXV OS is for people aged 18 and over." },
        {
          p: "**Changes.** We'll update this notice when how we use data changes, and tell members and applicants about material changes. We'll ask for consent again before using diversity information for a new purpose.",
        },
      ],
    },
  ];
}
