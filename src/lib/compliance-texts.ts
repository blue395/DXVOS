// The legal wording angels see: the two FCA investor statements and DXV's member terms.
// These are the STARTING DRAFTS only. The wording in use lives in the database
// (ComplianceText), versioned, and angels only ever see a version an admin approved.
//
// The statements follow the Financial Services and Markets Act 2000 (Financial Promotion)
// Order 2005, Schedule 5, as amended in 2024. They must match the Order word for word:
// Kevin to check against legislation.gov.uk before approving. Pure; no imports.

export type ComplianceKind = "HNW_STATEMENT" | "SOPHISTICATED_STATEMENT" | "MEMBER_TERMS";

export type ComplianceDraft = { kind: ComplianceKind; title: string; body: string; criteria: string[] };

export const COMPLIANCE_KIND_LABELS: Record<ComplianceKind, string> = {
  HNW_STATEMENT: "High net worth individual statement",
  SOPHISTICATED_STATEMENT: "Self-certified sophisticated investor statement",
  MEMBER_TERMS: "DXV member terms and privacy notice",
};

/** Which certification a signed statement records. */
export const STATEMENT_CERT_TYPE = {
  HNW_STATEMENT: "HIGH_NET_WORTH",
  SOPHISTICATED_STATEMENT: "SELF_CERTIFIED_SOPHISTICATED",
} as const;

export const DEFAULT_COMPLIANCE_TEXTS: Record<ComplianceKind, ComplianceDraft> = {
  HNW_STATEMENT: {
    kind: "HNW_STATEMENT",
    title: "Statement for certified high net worth individual",
    body: `This statement is for use by individuals who are high net worth under the Financial Services and Markets Act 2000 (Financial Promotion) Order 2005.

I make this statement so that I can receive promotional communications which are exempt from the restriction on promotion of investments in the Financial Services and Markets Act 2000. The exemption relates to certified high net worth individuals and I declare that I qualify as such because at least one of the following applies to me (ticked below).

Net assets for these purposes do not include: the property which is my primary residence or any money raised through a loan secured on that property; any rights of mine under a qualifying contract of insurance; or any benefits (in the form of pensions or otherwise) which are payable on the termination of my service or on my death or retirement and to which I am (or my dependants are) entitled.

I accept that the investments to which the promotions will relate may expose me to a significant risk of losing all of the money or other property invested. I am aware that it is open to me to seek advice from someone who specialises in advising on investments of this kind.`,
    criteria: [
      "I had, throughout the financial year immediately preceding the date below, an annual income of £100,000 or more. Income does not include money withdrawn from my pension savings (except where the withdrawals are used directly for income in retirement).",
      "I held, throughout the financial year immediately preceding the date below, net assets to the value of £250,000 or more.",
    ],
  },
  SOPHISTICATED_STATEMENT: {
    kind: "SOPHISTICATED_STATEMENT",
    title: "Statement for self-certified sophisticated investor",
    body: `This statement is for use by individuals who are self-certified sophisticated investors under the Financial Services and Markets Act 2000 (Financial Promotion) Order 2005.

I declare that I am a self-certified sophisticated investor for the purposes of the Financial Services and Markets Act 2000 (Financial Promotion) Order 2005. I understand that this means I can receive financial promotions that may not have been approved by a person authorised by the Financial Conduct Authority, and that the content of such financial promotions may not conform to rules issued by the Financial Conduct Authority.

I declare that I qualify as a self-certified sophisticated investor because at least one of the following applies to me (ticked below).

I accept that the investments to which the promotions will relate may expose me to a significant risk of losing all of the money or other property invested. I am aware that it is open to me to seek advice from someone who specialises in advising on investments of this kind.`,
    criteria: [
      "I am a member of a network or syndicate of business angels and have been so for at least the last six months prior to the date below.",
      "I have made more than one investment in an unlisted company in the two years prior to the date below.",
      "I am working, or have worked in the two years prior to the date below, in a professional capacity in the private equity sector, or in the provision of finance for small and medium enterprises.",
      "I am currently, or have been in the two years prior to the date below, a director of a company with an annual turnover of at least £1 million.",
    ],
  },
  MEMBER_TERMS: {
    kind: "MEMBER_TERMS",
    title: "DXV member terms and privacy notice",
    body: `Welcome to the Diversity X Ventures (DXV) syndicate portal.

Investing. DXV shares early-stage investment opportunities with members who hold a current high net worth or sophisticated investor statement. Investing in early-stage companies is high risk: you could lose all the money you invest, investments are hard to sell, returns are rare and take years, and tax reliefs (SEIS/EIS) depend on individual circumstances and can be withdrawn. DXV does not give investment, tax or legal advice: every decision to invest is yours. Consider taking independent advice.

Confidentiality. Deal materials (pitch decks, memos, terms and documents) are shared with you in confidence. Please don't copy, forward or share them outside DXV, or use them for anything other than considering the investment.

Your data. DXV stores the details you give us (contact details, investment interests, your investor statement and your investment activity) to run the syndicate, to meet our obligations on financial promotions, and to keep you informed. Details about yourself that you choose to share (such as tags) are optional and you can remove them at any time. We don't share your details with other members or third parties without your permission, except where the law requires. You can ask us for a copy of your data, to correct it, or to delete it, by contacting the DXV team.

Leaving. You can leave the syndicate at any time by telling the DXV team.`,
    criteria: [],
  },
};
