// The Angel Foundations course (/learn): every piece of wording learners see that we wrote,
// apart from the lessons themselves (src/content/course/lessons.json, verbatim from DXV's
// course, never rewritten). DRAFT for Kevin to check. UK English; no em dashes, arrows or emoji.
//
// Consents are stored with the exact wording shown and its version (CourseConsent). Changing
// any consent wording means a new version string here.

export const COURSE_NAME = "Angel Investing Foundations";

/** Education-only disclaimer: kept in the course footer and on every course page. */
export const COURSE_DISCLAIMER =
  "This course is for education only. It is not investment, tax or legal advice. Investing in early-stage companies is high risk: you could lose all the money you invest, and you may not be able to sell your shares. Tax treatment depends on individual circumstances and may change.";

export const COURSE_CONSENTS = {
  AGE: { version: "course-age-v1", wording: "I confirm I am 18 or over." },
  PRIVACY_NOTICE: { version: "course-privacy-v1", wording: "I have read the course privacy notice." },
  SYNDICATE_CONTACT: {
    version: "course-syndicate-contact-v1",
    wording: "I would like DXV to contact me about joining the DXV angel syndicate. (Optional. You can change your mind at any time on your account page.)",
  },
} as const;

/**
 * "Which best describes you?": the learner's own description, so DXV can tell angels from
 * angels-in-training. It is NOT the FCA investor statement: that is signed on the DXV Deal
 * Platform by anyone DXV approves to join, using the approved, versioned wording.
 */
export const DESCRIBES_AS = [
  {
    key: "HIGH_NET_WORTH",
    label: "I may qualify as a high net worth individual",
    statement: "HNW_STATEMENT",
  },
  {
    key: "SOPHISTICATED",
    label: "I may qualify as a sophisticated investor",
    statement: "SOPHISTICATED_STATEMENT",
  },
  { key: "ACTIVE_ANGEL", label: "I already invest in early-stage companies as an angel", statement: null },
  { key: "TRAINING", label: "I'm here to learn: I'm not investing yet", statement: null },
] as const;
export type DescribesAs = (typeof DESCRIBES_AS)[number]["key"];
export const describesAsLabel = (k: string | null) => DESCRIBES_AS.find((d) => d.key === k)?.label ?? "Not answered yet";

/**
 * Shown when DXV has no approved statement wording yet (the criteria come from the approved
 * ComplianceText, the same wording the Deal Platform uses). KEVIN: confirm the current FCA
 * wording (the rules changed in 2024) and approve it under Angels > Statements and terms.
 */
export const FCA_WORDING_PLACEHOLDER = "[PLACEHOLDER: FCA prescribed wording for this statement, to be confirmed by DXV before launch.]";

export const DESCRIBES_AS_NOTE =
  "This helps us understand who is taking the course. It is not a legal statement. If you later join the DXV syndicate, you will be asked to sign the FCA investor statement on the DXV Deal Platform before you see any investment opportunities.";

/** The course privacy notice (UK GDPR). DRAFT for Kevin, alongside DXV's main notice at /privacy. */
export function coursePrivacyNotice(contact: string, controller: string) {
  return [
    {
      title: "Who we are",
      text: [
        `${controller} ("DXV", "we") runs this course and is the controller of the personal data described here. Questions or requests: ${contact}. Our main privacy notice at /privacy has more detail.`,
      ],
    },
    {
      title: "What we collect",
      text: [
        "Your name and email address, so you can sign in and keep your progress.",
        "Your course progress: lessons opened, quiz answers and scores, and any notes you write. Your notes are private to you: the DXV team does not see them.",
        "How you describe yourself (for example, here to learn, or already investing), and whether you would like us to contact you about joining the DXV syndicate.",
        "When you agreed to each statement or consent, and the exact wording you saw.",
        "A scrambled (one-way hashed) version of the internet address you signed up from, used only to stop automated sign-ups.",
      ],
    },
    {
      title: "Why we use it",
      text: [
        "To run the course for you and save your progress across devices (to provide the service you asked for).",
        "To understand who takes the course, so we can improve it and plan our education work (our legitimate interests). We report only combined figures.",
        "To contact you about joining the syndicate, only if you tick that box (your consent). If you do, a DXV partner reviews your request, and if approved you are invited to create a member profile on the DXV Deal Platform.",
        "We do not sell your data or use it for advertising, and we do not use cookies to track you: we use only the cookie that keeps you signed in.",
      ],
    },
    {
      title: "How long we keep it",
      text: [
        "Until you delete it, or 24 months after you last used the course, whichever comes first. Sign-ups that are never confirmed are deleted after 7 days.",
        "If you become a DXV member, your course progress stays with your member login, and our main privacy notice applies to your membership.",
      ],
    },
    {
      title: "Your choices and rights",
      text: [
        "You can withdraw your consent to be contacted at any time on your account page. This does not affect anything we did before you withdrew it.",
        "You can download your course data, or delete it all, on your account page. Deleting closes your course login unless you are a DXV member, in which case only your course data is deleted.",
        `You also have the right to ask for a copy of your data, to correct it, to object, and to complain to the Information Commissioner's Office (ico.org.uk). Contact us first at ${contact} and we will help.`,
      ],
    },
  ];
}
