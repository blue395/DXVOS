// What founders read in the application form's "Founder diversity (optional)" section and
// its consent box: Kevin's signed-off wording (Google Doc "DXV founder diversity wording",
// 5 Nov 2026). EDIT ONLY WITH KEVIN'S SAY-SO; a change to the consent box is a new version
// (bump FOUNDER_DIVERSITY_CONSENT_VERSION and note the date in docs/privacy/founder-data-notes.md:
// founders who applied before consented to the earlier wording).

export const FOUNDER_DIVERSITY_CONSENT_VERSION = "founder-diversity-v2 (2026-11-05)";

export const FOUNDER_DIVERSITY_INTRO = [
  "Diversity X Ventures backs underestimated founders. We actively look for founding teams from groups under-represented in venture funding, including female founders, founders who are people of colour, neurodivergent and disabled founders, founders from socio-economic disadvantaged backgrounds, LGBTQIA+ founders and first time founders over 50.",
  'What you share here forms part of how we assess your application\'s fit with our mission, alongside your pitch deck. It can only count in your favour: leaving it blank or choosing "Prefer not to say" will never count against you. We also combine answers from all founders to produce anonymised statistics for our programme partners, including the British Business Bank.',
  'Answering is entirely voluntary. You can skip any question or choose "Prefer not to say".',
  "Only the DXV team assessing applications can see your answers. Our AI-assisted screening tools process them on our behalf to help us review applications, but a person always makes the decision. We only ever share aggregated statistics that cannot identify you. We delete your answers 24 months after you submit them, or sooner if you withdraw consent.",
];

export const founderDiversityConsent = (email: string) =>
  `I explicitly consent to Diversity X Ventures collecting and using the information I provide below, including information about my ethnicity, health or disability, sexual orientation and age, to assess my application's fit with DXV's mission and for anonymised reporting, as described above. I understand I can withdraw this consent at any time by emailing ${email}, and that withdrawing will not count against my application.`;

export const FOUNDER_DIVERSITY_PICK = "Tick any that apply to your founding team (only if you've ticked the consent box above):";
