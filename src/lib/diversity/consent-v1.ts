// Wording version diversity-consent-v1: the member-facing consent screen, VERBATIM from
// docs/privacy/consent-copy-and-privacy-notice.md (Blue, 2026-10-23; a test checks every
// string below appears there word for word). Never edit this file: a material change is a
// new file (consent-v2.ts) with a new version, and members are asked to re-confirm.
//
// Answer lists the copy leaves as "[list]" / "[options]" are DXV additions (the ONS 2021
// census lists, and the background items Blue moved from the old "About you" pills): they
// live in questions.ts, flagged for sign-off, and are not part of this wording.
//
// Pure (no server imports): used by the consent screen and by tests.

export const CONSENT_VERSION = "diversity-consent-v1";

export const CONSENT_V1 = {
  heading: "Help us see who we're reaching (optional)",
  intro: [
    "Diversity X Ventures exists to widen who invests in impact startups. If you choose, you can tell us about yourself so we can see whether we're reaching the people we want to, and improve how we do it.",
    "This is entirely your choice. Joining, deal access and how we treat you are exactly the same whether you answer or not. You can skip any question, change your answers or delete them at any time in your profile.",
  ],
  howWeUseLabel: "How we use your answers:",
  howWeUse:
    "only as combined statistics, in groups of at least 10 people, to report on our impact and to improve our programmes. We never show your individual answers to founders, other angels, funders or anyone outside a small named DXV team, and we never use them to decide anything about you.",
  questions: {
    disability: "Do you have a disability, or are you neurodivergent?",
    sexualOrientation: "How would you describe your sexual orientation?",
    ethnicGroup: "What is your ethnic group?",
    religion: "What is your religion or belief?",
    gender: "How do you describe your gender?",
    background: "Background: did you go to a state school; are you the first in your family to go to university?",
  },
  disabilityOptions: ["Yes, disability", "Yes, neurodivergent", "Yes, both", "No"],
  preferNotToSay: "Prefer not to say",
  selfDescribe: "Prefer to self-describe",
  religionNone: "None",
  freeTextNote: "Please don't include anything that identifies another person.",
  // One per category, shown only for categories the member has answered. {bold} is the
  // emphasised part of each sentence in the copy.
  consentBoxes: {
    health: { before: "I explicitly consent to Diversity X Ventures storing my answer about ", bold: "disability or neurodivergence", after: " (health information) and using it in combined statistics as described above." },
    sexual_orientation: { before: "I explicitly consent to Diversity X Ventures storing my answer about ", bold: "sexual orientation", after: " and using it in combined statistics as described above." },
    ethnicity: { before: "I explicitly consent to Diversity X Ventures storing my answer about ", bold: "ethnic group", after: " and using it in combined statistics as described above." },
    religion: { before: "I explicitly consent to Diversity X Ventures storing my answer about ", bold: "religion or belief", after: " and using it in combined statistics as described above." },
    gender_background: { before: "I agree to Diversity X Ventures storing my answers about ", bold: "gender and background", after: " and using them in combined statistics as described above." },
  },
  // "[privacy notice]" in the copy is a link.
  belowBoxes: { before: "You can withdraw consent at any time in ", bold: "Profile > My diversity information", middle: ", and we'll delete these answers. Withdrawing doesn't affect anything we did before. Our ", link: "privacy notice", after: " explains more, including who we are and your rights." },
  saveButton: "Save my answers",
  skipButton: "Skip for now",
  notSaved: "We haven't saved this answer because consent wasn't given. You can add it any time",
  // Other in-app copy (profile).
  profileHeading: "Your answers are private. They are only used in combined statistics (groups of 10 or more) and are never shown to founders, angels or funders.",
  profileChange: "Update your answer. We'll ask you to confirm consent again for the changed category.",
  profileWithdraw: "Remove my diversity information. This deletes your answers and stops us using them. It doesn't affect your membership.",
  withdrawDone: "Done. Your diversity answers have been deleted. They may remain in backups for up to [30 days], and combined statistics already published can't be traced to you.",
  downloadMyData: "Download everything we hold about you.",
  deleteAccount: "Delete my account and all my data.",
} as const;
